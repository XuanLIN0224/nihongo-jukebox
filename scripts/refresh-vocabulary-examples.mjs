import { readFile, writeFile } from "node:fs/promises";
import { buildVocabularyExample } from "./vocabulary-examples.mjs";

const vocabularyUrl = new URL("../src/data/generatedVocabulary.json", import.meta.url);
const words = JSON.parse(await readFile(vocabularyUrl, "utf8"));

const duplicateFrames = [
  {
    jp: (word) => `別のノートでも「${word}」の用法を確認した。`,
    zh: (word) => `在另一条笔记里也确认了「${word}」的用法。`,
    en: (word) => `I also checked the usage of "${word}" in another note.`
  },
  {
    jp: (word) => `復習カードでも「${word}」の意味を確認した。`,
    zh: (word) => `在复习卡片里也确认了「${word}」的意思。`,
    en: (word) => `I also reviewed the meaning of "${word}" on a study card.`
  },
  {
    jp: (word) => `単語リストでも「${word}」の読み方と意味を見直した。`,
    zh: (word) => `在单词列表里也复习了「${word}」的读音和意思。`,
    en: (word) => `I also reviewed the reading and meaning of "${word}" in the vocabulary list.`
  },
  {
    jp: (word) => `辞書メモでも「${word}」の使い方を整理した。`,
    zh: (word) => `在词典笔记里也整理了「${word}」的用法。`,
    en: (word) => `I also organized the usage of "${word}" in my dictionary notes.`
  },
  {
    jp: (word) => `確認テストでも「${word}」の意味をもう一度見た。`,
    zh: (word) => `在确认测试里也重新看了「${word}」的意思。`,
    en: (word) => `I checked the meaning of "${word}" again in the review test.`
  }
];

function uniquifyExample(example, seen, index, word) {
  if (!seen.has(example.exampleJp)) {
    seen.add(example.exampleJp);
    return example;
  }

  for (let attempt = 0; attempt < duplicateFrames.length; attempt += 1) {
    const frame = duplicateFrames[(index + attempt) % duplicateFrames.length];
    const candidate = {
      exampleJp: frame.jp(word.japanese),
      exampleZh: frame.zh(word.japanese),
      exampleEn: frame.en(word.japanese)
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
  const example = uniquifyExample(buildVocabularyExample(word, index + 1), seenExamples, index, word);
  return {
    ...word,
    ...example
  };
});

await writeFile(vocabularyUrl, `${JSON.stringify(refreshed, null, 2)}\n`);
console.log(`Refreshed examples for ${refreshed.length} generated vocabulary words.`);
