import { writeFile } from "node:fs/promises";
import https from "node:https";

const API = "https://jlpt-vocab-api.vercel.app/api/words";
const targets = {
  1: 1400,
  2: 800,
  3: 700,
  4: 350,
  5: 350
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "nihongo-jukebox-generator" } }, (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Request failed ${response.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          resolve(JSON.parse(data));
        });
      })
      .on("error", reject);
  });
}

function compactMeaning(meaning) {
  return String(meaning || "")
    .replace(/\s+/g, " ")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

function slug(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}ぁ-んァ-ンー一-龯]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function levelLabel(level) {
  return `N${level}`;
}

const phraseZh = new Map([
  ["agreement", "同意"],
  ["same opinion", "相同意见"],
  ["same feeling", "相同感受"],
  ["concurrence", "一致；赞同"],
  ["in some respects", "在某些方面"],
  ["to exist", "存在"],
  ["to have", "有"],
  ["to hasten", "使加快"],
  ["to quicken", "加快"],
  ["to expedite", "促进"],
  ["to precipitate", "促成"],
  ["to accelerate", "加速"],
  ["windmill", "风车"],
  ["pinwheel", "纸风车"],
  ["betting", "打赌"],
  ["gambling", "赌博"],
  ["a gamble", "赌注；冒险"],
  ["to amuse oneself", "自娱；玩乐"],
  ["to make merry", "尽情欢乐"],
  ["magnetism", "磁性；磁力"],
  ["perhaps", "也许"],
  ["possibly", "可能"],
  ["somewhere", "某处"],
  ["anywhere", "任何地方"],
  ["to remember", "记住；想起"],
  ["to forget", "忘记"],
  ["to understand", "理解"],
  ["to explain", "解释"],
  ["to express", "表达"],
  ["to decide", "决定"],
  ["to choose", "选择"],
  ["to compare", "比较"],
  ["to protect", "保护"],
  ["to continue", "继续"],
  ["to change", "改变"],
  ["to become", "变成"],
  ["to increase", "增加"],
  ["to decrease", "减少"],
  ["to raise", "提高；举起"],
  ["to lower", "降低"],
  ["to open", "打开"],
  ["to close", "关闭"],
  ["to begin", "开始"],
  ["to finish", "完成"],
  ["to end", "结束"],
  ["to stop", "停止"],
  ["to move", "移动"],
  ["to send", "发送；送出"],
  ["to receive", "接收"],
  ["to answer", "回答"],
  ["to ask", "询问"],
  ["to return", "返回"],
  ["to enter", "进入"],
  ["to leave", "离开"],
  ["to run", "跑"],
  ["to walk", "走"],
  ["to live", "生活；居住"],
  ["to die", "死亡"],
  ["to be born", "出生"]
]);

