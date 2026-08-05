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
  if (reading === word.kana) score += 12;
  if (word.forms?.includes(entry.word) || word.forms?.includes(entry.altWord)) score += 8;
  if (entry.jlpt === word.jlptLevel) score += 2;
  return score;
}

function findDictionaryDefinition(word, lookups) {
  const candidates = [
    ...(lookups.byKey.get(`${word.japanese}|${word.kana}`) ?? []),
    ...(word.forms ?? []).flatMap((form) => lookups.byKey.get(`${form}|${word.kana}`) ?? []),
    ...(lookups.byWord.get(word.japanese) ?? []),
    ...(word.forms ?? []).flatMap((form) => lookups.byWord.get(form) ?? []),
    ...(lookups.byReading.get(word.kana) ?? [])
  ];
  const best = uniqueValues(candidates)
    .filter((entry) => entry.meanings?.length)
    .map((entry) => ({ entry, score: scoreDictionaryEntry(entry, word) }))
    .sort((a, b) => b.score - a.score)[0]?.entry;

  if (!best) return null;
  return {
    en: compactDefinition(best.meanings),
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
    word.zh = `释义：${definition.en}`;
    word.en = definition.en;
    word.introZh = `词典释义：${definition.en}。出自例句「${word.exampleJp}」。`;
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
  const forms = uniqueValues([basic !== surface ? basic : "", surface !== reading ? reading : ""]);
  const contextMeaning = line.zh || `the lyric line "${line.japanese}"`;
  const fallbackZh = latinPattern.test(surface)
    ? `英语歌词词：${surface}`
    : `语境释义：${contextMeaning}`;
  const fallbackEn = latinPattern.test(surface)
    ? surface
    : `Context meaning: ${contextMeaning}`;

  return {
    id,
    japanese: surface,
    kana: reading,
    romaji,
    zh: fallbackZh,
    en: fallbackEn,
    partOfSpeech: `${labels.zh} / ${labels.en}`,
    introZh: `读作「${reading}」。本句语境：${contextMeaning}`,
    introEn: `Read as "${romaji}". Context: ${contextMeaning}`,
    exampleJp: line.japanese,
    exampleZh: line.zh || `《${song.titleJp}》中的一句歌词。`,
    exampleEn: `Example line from "${song.titleJp}" by ${song.artistJp}.`,
    tags: ["lyrics", `artist-${song.category}`, `jlpt-${levelForSong(song).toLowerCase()}`],
    jlptLevel: levelForSong(song),
    source: "user-provided-lyrics",
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
