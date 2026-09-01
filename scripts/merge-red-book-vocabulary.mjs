import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import kuromoji from "kuromoji";
import * as wanakana from "wanakana";
import { buildVocabularyExample } from "./vocabulary-examples.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(rootDir, "src/data/generatedVocabulary.json");
const kotobakoPath = path.join(rootDir, "node_modules/kotobako-data/kotobako-static.json");

const rawPath = process.argv[2];
if (!rawPath) {
  console.error("Usage: node scripts/merge-red-book-vocabulary.mjs /path/to/red-book-raw.json");
  process.exit(1);
}

const rawEntries = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const existing = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
const kotobako = JSON.parse(fs.readFileSync(kotobakoPath, "utf8")).datasets?.vocab ?? [];

const dictionaryByKey = new Map();
for (const entry of kotobako) {
  for (const key of [entry.word, entry.altWord, entry.reading].filter(Boolean)) {
    const bucket = dictionaryByKey.get(key) ?? [];
    bucket.push(entry);
    dictionaryByKey.set(key, bucket);
  }
}

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji
    .builder({ dicPath: path.join(rootDir, "node_modules/kuromoji/dict") })
    .build((error, builtTokenizer) => {
      if (error) reject(error);
      else resolve(builtTokenizer);
    });
});

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[［］]/g, "")
    .trim();
}

function normalizeJapanese(value) {
  return cleanText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ \t\n\r　]/g, "")
    .replace(/[。．.、，,！？!?「」『』（）()[\]【】]/g, "");
}

function safeIdPart(value) {
  return normalizeJapanese(value).replace(/[^ぁ-んァ-ンー一-龥々a-z0-9]/gi, "").slice(0, 24) || "word";
}

function cleanJapanese(value) {
  return cleanText(value)
    .replace(/･/g, "・")
    .replace(/厶/g, "ム")
    .replace(/丿/g, "")
    .replace(/／/g, "/")
    .replace(/[|｜]/g, "/")
    .replace(/^ffl/u, "")
    .replace(/^F小説$/u, "SF小説")
    .replace(/^U(?=出家)/u, "")
    .replace(/^霜(?=手厳しい|愛らしい)/u, "")
    .replace(/^韻(?=育成|家庭的)/u, "")
    .replace(/^題(?=漱ぐ)/u, "")
    .replace(/^筒(?=魅入る)/u, "")
    .replace(/^圜(?=有様)/u, "")
    .replace(/^覆(?=どんなに)/u, "")
    .replace(/^ラスメント$/u, "ハラスメント")
    .replace(/^ーチ$/u, "アプローチ")
    .replace(/^ートル$/u, "立方メートル")
    .replace(/先倒心/g, "先倒し")
    .replace(/青ニオ/g, "青二才")
    .replace(/手つ取り早い/g, "手っ取り早い")
    .replace(/待ち住びる/g, "待ち侘びる")
    .replace(/下捋え/g, "下拵え")
    .replace(/^(?:原貫!?|匱］|IB!|Iffl|cm|陶|麗|顒|隔|團|固|冒|躅|瀬|闔|圏|園|飼)+/u, "")
    .replace(/^[・•]+/, "")
    .trim();
}

function cleanKana(value) {
  const cleaned = cleanText(value)
    .replace(/[A-Za-z]+/g, "")
    .replace(/[®©①②③④⑤⑥⑦⑧⑨⑩◎⓪〇○0-9]/g, "")
    .replace(/[()（）]/g, "")
    .trim();
  if (cleaned.length > 24 || /[一-龥]/.test(cleaned)) return "";
  return cleaned;
}

function isKana(value) {
  return /^[ぁ-んァ-ンー・]+$/.test(value);
}

function toKana(value, dictionaryEntry) {
  const cleaned = cleanKana(value);
  if (isKana(cleaned)) return wanakana.toHiragana(cleaned);
  if (dictionaryEntry?.reading) return wanakana.toHiragana(dictionaryEntry.reading);
  const tokenized = tokenizerReading(cleanJapanese(value));
  if (tokenized) return tokenized;
  return wanakana.toHiragana(cleanJapanese(value));
}