const wordZh = new Map([
  ["ability", "能力"],
  ["absence", "缺席"],
  ["absolute", "绝对"],
  ["absolutely", "绝对"],
  ["abstract", "抽象"],
  ["accident", "事故"],
  ["account", "账户"],
  ["action", "行动"],
  ["activity", "活动"],
  ["actual", "实际"],
  ["addition", "添加"],
  ["address", "地址"],
  ["advantage", "优点"],
  ["advice", "建议"],
  ["age", "年龄"],
  ["air", "空气"],
  ["all", "全部"],
  ["allow", "允许"],
  ["amount", "数量"],
  ["anger", "愤怒"],
  ["answer", "答案"],
  ["appearance", "外观"],
  ["area", "区域"],
  ["argument", "争论"],
  ["article", "文章"],
  ["attack", "攻击"],
  ["attitude", "态度"],
  ["attention", "注意"],
  ["autumn", "秋天"],
  ["back", "后面"],
  ["bad", "坏"],
  ["bank", "银行"],
  ["base", "基础"],
  ["basic", "基础"],
  ["beautiful", "美丽"],
  ["beauty", "美"],
  ["beginning", "开始"],
  ["behavior", "行为"],
  ["belief", "信念"],
  ["body", "身体"],
  ["book", "书"],
  ["border", "边界"],
  ["bottom", "底部"],
  ["business", "业务"],
  ["case", "情况"],
  ["cause", "原因"],
  ["chance", "机会"],
  ["change", "变化"],
  ["child", "孩子"],
  ["city", "城市"],
  ["class", "班级"],
  ["clean", "干净"],
  ["cold", "冷"],
  ["color", "颜色"],
  ["common", "常见"],
  ["company", "公司"],
  ["condition", "条件"],
  ["connection", "连接"],
  ["consequence", "结果"],
  ["control", "控制"],
  ["country", "国家"],
  ["course", "课程"],
  ["custom", "习惯"],
  ["danger", "危险"],
  ["dark", "黑暗"],
  ["day", "日子"],
  ["death", "死亡"],
  ["decision", "决定"],
  ["degree", "程度"],
  ["desire", "欲望"],
  ["detail", "细节"],
  ["difference", "差异"],
  ["different", "不同"],
  ["difficult", "困难"],
  ["direction", "方向"],
  ["dirty", "脏"],
  ["disease", "疾病"],
  ["distance", "距离"],
  ["dream", "梦"],
  ["easy", "容易"],
  ["effect", "效果"],
  ["effort", "努力"],
  ["end", "结束"],
  ["energy", "能量"],
  ["example", "例子"],
  ["existence", "存在"],
  ["experience", "经验"],
  ["expression", "表达"],
  ["eye", "眼睛"],
  ["face", "脸"],
  ["fact", "事实"],
  ["failure", "失败"],
  ["feeling", "感受"],
  ["few", "少数"],
  ["field", "领域"],
  ["fire", "火"],
  ["first", "第一"],
  ["flower", "花"],
  ["food", "食物"],
  ["force", "力量"],
  ["form", "形式"],
  ["free", "自由"],
  ["friend", "朋友"],
  ["front", "前面"],
  ["future", "未来"],
  ["general", "一般"],
  ["good", "好"],
  ["government", "政府"],
  ["group", "团体"],
  ["hand", "手"],
  ["hard", "困难"],
  ["heart", "心"],
  ["heat", "热"],
  ["high", "高"],
  ["history", "历史"],
  ["home", "家"],
  ["hope", "希望"],
  ["hot", "热"],
  ["house", "房子"],
  ["idea", "想法"],
  ["important", "重要"],
  ["inside", "里面"],
  ["interest", "兴趣"],
  ["job", "工作"],
  ["kind", "种类"],
  ["language", "语言"],
  ["large", "大"],
  ["last", "最后"],
  ["law", "法律"],
  ["left", "左"],
  ["level", "级别"],
  ["life", "生活"],
  ["light", "光"],
  ["little", "少"],
  ["long", "长"],
  ["loss", "损失"],
  ["low", "低"],
  ["matter", "事情"],
  ["meaning", "意思"],
  ["method", "方法"],
  ["middle", "中间"],
  ["mind", "心智"],
  ["money", "钱"],
  ["month", "月"],
  ["morning", "早晨"],
  ["music", "音乐"],
  ["name", "名字"],
  ["natural", "自然"],
  ["necessary", "必要"],
  ["new", "新"],
  ["night", "夜晚"],
  ["normal", "普通"],
  ["number", "数字"],
  ["object", "物体"],
  ["old", "旧"],
  ["opinion", "意见"],
  ["order", "顺序"],
  ["outside", "外面"],
  ["pain", "痛苦"],
  ["parent", "父母"],
  ["part", "部分"],
  ["past", "过去"],
  ["people", "人们"],
  ["person", "人"],
  ["place", "地点"],
  ["plan", "计划"],
  ["point", "点"],
  ["position", "位置"],
  ["power", "力量"],
  ["present", "现在"],
  ["problem", "问题"],
  ["process", "过程"],
  ["purpose", "目的"],
  ["question", "问题"],
  ["quiet", "安静"],
  ["rain", "雨"],
  ["reason", "理由"],
  ["relation", "关系"],
  ["relationship", "关系"],
  ["result", "结果"],
  ["right", "右"],
  ["road", "道路"],
  ["room", "房间"],
  ["same", "相同"],
  ["school", "学校"],
  ["season", "季节"],
  ["shadow", "影子"],
  ["shape", "形状"],
  ["short", "短"],
  ["side", "侧面"],
  ["small", "小"],
  ["society", "社会"],
  ["soft", "柔软"],
  ["sound", "声音"],
  ["special", "特别"],
  ["spring", "春天"],
  ["state", "状态"],
  ["story", "故事"],
  ["strange", "奇怪"],
  ["street", "街道"],
  ["strong", "强"],
  ["student", "学生"],
  ["summer", "夏天"],
  ["sympathy", "同情"],
  ["thing", "东西"],
  ["thought", "想法"],
  ["time", "时间"],
  ["today", "今天"],
  ["tomorrow", "明天"],
  ["top", "顶部"],
  ["true", "真实"],
  ["truth", "真实"],
  ["use", "使用"],
  ["voice", "声音"],
  ["warm", "温暖"],
  ["water", "水"],
  ["way", "方法"],
  ["week", "周"],
  ["wide", "宽"],
  ["wind", "风"],
  ["woman", "女性"],
  ["word", "词语"],
  ["work", "工作"],
  ["world", "世界"],
  ["year", "年"],
  ["yesterday", "昨天"],
  ["young", "年轻"],
  ["accelerate", "加速"],
  ["accept", "接受"],
  ["add", "添加"],
  ["advance", "前进"],
  ["appear", "出现"],
  ["ask", "询问"],
  ["attack", "攻击"],
  ["avoid", "避免"],
  ["become", "变成"],
  ["begin", "开始"],
  ["believe", "相信"],
  ["borrow", "借入"],
  ["break", "打破"],
  ["bring", "带来"],
  ["buy", "买"],
  ["call", "叫"],
  ["carry", "携带"],
  ["change", "改变"],
  ["choose", "选择"],
  ["close", "关闭"],
  ["compare", "比较"],
  ["connect", "连接"],
  ["continue", "继续"],
  ["cut", "切"],
  ["decide", "决定"],
  ["decrease", "减少"],
  ["die", "死亡"],
  ["drink", "喝"],
  ["eat", "吃"],
  ["enter", "进入"],
  ["exist", "存在"],
  ["explain", "解释"],
  ["express", "表达"],
  ["fall", "落下"],
  ["finish", "完成"],
  ["forget", "忘记"],
  ["give", "给"],
  ["go", "去"],
  ["hasten", "加快"],
  ["hear", "听见"],
  ["help", "帮助"],
  ["hit", "击打"],
  ["increase", "增加"],
  ["indicate", "表示"],
  ["know", "知道"],
  ["learn", "学习"],
  ["leave", "离开"],
  ["lend", "借出"],
  ["listen", "听"],
  ["live", "生活"],
  ["look", "看"],
  ["lose", "失去"],
  ["make", "制作"],
  ["mean", "意思是"],
  ["meet", "见面"],
  ["move", "移动"],
  ["open", "打开"],
  ["pay", "支付"],
  ["protect", "保护"],
  ["pull", "拉"],
  ["push", "推"],
  ["quicken", "加快"],
  ["raise", "提高"],
  ["read", "读"],
  ["receive", "收到"],
  ["remember", "记住"],
  ["return", "返回"],
  ["run", "跑"],
  ["say", "说"],
  ["see", "看见"],
  ["sell", "卖"],
  ["send", "发送"],
  ["separate", "分开"],
  ["speak", "说话"],
  ["start", "开始"],
  ["stop", "停止"],
  ["take", "拿"],
  ["teach", "教"],
  ["tell", "告诉"],
  ["think", "认为"],
  ["understand", "理解"],
  ["use", "使用"],
  ["wait", "等待"],
  ["walk", "走"],
  ["watch", "观看"],
  ["win", "赢"],
  ["write", "写"],
  ["big", "大"],
  ["bright", "明亮"],
  ["cold", "冷"],
  ["correct", "正确"],
  ["dark", "暗"],
  ["dirty", "脏"],
  ["easy", "容易"],
  ["false", "假的"],
  ["fast", "快"],
  ["few", "少"],
  ["free", "自由"],
  ["hard", "硬；难"],
  ["high", "高"],
  ["important", "重要"],
  ["large", "大"],
  ["little", "小；少"],
  ["long", "长"],
  ["low", "低"],
  ["many", "许多"],
  ["much", "许多"],
  ["necessary", "必要"],
  ["new", "新"],
  ["noisy", "吵闹"],
  ["old", "旧"],
  ["quiet", "安静"],
  ["short", "短"],
  ["slow", "慢"],
  ["small", "小"],
  ["soft", "软"],
  ["special", "特别"],
  ["strange", "奇怪"],
  ["strong", "强"],
  ["true", "真实"],
  ["weak", "弱"],
  ["wide", "宽"],
  ["wrong", "错误"]
]);

