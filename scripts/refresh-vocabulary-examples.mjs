import { readFile, writeFile } from "node:fs/promises";
import { buildVocabularyExample } from "./vocabulary-examples.mjs";

const vocabularyUrl = new URL("../src/data/generatedVocabulary.json", import.meta.url);
const words = JSON.parse(await readFile(vocabularyUrl, "utf8"));

const exactFallbacks = {
  "三日月": {
    exampleJp: "夜空に三日月が静かに浮かんでいた。",
    exampleZh: "新月般的月牙静静地浮在夜空中。",
    exampleEn: "A crescent moon was quietly hanging in the night sky."
  },
  "夜行": {
    exampleJp: "夜行バスで東京へ向かった。",
    exampleZh: "坐夜行巴士去了东京。",
    exampleEn: "I headed to Tokyo on an overnight bus."
  },
  "家主": {
    exampleJp: "家主に水漏れを知らせた。",
    exampleZh: "把漏水的事告诉了房东。",
    exampleEn: "I told the landlord about the water leak."
  },
  "ここ": {
    exampleJp: "雨がやむまでここで待った。",
    exampleZh: "在这里等到雨停。",
    exampleEn: "I waited here until the rain stopped."
  },
  "この": {
    exampleJp: "この本を明日返す。",
    exampleZh: "明天归还这本书。",
    exampleEn: "I will return this book tomorrow."
  },
  "夜中": {
    exampleJp: "夜中に強い雨の音で目が覚めた。",
    exampleZh: "半夜被很大的雨声吵醒了。",
    exampleEn: "I woke up in the middle of the night to the sound of heavy rain."
  },
  "上る": {
    exampleJp: "坂を上ると海が見えた。",
    exampleZh: "爬上坡后看见了海。",
    exampleEn: "When I climbed the hill, I could see the sea."
  },
  "作る": {
    exampleJp: "夕飯にカレーを作る予定だ。",
    exampleZh: "晚饭打算做咖喱。",
    exampleEn: "I plan to make curry for dinner."
  },
  "東": {
    exampleJp: "東の空が明るくなった。",
    exampleZh: "东方的天空变亮了。",
    exampleEn: "The eastern sky grew bright."
  },
  "人": {
    exampleJp: "駅の前に多くの人が集まった。",
    exampleZh: "车站前聚集了很多人。",
    exampleEn: "Many people gathered in front of the station."
  },
  "一日": {
    exampleJp: "一日かけて部屋を片付けた。",
    exampleZh: "花了一天整理房间。",
    exampleEn: "I spent a whole day cleaning my room."
  },
  "暖かい": {
    exampleJp: "暖かいお茶を飲んで落ち着いた。",
    exampleZh: "喝了温暖的茶后平静了下来。",
    exampleEn: "I calmed down after drinking warm tea."
  },
  "戸": {
    exampleJp: "古い戸を静かに開けた。",
    exampleZh: "轻轻打开了旧门。",
    exampleEn: "I quietly opened the old door."
  },
  "今日": {
    exampleJp: "今日は早めに家を出た。",
    exampleZh: "今天早早出了门。",
    exampleEn: "I left home early today."
  },
  "一昨年": {
    exampleJp: "一昨年の旅行を今でも覚えている。",
    exampleZh: "至今还记得前年的旅行。",
    exampleEn: "I still remember the trip from two years ago."
  },
  "一昨日": {
    exampleJp: "一昨日買った本を読み終えた。",
    exampleZh: "读完了前天买的书。",
    exampleEn: "I finished the book I bought the day before yesterday."
  },
  "一人": {
    exampleJp: "一人で映画を見に行った。",
    exampleZh: "一个人去看了电影。",
    exampleEn: "I went to see a movie alone."
  },
  "下": {
    exampleJp: "机の下に鍵が落ちていた。",
    exampleZh: "钥匙掉在桌子下面。",
    exampleEn: "The key had fallen under the desk."
  },
  "弟": {
    exampleJp: "弟に宿題を手伝ってもらった。",
    exampleZh: "请弟弟帮忙做了作业。",
    exampleEn: "I had my younger brother help me with my homework."
  },
  "イメージアップ": {
    exampleJp: "新しい制服で店のイメージアップを図った。",
    exampleZh: "用新制服提升了店铺形象。",
    exampleEn: "The new uniforms helped improve the shop's image."
  },
  "頑固": {
    exampleJp: "彼は頑固で、一度決めたことをなかなか変えない。",
    exampleZh: "他很固执，一旦决定的事很难改变。",
    exampleEn: "He is stubborn and rarely changes his mind once he decides something."
  },
  "ポジティブ": {
    exampleJp: "彼女はいつもポジティブに物事を考える。",
    exampleZh: "她总是积极地看待事情。",
    exampleEn: "She always thinks about things in a positive way."
  },
  "乃至": {
    exampleJp: "参加者は五十人乃至六十人ほどだ。",
    exampleZh: "参加者大约五十到六十人。",
    exampleEn: "There are about fifty to sixty participants."
  },
  "枠組み": {
    exampleJp: "計画の枠組みを決めてから、細部を詰めた。",
    exampleZh: "先决定计划框架，再完善细节。",
    exampleEn: "After deciding the framework of the plan, we worked out the details."
  },
  "精一杯": {
    exampleJp: "試験の日まで精一杯勉強した。",
    exampleZh: "一直到考试当天都拼尽全力学习了。",
    exampleEn: "I studied with all my strength until the day of the exam."
  },
  "口出し": {
    exampleJp: "人のやり方にむやみに口出ししないほうがいい。",
    exampleZh: "最好不要随便干涉别人的做法。",
    exampleEn: "It is better not to interfere carelessly with how other people do things."
  },
  "だいいち": {
    exampleJp: "だいいち、約束の時間に遅れるのはよくない。",
    exampleZh: "首先，约定时间迟到是不好的。",
    exampleEn: "First of all, it is not good to be late for an appointment."
  },
  "値": {
    exampleJp: "この時計は値が張るが、長く使える。",
    exampleZh: "这块表价格偏高，但能用很久。",
    exampleEn: "This watch is expensive, but it can be used for a long time."
  },
  "賛成": {
    exampleJp: "私はその提案に賛成だ。",
    exampleZh: "我赞成那个提案。",
    exampleEn: "I agree with that proposal."
  },
  "できる": {
    exampleJp: "練習すれば、少しずつできるようになる。",
    exampleZh: "只要练习，就会慢慢变得会做。",
    exampleEn: "With practice, you will gradually become able to do it."
  }
};

