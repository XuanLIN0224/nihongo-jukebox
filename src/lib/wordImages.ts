export interface VisualSubject {
  id?: string;
  japanese: string;
  kana?: string;
  romaji?: string;
  zh: string;
  en: string;
  partOfSpeech?: string;
  tags?: string[];
  source?: string;
}

export interface WordVisualImage {
  id: string;
  title: string;
  thumbUrl: string;
  pageUrl: string;
  source: "Wikimedia Commons" | "Openverse";
  license?: string;
  query: string;
}

interface CommonsImageInfo {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  extmetadata?: {
    LicenseShortName?: { value?: string };
    ObjectName?: { value?: string };
  };
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: CommonsImageInfo[];
}

interface CommonsResponse {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
}

interface OpenverseResult {
  id: string;
  title: string;
  thumbnail?: string;
  url?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
}

interface OpenverseResponse {
  results?: OpenverseResult[];
}

const memoryCache = new Map<string, WordVisualImage[]>();
const pendingCache = new Map<string, Promise<WordVisualImage[]>>();
const cachePrefix = "nihongo-word-images:v5:";

const preciseQueryByJapanese = new Map<string, string[]>([
  ["指切り", ["pinky swear", "pinky promise hands"]],
  ["走り出し", ["person running", "runner starting"]],
  ["走る", ["person running", "runner"]],
  ["歩く", ["person walking", "walking path"]],
  ["踊る", ["person dancing", "dance"]],
  ["歌う", ["person singing", "microphone singing"]],
  ["声", ["person singing microphone", "voice microphone"]],
  ["夜", ["night sky", "night street"]],
  ["朝", ["morning sunlight", "sunrise"]],
  ["午後", ["afternoon sunlight", "afternoon street"]],
  ["春", ["spring cherry blossoms", "spring flowers"]],
  ["冬", ["winter snow", "winter landscape"]],
  ["雨", ["rain street", "raindrops"]],
  ["傘", ["umbrella rain", "umbrella"]],
  ["風", ["wind in trees", "wind grass"]],
  ["花", ["flower blossom", "flowers"]],
  ["桜", ["cherry blossom", "sakura blossom"]],
  ["光", ["sunlight", "light rays"]],
  ["影", ["shadow", "person shadow"]],
  ["電車", ["train station Japan", "train"]],
  ["窓", ["window", "window light"]],
  ["扉", ["door", "open door"]],
  ["鍵", ["key", "keys"]],
  ["部屋", ["Japanese room", "room interior"]],
  ["手紙", ["letter envelope", "handwritten letter"]],
  ["祭り", ["Japanese festival", "matsuri festival"]],
  ["踊り", ["dance", "person dancing"]],
  ["音", ["sound wave", "music speaker"]],
  ["リズム", ["music rhythm", "metronome"]],
  ["夢", ["sleeping dream", "dream night"]],
  ["希望", ["sunrise hope", "open sky"]],
  ["自由", ["open sky", "freedom open road"]],
  ["約束", ["promise handshake", "pinky promise"]],
  ["心", ["heart symbol", "person thinking"]],
  ["胸", ["hand on chest", "heart chest"]],
  ["涙", ["tear", "crying eye"]],
  ["泣く", ["person crying", "tears"]],
  ["笑う", ["smiling person", "person laughing"]],
  ["笑顔", ["smiling face", "smile"]],
  ["痛み", ["pain expression", "holding chest pain"]],
  ["傷", ["bandage", "wound bandage"]],
  ["命", ["candle life", "newborn life"]],
  ["死ぬ", ["cemetery candle", "memorial candle"]],
  ["死ん", ["cemetery candle", "memorial candle"]],
  ["治す", ["medical treatment", "doctor patient"]],
  ["治し", ["medical treatment", "doctor patient"]],
  ["治る", ["recovery health", "medical recovery"]],
  ["治ら", ["recovery health", "medical recovery"]],
  ["見せる", ["show display", "person showing"]],
  ["みせ", ["show display", "person showing"]],
  ["染まる", ["dyed fabric", "colored cloth"]],
  ["染まっ", ["dyed fabric", "colored cloth"]]
]);

