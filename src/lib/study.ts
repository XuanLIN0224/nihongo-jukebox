import {
  grammarTokens,
  type StudyLine,
  type StudyWord,
  type TokenInfo,
  vocabulary
} from "../data/studyContent";

const wordTokens: TokenInfo[] = vocabulary.map((word) => ({
  id: word.id,
  surface: word.japanese,
  reading: word.kana,
  romaji: word.romaji,
  zh: word.zh,
  en: word.en,
  pos: word.partOfSpeech,
  noteZh: word.introZh,
  exampleJp: word.exampleJp,
  exampleZh: word.exampleZh,
  exampleEn: word.exampleEn,
  forms: [word.japanese, word.kana, ...(word.forms ?? [])],
  vocabularyId: word.id,
  readingOptions: word.readingOptions,
  romajiOptions: word.romajiOptions
}));

export const tokenById = new Map<string, TokenInfo>(
  [...wordTokens, ...grammarTokens].map((token) => [token.id, token])
);

export const wordById = new Map<string, StudyWord>(vocabulary.map((word) => [word.id, word]));

const readingsBySurface = vocabulary.reduce((map, word) => {
  const readings = map.get(word.japanese) ?? new Set<string>();
  readings.add(word.kana);
  for (const reading of word.readingOptions ?? []) {
    readings.add(reading);
  }
  map.set(word.japanese, readings);
  return map;
}, new Map<string, Set<string>>());

const romajiBySurface = vocabulary.reduce((map, word) => {
  const romaji = map.get(word.japanese) ?? new Set<string>();
  romaji.add(word.romaji);
  for (const item of word.romajiOptions ?? []) {
    romaji.add(item);
  }
  map.set(word.japanese, romaji);
  return map;
}, new Map<string, Set<string>>());

export function readingOptionsForSurface(surface: string, fallback: string): string[] {
  const readings = readingsBySurface.get(surface);
  return Array.from(readings ?? new Set([fallback])).filter(Boolean);
}

export function romajiOptionsForSurface(surface: string, fallback: string): string[] {
  const romaji = romajiBySurface.get(surface);
  return Array.from(romaji ?? new Set([fallback])).filter(Boolean);
}

export function tokensForLine(line: StudyLine): TokenInfo[] {
  if (line.tokenIds.length > 0) {
    return line.tokenIds
      .map((id, index): TokenInfo | null => {
        const token = tokenById.get(id);
        if (!token) return null;
        const surface = line.tokenSurfaces?.[index] ?? token.surface;
        const reading = line.tokenReadings?.[index] ?? token.reading;
        const romaji = line.tokenRomaji?.[index] ?? token.romaji;
        return {
          ...token,
          id: `${line.id}-${token.id}-${index}`,
          surface,
          reading,
          romaji,
          ...(token.vocabularyId ? { vocabularyId: token.vocabularyId } : {}),
          readingOptions: readingOptionsForSurface(surface, reading),
          romajiOptions: romajiOptionsForSurface(surface, romaji)
        };
      })
      .filter((token): token is TokenInfo => token !== null);
  }

  return (
    analyzeJapaneseText(line.japanese)[0]?.tokens.map((token, index) => ({
      ...token,
      id: `${line.id}-${token.id}-${index}`
    })) ?? []
  );
}

export function normalizeJapanese(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ \t\n\r　]/g, "")
    .replace(/[。．.、，,！？!?「」『』（）()\[\]【】]/g, "");
}

export function isLineAnswerCorrect(input: string, line: StudyLine): boolean {
  const normalized = normalizeJapanese(input);
  return (
    normalized === normalizeJapanese(line.japanese) ||
    normalized === normalizeJapanese(line.kana)
  );
}

export function isWordAnswerCorrect(input: string, word: StudyWord): boolean {
  const normalized = normalizeJapanese(input);
  const accepted = [word.japanese, word.kana, ...(word.forms ?? [])].map(normalizeJapanese);
  return accepted.includes(normalized);
}

export function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export interface AnalyzedLine {
  id: string;
  text: string;
  tokens: TokenInfo[];
}

const analyzerEntries = [...wordTokens, ...grammarTokens]
  .flatMap((token) =>
    [token.surface, token.reading, ...(token.forms ?? [])]
      .filter(Boolean)
      .map((form) => ({
        form,
        normalizedForm: normalizeJapanese(form),
        token
      }))
  )
  .sort((a, b) => b.normalizedForm.length - a.normalizedForm.length);

export function analyzeJapaneseText(text: string): AnalyzedLine[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, lineIndex) => {
      const compact = normalizeJapanese(line);
      const tokens: TokenInfo[] = [];
      let cursor = 0;

      while (cursor < compact.length) {
        const hit = analyzerEntries.find(({ normalizedForm }) =>
          compact.startsWith(normalizedForm, cursor)
        );

        if (hit) {
          tokens.push({ ...hit.token, surface: hit.form });
          cursor += hit.normalizedForm.length;
        } else {
          const surface = compact[cursor];
          tokens.push({
            id: `unknown-${lineIndex}-${cursor}`,
            surface,
            reading: "未登録",
            romaji: "-",
            zh: "词库中暂未登记",
            en: "not in the local dictionary yet",
            pos: "unknown",
            noteZh: "可以先看整句语境，之后把这个词补进词库。",
            exampleJp: line,
            exampleZh: "自定义歌词行。",
            exampleEn: "Custom lyric line."
          });
          cursor += 1;
        }
      }

      return {
        id: `custom-${lineIndex}`,
        text: line,
        tokens
      };
    });
}

export function progressPercent(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}