const alternateFallbacks = {
  "第一": {
    exampleJp: "第一に、資料を最後まで読んでから判断したい。",
    exampleZh: "第一，我想先把资料读到最后再判断。",
    exampleEn: "First, I want to read the material to the end before making a judgment."
  },
  "だいいち": {
    exampleJp: "第一に、資料を最後まで読んでから判断したい。",
    exampleZh: "第一，我想先把资料读到最后再判断。",
    exampleEn: "First, I want to read the material to the end before making a judgment."
  },
  "夜行": {
    exampleJp: "夜行列車で故郷へ帰った。",
    exampleZh: "坐夜行列车回了故乡。",
    exampleEn: "I returned to my hometown on an overnight train."
  },
  "今日": {
    exampleJp: "今日は友達と駅で会った。",
    exampleZh: "今天和朋友在车站见了面。",
    exampleEn: "I met a friend at the station today."
  }
};

function uniquifyExample(word, seen, index) {
  const exactFallback = exactFallbacks[word.japanese] ?? exactFallbacks[word.kana];
  if (exactFallback && !seen.has(exactFallback.exampleJp)) {
    const fallback = {
      ...buildVocabularyExample(word, index + 1),
      ...exactFallback
    };
    seen.add(fallback.exampleJp);
    return fallback;
  }

  const alternateFallback = alternateFallbacks[word.japanese] ?? alternateFallbacks[word.kana];
  if (alternateFallback && !seen.has(alternateFallback.exampleJp)) {
    const fallback = {
      ...buildVocabularyExample(word, index + 1),
      ...alternateFallback
    };
    seen.add(fallback.exampleJp);
    return fallback;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildVocabularyExample(word, index + 1 + attempt * 997);
    if (!seen.has(candidate.exampleJp)) {
      seen.add(candidate.exampleJp);
      return candidate;
    }
  }

  if (word.kana === "ただ") {
    const fallback = {
      ...buildVocabularyExample(word, index + 1),
      exampleJp: "彼はただ静かに笑っていた。",
      exampleZh: "他只是安静地笑着。",
      exampleEn: "He was just smiling quietly."
    };
    seen.add(fallback.exampleJp);
    return fallback;
  }

  const fallback = {
    exampleJp: `${word.japanese}について、別の角度から話題が広がった。`,
    exampleZh: `关于「${word.japanese}」，话题从另一个角度展开了。`,
    exampleEn: `The topic of "${word.japanese}" expanded from another angle.`
  };
  seen.add(fallback.exampleJp);
  return fallback;
}

const seenExamples = new Set();
const refreshed = words.map((word, index) => {
  const example = uniquifyExample(word, seenExamples, index);
  const { partOfSpeech: _generatedPartOfSpeech, ...exampleFields } = example;
  return {
    ...word,
    ...exampleFields
  };
});

await writeFile(vocabularyUrl, `${JSON.stringify(refreshed, null, 2)}\n`);
console.log(`Refreshed examples for ${refreshed.length} generated vocabulary words.`);