function roughChineseSegment(segment) {
  const clean = String(segment || "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = clean.toLowerCase();
  if (!lower) return "";
  if (phraseZh.has(lower)) return phraseZh.get(lower);

  let translated = lower
    .replace(/\betc\.?/g, "等")
    .replace(/\be\.g\.?/g, "例如")
    .replace(/\bi\.e\.?/g, "即")
    .replace(/\bsb\.?/g, "某人")
    .replace(/\bsth\.?/g, "某事物")
    .replace(/\bto be\b/g, "是")
    .replace(/\bto\b/g, "")
    .replace(/\bof\b/g, "的")
    .replace(/\bfor\b/g, "为了")
    .replace(/\bwith\b/g, "和")
    .replace(/\bwithout\b/g, "没有")
    .replace(/\bfrom\b/g, "从")
    .replace(/\binto\b/g, "进入")
    .replace(/\bin\b/g, "在")
    .replace(/\bon\b/g, "在")
    .replace(/\bat\b/g, "在")
    .replace(/\bas\b/g, "作为")
    .replace(/\blike\b/g, "像")
    .replace(/\band\b/g, "和")
    .replace(/\bor\b/g, "或")
    .replace(/[a-z]+(?:-[a-z]+)?/g, (word) => wordZh.get(word) ?? word)
    .replace(/\s*,\s*/g, "，")
    .replace(/\s*\/\s*/g, "／")
    .replace(/\s+/g, "");

  if (translated === lower.replace(/\s+/g, "")) {
    return `参考：${clean}`;
  }
  return translated;
}

function roughChineseGloss(meaning) {
  return String(meaning || "")
    .split(/\s*;\s*/)
    .slice(0, 5)
    .map(roughChineseSegment)
    .filter(Boolean)
    .join("；");
}

function toStudyWord(item, index) {
  const level = levelLabel(item.level);
  const meaning = compactMeaning(item.meaning);
  const zh = roughChineseGloss(meaning) || `参考：${meaning}`;
  const japanese = item.word || item.furigana;
  const kana = item.furigana || item.word;
  const id = `jlpt-${level.toLowerCase()}-${slug(japanese)}-${index}`;

  return {
    id,
    japanese,
    kana,
    romaji: item.romaji || "",
    zh,
    en: meaning,
    partOfSpeech: "JLPT vocabulary",
    introZh: `${level} 词汇。先记住读音、核心意思，再放进例句里识别。`,
    introEn: `${level} vocabulary from the public JLPT vocabulary API.`,
    exampleJp: `${japanese}を覚える。`,
    exampleZh: `记住「${japanese}」。`,
    exampleEn: `Memorize "${japanese}".`,
    tags: [`jlpt-${level.toLowerCase()}`, "generated"],
    jlptLevel: level,
    source: "jlpt-vocab-api"
  };
}

const allWords = [];
const seen = new Set();

for (const [level, limit] of Object.entries(targets)) {
  const url = `${API}?level=${level}&offset=0&limit=${limit}`;
  const payload = await fetchJson(url);
  for (const item of payload.words || []) {
    const key = `${item.word}|${item.furigana}`;
    if (!item.word || !item.furigana || !item.meaning || seen.has(key)) continue;
    seen.add(key);
    allWords.push(toStudyWord(item, allWords.length + 1));
  }
}

const output = `// Generated by scripts/generate-jlpt-vocabulary.mjs.
// Source: https://jlpt-vocab-api.vercel.app/
// Vocabulary entries are stored in generatedVocabulary.json to keep TypeScript fast.
import type { StudyWord } from "./studyContent";
import rawVocabulary from "./generatedVocabulary.json";

export const generatedVocabularySource = {
  name: "JLPT Vocabulary API",
  url: "https://jlpt-vocab-api.vercel.app/",
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  count: ${allWords.length}
};

export const generatedVocabulary = rawVocabulary as StudyWord[];
`;

await writeFile(new URL("../src/data/generatedVocabulary.ts", import.meta.url), output);
await writeFile(
  new URL("../src/data/generatedVocabulary.json", import.meta.url),
  `${JSON.stringify(allWords, null, 2)}\n`
);
console.log(`Generated ${allWords.length} JLPT words.`);
