function cleanText(value) {
  return String(value || "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstEnglish(value) {
  const segment =
    cleanText(value)
      .split(/\s*;\s*/)
      .find(Boolean) || "this meaning";
  return segment.replace(/^to\s+/i, "").replace(/^a\s+/i, "").trim();
}

function firstChinese(value) {
  const text =
    cleanText(value)
      .replace(/^参考：/, "")
      .split("；")
      .find(Boolean)
      ?.trim() || "这个意思";
  return /[A-Za-z]/.test(text) ? "这个意思" : text;
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

function isVerb(word, en) {
  const lower = cleanText(en).toLowerCase();
  return (
    lower.startsWith("to ") ||
    lower.includes("; to ") ||
    /する$/.test(word) ||
    /[うくぐすつぬぶむる]$/.test(word)
  );
}

function isIAdjective(word, en) {
  if (!/[い]$/.test(word) || isVerb(word, en)) return false;
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
    "thick"
  ]);
}

function isNaAdjective(word, en) {
  if (isVerb(word, en) || isIAdjective(word, en)) return false;
  return (
    ["静か", "賑やか", "有名", "大切", "必要", "元気", "上手", "下手", "好き", "大好き", "嫌い", "綺麗"].includes(word) ||
    hasAny(en, ["quiet", "famous", "important", "necessary", "healthy", "skillful", "poor at", "like", "beautiful"])
  );
}

function isAdverb(word, en) {
  return /に$/.test(word) || hasAny(en, [
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
    "anywhere"
  ]);
}

function classifyWord(word, en) {
  if (isVerb(word, en)) return "verb";
  if (isIAdjective(word, en)) return "iAdjective";
  if (isNaAdjective(word, en)) return "naAdjective";
  if (isAdverb(word, en)) return "adverb";
  return "noun";
}

const templates = {
  noun: [
    (word, zh, en) => ({
      exampleJp: `辞書で「${word}」という名詞の意味を確認した。`,
      exampleZh: `在词典里确认了「${word}」这个名词表示“${zh}”。`,
      exampleEn: `I checked in the dictionary that the noun "${word}" means "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `ノートに「${word}」を名詞として整理した。`,
      exampleZh: `把「${word}」作为名词整理到笔记里，意思是“${zh}”。`,
      exampleEn: `I organized "${word}" in my notes as a noun meaning "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `例文では「${word}」が物事や考えを指している。`,
      exampleZh: `在例句里，「${word}」指的是“${zh}”。`,
      exampleEn: `In the example sentence, "${word}" points to the idea of "${en}".`
    })
  ],
  verb: [
    (word, zh, en) => ({
      exampleJp: `先生は「${word}」を動詞として使う場面を説明した。`,
      exampleZh: `老师说明了「${word}」作为动词使用时表示“${zh}”。`,
      exampleEn: `The teacher explained how the verb "${word}" is used to mean "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `例文では「${word}」が動きや変化を表している。`,
      exampleZh: `在例句里，「${word}」表示“${zh}”这种动作或变化。`,
      exampleEn: `In the example sentence, "${word}" expresses the action or change "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `「${word}」は動作や変化を表す語として確認した。`,
      exampleZh: `把「${word}」当作表示“${zh}”的动词来确认。`,
      exampleEn: `I reviewed "${word}" as a verb meaning "${en}".`
    })
  ],
  iAdjective: [
    (word, zh, en) => ({
      exampleJp: `「${word}」は状態や性質を表すい形容詞として覚える。`,
      exampleZh: `把「${word}」作为表示“${zh}”的い形容词来记。`,
      exampleEn: `I remember "${word}" as an i-adjective meaning "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `この文では「${word}」が人や物の様子を表している。`,
      exampleZh: `在这个句子里，「${word}」表示人或事物“${zh}”的样子。`,
      exampleEn: `In this sentence, "${word}" describes a state like "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `「${word}」を使って、状態を表す文を作った。`,
      exampleZh: `用「${word}」造了一个表示“${zh}”状态的句子。`,
      exampleEn: `I made a sentence with "${word}" to describe the state "${en}".`
    })
  ],
  naAdjective: [
    (word, zh, en) => ({
      exampleJp: `「${word}」は名詞の前で「${word}な」の形でも使う。`,
      exampleZh: `「${word}」也可以用「${word}な」修饰名词，意思是“${zh}”。`,
      exampleEn: `"${word}" can modify a noun as "${word} na" and means "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `例文では「${word}」が状態や性質を表している。`,
      exampleZh: `在例句里，「${word}」表示“${zh}”这种状态或性质。`,
      exampleEn: `In the example sentence, "${word}" describes the state or quality "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `「${word}」をな形容詞としてノートにまとめた。`,
      exampleZh: `把「${word}」作为な形容词整理到笔记里，意思是“${zh}”。`,
      exampleEn: `I noted "${word}" as a na-adjective meaning "${en}".`
    })
  ],
  adverb: [
    (word, zh, en) => ({
      exampleJp: `「${word}」は文全体の調子や程度を加える語として使った。`,
      exampleZh: `「${word}」用来给整句话补充语气、程度或范围，意思是“${zh}”。`,
      exampleEn: `"${word}" adds nuance, degree, or range to a sentence and means "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `例文では「${word}」が動作の様子を詳しくしている。`,
      exampleZh: `在例句里，「${word}」让动作的样子更具体，意思是“${zh}”。`,
      exampleEn: `In the example sentence, "${word}" describes how the action happens: "${en}".`
    }),
    (word, zh, en) => ({
      exampleJp: `「${word}」を入れると、文のニュアンスが変わる。`,
      exampleZh: `加入「${word}」后，句子的语感会变成“${zh}”。`,
      exampleEn: `Adding "${word}" changes the nuance of the sentence to "${en}".`
    })
  ]
};

export function buildVocabularyExample(word, index = 0) {
  const japanese = cleanText(word.japanese) || "この言葉";
  const zh = firstChinese(word.zh);
  const en = firstEnglish(word.en);
  const kind = classifyWord(japanese, word.en);
  const seed = hashSeed(japanese, zh, en, index);
  return pick(templates[kind], seed)(japanese, zh, en);
}