const meaningPatterns: Array<[RegExp, string[]]> = [
  [/pinky swear|pinky promise/i, ["pinky swear", "pinky promise hands"]],
  [/begin to run|start running|break into a run|running|to run/i, ["person running", "runner starting"]],
  [/to walk|walking/i, ["person walking", "walking path"]],
  [/to dance|dancing|dance/i, ["person dancing", "dance"]],
  [/to sing|singing|song/i, ["person singing", "microphone singing"]],
  [/voice|sound/i, ["microphone voice", "sound wave"]],
  [/night/i, ["night sky", "night street"]],
  [/morning|sunrise/i, ["morning sunlight", "sunrise"]],
  [/afternoon|p\.m\./i, ["afternoon sunlight", "afternoon street"]],
  [/wind/i, ["wind in trees", "wind grass"]],
  [/rain|raindrop/i, ["rain street", "raindrops"]],
  [/flower|blossom|cherry blossom|sakura/i, ["cherry blossom", "flowers"]],
  [/light|sunlight|radiance/i, ["sunlight", "light rays"]],
  [/shadow/i, ["shadow", "person shadow"]],
  [/train|station/i, ["train station", "train"]],
  [/window/i, ["window", "window light"]],
  [/door|entrance|gate/i, ["door", "open door"]],
  [/key/i, ["key", "keys"]],
  [/room/i, ["Japanese room", "room interior"]],
  [/letter|envelope/i, ["letter envelope", "handwritten letter"]],
  [/festival|matsuri/i, ["Japanese festival", "festival"]],
  [/dream/i, ["sleeping dream", "dream night"]],
  [/hope/i, ["sunrise hope", "open sky"]],
  [/freedom/i, ["open sky", "freedom open road"]],
  [/promise|agreement|contract|pact/i, ["promise handshake", "pinky promise"]],
  [/heart|mind|emotion|feeling|chest/i, ["heart symbol", "person thinking"]],
  [/cry|tear|weep/i, ["person crying", "tears"]],
  [/laugh|smile/i, ["smiling person", "person laughing"]],
  [/pain|wound|injur/i, ["bandage", "pain expression"]],
  [/die|death|pass away|cemetery/i, ["memorial candle", "cemetery"]],
  [/cure|heal|recover|medical/i, ["medical treatment", "doctor patient"]],
  [/show|display|present/i, ["show display", "person showing"]],
  [/dyed|tainted|stained|color/i, ["dyed fabric", "colored cloth"]],
  [/road|path|street|way/i, ["road path", "street"]],
  [/friend|talk/i, ["friends talking", "conversation"]],
  [/book|read/i, ["book reading", "open book"]],
  [/write|draw|paint/i, ["writing notebook", "drawing"]],
  [/music|melody|rhythm/i, ["music performance", "musical notes"]],
  [/question|answer/i, ["question mark", "student answering"]],
  [/truth|reality/i, ["mirror reflection", "reality"]],
  [/dark|darkness/i, ["dark night", "dark room"]],
  [/future|tomorrow/i, ["open road", "sunrise"]],
  [/happy|joy/i, ["happy person", "smile"]],
  [/sad|lonely|despair/i, ["lonely person", "rain window"]],
  [/particle|marker|auxiliary|copula|grammar/i, ["Japanese grammar notebook", "Japanese textbook"]]
];

const poorTitleTerms = [
  "logo",
  "flag",
  "coat of arms",
  "locator",
  "map",
  "diagram",
  "chart",
  "graph",
  "qr code",
  "icon",
  "svg"
];

function cacheKey(subject: VisualSubject): string {
  const stableId = subject.id || `${subject.japanese}-${subject.kana || ""}`;
  return `${cachePrefix}${stableId}:${subject.en.slice(0, 90)}`;
}

function readStoredImages(key: string): WordVisualImage[] | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as WordVisualImage[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeImages(key: string, images: WordVisualImage[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(images.slice(0, 6)));
  } catch {
    // Local storage is an optional cache.
  }
}

function cleanMeaning(value: string): string {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bone'?s\b/gi, "")
    .replace(/\.\.\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function usefulMeaningParts(subject: VisualSubject): string[] {
  return subject.en
    .split(";")
    .map(cleanMeaning)
    .map((value) => value.replace(/^to be\s+/i, "").replace(/^to\s+/i, ""))
    .filter((value) => value.length > 2)
    .filter((value) => !/^(the|a|an|be|is|do|does|did|thing|person)$/i.test(value))
    .slice(0, 4);
}

function queriesFromMeaning(subject: VisualSubject): string[] {
  const text = `${subject.en} ${subject.zh} ${subject.partOfSpeech ?? ""}`;
  const patternQueries = meaningPatterns.flatMap(([pattern, queries]) =>
    pattern.test(text) ? queries : []
  );
  const meaningParts = usefulMeaningParts(subject);
  const directQuery = meaningParts[0];
  const nounishQuery = directQuery
    ? directQuery
        .replace(/^be\s+/i, "")
        .replace(/^(make|take|get|do)\s+/i, "")
        .trim()
    : "";

  return uniqueValues([
    ...patternQueries,
    directQuery,
    nounishQuery && `${nounishQuery} photo`,
    subject.tags?.includes("lyrics") ? `${directQuery || subject.romaji || subject.japanese} concept` : "",
    "Japanese vocabulary notebook"
  ]);
}

export function buildWordImageQueries(subject: VisualSubject): string[] {
  const precise = preciseQueryByJapanese.get(subject.japanese) ?? [];
  return uniqueValues([...precise, ...queriesFromMeaning(subject)]).slice(0, 5);
}

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
  );
}

