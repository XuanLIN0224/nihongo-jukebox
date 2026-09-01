import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import kuromoji from "kuromoji";
import * as wanakana from "wanakana";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultInputPath = path.join(rootDir, "public/data/games/persona5-lines.json");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInputPath;

const latinPattern = /^[A-Za-z0-9][A-Za-z0-9'&.+-]*$/;
const kanaPattern = /^[ぁ-んァ-ンー]+$/;
const punctuationPattern = /^[\s、。．，,!?！？…・「」『』（）()［］\[\]【】〈〉《》“”"':：;；〜~♪]+$/u;

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

function shouldKeepToken(token) {
  const surface = token.surface_form.trim();
  if (!surface) return false;
  if (token.pos === "記号") return false;
  return !punctuationPattern.test(surface);
}

function romajiFromReadings(readings) {
  const chunks = [];
  for (const reading of readings) {
    if (chunks.length && /[っッ]$/.test(chunks[chunks.length - 1]) && /^[ぁ-んァ-ンー]/.test(reading)) {
      chunks[chunks.length - 1] += reading;
    } else {
      chunks.push(reading);
    }
  }
  return chunks
    .map((reading) => (latinPattern.test(reading) ? reading : wanakana.toRomaji(reading)))
    .join(" ");
}

function annotateSentence(sentence, tokenizer) {
  const tokens = tokenizer.tokenize(sentence).filter(shouldKeepToken);
  const kana = [];
  for (const token of tokens) {
    const reading = readingForToken(token);
    kana.push(reading);
  }
  const kanaText = kana.join(" ");
  return {
    kana: kanaText,
    romaji: romajiFromReadings(kana)
  };
}

const tokenizer = await buildTokenizer();
const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
let annotated = 0;

for (const line of payload.lines ?? []) {
  const japanese = String(line.japanese ?? "").trim();
  if (!japanese) {
    line.kana = "";
    line.romaji = "";
    continue;
  }
  const reading = annotateSentence(japanese, tokenizer);
  line.kana = reading.kana;
  line.romaji = reading.romaji;
  annotated += 1;
}

payload.readingMode = "kuromoji-wanakana";
fs.writeFileSync(inputPath, JSON.stringify(payload, null, 0), "utf8");
console.log(`Annotated ${annotated} Persona 5 lines with kana and romaji.`);
