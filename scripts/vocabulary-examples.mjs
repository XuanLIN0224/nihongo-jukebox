import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kotobakoPath = path.join(rootDir, "node_modules/kotobako-data/kotobako-static.json");

function loadKotobakoEntries() {
  try {
    const payload = JSON.parse(fs.readFileSync(kotobakoPath, "utf8"));
    return payload.datasets?.vocab ?? [];
  } catch {
    return [];
  }
}

const kotobakoEntries = loadKotobakoEntries();
const entriesBySurface = new Map();

for (const entry of kotobakoEntries) {
  for (const surface of [entry.word, entry.altWord, entry.reading].filter(Boolean)) {
    if (!entriesBySurface.has(surface)) entriesBySurface.set(surface, []);
    entriesBySurface.get(surface).push(entry);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMeanings(value) {
  return cleanText(value)
    .replace(/参考：/g, "")
    .split(/\s*[;；,，]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstEnglish(value) {
  const segment = splitMeanings(value).find(Boolean) || "this idea";
  return segment.replace(/^to\s+/i, "").replace(/^a\s+/i, "").trim();
}

function usableChinese(value) {
  const text = splitMeanings(value).find((item) => /[\u3400-\u9fff]/.test(item) && !/[A-Za-z]/.test(item));
  return text || "";
}

function chineseLabel(word, zh, en) {
  const text = usableChinese(zh);
  if (text) return text;
  const english = firstEnglish(en);
  return `「${word}」（${english}）`;
}

function hasAny(value, words) {
  const lower = cleanText(value).toLowerCase();
  return words.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(lower);
  });
}

function hashSeed(...parts) {
  return parts
    .join("|")
    .split("")
    .reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 7);
}

function pick(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function findKotobakoEntry(word) {
  const candidates = [
    ...(entriesBySurface.get(word.japanese) ?? []),
    ...(entriesBySurface.get(word.kana) ?? [])
  ];
  if (!candidates.length) return null;
  const scored = candidates
    .map((entry) => {
      let score = 0;
      if (entry.word === word.japanese) score += 5;
      if (entry.altWord === word.japanese) score += 4;
      if (entry.reading === word.kana) score += 4;
      if (entry.word === word.kana) score += 2;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.entry ?? null;
}

function meaningText(word, entry) {
  return cleanText(entry?.meanings?.join("; ") || word.en || "");
}

function partOfSpeech(word, entry) {
  if (entry?.pos) return entry.pos;
  const meaning = meaningText(word, entry);
  if (isIAdjective(word.japanese, meaning)) return "i-adjective";
  if (isNaAdjective(word.japanese, meaning)) return "na-adjective";
  if (hasVerbSignal(word.japanese, meaning, word.kana, "")) return "verb";
  if (isAdverb(word.japanese, meaning, "")) return "adverb";
  return "noun";
}

function exampleSurface(word, entry) {
  let surface = "";
  if (entry?.altWord === word.japanese && entry.word && entry.reading === word.kana) {
    surface = entry.word;
  } else if (entry?.word === word.kana && entry.reading === word.kana) {
    surface = entry.word;
  } else {
    surface = (cleanText(word.japanese) || cleanText(word.kana) || "言葉").split(/\s*\/\s*/)[0];
  }

  if (surface === "～周年") return "創立十周年";
  if (surface === "～商事") return "山田商事";
  if (surface === "～回戦") return "一回戦";
  if (surface === "～票") return "一票";
  if (surface === "～の念") return "感謝の念";
  if (surface === "～の鍵") return "成功の鍵";
  if (surface === "～の手前") return "世間の手前";
  if (surface === "～を追われる") return "故郷を追われる";

  return surface
    .replace(/^～に/, "仕事に")
    .replace(/^～/, "創立")
    .replace(/～$/u, "予定")
    .replace(/（[^）]+）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function hasVerbSignal(surface, en, kana, pos) {
  const lower = cleanText(en).toLowerCase();
  const lowerPos = cleanText(pos).toLowerCase();
  return (
    lower.startsWith("to ") ||
    lower.includes("; to ") ||
    /する/.test(kana) ||
    /する$/.test(surface) ||
    lowerPos.includes("godan verb") ||
    lowerPos.includes("ichidan verb") ||
    lowerPos === "verb" ||
    (lowerPos.includes("verb") && !lowerPos.includes("noun")) ||
    /[うくぐすつぬぶむる]$/.test(surface)
  );
}

function isIAdjective(surface, en) {
  if (!/[い]$/.test(surface) || /する$/.test(surface)) return false;
  return hasAny(en, [
    "big",
    "small",
    "large",
    "little",
    "long",
    "short",
    "high",
    "low",
    "old",
    "new",
    "hot",
    "cold",
    "warm",
    "cool",
    "easy",
    "difficult",
    "hard",
    "fast",
    "slow",
    "bright",
    "dark",
    "wide",
    "narrow",
    "dirty",
    "correct",
    "wrong",
    "bad",
    "good",
    "sweet",
    "weak",
    "strong",
    "thin",
    "thick",
    "stupid",
    "scary",
    "black",
    "white",
    "red",
    "blue",
    "light"
  ]);
}

function isNaAdjective(surface, en) {
  return (
    ["静か", "賑やか", "有名", "大切", "必要", "元気", "上手", "下手", "好き", "大好き", "嫌い", "綺麗", "清潔", "正式", "不便"].includes(surface) ||
    hasAny(en, ["quiet", "famous", "important", "necessary", "healthy", "skillful", "poor at", "like", "beautiful", "clean", "official", "inconvenient"])
  );
}

function isAdverb(surface, en, pos) {
  const lowerPos = cleanText(pos).toLowerCase();
  if (lowerPos.includes("adverb") && !lowerPos.includes("noun")) return true;
  if (/に$/.test(surface) && !lowerPos.includes("noun")) return true;
  if (lowerPos) return false;
  return hasAny(en, [
    "always",
    "usually",
    "often",
    "sometimes",
    "occasionally",
    "perhaps",
    "maybe",
    "possibly",
    "already",
    "still",
    "soon",
    "suddenly",
    "gradually",
    "slowly",
    "quickly",
    "very",
    "quite",
    "rather",
    "somewhere",
    "anywhere",
    "especially",
    "particularly",
    "greatly"
  ]);
}

function wordKind(word, entry, surface, en, pos) {
  const lowerPos = cleanText(pos).toLowerCase();
  if (lowerPos.includes("interjection") || lowerPos.includes("expression") || hasAny(en, ["take care", "excuse me", "hello", "goodbye", "thank"])) {
    return "expression";
  }
  if (lowerPos.includes("adj-pn")) return "adnominal";
  if (lowerPos.includes("noun") && hasAny(en, ["week", "month", "year", "morning", "evening", "night", "afternoon", "birthday", "birth date", "today", "tomorrow", "yesterday", "time", "day"])) {
    return "noun";
  }
  if (lowerPos.includes("noun") && hasAny(en, ["somewhere", "anywhere", "here and there"])) {
    return "adverb";
  }
  if (isIAdjective(surface, en) || lowerPos.includes("i-adjective")) return "iAdjective";
  if (isNaAdjective(surface, en) || lowerPos.includes("na-adjective")) return "naAdjective";
  if (isAdverb(surface, en, pos)) return "adverb";
  if (hasVerbSignal(surface, en, word.kana, pos)) return "verb";
  if (lowerPos.includes("pronoun")) return "pronoun";
  return "noun";
}

function verbSurface(surface, word, pos) {
  if (surface.endsWith("する")) return surface;
  if (/する/.test(word.kana) || cleanText(pos).toLowerCase().includes("suru verb")) return `${surface}する`;
  return surface;
}

function createExample(exampleJp, exampleZh, exampleEn, partOfSpeech) {
  return { exampleJp, exampleZh, exampleEn, partOfSpeech };
}

const nounRules = [
  {
    words: ["東京ドーム", "Tokyo Dome"],
    build: (w, zh, en, pos) => createExample(
      `${w}で野球の試合を見た。`,
      `在东京巨蛋看了棒球比赛。`,
      `I watched a baseball game at Tokyo Dome.`,
      pos
    )
  },
  {
    words: ["ミュンヘン", "Munich"],
    build: (w, zh, en, pos) => createExample(
      `${w}で国際会議が開かれた。`,
      `国际会议在慕尼黑举行。`,
      `An international conference was held in Munich.`,
      pos
    )
  },
  {
    words: ["樽", "cask", "barrel"],
    build: (w, zh, en, pos) => createExample(
      `ワインを古い${w}で熟成させた。`,
      `葡萄酒在旧木桶里熟成。`,
      `The wine was aged in an old barrel.`,
      pos
    )
  },
  {
    words: ["ヘクタール", "hectare", "公顷"],
    build: (w, zh, en, pos) => createExample(
      `その農園は五${w}の広さがある。`,
      `那座农园有五公顷大。`,
      `The farm covers five hectares.`,
      pos
    )
  },
  {
    words: ["便器", "toilet bowl", "马桶"],
    build: (w, zh, en, pos) => createExample(
      `古い${w}を新しいものに交換した。`,
      `把旧马桶换成了新的。`,
      `The old toilet bowl was replaced with a new one.`,
      pos
    )
  },
  {
    words: ["スペース", "space", "空间"],
    build: (w, zh, en, pos) => createExample(
      `机の横に本棚を置く${w}を作った。`,
      `在桌子旁边腾出了放书架的空间。`,
      `I made space beside the desk for a bookshelf.`,
      pos
    )
  },
  {
    words: ["ペース", "pace", "步调", "进度"],
    build: (w, zh, en, pos) => createExample(
      `無理のない${w}で走り続けた。`,
      `以不勉强的节奏继续跑。`,
      `I kept running at a comfortable pace.`,
      pos
    )
  },
  {
    words: ["祭典", "祭礼", "festival", "ceremony", "celebration"],
    build: (w, zh, en, pos) => createExample(
      `地域の${w}に多くの人が集まった。`,
      `很多人聚集到当地的${zh}。`,
      `Many people gathered for the local ${en}.`,
      pos
    )
  },
  {
    words: ["周年", "anniversary"],
    build: (w, zh, en, pos) => createExample(
      `${w}を記念して式典が開かれた。`,
      `为了纪念${zh}举行了典礼。`,
      `A ceremony was held to mark the ${en}.`,
      pos
    )
  },
  {
    words: ["開幕", "opening"],
    build: (w, zh, en, pos) => createExample(
      `映画祭の${w}に合わせて町がにぎわった。`,
      `配合电影节开幕，城镇热闹了起来。`,
      `The town became lively for the opening of the film festival.`,
      pos
    )
  },
  {
    words: ["敷地", "site", "premises", "用地", "地皮"],
    build: (w, zh, en, pos) => createExample(
      `新しい図書館は広い${w}に建てられた。`,
      `新图书馆建在宽阔的用地上。`,
      `The new library was built on a large site.`,
      pos
    )
  },
  {
    words: ["本場", "birthplace", "home of", "authentic", "正宗"],
    build: (w, zh, en, pos) => createExample(
      `${w}の味を知りたくて、その町を訪れた。`,
      `想了解正宗的味道，于是去了那座城镇。`,
      `I visited the town because I wanted to experience the authentic taste.`,
      pos
    )
  },
  {
    words: ["節目", "milestone", "turning point", "阶段", "段落"],
    build: (w, zh, en, pos) => createExample(
      `卒業は人生の大きな${w}になる。`,
      `毕业会成为人生的一个重要阶段。`,
      `Graduation becomes a major milestone in life.`,
      pos
    )
  },
  {
    words: ["連日", "successive days", "day after day", "连日"],
    build: (w, zh, en, pos) => createExample(
      `${w}の雨で川の水位が上がった。`,
      `连日下雨使河水水位上涨。`,
      `The river rose after rain for successive days.`,
      pos
    )
  },
  {
    words: ["集客", "attracting customers", "吸引客人", "招揽客人"],
    build: (w, zh, en, pos) => createExample(
      `店は週末の${w}に力を入れている。`,
      `店铺正在努力吸引周末的客人。`,
      `The shop is focusing on attracting customers on weekends.`,
      pos
    )
  },
  {
    words: ["気味", "slightly", "a touch of", "有点"],
    build: (w, zh, en, pos) => createExample(
      `発表の前で、彼は少し緊張${w}だった。`,
      `发表前，他有点紧张。`,
      `He seemed slightly nervous before the presentation.`,
      pos
    )
  },
  {
    words: ["遺伝学", "genetics"],
    build: (w, zh, en, pos) => createExample(
      `大学で${w}を学び、病気の仕組みに興味を持った。`,
      `在大学学习遗传学后，对疾病机制产生了兴趣。`,
      `After studying genetics at university, I became interested in how diseases work.`,
      pos
    )
  },
  {
    words: ["責任逃れ", "avoid responsibility", "逃避责任"],
    build: (w, zh, en, pos) => createExample(
      `失敗の後で${w}をする態度は信頼を失う。`,
      `失败后逃避责任的态度会失去信任。`,
      `An attitude of avoiding responsibility after a failure destroys trust.`,
      pos
    )
  },
  {
    words: ["著作権", "copyright"],
    build: (w, zh, en, pos) => createExample(
      `作品を公開する前に${w}を確認した。`,
      `公开作品前确认了著作权。`,
      `I checked the copyright before publishing the work.`,
      pos
    )
  },
  {
    words: ["予算", "budget"],
    build: (w, zh, en, pos) => createExample(
      `限られた${w}の中で旅行の計画を立てた。`,
      `在有限预算内制定了旅行计划。`,
      `I planned the trip within a limited budget.`,
      pos
    )
  },
  {
    words: ["議会", "assembly", "parliament", "council"],
    build: (w, zh, en, pos) => createExample(
      `${w}で新しい条例について議論された。`,
      `议会上讨论了新的条例。`,
      `The council discussed the new ordinance.`,
      pos
    )
  },
  {
    words: ["承認", "approval", "approve", "承认"],
    build: (w, zh, en, pos) => createExample(
      `計画は上司の${w}を得てから進める。`,
      `计划获得上司批准后再推进。`,
      `The plan will proceed after receiving the manager's approval.`,
      pos
    )
  },
  {
    words: ["ご近所同士", "neighbors", "neighbours"],
    build: (w, zh, en, pos) => createExample(
      `${w}で防災について話し合った。`,
      `邻里之间讨论了防灾问题。`,
      `The neighbors discussed disaster prevention together.`,
      pos
    )
  },
  {
    words: ["vendor", "dealer", "trader", "contractor", "業者"],
    build: (w, zh, en, pos) => createExample(
      `信頼できる${w}に修理を頼んだ。`,
      `委托了可靠的业者来修理。`,
      `I asked a reliable contractor to handle the repair.`,
      pos
    )
  },
  {
    words: ["free of charge", "no charge"],
    build: (w, zh, en, pos) => createExample(
      `このイベントの入場料は${w}だった。`,
      `这个活动的入场费是免费的。`,
      `Admission to this event was free of charge.`,
      pos
    )
  },
  {
    words: ["相対", "confrontation", "facing", "no third party", "tete-a-tete"],
    build: (w, zh, en, pos) => createExample(
      `${w}で条件を話し合った。`,
      `面对面地讨论了条件。`,
      `We discussed the terms face to face.`,
      pos
    )
  },
  {
    words: ["full house", "no vacancy", "sold out", "満員"],
    build: (w, zh, en, pos) => createExample(
      `電車は${w}で、入口まで人が立っていた。`,
      `电车满员了，连入口处都站满了人。`,
      `The train was full, with people standing all the way to the doors.`,
      pos
    )
  },
  {
    words: ["only", "sole", "unique"],
    build: (w, zh, en, pos) => createExample(
      `${w}の方法で問題を解決した。`,
      `用唯一的方法解决了问题。`,
      `I solved the problem with the only available method.`,
      pos
    )
  },
  {
    words: ["agreement", "same opinion", "same feeling", "concurrence"],
    build: (w, zh, en, pos) => createExample(
      `彼の意見に${w}して、深くうなずいた。`,
      `赞同他的意见，于是深深地点了点头。`,
      `I agreed with his opinion and nodded deeply.`,
      pos
    )
  },
  {
    words: ["development", "construction", "exploitation"],
    build: (w, zh, en, pos) => createExample(
      `新しいサービスの${w}が予定より早く進んでいる。`,
      `新服务的${zh}比计划推进得更快。`,
      `The ${en} of the new service is moving ahead of schedule.`,
      pos
    )
  },
  {
    words: ["hospitalization", "hospitalisation", "hospital admission"],
    build: (w, zh, en, pos) => createExample(
      `祖父の${w}が決まり、家族で準備をした。`,
      `祖父确定要住院后，家人一起做了准备。`,
      `After my grandfather's hospitalization was decided, the family prepared together.`,
      pos
    )
  },
  {
    words: ["subscription", "subscribe"],
    build: (w, zh, en, pos) => createExample(
      `好きな雑誌の${w}を申し込んだ。`,
      `申请订阅了喜欢的杂志。`,
      `I subscribed to a magazine I like.`,
      pos
    )
  },
  {
    words: ["free time", "leisure", "spare time"],
    build: (w, zh, en, pos) => createExample(
      `週末に${w}があれば、映画を見に行きたい。`,
      `周末如果有空，想去看电影。`,
      `If I have free time on the weekend, I want to go see a movie.`,
      pos
    )
  },
  {
    words: ["night travel", "overnight", "夜行"],
    build: (w, zh, en, pos) => createExample(
      `夜行バスで東京へ向かった。`,
      `坐夜行巴士去了东京。`,
      `I headed to Tokyo on an overnight bus.`,
      pos
    )
  },
  {
    words: ["today", "tomorrow", "yesterday"],
    build: (w, zh, en, pos) => createExample(
      `${w}は早めに家を出た。`,
      `${zh}早早出了门。`,
      `I left home early ${en}.`,
      pos
    )
  },
  {
    words: ["company", "corporation", "workplace"],
    build: (w, zh, en, pos) => createExample(
      `駅前の${w}で新しい仕事が始まった。`,
      `在车站前的公司开始了新工作。`,
      `I started a new job at the company in front of the station.`,
      pos
    )
  },
  {
    words: ["attached", "affiliated", "belonging"],
    build: (w, zh, en, pos) => createExample(
      `大学に${w}する病院で実習した。`,
      `在大学附属医院实习了。`,
      `I trained at a hospital affiliated with the university.`,
      pos
    )
  },
  {
    words: ["browsing", "viewing", "reading", "inspection"],
    build: (w, zh, en, pos) => createExample(
      `資料の${w}には事前の予約が必要だ。`,
      `阅览资料需要提前预约。`,
      `Viewing the materials requires an advance reservation.`,
      pos
    )
  },
  {
    words: ["visit to japan", "arrival in japan"],
    build: (w, zh, en, pos) => createExample(
      `友人の${w}に合わせて、週末の予定を空けた。`,
      `配合朋友来日本，空出了周末的时间。`,
      `I kept the weekend free for my friend's visit to Japan.`,
      pos
    )
  },
  {
    words: ["agreement", "opinion", "point of view", "view", "perspective", "idea", "thought"],
    build: (w, zh, en, pos) => createExample(
      `彼の${w}を聞いて、考え方が少し変わった。`,
      `听了他的${zh}之后，想法稍微改变了。`,
      `After hearing his ${en}, my way of thinking changed a little.`,
      pos
    )
  },
  {
    words: ["shame", "obliged", "sorry", "grateful", "恐縮"],
    build: (w, zh, en, pos) => createExample(
      `急なお願いで${w}して、何度も頭を下げた。`,
      `因为突然提出请求而感到过意不去，于是连连低头致歉。`,
      `I felt apologetic about the sudden request and bowed several times.`,
      pos
    )
  },
  {
    words: ["feeling", "mood", "emotion", "depression", "melancholy", "indignation", "resentment", "sympathy", "soul", "spirit"],
    build: (w, zh, en, pos) => createExample(
      `突然の知らせに強い${w}を覚えた。`,
      `听到突然的消息后，感到了强烈的${zh}。`,
      `The sudden news stirred a strong sense of ${en}.`,
      pos
    )
  },
  {
    words: ["shame", "obliged", "sorry", "grateful", "恐縮"],
    build: (w, zh, en, pos) => createExample(
      `急なお願いで${w}して、何度も頭を下げた。`,
      `因为突然提出请求而感到过意不去，于是连连低头致歉。`,
      `I felt apologetic about the sudden request and bowed several times.`,
      pos
    )
  },
  {
    words: ["artificial", "man-made", "human skill"],
    build: (w, zh, en, pos) => createExample(
      `${w}の光が夜の道を照らしていた。`,
      `人造的光照亮了夜路。`,
      `Artificial light was illuminating the road at night.`,
      pos
    )
  },
  {
    words: ["race", "ethnicity"],
    build: (w, zh, en, pos) => createExample(
      `多様な${w}の人々が同じ会場に集まった。`,
      `不同种族的人们聚集在同一个会场。`,
      `People of many races gathered in the same venue.`,
      pos
    )
  },
  {
    words: ["army", "military", "troops"],
    build: (w, zh, en, pos) => createExample(
      `${w}が国境近くに配置された。`,
      `军队被部署在国境附近。`,
      `The army was stationed near the border.`,
      pos
    )
  },
  {
    words: ["head of state", "sovereign", "monarch"],
    build: (w, zh, en, pos) => createExample(
      `${w}が式典で短い演説を行った。`,
      `国家元首在仪式上做了简短演讲。`,
      `The head of state gave a short speech at the ceremony.`,
      pos
    )
  },
  {
    words: ["too late", "belated"],
    build: (w, zh, en, pos) => createExample(
      `気づいたときには、もう${w}だった。`,
      `意识到的时候已经太晚了。`,
      `By the time I noticed, it was already too late.`,
      pos
    )
  },
  {
    words: ["liquid", "fluid"],
    build: (w, zh, en, pos) => createExample(
      `透明な${w}を小さな瓶に入れた。`,
      `把透明的液体装进了小瓶子。`,
      `I poured the clear liquid into a small bottle.`,
      pos
    )
  },
  {
    words: ["number", "serial number", "phone number"],
    build: (w, zh, en, pos) => createExample(
      `受付で${w}を呼ばれるまで待った。`,
      `在接待处等到号码被叫到。`,
      `I waited at reception until my number was called.`,
      pos
    )
  },
  {
    words: ["summit", "peak", "bottom", "sole"],
    build: (w, zh, en, pos) => createExample(
      `山の${w}から町全体が見えた。`,
      `从山顶能看到整个城镇。`,
      `From the top of the mountain, I could see the whole town.`,
      pos
    )
  },
  {
    words: ["fee", "charge", "rate", "payment", "repairs", "maintenance", "loan", "lending", "non-payment", "default"],
    build: (w, zh, en, pos) => createExample(
      `${w}の手続きを期限までに済ませた。`,
      `在期限前办好了${zh}的手续。`,
      `I completed the procedure for the ${en} before the deadline.`,
      pos
    )
  },
  {
    words: ["goods", "materials", "lumber", "timber", "wood", "material", "resource", "supply"],
    build: (w, zh, en, pos) => createExample(
      `工場に必要な${w}を朝のうちに集めた。`,
      `上午就收集好了工厂需要的${zh}。`,
      `We gathered the ${en} needed for the factory in the morning.`,
      pos
    )
  },
  {
    words: ["food", "fruit", "meat", "beef", "pork", "chicken", "egg", "snack", "cake", "meal"],
    build: (w, zh, en, pos) => createExample(
      `昼ご飯に${w}を少し食べた。`,
      `午饭吃了一点${zh}。`,
      `I ate a little ${en} for lunch.`,
      pos
    )
  },
  {
    words: ["rice field", "paddy field", "field"],
    build: (w, zh, en, pos) => createExample(
      `雨上がりの${w}に空が映っていた。`,
      `雨后的田里映着天空。`,
      `The sky was reflected in the rice field after the rain.`,
      pos
    )
  },
  {
    words: ["tea", "coffee", "water", "alcohol", "sake", "drink"],
    build: (w, zh, en, pos) => createExample(
      `休憩中に温かい${w}を一杯飲んだ。`,
      `休息时喝了一杯热的${zh}。`,
      `I drank a cup of warm ${en} during the break.`,
      pos
    )
  },
  {
    words: ["station", "school", "embassy", "bank", "room", "park", "village", "country", "foreign country", "bathroom", "kitchen", "place", "shop", "store"],
    build: (w, zh, en, pos) => createExample(
      `週末に${w}へ行く道を調べた。`,
      `周末前查好了去${zh}的路。`,
      `I looked up the way to the ${en} for the weekend.`,
      pos
    )
  },
  {
    words: ["week", "month", "year", "morning", "evening", "night", "afternoon", "birthday", "birth date", "today", "tomorrow", "yesterday", "time"],
    build: (w, zh, en, pos) => createExample(
      `${w}に大事な予定が入っている。`,
      `${zh}有一个重要安排。`,
      `I have an important plan in ${en}.`,
      pos
    )
  },
  {
    words: ["student", "teacher", "doctor", "adult", "child", "younger brother", "younger sister", "older brother", "older sister", "young lady", "servant", "housewife", "thief", "person", "heir", "successor", "cousin"],
    build: (w, zh, en, pos) => createExample(
      `困っている${w}に声をかけた。`,
      `主动跟遇到困难的${zh}搭了话。`,
      `I spoke to the ${en} who seemed to be in trouble.`,
      pos
    )
  },
  {
    words: ["animal", "livestock", "cattle", "horse", "bird", "fish", "dog", "cat"],
    build: (w, zh, en, pos) => createExample(
      `近くの牧場で${w}を見た。`,
      `在附近的牧场看到了${zh}。`,
      `I saw ${en} at a nearby farm.`,
      pos
    )
  },
  {
    words: ["surface", "front", "visible side", "outside"],
    build: (w, zh, en, pos) => createExample(
      `封筒の${w}に住所を書いた。`,
      `在信封正面写了地址。`,
      `I wrote the address on the front of the envelope.`,
      pos
    )
  },
  {
    words: ["jacket", "coat", "clothes", "clothing", "shirt", "sock", "socks", "shoe", "shoes", "garment", "outerwear"],
    build: (w, zh, en, pos) => createExample(
      `寒くなったので${w}を羽織った。`,
      `天气变冷了，所以披上了${zh}。`,
      `It got cold, so I put on a ${en}.`,
      pos
    )
  },
  {
    words: ["foot", "leg", "hand", "mouth", "tooth", "body", "neck", "head", "face", "hair", "beard", "moustache", "wrist"],
    build: (w, zh, en, pos) => createExample(
      `${w}が痛くて、今日は早めに休んだ。`,
      `${zh}疼，所以今天早点休息了。`,
      `My ${en} hurt, so I rested early today.`,
      pos
    )
  },
  {
    words: ["west", "south", "east", "north"],
    build: (w, zh, en, pos) => createExample(
      `${w}の空が夕焼けで赤く染まった。`,
      `西边的天空被晚霞染红了。`,
      `The western sky turned red in the sunset.`,
      pos
    )
  },
  {
    words: ["cloud", "rain", "snow", "wind", "moon", "sky", "weather", "sand", "tree", "flower", "pond", "mountain", "autumn", "winter", "summer", "spring"],
    build: (w, zh, en, pos) => createExample(
      `夕方になると、${w}がとてもきれいに見えた。`,
      `到了傍晚，${zh}看起来特别漂亮。`,
      `In the evening, the ${en} looked especially beautiful.`,
      pos
    )
  },
  {
    words: ["black", "white", "red", "blue", "green", "grey", "gray", "ashen", "color"],
    build: (w, zh, en, pos) => createExample(
      `${w}のシャツを選んで、鏡の前で合わせてみた。`,
      `选了一件${zh}的衬衫，在镜子前试着搭配。`,
      `I chose a ${en} shirt and tried matching it in front of the mirror.`,
      pos
    )
  },
  {
    words: ["two", "three", "four", "five", "seven", "eight", "hundred", "thousand", "number"],
    build: (w, zh, en, pos) => createExample(
      `${w}の箱を棚にきれいに並べた。`,
      `把${zh}个箱子整齐地摆在架子上。`,
      `I neatly lined up ${en} boxes on the shelf.`,
      pos
    )
  },
  {
    words: ["book", "magazine", "newspaper", "letter", "sentence", "map", "dictionary", "document", "photo", "photograph", "ticket", "wallet", "pencil", "box", "soap", "teacup", "kettle", "pot", "drum", "pipe", "tube", "weapon", "umbrella", "bicycle", "window", "door", "clock"],
    build: (w, zh, en, pos) => createExample(
      `机の上に${w}を置いてから出かけた。`,
      `把${zh}放在桌上之后出门了。`,
      `I put the ${en} on the desk before going out.`,
      pos
    )
  },
  {
    words: ["table", "chart", "surface", "front", "outside"],
    build: (w, zh, en, pos) => createExample(
      `資料の${w}に数字をまとめた。`,
      `把数字整理在资料的表格里。`,
      `I organized the numbers in a table in the document.`,
      pos
    )
  },
  {
    words: ["cupboard", "closet", "shelf", "cabinet", "fan", "decoration", "ornament"],
    build: (w, zh, en, pos) => createExample(
      `部屋の${w}をきれいに整えた。`,
      `把房间里的${zh}整理得很干净。`,
      `I tidied up the ${en} in the room.`,
      pos
    )
  },
  {
    words: ["stage", "theatre", "comedy", "show", "music", "song", "essay", "writings"],
    build: (w, zh, en, pos) => createExample(
      `週末に友達と${w}を見に行った。`,
      `周末和朋友去看了${zh}。`,
      `I went to see the ${en} with a friend on the weekend.`,
      pos
    )
  },
  {
    words: ["class", "grade", "lesson", "study", "job", "work", "duty", "task", "responsibility", "business"],
    build: (w, zh, en, pos) => createExample(
      `今日の${w}は思ったより早く終わった。`,
      `今天的${zh}比想象中更早结束。`,
      `Today's ${en} ended earlier than I expected.`,
      pos
    )
  }
];

const verbRules = [
  {
    words: ["繰り広げ", "unfold", "unroll", "展开", "开展"],
    build: (w, zh, en, pos) => createExample(
      `両チームは最後まで激しい試合を繰り広げた。`,
      `两支队伍一直展开激烈比赛直到最后。`,
      `Both teams carried on an intense match until the end.`,
      pos
    )
  },
  {
    words: ["開催", "举办", "举行", "hold an event", "hold"],
    build: (w, zh, en, pos) => createExample(
      `来月、駅前の広場で音楽イベントを${w}。`,
      `下个月将在车站前广场举办音乐活动。`,
      `A music event will be held in the plaza in front of the station next month.`,
      pos
    )
  },
  {
    words: ["設置", "设置", "安装", "install", "set up"],
    build: (w, zh, en, pos) => createExample(
      `入口に新しい案内板を${w}。`,
      `在入口处设置了新的指示牌。`,
      `A new information board was installed at the entrance.`,
      pos
    )
  },
  {
    words: ["見込", "预测", "expect", "forecast", "anticipate"],
    build: (w, zh, en, pos) => createExample(
      `今年の売上は去年を上回ると${w.replace(/む$/u, "んでいる").replace(/する$/u, "している")}。`,
      `预计今年的销售额会超过去年。`,
      `We expect this year's sales to exceed last year's.`,
      pos
    )
  },
  {
    words: ["負担", "承担", "burden", "bear the cost"],
    build: (w, zh, en, pos) => createExample(
      `出張の交通費は会社が${w}。`,
      `出差的交通费由公司负担。`,
      `The company bears the transportation cost for the business trip.`,
      pos
    )
  },
  {
    words: ["組織", "组织", "organize"],
    build: (w, zh, en, pos) => createExample(
      `学生たちが地域の交流会を${w}。`,
      `学生们组织了地区交流会。`,
      `The students organized a local exchange event.`,
      pos
    )
  },
  {
    words: ["殺到", "蜂拥", "rush in", "flood in"],
    build: (w, zh, en, pos) => createExample(
      `発売日に注文が店へ${w}。`,
      `发售当天订单涌向店铺。`,
      `Orders flooded into the store on the release date.`,
      pos
    )
  },
  {
    words: ["入居", "迁入", "搬进", "move into"],
    build: (w, zh, en, pos) => createExample(
      `春から新しいマンションに${w}ことになった。`,
      `从春天开始要搬进新的公寓。`,
      `I will move into a new apartment starting in spring.`,
      pos
    )
  },
  {
    words: ["表明", "表明", "state", "express"],
    build: (w, zh, en, pos) => createExample(
      `市長は会見で辞任の意向を${w}。`,
      `市长在记者会上表明了辞职意向。`,
      `The mayor stated the intention to resign at the press conference.`,
      pos
    )
  },
  {
    words: ["配慮", "关怀", "照顾", "consideration"],
    build: (w, zh, en, pos) => createExample(
      `小さな子ども連れの客に${w.replace(/する$/u, "した")}席を用意した。`,
      `为带小孩的客人准备了体现照顾的座位。`,
      `We prepared seats with consideration for guests with small children.`,
      pos
    )
  },
  {
    words: ["打ち込", "专心致志", "devote oneself", "be absorbed"],
    build: (w, zh, en, pos) => createExample(
      `彼は大学時代から研究に${w.replace(/む$/u, "んでいる")}。`,
      `他从大学时代起就专心投入研究。`,
      `He has devoted himself to research since his university days.`,
      pos
    )
  },
  {
    words: ["覚える", "remember", "memorize", "记住", "想起"],
    build: (w, zh, en, pos) => createExample(
      `新しい漢字を毎日五つずつ${w}。`,
      `每天记住五个新的汉字。`,
      `I memorize five new kanji every day.`,
      pos
    )
  },
  {
    words: ["地位に就く", "take up a position", "assume a post"],
    build: (w, zh, en, pos) => createExample(
      `彼は若くして重要な地位に就いた。`,
      `他年纪轻轻就担任了重要职位。`,
      `He took up an important position at a young age.`,
      pos
    )
  },
  {
    words: ["become used to", "get used to", "familiar"],
    build: (w, zh, en, pos) => createExample(
      `この景色に${w}まで、少し時間がかかった。`,
      `花了一点时间才看惯这片景色。`,
      `It took a little time to become used to this scenery.`,
      pos
    )
  },
  {
    words: ["be based on", "based on", "grounded on", "basis"],
    build: (w, zh, en, pos) => createExample(
      `事実に${w}意見を述べた。`,
      `陈述了基于事实的意见。`,
      `I stated an opinion based on the facts.`,
      pos
    )
  },
  {
    words: ["draw out", "pull out", "withdraw", "extract"],
    build: (w, zh, en, pos) => createExample(
      `引き出しから古い手紙を${w}と、懐かしくなった。`,
      `从抽屉里取出旧信时，感到很怀念。`,
      `When I pulled an old letter out of the drawer, I felt nostalgic.`,
      pos
    )
  },
  {
    words: ["become cold", "get cold", "cool down", "grow cold"],
    build: (w, zh, en, pos) => createExample(
      `スープが${w}まで、少し待った。`,
      `等到汤凉下来。`,
      `I waited until the soup cooled down.`,
      pos
    )
  },
  {
    words: ["recommend", "advise", "suggest"],
    build: (w, zh, en, pos) => createExample(
      `先生が${w}本はとても読みやすい。`,
      `老师给我推荐了一本容易读的书。`,
      `The teacher recommended an easy book to read.`,
      pos
    )
  },
  {
    words: ["love"],
    build: (w, zh, en, pos) => createExample(
      `家族を${w}気持ちを大切にしている。`,
      `珍惜爱家人的心情。`,
      `I treasure the feeling of loving my family.`,
      pos
    )
  },
  {
    words: ["become", "consist", "turn into"],
    build: (w, zh, en, pos) => createExample(
      `春に${w}頃、駅前の桜が咲き始める。`,
      `到了春天的时候，车站前的樱花开始开放。`,
      `Around the time it becomes spring, the cherry blossoms near the station begin to bloom.`,
      pos
    )
  },
  {
    words: ["fall over", "collapse", "fall down", "break down"],
    build: (w, zh, en, pos) => createExample(
      `強い風で木が${w}音がした。`,
      `强风中传来了树倒下的声音。`,
      `I heard the sound of a tree falling over in the strong wind.`,
      pos
    )
  },
  {
    words: ["harm", "damage", "impair", "spoil", "hurt"],
    build: (w, zh, en, pos) => createExample(
      `信頼を${w}発言は避けたほうがいい。`,
      `最好避免损害信任的发言。`,
      `It is better to avoid remarks that damage trust.`,
      pos
    )
  },
  {
    words: ["create", "manufacture", "build", "prepare", "compose"],
    build: (w, zh, en, pos) => createExample(
      `週末に友達と棚を${w}計画を立てた。`,
      `周末计划和朋友一起做一个架子。`,
      `I made a plan to build a shelf with a friend on the weekend.`,
      pos
    )
  },
  {
    words: ["carry through", "accomplish", "complete", "finish"],
    build: (w, zh, en, pos) => createExample(
      `最後まで計画を${w}覚悟を決めた。`,
      `下定决心把计划坚持到最后。`,
      `I resolved to carry the plan through to the end.`,
      pos
    )
  },
  {
    words: ["resemble", "similar", "alike"],
    build: (w, zh, en, pos) => createExample(
      `二つの意見が${w}理由を考えた。`,
      `思考了两个意见相似的理由。`,
      `I thought about why the two opinions were so similar.`,
      pos
    )
  },
  {
    words: ["use", "employ", "utilize"],
    build: (w, zh, en, pos) => createExample(
      `新しい道具を${w}場面が増えている。`,
      `使用新工具的场景正在增加。`,
      `There are more situations where we use the new tool.`,
      pos
    )
  },
  {
    words: ["hospitalise", "hospitalize", "hospital"],
    build: (w, zh, en, pos) => createExample(
      `祖父が検査のために${w}ことになった。`,
      `祖父因为检查需要住院。`,
      `My grandfather had to be hospitalized for tests.`,
      pos
    )
  },
  {
    words: ["touch lightly", "graze"],
    build: (w, zh, en, pos) => createExample(
      `腕が壁を${w}音がした。`,
      `手臂轻轻擦到墙，发出了声音。`,
      `My arm made a sound as it brushed lightly against the wall.`,
      pos
    )
  },
  {
    words: ["surround", "circle", "enclose", "encircle"],
    build: (w, zh, en, pos) => createExample(
      `町を${w}山々が夕日に染まった。`,
      `环绕城镇的群山被夕阳染上了颜色。`,
      `The mountains surrounding the town were colored by the sunset.`,
      pos
    )
  },
  {
    words: ["apply"],
    build: (w, zh, en, pos) => createExample(
      `この条件に${w}場合は、追加の手続きが必要だ。`,
      `符合这个条件时，需要追加手续。`,
      `If this condition applies, extra paperwork is required.`,
      pos
    )
  },
  {
    words: ["repay", "pay back", "refund"],
    build: (w, zh, en, pos) => createExample(
      `店が料金を${w}手続きを進めている。`,
      `店家正在办理退还费用的手续。`,
      `The shop is processing the procedure to ${en} the fee.`,
      pos
    )
  },
  {
    words: ["mince", "carve", "engrave"],
    build: (w, zh, en, pos) => createExample(
      `職人が木に名前を${w}様子を見た。`,
      `看到了工匠把名字刻在木头上的样子。`,
      `I watched the craftsperson carve a name into the wood.`,
      pos
    )
  },
  {
    words: ["turn on", "switch on", "light up", "come on", "catch fire", "be lit", "ignite", "switched on"],
    build: (w, zh, en, pos) => createExample(
      `部屋の明かりが${w}と、少し安心した。`,
      `房间的灯亮起来后，稍微安心了。`,
      `I felt a little relieved when the room light came on.`,
      pos
    )
  },
  {
    words: ["cool", "let cool", "dampen"],
    build: (w, zh, en, pos) => createExample(
      `熱いスープを少し${w}時間が必要だった。`,
      `需要一点时间把热汤放凉。`,
      `I needed time to ${en} the hot soup a little.`,
      pos
    )
  },
  {
    words: ["point", "indicate"],
    build: (w, zh, en, pos) => createExample(
      `地図で目的地を${w}指を見た。`,
      `看着在地图上指向目的地的手指。`,
      `I looked at the finger pointing to the destination on the map.`,
      pos
    )
  },
  {
    words: ["seek", "request", "demand", "want", "wish", "search"],
    build: (w, zh, en, pos) => createExample(
      `助けを${w}声が遠くから聞こえた。`,
      `远处传来了寻求帮助的声音。`,
      `I heard a voice from far away seeking help.`,
      pos
    )
  },
  {
    words: ["condemn", "blame", "criticize"],
    build: (w, zh, en, pos) => createExample(
      `相手を強く${w}前に、まず事情を聞いた。`,
      `在强烈责备对方之前，先听了事情经过。`,
      `Before I strongly ${en} the other person, I listened to the situation.`,
      pos
    )
  },
  {
    words: ["argue", "discuss", "debate"],
    build: (w, zh, en, pos) => createExample(
      `新しい案を${w}会議が夜まで続いた。`,
      `讨论新方案的会议一直持续到晚上。`,
      `The meeting to ${en} the new proposal continued until night.`,
      pos
    )
  },
  {
    words: ["take down", "launch", "drop"],
    build: (w, zh, en, pos) => createExample(
      `棚から荷物を${w}ときは、足元に気をつける。`,
      `从架子上拿下行李时，要注意脚边。`,
      `When you ${en} luggage from the shelf, watch your step.`,
      pos
    )
  },
  {
    words: ["carry", "transport", "bring", "send"],
    build: (w, zh, en, pos) => createExample(
      `重い荷物を駅まで${w}人を探した。`,
      `找了一个能把重行李搬到车站的人。`,
      `I looked for someone to ${en} the heavy luggage to the station.`,
      pos
    )
  },
  {
    words: ["wear", "put on", "take off", "hang"],
    build: (w, zh, en, pos) => createExample(
      `上着を${w}場所を入口の近くに作った。`,
      `在入口附近设置了可以处理外套的地方。`,
      `We made a place near the entrance to ${en} coats.`,
      pos
    )
  },
  {
    words: ["boil", "grow hot", "get excited"],
    build: (w, zh, en, pos) => createExample(
      `湯が${w}まで、台所で少し待った。`,
      `在厨房等到水烧开。`,
      `I waited in the kitchen until the water began to ${en}.`,
      pos
    )
  },
  {
    words: ["match", "fit"],
    build: (w, zh, en, pos) => createExample(
      `予定が${w}日を選んで、みんなで集まった。`,
      `选了日程合得上的日子，大家聚在一起。`,
      `We chose a day when our schedules would ${en} and gathered together.`,
      pos
    )
  },
  {
    words: ["break", "split", "crack"],
    build: (w, zh, en, pos) => createExample(
      `ガラスが${w}音がして、みんなが振り向いた。`,
      `传来玻璃破裂的声音，大家都回过头。`,
      `Everyone turned around at the sound of glass beginning to ${en}.`,
      pos
    )
  },
  {
    words: ["look after", "take care"],
    build: (w, zh, en, pos) => createExample(
      `子どもを${w}人がもう一人必要だった。`,
      `还需要一个照看孩子的人。`,
      `We needed one more person to ${en} the child.`,
      pos
    )
  },
  {
    words: ["dance", "play", "amuse oneself", "make merry"],
    build: (w, zh, en, pos) => createExample(
      `休日に友達とゲームに${w}時間を楽しんだ。`,
      `假日享受了和朋友一起玩乐的时间。`,
      `I enjoyed spending playful time with friends on the holiday.`,
      pos
    )
  },
  {
    words: ["go", "come", "return", "visit", "lodge", "stay"],
    build: (w, zh, en, pos) => createExample(
      `週末に友達の家へ${w}予定だ。`,
      `周末计划去朋友家。`,
      `I plan to ${en} to my friend's house this weekend.`,
      pos
    )
  },
  {
    words: ["read", "write", "listen", "hear", "watch", "see", "sing"],
    build: (w, zh, en, pos) => createExample(
      `夜にゆっくり${w}時間を作った。`,
      `晚上留出了慢慢做这件事的时间。`,
      `I made time at night to slowly ${en}.`,
      pos
    )
  }
];

const adverbRules = [
  {
    words: ["if", "in case"],
    build: (w, zh, en, pos) => createExample(
      `${w}時間があれば、もう一度会いたい。`,
      `如果有时间的话，还想再见一次。`,
      `If there is time, I want to meet once more.`,
      pos
    )
  },
  {
    words: ["perhaps", "possibly", "maybe"],
    build: (w, zh, en, pos) => createExample(
      `${w}明日は雨になるかもしれない。`,
      `${zh}明天可能会下雨。`,
      `${en}, it may rain tomorrow.`,
      pos
    )
  },
  {
    words: ["somewhere", "anywhere"],
    build: (w, zh, en, pos) => createExample(
      `鍵を${w}に置いてしまった。`,
      `把钥匙放到${zh}去了。`,
      `I put the key ${en}.`,
      pos
    )
  },
  {
    words: ["here and there"],
    build: (w, zh, en, pos) => createExample(
      `${w}を探したが、財布は見つからなかった。`,
      `到处找了，但没找到钱包。`,
      `I searched ${en}, but I couldn't find my wallet.`,
      pos
    )
  },
  {
    words: ["especially", "particularly"],
    build: (w, zh, en, pos) => createExample(
      `${w}この部分を丁寧に読んだ。`,
      `${zh}仔细读了这一部分。`,
      `I read this part ${en} carefully.`,
      pos
    )
  },
  {
    words: ["greatly", "very", "quite", "rather"],
    build: (w, zh, en, pos) => createExample(
      `今日は${w}疲れたので、早めに寝た。`,
      `今天${zh}累，所以早点睡了。`,
      `I was ${en} tired today, so I went to bed early.`,
      pos
    )
  }
];

function buildNounExample(surface, zh, en, pos, seed, lower) {
  const rule = nounRules.find((item) => hasAny(lower, item.words));
  if (rule) return rule.build(surface, zh, en, pos);

  const concrete = hasAny(lower, [
    "object",
    "tool",
    "machine",
    "bag",
    "box",
    "clothes",
    "shirt",
    "shoe",
    "key",
    "table",
    "desk",
    "paper",
    "cup",
    "pot",
    "vehicle",
    "windmill",
    "pinwheel"
  ]);

  if (concrete) {
    return createExample(
      `近くの店で${surface}を見つけた。`,
      `在附近的店里找到了${zh}。`,
      `I found a ${en} at a nearby shop.`,
      pos
    );
  }

  return pick(
    [
      createExample(
        `会議で${surface}について具体的に話し合った。`,
        `会议上具体讨论了${zh}。`,
        `We discussed ${en} in detail at the meeting.`,
        pos
      ),
      createExample(
        `友達と${surface}についてしばらく話した。`,
        `和朋友聊了一会儿关于${zh}的话题。`,
        `I talked with a friend for a while about ${en}.`,
        pos
      )
    ],
    seed
  );
}

function buildVerbExample(surface, word, zh, en, pos, seed, lower) {
  const verb = verbSurface(surface, word, pos);
  const rule = verbRules.find((item) => hasAny(lower, item.words));
  if (rule) return rule.build(verb, zh, en, pos);

  return pick(
    [
      createExample(
        `問題を解決するために、チームで${verb}ことにした。`,
        `为了解决问题，团队决定${zh}。`,
        `The team decided to ${en} in order to solve the problem.`,
        pos
      ),
      createExample(
        `状況を確認してから、落ち着いて${verb}。`,
        `确认情况后，冷静地${zh}。`,
        `After checking the situation, I calmly ${en}.`,
        pos
      )
    ],
    seed
  );
}

function buildIAdjectiveExample(surface, zh, en, pos, seed, lower) {
  if (hasAny(lower, ["black", "white", "red", "blue", "green", "grey", "gray"])) {
    return createExample(
      `${surface}シャツを選んで、鏡の前で合わせてみた。`,
      `选了一件${zh}的衬衫，在镜子前试着搭配。`,
      `I chose a ${en} shirt and tried matching it in front of the mirror.`,
      pos
    );
  }
  if (hasAny(lower, ["small", "little", "large", "big"])) {
    return createExample(
      `${surface}箱を棚の上に置いた。`,
      `把${zh}的盒子放到了架子上。`,
      `I put the ${en} box on the shelf.`,
      pos
    );
  }
  if (hasAny(lower, ["long", "short", "wide", "narrow"])) {
    return createExample(
      `${surface}道をゆっくり歩いた。`,
      `慢慢走过了${zh}的路。`,
      `I walked slowly along the ${en} road.`,
      pos
    );
  }
  if (hasAny(lower, ["high", "low", "tall"])) {
    return createExample(
      `${surface}建物を見上げた。`,
      `抬头看了那栋${zh}的建筑。`,
      `I looked up at the ${en} building.`,
      pos
    );
  }
  if (hasAny(lower, ["hot", "cold", "warm", "cool"])) {
    return createExample(
      `今日はとても${surface}ので、水を多めに飲んだ。`,
      `今天很${zh}，所以多喝了一些水。`,
      `It was very ${en} today, so I drank extra water.`,
      pos
    );
  }
  return pick(
    [
      createExample(
        `その説明は少し${surface}と感じた。`,
        `感觉那个说明有点${zh}。`,
        `I felt that explanation was a little ${en}.`,
        pos
      ),
      createExample(
        `思ったより${surface}問題だった。`,
        `这是个比想象中更${zh}的问题。`,
        `It was a more ${en} problem than I expected.`,
        pos
      ),
      createExample(
        `${surface}日だったが、最後まで歩いた。`,
        `虽然是${zh}的一天，但还是走到了最后。`,
        `It was a ${en} day, but I walked until the end.`,
        pos
      )
    ],
    seed
  );
}

function buildNaAdjectiveExample(surface, zh, en, pos, seed, lower) {
  if (hasAny(lower, ["abundant", "plentiful", "rich", "豊富"])) {
    return createExample(
      `${surface}な資料を使って発表した。`,
      `使用丰富的资料做了发表。`,
      `I gave the presentation using abundant materials.`,
      pos
    );
  }
  if (hasAny(lower, ["slump", "poor condition", "dull", "不振"])) {
    return createExample(
      `${surface}な成績が続き、原因を見直した。`,
      `成绩持续低迷，于是重新审视了原因。`,
      `After poor results continued, I reviewed the cause.`,
      pos
    );
  }
  if (hasAny(lower, ["warm", "mild", "temperate", "温暖"])) {
    return createExample(
      `${surface}な気候の町で暮らしたい。`,
      `想住在气候温暖的城镇。`,
      `I want to live in a town with a mild climate.`,
      pos
    );
  }
  if (hasAny(lower, ["unfair", "unjust", "injustice", "improper", "unreasonable"])) {
    return createExample(
      `${surface}な扱いを受けて、彼はすぐに抗議した。`,
      `受到不公正的对待后，他马上提出了抗议。`,
      `He protested immediately after receiving unfair treatment.`,
      pos
    );
  }
  if (hasAny(lower, ["elaborate", "delicate", "precise", "fine", "exquisite"])) {
    return createExample(
      `${surface}な時計の作りに思わず見入った。`,
      `不由得看入迷了那只精巧手表的做工。`,
      `I could not help staring at the elaborate workmanship of the watch.`,
      pos
    );
  }
  if (hasAny(lower, ["important", "necessary", "official", "formal"])) {
    return createExample(
      `${surface}な書類を忘れずに持って行った。`,
      `没有忘记带上${zh}的文件。`,
      `I remembered to bring the ${en} documents.`,
      pos
    );
  }
  if (hasAny(lower, ["quiet", "clean", "lively", "famous", "beautiful", "healthy"])) {
    return createExample(
      `${surface}な町をゆっくり歩いた。`,
      `慢慢走过了一个${zh}的城镇。`,
      `I slowly walked through a ${en} town.`,
      pos
    );
  }
  return pick(
    [
      createExample(
        `${surface}な様子で、彼は最後まで話を聞いた。`,
        `他以${zh}的样子听到了最后。`,
        `He listened until the end with a ${en} manner.`,
        pos
      ),
      createExample(
        `${surface}な点を先に説明した。`,
        `先说明了${zh}的地方。`,
        `I explained the ${en} point first.`,
        pos
      )
    ],
    seed
  );
}

function buildAdverbExample(surface, zh, en, pos, seed, lower) {
  const rule = adverbRules.find((item) => hasAny(lower, item.words));
  if (rule) return rule.build(surface, zh, en, pos);
  return pick(
    [
      createExample(
        `${surface}予定を変更した。`,
        `${zh}改变了计划。`,
        `I changed the plan ${en}.`,
        pos
      ),
      createExample(
        `${surface}返事が届いたので安心した。`,
        `${zh}收到了回复，所以放心了。`,
        `I felt relieved when the reply arrived ${en}.`,
        pos
      )
    ],
    seed
  );
}

function buildExpressionExample(surface, zh, en, pos) {
  return createExample(
    `帰り際に「${surface}」と声をかけた。`,
    `离开时对对方说了“${zh}”。`,
    `As I left, I said "${en}" to the other person.`,
    pos
  );
}

function buildAdnominalExample(surface, zh, en, pos) {
  return createExample(
    `${surface}店は駅の近くにある。`,
    `${zh}那家店在车站附近。`,
    `That shop is near the station.`,
    pos
  );
}

function buildPronounExample(surface, zh, en, pos, seed, lower) {
  if (hasAny(lower, ["somewhere", "anywhere"])) {
    return createExample(
      `週末は${surface}静かな場所へ行きたい。`,
      `周末想去${zh}安静的地方。`,
      `This weekend I want to go ${en} quiet.`,
      pos
    );
  }
  if (hasAny(lower, ["here", "there", "this place", "that place"])) {
    return createExample(
      `${surface}で少し休んでから出発した。`,
      `在这里稍微休息后出发了。`,
      `I rested here for a while before leaving.`,
      pos
    );
  }
  return pick(
    [
      createExample(
        `${surface}は静かにうなずいた。`,
        `${zh}静静地点了点头。`,
        `${en} nodded quietly.`,
        pos
      ),
      createExample(
        `${surface}に道を尋ねた。`,
        `向${zh}问了路。`,
        `I asked ${en} for directions.`,
        pos
      )
    ],
    seed
  );
}

export function buildVocabularyExample(word, index = 0) {
  const entry = findKotobakoEntry(word);
  const surface = exampleSurface(word, entry);
  const entryMeaning = meaningText(word, entry);
  const enSource = cleanText(word.en || entryMeaning);
  const combinedMeaning = [word.en, entryMeaning].filter(Boolean).join("; ");
  const en = firstEnglish(enSource);
  const zh = chineseLabel(surface, word.zh, enSource);
  const pos = partOfSpeech(word, entry);
  const kind = wordKind(word, entry, surface, combinedMeaning || enSource, pos);
  const lower = [combinedMeaning, word.zh, pos, surface].join(" ").toLowerCase();
  const seed = hashSeed(surface, zh, en, pos, index);

  if (kind === "expression") return buildExpressionExample(surface, zh, en, pos);
  if (kind === "adnominal") return buildAdnominalExample(surface, zh, en, pos);
  if (kind === "pronoun") return buildPronounExample(surface, zh, en, pos, seed, lower);
  if (kind === "verb") return buildVerbExample(surface, word, zh, en, pos, seed, lower);
  if (kind === "iAdjective") return buildIAdjectiveExample(surface, zh, en, pos, seed, lower);
  if (kind === "naAdjective") return buildNaAdjectiveExample(surface, zh, en, pos, seed, lower);
  if (kind === "adverb") return buildAdverbExample(surface, zh, en, pos, seed, lower);
  return buildNounExample(surface, zh, en, pos, seed, lower);
}