function isLikelyPhoto(image: WordVisualImage): boolean {
  const haystack = `${image.title} ${image.thumbUrl}`.toLowerCase();
  if (poorTitleTerms.some((term) => haystack.includes(term))) return false;
  const urlWithoutQuery = image.thumbUrl.split("?")[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(urlWithoutQuery) || image.source === "Openverse";
}

function dedupeImages(images: WordVisualImage[]): WordVisualImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.pageUrl || image.thumbUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchCommons(query: string, limit: number): Promise<WordVisualImage[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: query,
    gsrlimit: String(Math.max(6, limit * 3)),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "640",
    format: "json",
    origin: "*"
  });
  const data = await requestJson<CommonsResponse>(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`
  );
  if (!data) return [];
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.pageid ?? 0) - (b.pageid ?? 0));

  return pages
    .map((page): WordVisualImage | null => {
      const info = page.imageinfo?.[0];
      const thumbUrl = info?.thumburl || info?.url;
      const pageUrl = info?.descriptionurl;
      if (!thumbUrl || !pageUrl) return null;
      const title = cleanImageTitle(info?.extmetadata?.ObjectName?.value, page.title);
      return {
        id: `commons-${page.pageid}`,
        title,
        thumbUrl,
        pageUrl,
        source: "Wikimedia Commons",
        license: decodeHtml(info?.extmetadata?.LicenseShortName?.value ?? ""),
        query
      };
    })
    .filter((image): image is WordVisualImage => Boolean(image))
    .filter(isLikelyPhoto)
    .slice(0, limit);
}

async function searchOpenverse(query: string, limit: number): Promise<WordVisualImage[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.max(4, limit)),
    mature: "false"
  });
  const data = await requestJson<OpenverseResponse>(
    `https://api.openverse.org/v1/images/?${params.toString()}`
  );
  if (!data) return [];

  return (data.results ?? [])
    .map((result): WordVisualImage | null => {
      const thumbUrl = result.thumbnail || result.url;
      const pageUrl = result.foreign_landing_url || result.url;
      if (!thumbUrl || !pageUrl) return null;
      const license = [result.license, result.license_version].filter(Boolean).join(" ");
      return {
        id: `openverse-${result.id}`,
        title: result.title || query,
        thumbUrl,
        pageUrl,
        source: "Openverse",
        license,
        query
      };
    })
    .filter((image): image is WordVisualImage => Boolean(image))
    .filter(isLikelyPhoto)
    .slice(0, limit);
}

async function fetchImages(subject: VisualSubject, limit: number): Promise<WordVisualImage[]> {
  const queries = buildWordImageQueries(subject);
  const images: WordVisualImage[] = [];

  for (const query of queries) {
    const remaining = Math.max(limit - images.length, 1);
    images.push(...(await searchCommons(query, remaining)));
    if (images.length >= limit) break;
    images.push(...(await searchOpenverse(query, remaining)));
    if (images.length >= limit) break;
  }

  return dedupeImages(images).slice(0, limit);
}

export async function getWordVisualImages(
  subject: VisualSubject,
  limit = 3
): Promise<WordVisualImage[]> {
  const key = cacheKey(subject);
  const cached = memoryCache.get(key) ?? readStoredImages(key);
  if (cached?.length) return cached.slice(0, limit);

  const pending = pendingCache.get(key);
  if (pending) return (await pending).slice(0, limit);

  const request = fetchImages(subject, Math.max(limit, 3))
    .then((images) => {
      memoryCache.set(key, images);
      storeImages(key, images);
      pendingCache.delete(key);
      return images;
    })
    .catch(() => {
      pendingCache.delete(key);
      return [];
    });

  pendingCache.set(key, request);
  return (await request).slice(0, limit);
}

function decodeHtml(value: string): string {
  if (typeof document === "undefined") return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function cleanImageTitle(rawTitle: string | undefined, fallbackTitle: string): string {
  const fallback = fallbackTitle
    .replace(/^File:/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const decoded = decodeHtml(rawTitle || "");
  if (!decoded || decoded.length > 110 || decoded.includes("label QS:")) return fallback;
  return decoded;
}

function requestJson<T>(url: string): Promise<T | null> {
  if (typeof fetch === "function") {
    return fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }

  if (typeof XMLHttpRequest === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(request.responseText) as T);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
    request.ontimeout = () => resolve(null);
    request.timeout = 12000;
    request.send();
  });
}
