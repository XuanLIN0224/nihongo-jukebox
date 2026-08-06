import { readFile, writeFile } from "node:fs/promises";
import { buildVocabularyExample } from "./vocabulary-examples.mjs";

const vocabularyUrl = new URL("../src/data/generatedVocabulary.json", import.meta.url);
const words = JSON.parse(await readFile(vocabularyUrl, "utf8"));

const duplicatePrefixes = [
  { jp: "昨日", zh: "昨天，", en: "Yesterday, " },
  { jp: "今日", zh: "今天，", en: "Today, " },
  { jp: "授業で", zh: "在课堂上，", en: "In class, " },
  { jp: "会話の中で", zh: "在对话中，", en: "In conversation, " },
  { jp: "テストでは", zh: "在测试中，", en: "In the test, " }
];

function uniquifyExample(example, seen, index) {
  if (!seen.has(example.exampleJp)) {
    seen.add(example.exampleJp);
    return example;
  }

  for (let attempt = 0; attempt < duplicatePrefixes.length; attempt += 1) {
    const prefix = example.exampleJp.startsWith("答えは")
      ? duplicatePrefixes[4]
      : duplicatePrefixes[(index + attempt) % duplicatePrefixes.length];
    const candidate = {
      exampleJp: `${prefix.jp}、${example.exampleJp}`,
      exampleZh: `${prefix.zh}${example.exampleZh}`,
      exampleEn: `${prefix.en}${example.exampleEn}`
    };
    if (!seen.has(candidate.exampleJp)) {
      seen.add(candidate.exampleJp);
      return candidate;
    }
  }

  const fallback = {
    exampleJp: `別の文では、${example.exampleJp}`,
    exampleZh: `另一句里，${example.exampleZh}`,
    exampleEn: `In another sentence, ${example.exampleEn}`
  };
  seen.add(fallback.exampleJp);
  return fallback;
}

const seenExamples = new Set();
const refreshed = words.map((word, index) => {
  const example = uniquifyExample(buildVocabularyExample(word, index + 1), seenExamples, index);
  return {
    ...word,
    ...example
  };
});

await writeFile(vocabularyUrl, `${JSON.stringify(refreshed, null, 2)}\n`);
console.log(`Refreshed examples for ${refreshed.length} generated vocabulary words.`);
