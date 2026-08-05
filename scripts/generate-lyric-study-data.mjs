import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import kuromoji from "kuromoji";
import * as wanakana from "wanakana";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artistPath = path.join(rootDir, "src/data/artistLyrics.ts");
const lyricVocabularyPath = path.join(rootDir, "src/data/lyricVocabulary.ts");
const generatedVocabularyPath = path.join(rootDir, "src/data/generatedVocabulary.json");
const kotobakoPath = path.join(rootDir, "node_modules/kotobako-data/kotobako-static.json");

const grammarLookup = new Map([
  ["は", "pt-wa"],
  ["が", "pt-ga"],
  ["を", "pt-wo"],
  ["に", "pt-ni"],
  ["で", "pt-de"],
  ["の", "pt-no"],
  ["と", "pt-to"],
  ["へ", "pt-he"],
  ["も", "pt-mo"],
  ["まで", "pt-made"],
  ["ほど", "pt-hodo"],
  ["みたいに", "pt-mitai"]
]);

const posLabels = new Map([
  ["名詞", ["名词", "noun"]],
  ["動詞", ["动词", "verb"]],
  ["形容詞", ["形容词", "adjective"]],
  ["副詞", ["副词", "adverb"]],
  ["助詞", ["助词", "particle"]],
  ["助動詞", ["助动词", "auxiliary"]],
  ["連体詞", ["连体词", "adnominal"]],
  ["接続詞", ["连接词", "conjunction"]],
  ["感動詞", ["感叹词", "interjection"]],
  ["接頭詞", ["前缀", "prefix"]],
  ["フィラー", ["填充词", "filler"]]
]);

const latinPattern = /^[A-Za-z0-9][A-Za-z0-9'’&.+-]*$/;
const kanaPattern = /^[ぁ-んァ-ンー]+$/;
const punctuationPattern = /^[\s、。．，,!?！？…・「」『』（）()［］\[\]【】〈〉《》“”"':：;；〜~♪]+$/u;

const grammarMeanings = new Map([
  ["た", ["过去或完成助动词，相当于“了/过”。", "Past or completion auxiliary."]],
  ["だ", ["断定助动词，相当于“是/为”。", "Plain copula, similar to is/am/are."]],
  ["です", ["礼貌断定助动词，相当于“是”。", "Polite copula, similar to is/am/are."]],
  ["ます", ["礼貌助动词，让动词语气更郑重。", "Polite auxiliary attached to verbs."]],
  ["ない", ["否定助动词，相当于“不/没有”。", "Negative auxiliary, similar to not."]],
  ["ぬ", ["文语或歌词里常见的否定助动词，相当于“不”。", "Literary negative auxiliary, often seen in lyrics."]],
  ["ん", ["口语否定或音便形式的一部分，需结合整句判断。", "Colloquial negative or sound-change fragment; read in context."]],
  ["ら", ["常出现在假定、复数或活用形式中，需结合整句判断。", "A bound form used in conditionals, plurals, or conjugations."]],
  ["ば", ["条件形式，相当于“如果……就……”。", "Conditional marker, similar to if/when."]],
  ["て", ["连接助词，表示动作连接、方式或原因。", "Connective te-form marker."]],
  ["で", ["助词，表示地点、方式、原因，也可连接名词性状态。", "Particle for place, means, cause, or nominal te-form."]],
  ["と", ["助词，表示“和”、引用、条件或内容。", "Particle for and, quotation, condition, or content."]],
  ["も", ["助词，表示“也/连……也”。", "Particle meaning also/even."]]
]);

function loadArtistPacks() {
  const source = fs.readFileSync(artistPath, "utf8");
  const match = source.match(/export const artistSongPacks: SongPack\[\] = ([\s\S]*);\s*$/);
  if (!match) {
    throw new Error("Could not parse artistSongPacks from src/data/artistLyrics.ts");
  }
  return JSON.parse(match[1]);
}

function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: path.join(rootDir, "node_modules/kuromoji/dict") })
      .build((error, tokenizer) => {
        if (error) reject(error);
        else resolve(tokenizer);
      });
  });
}