function tokenizerReading(value) {
  if (!value || /^[A-Za-z0-9]+$/.test(value)) return "";
  const tokens = tokenizer.tokenize(value);
  const readings = tokens.map((token) => {
    const surface = token.surface_form || "";
    if (/^[ぁ-んァ-ンー]+$/.test(surface)) return wanakana.toHiragana(surface);
    return token.reading && token.reading !== "*" ? wanakana.toHiragana(token.reading) : "";
  });
  if (readings.some((reading) => !reading)) return "";
  return readings.join("");
}

function findDictionaryEntry(japanese, kana) {
  const candidates = [
    ...(japanese ? dictionaryByKey.get(japanese) ?? [] : []),
    ...(kana ? dictionaryByKey.get(kana) ?? [] : [])
  ];
  if (!candidates.length) return null;
  return candidates
    .map((entry) => {
      let score = 0;
      if (wanakana.toHiragana(entry.reading || "") === kana) score += 8;
      if (entry.word === japanese) score += 5;
      if (entry.altWord === japanese) score += 4;
      if (entry.word === kana) score += 2;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score)[0].entry;
}

function preferredJapanese(rawJapanese, kana, dictionaryEntry, rawReading) {
  if (/image\s*up|imageup/i.test(rawReading || "") && /ジアップ|イメージ/.test(rawJapanese)) {
    return "イメージアップ";
  }
  if (/positive/i.test(rawReading || "") && rawJapanese === "ポジティ") return "ポジティブ";
  if (!dictionaryEntry) return rawJapanese;
  if (normalizeJapanese(dictionaryEntry.word || "") === normalizeJapanese(rawJapanese)) {
    return rawJapanese;
  }
  const dictionarySurface =
    dictionaryEntry.word && normalizeJapanese(dictionaryEntry.word) !== normalizeJapanese(kana)
      ? dictionaryEntry.word
      : dictionaryEntry.altWord;
  if (!dictionarySurface) return rawJapanese;
  const normalizedRaw = normalizeJapanese(rawJapanese);
  const normalizedDictionary = normalizeJapanese(dictionarySurface);
  if (/^[ぁ-ん]+$/.test(rawJapanese) && /[一-龥]/.test(dictionarySurface)) {
    return dictionarySurface;
  }
  if (
    normalizedDictionary.endsWith(normalizedRaw) &&
    normalizedDictionary.length <= normalizedRaw.length + 2
  ) {
    return dictionarySurface;
  }
  if (normalizedRaw.length <= 2 && wanakana.toHiragana(dictionaryEntry.reading || "") === kana) {
    return dictionarySurface;
  }
  return rawJapanese;
}

const zhToEnglishRules = [
  [/继承|传承/, "to inherit; to carry on"],
  [/接住|接受|理解/, "to catch; to accept; to understand"],
  [/被动|消极/, "passive; negative"],
  [/漩涡/, "vortex; whirlpool"],
  [/埋|掩埋|占满|填满/, "to bury; to fill"],
  [/可疑|怀疑|不可靠/, "suspicious; doubtful"],
  [/宏大|广大|广阔/, "vast; extensive"],
  [/考虑|斟酌/, "consideration; to consider"],
  [/遮挡|阻挡|打断/, "to block; to interrupt"],
  [/违背|违抗|违反/, "to go against; to disobey"],
  [/悄悄|偷偷/, "secretly; quietly"],
  [/察觉|体察/, "to detect; to perceive"],
  [/滚|滚转/, "to roll"],
  [/拥挤|人群/, "crowd; congestion"],
  [/深处|深度/, "depth"],
  [/边|框架/, "edge; frame"],
  [/不正当|不合理/, "unfair; improper"],
  [/摇晃|闲逛|无所事事/, "to dangle; to stroll; idle"],
  [/空白/, "blank; gap"],
  [/妨碍|阻挡/, "to block; to obstruct"],
  [/并行|同时进行/, "parallel; concurrent"],
  [/并列|并联/, "parallel; side by side"],
  [/操作|操纵|驾驶/, "to operate; to control"],
  [/错误|误解/, "mistake; error"],
  [/甜/, "sweet"],
  [/剩余|多余|过度/, "to remain; excess"],
  [/撒娇|任性/, "to act spoiled; to depend on"],
  [/雨具/, "rain gear"],
  [/鸦片/, "opium"],
  [/进一步|更加/, "further; additional"],
  [/否则|不然/, "otherwise"],
  [/作用|功能/, "function; effect"],
  [/夺取|掠夺|赢得/, "to snatch; to win"],
  [/疏浚/, "to dredge"],
  [/复习/, "to review"],
  [/小额高利贷/, "consumer loan"],
  [/晒|曝|暴露/, "to expose; to air"],
  [/妨碍|危害|不利/, "to hinder; harmful"],
  [/酸味|酸/, "acid; sourness"],
  [/统治下|旗帜下/, "under control; umbrella"],
  [/氧化/, "oxidation"],
  [/招聘|征聘/, "recruiting"],
  [/救济|救助|拯救/, "relief; rescue"],
  [/休止|中止|停止/, "pause; suspension"],
  [/宫殿/, "palace"],
  [/宫廷/, "court"],
  [/旧友|故交/, "old acquaintance"],
  [/困境|窘境/, "predicament"],
  [/球根/, "bulb"],
  [/最终|究竟|毕竟/, "ultimate; final"],
  [/嗅觉/, "sense of smell"],
  [/听觉/, "hearing"],
  [/视觉/, "vision"],
  [/味觉/, "taste"],
  [/领导|带领|领先/, "leadership; to lead"],
  [/回收|罢免/, "recall; recovery"],
  [/陆上|田径/, "land; athletics"],
  [/道理|理由|理论|歪理/, "reason; logic"],
  [/利己|自私/, "selfish"],
  [/恋爱|爱情/, "love; romance"],
  [/情书/, "love letter"],
  [/等级|次序/, "rank"],
  [/滥用/, "abuse; misuse"],
  [/粗略|草率|粗糙|粗鲁/, "rough; careless"],
  [/相扑|力士/, "sumo wrestler"],
  [/要求|点播/, "request"],
  [/价值|价格/, "value; price"],
  [/螺丝刀|改锥/, "screwdriver"],
  [/沼泽/, "marsh; swamp"],
  [/嫉妒|羡慕/, "jealous; envious"],
  [/底片|否定/, "negative"],
  [/主人|物主/, "owner; master"],
  [/声音|音色/, "sound; tone"],
  [/偷偷溜走|脱身|脱落/, "to slip out; to escape; to come off"],
  [/杰出|出众/, "outstanding"],
  [/粗略|大致/, "rough; approximate"],
  [/积极|主动/, "positive; proactive"],
  [/消极/, "negative; passive"]
];

function englishFromZh(zh) {
  const text = cleanText(zh);
  for (const [pattern, english] of zhToEnglishRules) {
    if (pattern.test(text)) return english;
  }
  return text ? `meaning: ${text}` : "N1 vocabulary item";
}

const englishToZhRules = [
  [/authority|leading figure|master/, "权威；大师"],
  [/include|including|whole|entire/, "包括；全部"],
  [/subtract|deduct|offset/, "扣除；抵消"],
  [/strict|severe|stern/, "严厉；严格"],
  [/incessant|continuous|without pause|constant/, "接连不断地"],
  [/formidable|tough|shrewd|strong-willed/, "难对付；精明强悍"],
  [/moist|damp|quietly elegant/, "湿润；沉静"],
  [/generally|mostly|in general/, "一般；总的来说"],
  [/gesture|appearance|behavior|behaviour/, "神态；举止"],
  [/self-inflicted|one's own fault|karma/, "自作自受"],
  [/high place|height|elevation/, "高处"],
  [/save up|reserve|installment|instalment/, "积攒；分期储蓄"],
  [/distance|move away|estrange/, "使远离；疏远"],
  [/long ago|already/, "早就；老早"],
  [/shower|rain shower/, "骤雨"],
  [/debit|withdraw|pull down/, "划账；拉下"],
  [/single-minded|earnest|devoted/, "一心一意；专心致志"],
  [/less than|not reaching/, "不足；不满"],
  [/covered with|smeared with/, "沾满"],
  [/sob|whimper|cry/, "低声哭泣；抽泣"],
  [/scheme|plan|plot/, "策划；图谋"],
  [/list up|make a list/, "列出；列表"],
  [/custom[- ]made|made to order/, "定制"],
  [/support|backing|patronage|recommendation/, "扶持；提拔；支持"],
  [/immature|greenhorn|youngster/, "年轻幼稚的人"],
  [/frank|naked|bare/, "赤裸裸；坦率"],
  [/face down|prone/, "俯卧；脸朝下"],
  [/dumbfounded|taken aback|astonished/, "目瞪口呆"],
  [/malignant|evil|bad/, "恶性；坏"],
  [/redden|blush/, "发红；脸红"],
  [/\bbase\b|\bmean\b|vulgar/, "卑鄙；下流"],
  [/piece of cake|easy/, "轻而易举"],
  [/homey|cozy|cosy/, "像家一样舒适"],
  [/anticlimactic|too easy|disappointing/, "没劲；不尽兴"],
  [/aluminum sash|aluminium sash/, "铝合金窗框"],
  [/wet tissue|wet wipe/, "湿纸巾"],
  [/holiday|festival day/, "节假日"],
  [/guilty|ashamed/, "内疚；惭愧"],
  [/suspicious|strange|doubtful/, "可疑；奇怪"],
  [/intimate|open up|become friendly/, "亲近；打成一片"],
  [/break down|defeat|destroy/, "打破；击败"],
  [/outgoing|extroverted/, "外向的"],
  [/clear and bright|cheerful/, "晴朗；心情舒畅"],
  [/ignorant|unfamiliar|distant/, "不熟悉；疏远"],
  [/look up|face upward/, "仰起脸；向上看"],
  [/change with time|transition/, "变迁；推移"],
  [/empty|hollow|vacant/, "空洞；茫然"],
  [/by nature|born/, "天生"],
  [/reclaim|fill in/, "填海造地；填埋"],
  [/overwrite|superscription/, "覆盖写入；写在表面"],
  [/uranium/, "铀"],
  [/improve|turn upward/, "好转；上升"],
  [/decline|turn downward/, "下降；衰退"],
  [/absent-minded/, "心不在焉"],
  [/absolutely not|flatly refuse/, "绝对不干；坚决拒绝"],
  [/essay/, "随笔；散文"],
  [/extra|bit player/, "临时演员；额外的"],
  [/scoop out|gouge|probe deeply/, "挖出；揭露"],
  [/eco[- ]mark|ecology mark/, "环保标志"],
  [/science fiction|sci-fi/, "科幻小说"],
  [/heal|comfort|soothe/, "治愈；安慰"],
  [/excessively|strangely|awfully/, "异常；特别"],
  [/harassment/, "骚扰"],
  [/sarcasm|spite/, "讽刺；挖苦"],
  [/bay|inlet/, "海湾"],
  [/container|case|holder/, "容器；盒子"],
  [/interchange/, "立交桥；互通式立交"],
  [/contract|guarantee|warranty/, "承诺；担保"],
  [/weekday/, "工作日"],
  [/urgent|prompt|immediate/, "紧急；迅速"]
];

function chineseFromEnglish(english) {
  const text = cleanText(english).toLowerCase();
  if (text.startsWith("meaning:")) return "";
  for (const [pattern, zh] of englishToZhRules) {
    if (pattern.test(text)) return zh;
  }
  return "";
}

function looksPollutedZh(value) {
  return (
    /[ぁ-んァ-ヶー]/.test(value) ||
    /[A-Za-z]{2,}/.test(value) ||
    /[•■△□]|名[•・]|動[123]?|自動|他動|ナ形|イ形/.test(value) ||
    /[）)]$/.test(value) ||
    value.length <= 1
  );
}

function cleanZh(value) {
  return cleanText(value)
    .replace(/[•・■△□].*$/u, "")
    .replace(/\b[A-Z]\s*.*/u, "")
    .replace(/名[•・].*$/u, "")
    .replace(/[自他]?動[123]?.*$/u, "")
    .replace(/[ぁ-んァ-ヶー].*$/u, "")
    .replace(/\s+[^,，;；（）()、。]{2,}$/u, (tail) => {
      const head = tail.trim();
      return /^(的|地|得|而|和|或|及|以及)/.test(head) ? tail : "";
    })
    .replace(/[（(][^）)]*$/u, "")
    .replace(/[\"“”'’]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[，,;；、。:：-]+$/u, "");
}

function englishForSpecialCase(japanese, zh, dictionaryEnglish) {
  const specials = new Map([
    ["イメージアップ", "image improvement; improving one's public image"],
    ["ひらめき", "flash of insight; inspiration"],
    ["閃き", "flash of insight; inspiration"],
    ["挽回", "recovery; to recover lost ground"],
    ["自ずと", "naturally; of its own accord"],
    ["ポジティブ", "positive; proactive"],
    ["乃至", "from ... to; or"],
    ["枠組み", "framework; outline"],
    ["精一杯", "with all one's strength; as much as possible"],
    ["からっと", "dry and crisp; cheerfully; suddenly clearing"],
    ["カスタムメード", "custom-made; made to order"],
    ["アルミサッシ", "aluminum sash; aluminum window frame"],
    ["ハラスメント", "harassment"],
    ["青二才", "greenhorn; immature youngster"],
    ["SF小説", "science fiction novel"],
    ["家庭的", "homey; family-like; warm"],
    ["育成", "training; cultivation; fostering"],
    ["有様", "state; condition; situation"],
    ["どんなに", "no matter how; how much"],
    ["先倒し", "moving up a schedule; doing ahead of time"],
    ["亜〜", "sub-; quasi-; semi-"],
    ["申し付ける", "to order; to command"],
    ["たった今", "just now; a moment ago"],
    ["ウェットティッシュ", "wet tissue; wet wipe"],
    ["晴れ晴れしい", "bright and clear; cheerful"],
    ["移り変わる", "to change; to transition"],
    ["ウラニウム", "uranium"],
    ["掛け〜", "credit; on account"],
    ["〜気触れ", "being strongly influenced by; craze for"],
    ["駆られる", "to be driven by; to be compelled by"],
    ["気恥ずかしい", "embarrassed; shy"],
    ["賛否両論", "pros and cons; divided opinions"],
    ["意気揚々", "triumphant; in high spirits"],
    ["有り触れる", "common; ordinary"],
    ["拗らせる", "to complicate; to aggravate"],
    ["こじらす", "to complicate; to aggravate"],
    ["事と次第では", "depending on the circumstances"],
    ["支離滅裂", "incoherent; disorganized"],
    ["しぶとい", "tenacious; stubbornly tough"],
    ["ショーウインドー", "show window; display window"],
    ["漱ぐ", "to rinse; to gargle"],
    ["セールスポイント", "selling point"],
    ["〜タワー", "tower"],
    ["単〜", "single; mono-"],
    ["継ぎ目", "joint; seam"],
    ["ディスプレー", "display; exhibition"],
    ["とんぼがえり", "somersault; quick return trip"],
    ["干し〜", "dried"],
    ["褒め称える", "to praise highly"],
    ["待ち侘びる", "to wait impatiently"],
    ["マルチ〜", "multi-"],
    ["手っ取り早い", "quick; handy; simple"],
    ["ムードアップ", "improving the mood; livening up the atmosphere"],
    ["働かす", "to make work; to put to work"],
    ["立方メートル", "cubic meter"],
    ["下拵え", "preparation; preliminary arrangement"],
    ["余所余所しい", "distant; cold; formal"],
    ["ワンパターン", "stereotyped; predictable"]
  ]);
  return specials.get(japanese) ?? (dictionaryEnglish || englishFromZh(zh));
}

function zhForSpecialCase(japanese, zh, existingZh, english) {
  const specials = new Map([
    ["イメージアップ", "提升形象；改善印象"],
    ["ひらめき", "灵感；闪念"],
    ["閃き", "灵感；闪念"],
    ["挽回", "挽回；恢复"],
    ["自ずと", "自然而然地"],
    ["ポジティブ", "积极；正面；主动"],
    ["乃至", "至；到；或者"],
    ["枠組み", "框架；结构"],
    ["精一杯", "竭尽全力；最大限度"],
    ["からっと", "干爽；爽朗；一下子放晴"],
    ["頑固", "顽固；固执"],
    ["口出し", "插嘴；干涉"],
    ["頑な", "顽固；固执"],
    ["手間", "时间和劳力；工夫"],
    ["焦がす", "烧焦；烤焦"],
    ["宛てる", "寄给；写给"],
    ["霞", "霞；薄雾"],
    ["いろは", "基础；入门"],
    ["会わす", "使一致；合并"],
    ["ポイント", "要点；分数；点"],
    ["オートマチック", "自动；自动档"],
    ["画", "笔画"],
    ["管", "管子；管道"],
    ["苗字", "姓氏"],
    ["菌", "细菌；菌类"],
    ["茎", "茎"],
    ["交渉", "谈判；交涉"],
    ["天国", "天堂"],
    ["目指す", "以……为目标"],
    ["差し支える", "妨碍；不方便"],
    ["師", "老师；师傅"],
    ["鹿", "鹿"],
    ["占う", "占卜；预测"],
    ["鷹", "鹰"],
    ["鉛", "铅"],
    ["逃がす", "放走；错过"],
    ["肺", "肺"],
    ["計り知れない", "无法估量"],
    ["火", "火"],
    ["仏", "佛；佛像"],
    ["邦人", "本国人；日本人"],
    ["免れる", "避免；逃脱"],
    ["魅入る", "看入迷；被迷住"],
    ["薬", "药"],
    ["休める", "使休息；暂停"],
    ["隣国", "邻国"],
    ["レス", "回复；回应"],
    ["カスタムメード", "定制"],
    ["アルミサッシ", "铝合金窗框"],
    ["ハラスメント", "骚扰"],
    ["青二才", "毛头小子；经验不足的人"],
    ["SF小説", "科幻小说"],
    ["家庭的", "像家庭一样；亲切舒适"],
    ["育成", "培养；培育"],
    ["有様", "样子；情况"],
    ["どんなに", "无论多么；多么"],
    ["先倒し", "提前；提早办理"],
    ["亜〜", "亚；次"],
    ["申し付ける", "吩咐；命令"],
    ["たった今", "刚刚"],
    ["ウェットティッシュ", "湿纸巾"],
    ["晴れ晴れしい", "晴朗；心情舒畅"],
    ["移り変わる", "变迁；转变"],
    ["ウラニウム", "铀"],
    ["掛け〜", "赊账；记账"],
    ["〜気触れ", "受……影响而迷恋"],
    ["駆られる", "被驱使；受……影响"],
    ["気恥ずかしい", "害羞；难为情"],
    ["賛否両論", "赞成和反对两种意见"],
    ["意気揚々", "得意扬扬"],
    ["有り触れる", "常见；司空见惯"],
    ["拗らせる", "使复杂化；使恶化"],
    ["こじらす", "使复杂化；使恶化"],
    ["事と次第では", "根据情况"],
    ["支離滅裂", "支离破碎；毫无条理"],
    ["しぶとい", "顽强；难对付"],
    ["ショーウインドー", "橱窗"],
    ["漱ぐ", "漱口；涮洗"],
    ["セールスポイント", "卖点"],
    ["〜タワー", "塔"],
    ["単〜", "单……"],
    ["継ぎ目", "接缝；连接处"],
    ["ディスプレー", "陈列；显示器"],
    ["とんぼがえり", "翻筋斗；当天返回"],
    ["干し〜", "干……"],
    ["褒め称える", "极力称赞"],
    ["待ち侘びる", "焦急等待"],
    ["マルチ〜", "多功能；多……"],
    ["手っ取り早い", "快捷；简便"],
    ["ムードアップ", "提升气氛"],
    ["働かす", "使工作；开动"],
    ["立方メートル", "立方米"],
    ["下拵え", "预先准备"],
    ["余所余所しい", "冷淡；疏远"],
    ["ワンパターン", "老一套；模式单一"]
  ]);
  const special = specials.get(japanese);
  if (special) return special;

  const cleaned = cleanZh(zh);
  if (cleaned && !looksPollutedZh(cleaned)) return cleaned;

  const existing = cleanZh(existingZh);
  if (existing && !looksPollutedZh(existing)) return existing;

  return chineseFromEnglish(english) || cleaned || existing || "N1 词汇";
}

function partOfSpeech(rawPos, japanese) {
  const pos = cleanText(rawPos);
  const parts = [];
  if (pos.includes("名")) parts.push("noun");
  if (pos.includes("ナ形")) parts.push("na-adjective");
  if (pos.includes("イ形")) parts.push("i-adjective");
  if (pos.includes("副")) parts.push("adverb");
  if (pos.includes("連体")) parts.push("adnominal");
  if (pos.includes("接頭")) parts.push("prefix");
  if (pos.includes("接尾")) parts.push("suffix");
  if (pos === "接" || pos.includes("接続")) parts.push("conjunction");
  if (pos.includes("慣用")) parts.push("expression");
  if (pos.includes("自動")) parts.push("intransitive verb");
  if (pos.includes("他動")) parts.push("transitive verb");
  if (pos.includes("動3") || (pos.includes("名") && /する/.test(japanese))) parts.push("suru verb");
  if (!parts.length) parts.push("N1 word");
  return Array.from(new Set(parts)).join(" / ");
}

function formsFor(word, kana, pos) {
  const forms = new Set([word, kana]);
  const cleanWord = word.replace(/^〜|^～/u, "").replace(/〜$|～$/u, "");
  if (cleanWord !== word) forms.add(cleanWord);
  if (/suru verb|名•他動3|名•自動3|名・他動3|名・自動3/.test(pos)) {
    forms.add(`${cleanWord}する`);
    forms.add(`${kana}する`);
  }
  return Array.from(forms).filter(Boolean);
}

function buildEntry(raw, sequence, existingEntry) {
  const rawJapanese = cleanJapanese(raw.japanese);
  let provisionalKana = cleanKana(raw.reading);
  const firstDictionary = findDictionaryEntry(rawJapanese, wanakana.toHiragana(provisionalKana));
  let kana = toKana(provisionalKana || rawJapanese, firstDictionary);
  const dictionaryEntry = firstDictionary ?? findDictionaryEntry(rawJapanese, kana);
  const japanese = preferredJapanese(rawJapanese, kana, dictionaryEntry, raw.reading);
  if (!provisionalKana && normalizeJapanese(japanese) !== normalizeJapanese(rawJapanese)) {
    kana = dictionaryEntry?.reading ? wanakana.toHiragana(dictionaryEntry.reading) : wanakana.toHiragana(japanese);
  }
  const specialKana = new Map([
    ["イメージアップ", "いめーじあっぷ"],
    ["ポジティブ", "ぽじてぃぶ"],
    ["カスタムメード", "かすたむめーど"],
    ["アルミサッシ", "あるみさっし"],
    ["ハラスメント", "はらすめんと"],
    ["青二才", "あおにさい"],
    ["SF小説", "えすえふしょうせつ"],
    ["家庭的", "かていてき"],
    ["育成", "いくせい"],
    ["有様", "ありさま"],
    ["どんなに", "どんなに"],
    ["先倒し", "さきだおし"],
    ["浅ましい", "あさましい"],
    ["打ち破る", "うちやぶる"],
    ["賛否両論", "さんぴりょうろん"],
    ["申し付ける", "もうしつける"],
    ["ショーウインドー", "しょーういんどー"],
    ["セールスポイント", "せーるすぽいんと"],
    ["ディスプレー", "でぃすぷれー"],
    ["待ち侘びる", "まちわびる"],
    ["マルチ〜", "まるち"],
    ["手っ取り早い", "てっとりばやい"],
    ["ムードアップ", "むーどあっぷ"],
    ["立方メートル", "りっぽうめーとる"],
    ["下拵え", "したごしらえ"],
    ["ワンパターン", "わんぱたーん"]
  ]);
  if (specialKana.has(japanese)) kana = specialKana.get(japanese);
  const romaji = wanakana.toRomaji(kana);
  const dictionaryEnglish = cleanText(dictionaryEntry?.meanings?.join("; "));
  const en = cleanText(englishForSpecialCase(japanese, raw.zh, dictionaryEnglish));
  const zh = zhForSpecialCase(japanese, raw.zh, existingEntry?.zh, dictionaryEnglish || en);
  const pos = partOfSpeech(raw.pos || dictionaryEntry?.pos || "", japanese);
  const id = existingEntry?.id ?? `red-n1-${safeIdPart(japanese)}-${sequence}`;
  const word = {
    id,
    japanese,
    kana,
    romaji,
    zh,
    en,
    partOfSpeech: pos,
    introZh: "N1 红宝书词汇。释义根据用户提供的 PDF 词条整理，例句已按学习语境重写。",
    introEn: "N1 vocabulary imported from the Red Book PDF provided by the user, with rewritten study examples.",
    exampleJp: "",
    exampleZh: "",
    exampleEn: "",
    tags: ["jlpt-n1", "red-n1", "generated"],
    jlptLevel: "N1",
    source: "red-book-n1-pdf",
    forms: formsFor(japanese, kana, pos),
    readingOptions: [kana],
    romajiOptions: [romaji]
  };
  const example = buildVocabularyExample(word, sequence);
  const { partOfSpeech: _generatedPartOfSpeech, ...exampleFields } = example;
  return { ...word, ...exampleFields };
}

const existingByKey = new Map();
for (const word of existing) {
  existingByKey.set(`${normalizeJapanese(word.japanese)}|${normalizeJapanese(word.kana)}`, word);
  existingByKey.set(normalizeJapanese(word.japanese), word);
}

const importedByKey = new Map();
let sequence = 1;
const supplementalEntries = [
  {
    japanese: "精一杯",
    reading: "せいいっぱい",
    pos: "名・副",
    zh: "竭尽全力；最大限度"
  }
];

for (const raw of [...rawEntries, ...supplementalEntries]) {
  const japanese = cleanJapanese(raw.japanese);
  if (!japanese) continue;
  if (/^ー/.test(japanese)) continue;
  const provisionalKana = wanakana.toHiragana(cleanKana(raw.reading || ""));
  const exact = existingByKey.get(`${normalizeJapanese(japanese)}|${normalizeJapanese(provisionalKana)}`);
  const loose = existingByKey.get(normalizeJapanese(japanese));
  const entry = buildEntry(raw, sequence, exact ?? loose);
  if (!entry.kana || /[一-龥A-Za-z]/.test(entry.kana)) {
    sequence += 1;
    continue;
  }
  if (/^[一-龥]{1,2}$/.test(entry.japanese) && /^meaning:/.test(entry.en)) {
    sequence += 1;
    continue;
  }
  const key = normalizeJapanese(entry.japanese);
  const current = importedByKey.get(key);
  if (!current || entry.zh.length > current.zh.length) importedByKey.set(key, entry);
  sequence += 1;
}

const imported = Array.from(importedByKey.values());
const importedKeys = new Set(imported.map((word) => normalizeJapanese(word.japanese)));
const retained = existing.filter((word) => !importedKeys.has(normalizeJapanese(word.japanese)));
const merged = [...imported, ...retained];

fs.writeFileSync(generatedPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`Imported ${imported.length} red-book N1 entries. Generated vocabulary is now ${merged.length} entries.`);