function toHiragana(value) {
  if (!value || value === "*") return "";
  if (latinPattern.test(value)) return value;
  return wanakana.toHiragana(value);
}

function readingForToken(token) {
  const surface = token.surface_form;
  if (latinPattern.test(surface)) return surface;
  if (token.pos === "助詞" && surface === "は") return "わ";
  if (token.pos === "助詞" && surface === "へ") return "え";
  if (token.pos === "助詞" && surface === "を") return "を";
  const reading = toHiragana(token.reading || token.pronunciation);
  if (reading) return reading;
  if (kanaPattern.test(surface)) return wanakana.toHiragana(surface);
  return surface;
}

function romajiForToken(token, reading) {
  const surface = token.surface_form;
  if (latinPattern.test(surface)) return surface;
  if (token.pos === "助詞" && surface === "は") return "wa";
  if (token.pos === "助詞" && surface === "へ") return "e";
  if (token.pos === "助詞" && surface === "を") return "o";
  return wanakana.toRomaji(reading);
}

function posLabel(pos) {
  const [zh, en] = posLabels.get(pos) ?? ["歌词词", "lyric word"];
  return { zh, en };
}

function stableCode(value) {
  return [...value]
    .map((char) => char.codePointAt(0).toString(16))
    .join("-");
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function addToMapList(map, key, value) {
  const next = map.get(key) ?? [];
  next.push(value);
  map.set(key, next);
}

function makeExistingLookups(words) {
  const bySurface = new Map();
  const byKey = new Map();
  for (const word of words) {
    addToMapList(bySurface, word.japanese, word);
    byKey.set(`${word.japanese}|${word.kana}`, word);
    for (const form of word.forms ?? []) {
      addToMapList(bySurface, form, word);
      byKey.set(`${form}|${word.kana}`, word);
    }
  }
  return { bySurface, byKey };
}

function findExistingWord(token, reading, lookups) {
  const surface = token.surface_form;
  const basic = token.basic_form && token.basic_form !== "*" ? token.basic_form : surface;
  const exactSurface = lookups.byKey.get(`${surface}|${reading}`);
  if (exactSurface) return exactSurface;

  const exactBasic = lookups.byKey.get(`${basic}|${reading}`);
  if (exactBasic) return exactBasic;

  const basicCandidates = lookups.bySurface.get(basic) ?? [];
  if (basicCandidates.length === 1) return basicCandidates[0];

  const surfaceCandidates = lookups.bySurface.get(surface) ?? [];
  if (surfaceCandidates.length === 1) return surfaceCandidates[0];

  return null;
}

function shouldKeepToken(token) {
  const surface = token.surface_form.trim();
  if (!surface) return false;
  if (token.pos === "記号") return false;
  return !punctuationPattern.test(surface);
}

function levelForSong(song) {
  return /^N[1-5]$/.test(song.level) ? song.level : "N2";
}

function compactDefinition(values) {
  return uniqueValues(values)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
}

const glossZh = new Map([
  ["about", "大约；关于"],
  ["accident", "事故；意外"],
  ["actuality", "实际；现实"],
  ["adversary", "对手；敌手"],
  ["afternoon", "下午"],
  ["again", "再次；又"],
  ["agreement", "约定；协议"],
  ["all", "全部；所有"],
  ["almost", "几乎；差不多"],
  ["already", "已经"],
  ["alteration", "改变；变更"],
  ["although", "虽然；尽管"],
  ["and", "和；然后"],
  ["and yet", "然而；即便如此"],
  ["arm", "手臂"],
  ["at times", "有时；偶尔"],
  ["be", "是；存在"],
  ["beautiful", "美丽的"],
  ["because", "因为"],
  ["before long", "不久；很快"],
  ["beginning", "开始；开端"],
  ["best", "最好；第一"],
  ["besides", "而且；此外"],
  ["bewilderment", "迷惑；困惑"],
  ["bill", "账单；票据"],
  ["blessing", "祝福；恩惠"],
  ["blot", "污点"],
  ["brand new", "崭新的"],
  ["brightness", "明亮；光辉"],
  ["but", "但是；不过"],
  ["change", "变化；改变"],
  ["charm", "魅力"],
  ["close", "结束；关闭"],
  ["common", "普通；常见"],
  ["condition", "情况；状态"],
  ["connection", "关系；连接"],
  ["contract", "契约；合同"],
  ["credit", "赊账；信用"],
  ["current", "当前；潮流"],
  ["daily", "每日的；日常的"],
  ["dark", "黑暗的；阴郁的"],
  ["darkness", "黑暗；迷惘"],
  ["dear", "亲爱的"],
  ["defeat", "失败；落败"],
  ["delusion", "妄想；错觉"],
  ["despair", "绝望"],
  ["destination", "目的地；去向"],
  ["difficulty", "困难"],
  ["disaster", "灾难"],
  ["disposition", "性情；倾向"],
  ["division", "分割；划分"],
  ["dusk", "黄昏"],
  ["end", "结束；末尾"],
  ["ending", "结尾；终局"],
  ["every day", "每天"],
  ["everyday", "每天的；日常的"],
  ["excellent", "优秀的；极好的"],
  ["escape", "逃脱；逃避"],
  ["even", "甚至；即使"],
  ["even if", "即使"],
  ["faintly", "隐约地；微弱地"],
  ["farewell", "告别；再见"],
  ["figure", "身影；形状"],
  ["finally", "终于；最后"],
  ["finish", "结束；完成"],
  ["fleeting", "短暂的；转瞬即逝的"],
  ["flower", "花"],
  ["foreleg", "前腿"],
  ["forepaw", "前爪"],
  ["front and rear", "前后"],
  ["front and back", "前后；正反"],
  ["from", "从；由于"],
  ["futility", "徒劳；无益"],
  ["good", "好的"],
  ["goodbye", "再见；告别"],
  ["grace", "恩惠；优雅"],
  ["hand", "手"],
  ["handle", "把手；处理"],
  ["happy", "开心的；高兴的"],
  ["he", "他"],
  ["heart", "心；内心"],
  ["here!", "看这里；这边"],
  ["hey", "喂；嘿"],
  ["hey!", "喂；嘿"],
  ["him", "他"],
  ["however", "但是；然而"],
  ["I", "我"],
  ["if", "如果"],
  ["immediately", "立刻；马上"],
  ["impulse", "冲动"],
  ["inside out", "里外颠倒；反面"],
  ["intention", "意图；心意"],
  ["is", "是"],
  ["just", "正好；只是"],
  ["later", "之后；稍后"],
  ["lie", "谎言"],
  ["light", "光；轻微的"],
  ["like that", "像那样"],
  ["look", "看；瞧"],
  ["look!", "看！"],
  ["lovely", "可爱的；令人喜爱的"],
  ["me", "我"],
  ["meaning", "意思；意义"],
  ["merely", "仅仅；只是"],
  ["mind", "心；精神"],
  ["moment", "瞬间"],
  ["moreover", "而且；此外"],
  ["motive", "动机"],
  ["nature", "本性；自然"],
  ["nearly", "几乎；将近"],
  ["nevertheless", "然而；尽管如此"],
  ["nightfall", "黄昏；入夜"],
  ["no", "不；没有"],
  ["no more than", "只不过；不超过"],
  ["nonexistent", "不存在；没有"],
  ["not being (there)", "不在；不存在"],
  ["not had", "没有持有"],
  ["nothing but", "仅仅；只有"],
  ["now", "现在"],
  ["occasionally", "偶尔"],
  ["omission", "省略；遗漏"],
  ["only", "只有；仅仅"],
  ["ordinary", "普通的；平常的"],
  ["outcome", "结果；结局"],
  ["p.m.", "下午；午后"],
  ["painful", "痛苦的；疼痛的"],
  ["passage", "通道；段落"],
  ["pinky promise", "拉钩约定"],
  ["pinky swear (i.e. linking little fingers to confirm a promise)", "拉钩起誓"],
  ["pleasant", "愉快的；舒服的"],
  ["position", "位置；立场"],
  ["precious", "珍贵的"],
  ["promise", "约定；承诺"],
  ["question", "问题；疑问"],
  ["really", "真的；确实"],
  ["regular", "通常的；固定的"],
  ["result", "结果"],
  ["road", "道路"],
  ["shape", "形状；样子"],
  ["soon", "很快；不久"],
  ["so", "所以；那么"],
  ["spirit", "精神；心"],
  ["spot", "地点；场所"],
  ["stain", "污渍；污点"],
  ["still", "仍然；还是"],
  ["street", "街道"],
  ["such", "这样的"],
  ["sundown", "日落"],
  ["sunset", "日落；夕阳"],
  ["that", "那个；那样"],
  ["that kind of", "那种"],
  ["that sort of", "那种"],
  ["that time", "那个时候"],
  ["the", "那；这个"],
  ["then", "然后；那时"],
  ["there!", "那里；看那边"],
  ["thing", "事情；东西"],
  ["this", "这个"],
  ["this person", "这个人；这边"],
  ["trouble", "麻烦；困难"],
  ["unique", "独一无二的；独特的"],
  ["unowned", "无主的；没有的"],
  ["unpossessed", "未持有的；没有的"],
  ["usual", "通常的；平常的"],
  ["visage", "面容；相貌"],
  ["what?", "什么？"],
  ["when", "什么时候；当……时"],
  ["who", "谁"],
  ["with", "和……一起"],
  ["yet", "还；然而"],
  ["you", "你"],
  ["to abandon", "放弃；抛弃"],
  ["to abhor", "厌恶；憎恶"],
  ["to advance", "前进；进展"],
  ["to aim at", "瞄准；以……为目标"],
  ["to answer", "回答"],
  ["to arrive", "到达；抵达"],
  ["to attain", "达到；获得"],
  ["to avoid", "避开；避免"],
  ["to be altered", "被改变；发生改变"],
  ["to be bereaved of", "丧失；失去亲近的人"],
  ["to be connected (to)", "连接到；关联到"],
  ["to be consumed", "被消耗；耗尽"],
  ["to be different", "不同；有差异"],
  ["to be exhausted", "耗尽；筋疲力尽"],
  ["to be lost (e.g. luggage)", "丢失；遗失"],
  ["to be missing", "不见；缺失"],
  ["to be run out", "用完；耗尽"],
  ["to be transformed", "变形；被改变"],
  ["to be used up", "用尽；耗尽"],
  ["to be cured", "被治好；痊愈"],
  ["to be dyed", "被染上；染成"],
  ["to be restored", "恢复；复原"],
  ["to be stained", "被沾染；染上"],
  ["to be tainted", "被玷污；被污染"],
  ["to become", "变成；成为"],
  ["to become aware (of)", "意识到；察觉到"],
  ["to begin to run", "开始跑"],
  ["to break", "断裂；折断"],
  ["to break into a run", "突然跑起来"],
  ["to carry out", "执行；完成"],
  ["to cause to become", "使变成"],
  ["to cease", "停止；终止"],
  ["to change", "改变；变化"],
  ["to close", "关闭；结束"],
  ["to come to an end", "结束；告终"],
  ["to connect", "连接；联系"],
  ["to concede (goals, points, etc.)", "失分；让分"],
  ["to cure", "治好；治愈"],
  ["to deceive", "欺骗"],
  ["to desire", "渴望；想要"],
  ["to die", "死亡；逝去"],
  ["to dislike", "讨厌；不喜欢"],
  ["to disregard", "无视；不顾"],
  ["to display", "展示；显示"],
  ["to do", "做；进行"],
  ["to do accidentally", "不小心做；无意中做"],
  ["to do completely", "彻底做完"],
  ["to do without meaning to", "无意中做"],
  ["to drop", "落下；丢下"],
  ["to end", "结束"],
  ["to finish", "完成；结束"],
  ["to get", "得到；变得"],
  ["to get better", "好转；恢复"],
  ["to get well", "好起来；痊愈"],
  ["to get under way", "开始进行；启程"],
  ["to grasp", "理解；抓住"],
  ["to grow", "成长；变得"],
  ["to happen to do", "碰巧做；不小心做"],
  ["to hate", "讨厌；憎恨"],
  ["to hold out", "伸出；坚持"],
  ["to look dead", "看起来没有生气"],
  ["to loathe", "厌恶；憎恶"],
  ["to lose", "失去；输掉"],
  ["to lose (a loved one)", "失去亲近的人"],
  ["to lose spirit", "失去精神；泄气"],
  ["to lose vigor", "失去活力"],
  ["to love", "爱；喜欢"],
  ["to maintain", "维持；保持"],
  ["to make (into)", "做成；使变为"],
  ["to make (something or someone) look ...", "使某物或某人显得……"],
  ["to make (something) worth watching", "使……值得一看"],
  ["to miss (a chance, opportunity)", "错过机会"],
  ["to move (towards)", "朝……移动"],
  ["to move to", "搬到；移动到"],
  ["to notice", "注意到；察觉"],
  ["to pass away", "去世；逝去"],
  ["to perceive", "察觉；感知"],
  ["to perform", "进行；表演"],
  ["to present", "提出；呈现"],
  ["to present an appearance of ...", "呈现出……的样子"],
  ["to recover (from an illness)", "康复；从病中恢复"],
  ["to reach", "到达；达到"],
  ["to realise", "意识到；明白"],
  ["to realize", "意识到；明白"],
  ["to see", "看见；明白"],
  ["to sense", "感觉到"],
  ["to show", "显示；给……看"],
  ["to start moving (e.g. a vehicle)", "开始移动（如车辆）"],
  ["to start running", "开始跑起来"],
  ["to stop", "停止"],
  ["to strike", "打；击中"],
  ["to take off", "起飞；出发"],
  ["to turn", "转向；变成"],
  ["to turn (into)", "变成"],
  ["to vary", "变化；不同"],
  ["to be entertaining", "有看头；有趣"],
  ["to heal", "治愈；痊愈"],
  ["to infect", "感染"],
  ["to steep", "浸透；沉浸"]
]);

function stripLeadingTo(gloss) {
  return gloss.replace(/^to\s+/i, "");
}

function translateGlossToChinese(gloss) {
  const compact = gloss.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const exact = glossZh.get(compact) ?? glossZh.get(compact.toLowerCase());
  if (exact) return exact;

  const withoutParenthetical = compact.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const withoutParentheticalExact =
    glossZh.get(withoutParenthetical) ?? glossZh.get(withoutParenthetical.toLowerCase());
  if (withoutParentheticalExact) return withoutParentheticalExact;

  if (/^to\s+/i.test(compact)) {
    const bare = stripLeadingTo(withoutParenthetical).toLowerCase();
    const bareExact = glossZh.get(bare) ?? glossZh.get(`to ${bare}`);
    if (bareExact) return bareExact;
  }

  return "";
}

function compactChineseDefinition(values, contextMeaning) {
  const translated = uniqueValues(
    values
      .map(translateGlossToChinese)
      .flatMap((value) => value.split("；"))
      .map((value) => value.trim())
  )
    .filter(Boolean)
    .slice(0, 8);
  if (translated.length) return translated.join("；");
  return `结合本句可理解为：${contextMeaning}`;
}

function addDictionaryEntry(map, key, entry) {
  if (!key) return;
  const items = map.get(key) ?? [];
  items.push(entry);
  map.set(key, items);
}

function loadKotobakoLookups() {
  const data = JSON.parse(fs.readFileSync(kotobakoPath, "utf8"));
  const byWord = new Map();
  const byReading = new Map();
  const byKey = new Map();

  for (const entry of data.datasets.vocab) {
    const reading = toHiragana(entry.reading);
    const words = uniqueValues([entry.word, entry.altWord]);
    for (const word of words) {
      addDictionaryEntry(byWord, word, entry);
      addDictionaryEntry(byKey, `${word}|${reading}`, entry);
    }
    addDictionaryEntry(byReading, reading, entry);
  }

  return { byWord, byReading, byKey, version: data.version };
}

function scoreDictionaryEntry(entry, word) {
  const reading = toHiragana(entry.reading);
  let score = 0;
  if (entry.word === word.japanese) score += 20;
  if (entry.altWord === word.japanese) score += 18;
  if (word.forms?.includes(entry.word) || word.forms?.includes(entry.altWord)) score += 28;
  if (word.forms?.includes(reading)) score += 26;
  if (reading === word.kana) score += 6;
  if (entry.jlpt === word.jlptLevel) score += 2;
  return score;
}

function findDictionaryDefinition(word, lookups) {
  if (word.source === "lyric-grammar") return null;
  const candidates = [
    ...(lookups.byKey.get(`${word.japanese}|${word.kana}`) ?? []),
    ...(word.forms ?? []).flatMap((form) => lookups.byKey.get(`${form}|${word.kana}`) ?? []),
    ...(lookups.byWord.get(word.japanese) ?? []),
    ...(word.forms ?? []).flatMap((form) => lookups.byWord.get(form) ?? []),
    ...(word.forms ?? []).flatMap((form) => lookups.byReading.get(form) ?? []),
    ...(lookups.byReading.get(word.kana) ?? [])
  ];
  const best = uniqueValues(candidates)
    .filter((entry) => entry.meanings?.length)
    .map((entry) => ({ entry, score: scoreDictionaryEntry(entry, word) }))
    .sort((a, b) => b.score - a.score)[0]?.entry;

  if (!best) return null;
  const meanings = best.meanings.map((meaning) => meaning.replace(/\s+/g, " ").trim()).filter(Boolean);
  return {
    en: compactDefinition(meanings),
    zh: compactChineseDefinition(meanings, word.exampleZh),
    partOfSpeechEn: best.pos ?? "",
    source: "kotobako-jmdict"
  };
}

function enrichLyricVocabulary(words, lookups) {
  let resolved = 0;
  for (const word of words) {
    const definition = findDictionaryDefinition(word, lookups);
    if (!definition?.en) continue;
    resolved += 1;
    word.zh = definition.zh;
    word.en = definition.en;
    word.introZh = `词典释义：${definition.zh}。出自例句「${word.exampleJp}」。`;
    word.introEn = `Meaning: ${definition.en}. Dictionary data: local Kotobako/JMdict.`;
    if (definition.partOfSpeechEn && !word.partOfSpeech.includes(definition.partOfSpeechEn)) {
      word.partOfSpeech = `${word.partOfSpeech}; ${definition.partOfSpeechEn}`;
    }
    word.source = definition.source;
  }
  return resolved;
}

function makeLyricWord({ id, token, reading, romaji, song, line }) {
  const surface = token.surface_form;
  const basic = token.basic_form && token.basic_form !== "*" ? token.basic_form : surface;
  const labels = posLabel(token.pos);
  const forms = uniqueValues([basic !== surface ? basic : ""]);
  const contextMeaning = line.zh || `the lyric line "${line.japanese}"`;
  const fallbackZh = latinPattern.test(surface)
    ? `英语歌词词：${surface}`
    : `语境释义：${contextMeaning}`;
  const fallbackEn = latinPattern.test(surface)
    ? surface
    : `Context meaning: ${contextMeaning}`;
  const grammarMeaning = grammarMeanings.get(surface);

  return {
    id,
    japanese: surface,
    kana: reading,
    romaji,
    zh: grammarMeaning?.[0] ?? fallbackZh,
    en: grammarMeaning?.[1] ?? fallbackEn,
    partOfSpeech: `${labels.zh} / ${labels.en}`,
    introZh: grammarMeaning
      ? `语法说明：${grammarMeaning[0]} 出自例句「${line.japanese}」。`
      : `读作「${reading}」。本句语境：${contextMeaning}`,
    introEn: grammarMeaning
      ? `${grammarMeaning[1]} Example line: "${line.japanese}".`
      : `Read as "${romaji}". Context: ${contextMeaning}`,
    exampleJp: line.japanese,
    exampleZh: line.zh || `《${song.titleJp}》中的一句歌词。`,
    exampleEn: `Example line from "${song.titleJp}" by ${song.artistJp}.`,
    tags: ["lyrics", `artist-${song.category}`, `jlpt-${levelForSong(song).toLowerCase()}`],
    jlptLevel: levelForSong(song),
    source: grammarMeaning ? "lyric-grammar" : "user-provided-lyrics",
    ...(forms.length ? { forms } : {})
  };
}

function withReadingOptions(words) {
  const readingsBySurface = new Map();
  for (const word of words) {
    addToMapList(readingsBySurface, word.japanese, word.kana);
  }

  return words.map((word) => {
    const readings = uniqueValues(readingsBySurface.get(word.japanese) ?? []);
    if (readings.length <= 1) return word;
    return {
      ...word,
      readingOptions: readings,
      romajiOptions: readings.map((reading) => wanakana.toRomaji(reading))
    };
  });
}

function writeArtistPacks(packs) {
  const header = `// Generated by scripts/generate-lyric-study-data.mjs from user-provided local lyric DOCX imports.\n// Source files: /Users/linxuan/Documents/lyrics/fujikaze.docx and /Users/linxuan/Documents/lyrics/togenashi togeari.docx\nimport type { SongPack } from "./studyContent";\n\n`;
  fs.writeFileSync(
    artistPath,
    `${header}export const artistSongPacks: SongPack[] = ${JSON.stringify(packs, null, 2)};\n`
  );
}

function writeLyricVocabulary(words) {
  const header = `// Generated by scripts/generate-lyric-study-data.mjs.\n// These entries cover lyric tokens not already present in the bundled JLPT vocabulary snapshot.\nimport type { StudyWord } from "./studyContent";\n\n`;
  fs.writeFileSync(
    lyricVocabularyPath,
    `${header}export const lyricVocabulary: StudyWord[] = ${JSON.stringify(words, null, 2)};\n`
  );
}

const packs = loadArtistPacks();
const generatedVocabulary = JSON.parse(fs.readFileSync(generatedVocabularyPath, "utf8"));
const existingLookups = makeExistingLookups(generatedVocabulary);
const kotobakoLookups = loadKotobakoLookups();
const tokenizer = await buildTokenizer();
const lyricWordsByKey = new Map();
const createdLookups = makeExistingLookups([]);
let createdCounter = 1;

for (const song of packs) {
  for (const line of song.lines) {
    const tokens = tokenizer.tokenize(line.japanese).filter(shouldKeepToken);
    const tokenIds = [];
    const tokenSurfaces = [];
    const tokenReadings = [];
    const tokenRomaji = [];

    for (const token of tokens) {
      const surface = token.surface_form;
      const reading = readingForToken(token);
      const romaji = romajiForToken(token, reading);
      const grammarId = grammarLookup.get(surface);
      const existing = grammarId ? null : findExistingWord(token, reading, existingLookups);
      let tokenId = grammarId || existing?.id;

      if (!tokenId) {
        const key = `${surface}|${reading}`;
        let lyricWord = lyricWordsByKey.get(key);
        if (!lyricWord) {
          const id = `lyric-${stableCode(surface)}-${createdCounter}`;
          createdCounter += 1;
          lyricWord = makeLyricWord({ id, token, reading, romaji, song, line });
          lyricWordsByKey.set(key, lyricWord);
          addToMapList(createdLookups.bySurface, surface, lyricWord);
          createdLookups.byKey.set(key, lyricWord);
        }
        tokenId = lyricWord.id;
      }

      tokenIds.push(tokenId);
      tokenSurfaces.push(surface);
      tokenReadings.push(reading);
      tokenRomaji.push(romaji);
    }

    line.tokenIds = tokenIds;
    line.tokenSurfaces = tokenSurfaces;
    line.tokenReadings = tokenReadings;
    line.tokenRomaji = tokenRomaji;
    line.kana = tokenReadings.join(" ");
    line.romaji = tokenRomaji.join(" ");
  }
}

const lyricVocabulary = withReadingOptions(Array.from(lyricWordsByKey.values()));
const resolvedDefinitions = enrichLyricVocabulary(lyricVocabulary, kotobakoLookups);
writeArtistPacks(packs);
writeLyricVocabulary(lyricVocabulary);

console.log(`Updated ${packs.length} songs.`);
console.log(`Generated ${lyricVocabulary.length} lyric vocabulary entries.`);
console.log(`Resolved ${resolvedDefinitions} English definitions from Kotobako/JMdict.`);
