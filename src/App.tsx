import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  CircleUserRound,
  Gamepad2,
  GripVertical,
  Image as ImageIcon,
  Library,
  LogOut,
  Music2,
  Pause,
  PenLine,
  Play,
  RefreshCcw,
  Repeat,
  Repeat1,
  Search,
  ScrollText,
  Shuffle as ShuffleIcon,
  Volume2,
  X
} from "lucide-react";
import type { CSSProperties, Dispatch, DragEvent, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  contentVersion,
  legalNotice,
  songPacks,
  type Category,
  type JLPTLevel,
  type SongPack,
  type StudyLine,
  type StudyWord,
  type TokenInfo,
  vocabulary
} from "./data/studyContent";
import {
  exampleReadings,
  type ExampleReading
} from "./data/exampleReadings";
import {
  gamePacks,
  type GamePack,
  type GameTrack
} from "./data/gameContent";
import {
  grammarPoints,
  grammarSource,
  type GrammarPoint
} from "./data/grammarStudy";
import {
  type AuthSession,
  type ProgressState,
  emptyProgress,
  getStoredSession,
  loadProgress,
  login,
  register,
  saveProgress,
  storeSession
} from "./lib/api";
import { speakJapanese } from "./lib/speech";
import {
  analyzeJapaneseText,
  isLineAnswerCorrect,
  isWordAnswerCorrect,
  progressPercent,
  readingOptionsForSurface,
  romajiOptionsForSurface,
  shuffle,
  tokensForLine,
  wordById
} from "./lib/study";
import {
  getWordVisualImages,
  type VisualSubject,
  type WordVisualImage
} from "./lib/wordImages";

type View = "lyrics" | "words" | "grammar" | "games" | "saved" | "progress" | "account";

const categoryLabels: Record<Category | "all", string> = {
  all: "全部歌手",
  "fujii-kaze": "藤井風",
  "togenashi-togeari": "トゲナシトゲアリ"
};

const jlptLevels: JLPTLevel[] = ["N1", "N2", "N3", "N4", "N5"];

interface GameLine {
  id: string;
  sourceKey: string;
  file: string;
  messageId: string;
  messageKey: string;
  speakerJp: string;
  speakerEn: string;
  japanese: string;
  english: string;
  zh: string;
  kana?: string;
  romaji?: string;
  furigana: string;
  isDummy: boolean;
  order: number;
}

interface GameData {
  id: string;
  title: string;
  sourceWorkbook: string;
  generatedAt: string;
  lineCount: number;
  fileCount: number;
  nonDummyLineCount: number;
  translationMode: string;
  lines: GameLine[];
}

function assetUrl(path: string): string {
  const url = `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/g, "$1");
  return encodeURI(url);
}

function toggleSavedWord(
  wordId: string,
  setProgress: Dispatch<SetStateAction<ProgressState>>
): void {
  setProgress((current) => {
    const saved = current.savedWords ?? [];
    return {
      ...current,
      savedWords: saved.includes(wordId)
        ? saved.filter((id) => id !== wordId)
        : [...saved, wordId]
    };
  });
}

function toggleLearnedGrammar(
  pointId: string,
  setProgress: Dispatch<SetStateAction<ProgressState>>
): void {
  setProgress((current) => {
    const learnedGrammar = current.learnedGrammar ?? [];
    return {
      ...current,
      learnedGrammar: learnedGrammar.includes(pointId)
        ? learnedGrammar.filter((id) => id !== pointId)
        : [...learnedGrammar, pointId]
    };
  });
}

function optionLabel(values: string[]): string {
  return values.filter(Boolean).join(" / ");
}

function exampleReadingFor(
  key?: string,
  fallback?: Pick<ExampleReading, "kana" | "romaji">
): ExampleReading | undefined {
  const reading = key ? exampleReadings[key] : undefined;
  if (reading?.kana || reading?.romaji) return reading;
  if (fallback?.kana || fallback?.romaji) return fallback;
  return undefined;
}

function visualSubjectFromWord(word: StudyWord): VisualSubject {
  return {
    id: word.id,
    japanese: word.japanese,
    kana: word.kana,
    romaji: word.romaji,
    zh: word.zh,
    en: word.en,
    partOfSpeech: word.partOfSpeech,
    tags: word.tags,
    source: word.source
  };
}

function visualSubjectFromToken(token: ReturnType<typeof tokensForLine>[number]): VisualSubject {
  return {
    id: token.vocabularyId ?? token.surface,
    japanese: token.surface,
    kana: token.reading,
    romaji: token.romaji,
    zh: token.zh,
    en: token.en,
    partOfSpeech: token.pos,
    tags: token.vocabularyId ? wordById.get(token.vocabularyId)?.tags : undefined,
    source: token.vocabularyId ? wordById.get(token.vocabularyId)?.source : undefined
  };
}

function tokensForGameLine(line: GameLine): TokenInfo[] {
  return analyzeJapaneseText(line.japanese).flatMap((segment, segmentIndex) =>
    segment.tokens.map((token, tokenIndex) => {
      const readingOptions = token.vocabularyId
        ? readingOptionsForSurface(token.surface, token.reading)
        : token.readingOptions;
      const romajiOptions = token.vocabularyId
        ? romajiOptionsForSurface(token.surface, token.romaji)
        : token.romajiOptions;
      return {
        ...token,
        id: `${line.id}-${segmentIndex}-${token.id}-${tokenIndex}`,
        exampleKey: token.exampleKey ?? token.vocabularyId,
        readingOptions,
        romajiOptions
      };
    })
  );
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [progress, setProgress] = useState<ProgressState>(() => emptyProgress());
  const [view, setView] = useState<View>("lyrics");
  const [isReady, setIsReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let alive = true;
    async function hydrate() {
      if (!session) {
        setIsReady(true);
        return;
      }

      setIsReady(false);
      try {
        const remoteProgress = await loadProgress(session);
        if (alive) setProgress(remoteProgress);
      } finally {
        if (alive) setIsReady(true);
      }
    }
    hydrate();
    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !isReady) return;
    setSaveState("saving");
    const timeout = window.setTimeout(async () => {
      try {
        await saveProgress(session, progress);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [progress, session, isReady]);

  function handleSession(next: AuthSession | null) {
    storeSession(next);
    setSession(next);
  }

  if (!session) {
    return <LoginScreen onSession={handleSession} />;
  }

  const navItems: { id: View; label: string; icon: typeof Music2 }[] = [
    { id: "lyrics", label: "歌词学习", icon: Music2 },
    { id: "words", label: "背单词", icon: BookOpen },
    { id: "grammar", label: "文法", icon: ScrollText },
    { id: "games", label: "游戏区", icon: Gamepad2 },
    { id: "saved", label: "生词本", icon: BookMarked },
    { id: "progress", label: "进度", icon: Check },
    { id: "account", label: "账号", icon: CircleUserRound }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">日</span>
          <div>
            <p className="eyebrow">Nihongo Jukebox</p>
            <h1>歌と単語</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "nav-item active" : "nav-item"}
                type="button"
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="user-panel">
          <CircleUserRound size={18} />
          <div>
            <strong>{session.displayName}</strong>
            <span>{session.mode === "api" ? "MongoDB synced" : "local demo"}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Log out"
            onClick={() => handleSession(null)}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">中日英 / Japanese first</p>
            <h2>{viewTitle(view)}</h2>
          </div>
          <div className={`save-pill ${saveState}`}>
            {saveState === "saving" ? "保存中" : saveState === "error" ? "保存失败" : "已保存"}
          </div>
        </header>

        {!isReady ? (
          <div className="empty-state">正在读取你的学习进度...</div>
        ) : (
          <>
            {view === "lyrics" && <LyricsLab progress={progress} setProgress={setProgress} />}
            {view === "words" && <VocabularyDrill progress={progress} setProgress={setProgress} />}
            {view === "grammar" && <GrammarView progress={progress} setProgress={setProgress} />}
            {view === "games" && <GamesView progress={progress} setProgress={setProgress} />}
            {view === "saved" && <SavedWordsView progress={progress} setProgress={setProgress} />}
            {view === "progress" && <ProgressView progress={progress} setProgress={setProgress} />}
            {view === "account" && <AccountView session={session} />}
          </>
        )}
      </main>
    </div>
  );
}

function viewTitle(view: View): string {
  if (view === "lyrics") return "歌词学习";
  if (view === "words") return "背单词";
  if (view === "grammar") return "文法学习";
  if (view === "games") return "游戏区";
  if (view === "saved") return "生词本";
  if (view === "progress") return "学习进度";
  return "账号";
}

function LoginScreen({ onSession }: { onSession: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const next =
        mode === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password, displayName.trim());
      onSession(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Japanese lyric study</p>
          <h1>Nihongo Jukebox</h1>
          <p className="login-copy">
            面向日语的歌词与单词学习站，中文和英文辅助理解。登录后会记录学过的歌曲行、完成的歌曲和背过的单词。
          </p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="segmented">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              创建账号
            </button>
          </div>

          <label>
            账号
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          {mode === "register" && (
            <label>
              昵称
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          )}
          <label>
            密码
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={isBusy}>
            <Check size={18} />
            {isBusy ? "处理中" : mode === "login" ? "进入学习" : "创建并进入"}
          </button>
          {message && <p className="form-message">{message}</p>}
          <p className="fine-print">
            后端地址由部署环境自动配置。未接入后端时是本地体验模式，可用 demo / demo1234。
          </p>
        </form>
      </section>
    </main>
  );
}

function LyricsLab({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState(songPacks[0]?.id ?? "");
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [customText, setCustomText] = useState("静かな夜に君の声を思い出す。");

  const songs = useMemo(
    () => songPacks.filter((song) => category === "all" || song.category === category),
    [category]
  );
  useEffect(() => {
    if (songs.some((song) => song.id === selectedId)) return;
    setSelectedId(songs[0]?.id ?? "");
    setSelectedTokenId(null);
    setQuizOpen(false);
  }, [selectedId, songs]);
  const selected = songPacks.find((song) => song.id === selectedId) ?? songPacks[0];
  const selectedToken = selectedTokenId
    ? selected.lines.flatMap(tokensForLine).find((token) => token.id === selectedTokenId)
    : tokensForLine(selected.lines[0])[0];
  const analyzed = useMemo(() => analyzeJapaneseText(customText), [customText]);

  function markLine(lineId: string) {
    setProgress((current) => ({
      ...current,
      learnedSongLines: Array.from(new Set([...current.learnedSongLines, lineId]))
    }));
  }

  function markSongDone(song: SongPack) {
    setProgress((current) => ({
      ...current,
      learnedSongLines: Array.from(
        new Set([...current.learnedSongLines, ...song.lines.map((line) => line.id)])
      ),
      completedSongs: Array.from(new Set([...current.completedSongs, song.id]))
    }));
  }

  return (
    <div className="lyrics-layout">
      <section className="catalog-column">
        <div className="section-toolbar">
          <div className="segmented compact">
            {(Object.keys(categoryLabels) as (Category | "all")[]).map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {categoryLabels[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="song-list">
          {songs.map((song) => {
            const done = song.lines.every((line) => progress.learnedSongLines.includes(line.id));
            return (
              <button
                key={song.id}
                type="button"
                className={selected.id === song.id ? "song-card active" : "song-card"}
                onClick={() => {
                  setSelectedId(song.id);
                  setSelectedTokenId(null);
                  setQuizOpen(false);
                }}
              >
                <span className="song-category">{categoryLabels[song.category]}</span>
                <strong>{song.titleJp}</strong>
                <span>{song.artistJp}</span>
                <small>{done ? "已完成" : song.level}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="study-column">
        <div className="study-heading">
          <div>
            <p className="eyebrow">{selected.artistJp}</p>
            <h3>{selected.titleJp}</h3>
            <p>{selected.descriptionZh}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => setQuizOpen(true)}>
            <PenLine size={18} />
            拼写测试
          </button>
        </div>

        <div className="notice-line">{legalNotice.zh}</div>

        <div className="source-row">
          {selected.sourceLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>

        {quizOpen ? (
          <LineQuiz
            song={selected}
            onClose={() => setQuizOpen(false)}
            onLineDone={markLine}
            onSongDone={markSongDone}
            setProgress={setProgress}
          />
        ) : (
          <div className="line-stack">
            {selected.lines.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                learned={progress.learnedSongLines.includes(line.id)}
                selectedTokenId={selectedToken?.id}
                onToken={setSelectedTokenId}
                onDone={markLine}
              />
            ))}
          </div>
        )}

        <section className="custom-analyzer">
          <div className="section-title">
            <Search size={18} />
            <h3>粘贴歌词分析</h3>
          </div>
          <textarea
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            rows={4}
            placeholder="把你有权用于个人学习的日文歌词粘贴到这里。"
          />
          <div className="analyzed-lines">
            {analyzed.map((line) => (
              <div className="analyzed-line" key={line.id}>
                <div className="line-title-row">
                  <strong>{line.text}</strong>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="朗读这句日语"
                    title="朗读这句日语"
                    onClick={() => speakJapanese(line.text)}
                  >
                    <Volume2 size={17} />
                  </button>
                </div>
                <div className="token-row">
                  {line.tokens.map((token, index) => (
                    <span className={token.pos === "unknown" ? "token-chip unknown" : "token-chip"} key={`${token.id}-${index}`}>
                      {token.surface}
                      <small>{token.zh}</small>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <aside className="detail-column">
        {selectedToken && (
          <TokenDetail token={selectedToken} progress={progress} setProgress={setProgress} />
        )}
      </aside>
    </div>
  );
}

function LineCard({
  line,
  learned,
  selectedTokenId,
  onToken,
  onDone
}: {
  line: StudyLine;
  learned: boolean;
  selectedTokenId?: string;
  onToken: (tokenId: string) => void;
  onDone: (lineId: string) => void;
}) {
  const tokens = tokensForLine(line);
  return (
    <article className={learned ? "line-card learned" : "line-card"}>
      <div className="line-copy">
        <div className="line-title-row">
          <strong>{line.japanese}</strong>
          <button
            className="icon-button"
            type="button"
            aria-label="朗读日语句子"
            title="朗读日语句子"
            onClick={() => speakJapanese(line.japanese)}
          >
            <Volume2 size={17} />
          </button>
        </div>
        {line.kana && <span>{line.kana}</span>}
        {line.romaji && <span>{line.romaji}</span>}
        {line.zh && <p>{line.zh}</p>}
        {line.en && <p>{line.en}</p>}
      </div>
      <div className="token-row">
        {tokens.map((token, index) => (
          <button
            key={`${token.id}-${index}`}
            className={selectedTokenId === token.id ? "token-chip active" : "token-chip"}
            type="button"
            onClick={() => onToken(token.id)}
          >
            {token.surface}
            <small>{token.reading}</small>
          </button>
        ))}
      </div>
      <button className="text-button" type="button" onClick={() => onDone(line.id)}>
        <Check size={16} />
        {learned ? "已学过" : "标记学完"}
      </button>
    </article>
  );
}

function WordImageStrip({
  subject,
  limit = 3,
  compact = false
}: {
  subject: VisualSubject;
  limit?: number;
  compact?: boolean;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [images, setImages] = useState<WordVisualImage[]>([]);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!node || shouldLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "260px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let alive = true;
    setImages([]);
    setFailedUrls(new Set());
    setIsLoaded(false);
    getWordVisualImages(subject, limit).then((nextImages) => {
      if (alive) {
        setImages(nextImages);
        setIsLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [limit, shouldLoad, subject.id, subject.japanese, subject.en, subject.zh]);

  const visibleImages = images.filter((image) => !failedUrls.has(image.thumbUrl)).slice(0, limit);

  return (
    <div
      ref={setNode}
      className={`word-visual-strip ${compact ? "compact" : ""}`}
      aria-label={`${subject.japanese} visual examples`}
    >
      {visibleImages.length > 0 ? (
        visibleImages.map((image) => (
          <a
            key={image.id}
            className="word-visual-tile"
            href={image.pageUrl}
            target="_blank"
            rel="noreferrer"
            title={`${image.title} · ${image.source}`}
          >
            <img
              src={image.thumbUrl}
              alt={`${subject.japanese}: ${image.title}`}
              loading="lazy"
              onError={() =>
                setFailedUrls((current) => {
                  const next = new Set(current);
                  next.add(image.thumbUrl);
                  return next;
                })
              }
            />
            <span>{image.source}{image.license ? ` · ${image.license}` : ""}</span>
          </a>
        ))
      ) : (
        <div className="word-visual-placeholder">
          <ImageIcon size={compact ? 16 : 22} />
          <span>{!shouldLoad ? "视觉图" : !isLoaded ? "图片匹配中" : "暂无匹配图"}</span>
        </div>
      )}
    </div>
  );
}

function ExampleBlock({
  japanese,
  reading,
  zh,
  en,
  wide = false
}: {
  japanese: string;
  reading?: ExampleReading;
  zh: string;
  en: string;
  wide?: boolean;
}) {
  return (
    <div className={`example-block ${wide ? "wide" : ""}`}>
      <div className="example-head">
        <strong>{japanese}</strong>
        <button
          className="icon-button"
          type="button"
          aria-label="朗读这句例句"
          title="朗读这句例句"
          onClick={() => speakJapanese(japanese)}
        >
          <Volume2 size={17} />
        </button>
      </div>
      {(reading?.kana || reading?.romaji) && (
        <div className="example-reading-box" aria-label="例句读音">
          {reading?.kana && (
            <>
              <span>读音</span>
              <p className="example-reading kana">{reading.kana}</p>
            </>
          )}
          {reading?.romaji && (
            <>
              <span>Romaji</span>
              <p className="example-reading romaji">{reading.romaji}</p>
            </>
          )}
        </div>
      )}
      <span>{zh}</span>
      <span>{en}</span>
    </div>
  );
}

function TokenDetail({
  token,
  progress,
  setProgress
}: {
  token: ReturnType<typeof tokensForLine>[number];
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const vocabularyId = token.vocabularyId;
  const saved = vocabularyId ? (progress.savedWords ?? []).includes(vocabularyId) : false;
  const readings = token.readingOptions?.length
    ? token.readingOptions
    : readingOptionsForSurface(token.surface, token.reading);
  const romaji = token.romajiOptions?.length
    ? token.romajiOptions
    : romajiOptionsForSurface(token.surface, token.romaji);

  return (
    <section className="token-detail">
      <p className="eyebrow">Word detail</p>
      <div className="word-title-row compact-title">
        <h3>{token.surface}</h3>
        <button
          className="icon-button"
          type="button"
          aria-label="朗读这个词"
          title="朗读这个词"
          onClick={() => speakJapanese(token.surface)}
        >
          <Volume2 size={17} />
        </button>
      </div>
      <div className="reading-grid">
        <span>读音</span>
        <strong>{optionLabel(readings)}</strong>
        <span>罗马音</span>
        <strong>{optionLabel(romaji)}</strong>
        <span>词性</span>
        <strong>{token.pos}</strong>
      </div>
      <WordImageStrip subject={visualSubjectFromToken(token)} limit={3} />
      <div className="meaning-block">
        <span>中文释义</span>
        <p>{token.zh}</p>
        <span>English meaning</span>
        <p>{token.en}</p>
      </div>
      <p>{token.noteZh}</p>
      <ExampleBlock
        japanese={token.exampleJp}
        reading={exampleReadingFor(token.exampleKey ?? vocabularyId)}
        zh={token.exampleZh}
        en={token.exampleEn}
      />
      {vocabularyId && (
        <button className="secondary-button" type="button" onClick={() => toggleSavedWord(vocabularyId, setProgress)}>
          {saved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
          {saved ? "已在生词本" : "加入生词本"}
        </button>
      )}
    </section>
  );
}

function LineQuiz({
  song,
  onClose,
  onLineDone,
  onSongDone,
  setProgress
}: {
  song: SongPack;
  onClose: () => void;
  onLineDone: (lineId: string) => void;
  onSongDone: (song: SongPack) => void;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [order] = useState(() => shuffle(song.lines));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const line = order[index];
  const finished = index >= order.length;

  if (finished) {
    return (
      <section className="quiz-panel">
        <h3>这首歌的歌词练习完成了。</h3>
        <p>进度会用稳定 ID 保存，以后内容更新也不会覆盖你已经完成的记录。</p>
        <button className="primary-button" type="button" onClick={() => onSongDone(song)}>
          <Check size={18} />
          标记整首歌完成
        </button>
      </section>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isLineAnswerCorrect(input, line)) {
      setStatus("correct");
      onLineDone(line.id);
    } else {
      setStatus("wrong");
      setProgress((current) => ({
        ...current,
        mistakes: {
          ...current.mistakes,
          [line.id]: (current.mistakes[line.id] ?? 0) + 1
        }
      }));
    }
  }

  function next() {
    setIndex((current) => current + 1);
    setInput("");
    setStatus("idle");
  }

  return (
    <section className="quiz-panel">
      <div className="quiz-header">
        <span>
          {index + 1} / {order.length}
        </span>
        <button className="icon-button" type="button" aria-label="Close quiz" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="quiz-prompt-row">
        <p className="quiz-prompt">{line.zh}</p>
        <button
          className="icon-button"
          type="button"
          aria-label="朗读当前歌词"
          title="朗读当前歌词"
          onClick={() => speakJapanese(line.japanese)}
        >
          <Volume2 size={17} />
        </button>
      </div>
      {line.en && <p className="quiz-prompt en">{line.en}</p>}
      <form onSubmit={submit} className="quiz-form">
        <input
          autoFocus
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setStatus("idle");
          }}
          placeholder="输入日文原句"
        />
        <button className="primary-button" type="submit">
          <Check size={18} />
          检查
        </button>
      </form>
      {status === "wrong" && (
        <div className="answer-reveal wrong-answer">
          <span>正确答案</span>
          <strong>{line.japanese}</strong>
          {line.romaji && <small>{line.romaji}</small>}
          <p>还差一点，照着答案重拼这一句。</p>
        </div>
      )}
      {status === "correct" && (
        <div className="correct-row">
          <span>正确。</span>
          <button className="secondary-button" type="button" onClick={next}>
            下一句
          </button>
        </div>
      )}
    </section>
  );
}

function VocabularyDrill({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [mode, setMode] = useState<"study" | "library">("study");
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>("N1");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wordHistory, setWordHistory] = useState<string[]>([]);
  const [reviewWordId, setReviewWordId] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ level: JLPTLevel; words: StudyWord[]; milestone: number } | null>(null);
  const learnedSet = useMemo(() => new Set(progress.learnedWords), [progress.learnedWords]);
  const savedSet = useMemo(() => new Set(progress.savedWords ?? []), [progress.savedWords]);

  const levelCounts = useMemo(
    () =>
      jlptLevels.reduce((counts, level) => {
        counts[level] = vocabulary.filter((word) => (word.jlptLevel ?? "N3") === level).length;
        return counts;
      }, {} as Record<JLPTLevel, number>),
    []
  );
  const levelWords = useMemo(
    () => vocabulary.filter((word) => (word.jlptLevel ?? "N3") === selectedLevel),
    [selectedLevel]
  );
  const levelWordIds = useMemo(() => new Set(levelWords.map((word) => word.id)), [levelWords]);
  const learnedLevelIds = useMemo(
    () => progress.learnedWords.filter((id) => levelWordIds.has(id)),
    [levelWordIds, progress.learnedWords]
  );
  const quizMilestone = progress.wordQuizMilestones?.[selectedLevel] ?? 0;
  const dueQuizWords = useMemo(
    () =>
      learnedLevelIds
        .slice(quizMilestone, quizMilestone + 10)
        .map((id) => levelWords.find((word) => word.id === id))
        .filter((word): word is StudyWord => Boolean(word)),
    [learnedLevelIds, levelWords, quizMilestone]
  );
  const needsQuiz = dueQuizWords.length >= 10;
  const quizSession = activeQuiz ?? (needsQuiz ? { level: selectedLevel, words: dueQuizWords, milestone: quizMilestone } : null);
  const remaining = levelWords.filter((word) => !learnedSet.has(word.id));
  const reviewWord = reviewWordId ? levelWords.find((word) => word.id === reviewWordId) : undefined;
  const currentWord = reviewWord ?? remaining[currentIndex % Math.max(remaining.length, 1)];
  const currentSaved = currentWord ? savedSet.has(currentWord.id) : false;
  const currentLearned = currentWord ? learnedSet.has(currentWord.id) : false;
  const percent = progressPercent(learnedLevelIds.length, levelWords.length);
  const quizGap = Math.max(0, 10 - (learnedLevelIds.length - quizMilestone));

  function rememberCurrentWord(word: StudyWord) {
    setWordHistory((current) => {
      if (current[current.length - 1] === word.id) return current;
      return [...current, word.id];
    });
  }

  function goToPreviousWord() {
    const previousId = wordHistory[wordHistory.length - 1];
    if (!previousId) return;
    setReviewWordId(previousId);
    setWordHistory((current) => current.slice(0, -1));
  }

  function skipWord(word: StudyWord) {
    if (!reviewWordId) {
      rememberCurrentWord(word);
      setCurrentIndex((current) => current + 1);
    }
    setReviewWordId(null);
  }

  function markWord(word: StudyWord) {
    if (!reviewWordId) rememberCurrentWord(word);
    setProgress((current) => ({
      ...current,
      learnedWords: current.learnedWords.includes(word.id)
        ? current.learnedWords
        : [...current.learnedWords, word.id]
    }));
    setReviewWordId(null);
  }

  function chooseLevel(level: JLPTLevel) {
    setSelectedLevel(level);
    setCurrentIndex(0);
    setWordHistory([]);
    setReviewWordId(null);
    setActiveQuiz(null);
  }

  useEffect(() => {
    if (!activeQuiz && needsQuiz) {
      setActiveQuiz({ level: selectedLevel, words: dueQuizWords, milestone: quizMilestone });
    }
  }, [activeQuiz, dueQuizWords, needsQuiz, quizMilestone, selectedLevel]);

  if (mode === "library") {
    return (
      <div className="word-stage-shell">
        <VocabularyModeToolbar mode={mode} onMode={setMode} />
        <VocabularyLibrary progress={progress} setProgress={setProgress} />
      </div>
    );
  }

  if (quizSession && quizSession.words.length >= 10) {
    return (
      <div className="word-stage-shell">
        <VocabularyModeToolbar mode={mode} onMode={setMode} />
        <LevelToolbar counts={levelCounts} selectedLevel={selectedLevel} onSelect={chooseLevel} />
        <WordQuiz
          words={quizSession.words}
          progress={progress}
          setProgress={setProgress}
          title={`${quizSession.level} Vocabulary spelling test`}
          completeTitle={`${quizSession.level} 10 词拼写测试完成。`}
          onDone={() => {
            setProgress((current) => ({
              ...current,
              wordQuizMilestones: {
                ...(current.wordQuizMilestones ?? {}),
                [quizSession.level]: Math.max(
                  current.wordQuizMilestones?.[quizSession.level] ?? 0,
                  quizSession.milestone + quizSession.words.length
                )
              },
              lastWordQuizMilestone: current.lastWordQuizMilestone + quizSession.words.length
            }));
            setActiveQuiz(null);
          }}
        />
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="word-stage-shell">
        <VocabularyModeToolbar mode={mode} onMode={setMode} />
        <LevelToolbar counts={levelCounts} selectedLevel={selectedLevel} onSelect={chooseLevel} />
        <section className="empty-state">
          <h3>{selectedLevel} 这组词已经背完。</h3>
          <p>可以切换到其他级别，继续去歌词学习区，或等下一次内容更新。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="word-stage-shell">
      <VocabularyModeToolbar mode={mode} onMode={setMode} />
      <LevelToolbar counts={levelCounts} selectedLevel={selectedLevel} onSelect={chooseLevel} />
      <div className="vocab-layout">
        <section className="word-stage">
          <div className="progress-strip">
            <span>
              {selectedLevel} {learnedLevelIds.length} / {levelWords.length}
            </span>
            <div>
              <span style={{ width: `${percent}%` }} />
            </div>
            <strong>{percent}%</strong>
          </div>

          <article className="word-card">
            <div className="word-card-meta">
              <p className="eyebrow">{currentWord.partOfSpeech}</p>
              <span className="level-badge">{currentWord.jlptLevel ?? selectedLevel}</span>
            </div>
            <div className="word-title-row">
              <h3>{currentWord.japanese}</h3>
              <button
                className="icon-button"
                type="button"
                aria-label="朗读这个单词"
                title="朗读这个单词"
                onClick={() => speakJapanese(currentWord.japanese)}
              >
                <Volume2 size={18} />
              </button>
            </div>
            <p className="reading-large">
              {optionLabel(currentWord.readingOptions ?? [currentWord.kana])} /{" "}
              {optionLabel(currentWord.romajiOptions ?? [currentWord.romaji])}
            </p>
            <WordImageStrip subject={visualSubjectFromWord(currentWord)} limit={3} />
            <div className="meaning-grid">
              <div>
                <span>中文</span>
                <strong>{currentWord.zh}</strong>
              </div>
              <div>
                <span>English</span>
                <strong>{currentWord.en}</strong>
              </div>
            </div>
            <p>{currentWord.introZh}</p>
            <p className="english-note">{currentWord.introEn}</p>
            <ExampleBlock
              japanese={currentWord.exampleJp}
              reading={exampleReadingFor(currentWord.id, {
                kana: currentWord.kana,
                romaji: currentWord.romaji
              })}
              zh={currentWord.exampleZh}
              en={currentWord.exampleEn}
              wide
            />
            <div className="word-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={goToPreviousWord}
                disabled={wordHistory.length === 0}
              >
                <ArrowLeft size={17} />
                上一个
              </button>
              <button className="secondary-button" type="button" onClick={() => toggleSavedWord(currentWord.id, setProgress)}>
                {currentSaved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
                {currentSaved ? "已在生词本" : "加入生词本"}
              </button>
              <button className="secondary-button" type="button" onClick={() => skipWord(currentWord)}>
                <RefreshCcw size={17} />
                {reviewWordId ? "回到当前" : "先放一放"}
              </button>
              <button className="primary-button" type="button" onClick={() => markWord(currentWord)}>
                <Check size={18} />
                {currentLearned ? "已记住" : "记住了"}
              </button>
            </div>
          </article>
        </section>

        <aside className="queue-panel">
          <p className="eyebrow">Next quiz</p>
          <h3>{selectedLevel} 每 10 个词拼写测试</h3>
          <p>当前批次还差 {quizGap} 个词进入测试。</p>
          <div className="mini-word-list">
            {levelWords.slice(0, 18).map((word) => (
              <span key={word.id} className={learnedSet.has(word.id) ? "done" : ""}>
                {word.japanese}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LevelToolbar({
  selectedLevel,
  counts,
  onSelect,
  unit = "词"
}: {
  selectedLevel: JLPTLevel;
  counts: Record<JLPTLevel, number>;
  onSelect: (level: JLPTLevel) => void;
  unit?: string;
}) {
  return (
    <section className="level-toolbar" aria-label="JLPT difficulty">
      <div>
        <p className="eyebrow">Difficulty</p>
        <h3>JLPT 难度</h3>
      </div>
      <div className="segmented level-tabs">
        {jlptLevels.map((level) => (
          <button
            key={level}
            type="button"
            className={selectedLevel === level ? "active" : ""}
            onClick={() => onSelect(level)}
          >
            <strong>{level}</strong>
            <small>{counts[level]} {unit}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function WordQuiz({
  words,
  title,
  completeTitle,
  onDone,
  onCancel,
  progress,
  setProgress
}: {
  words: StudyWord[];
  title: string;
  completeTitle?: string;
  onDone: () => void;
  onCancel?: () => void;
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const quizWordKey = words.map((item) => item.id).join("|");
  const [queue, setQueue] = useState<StudyWord[]>(() => words);
  const [missedIds, setMissedIds] = useState<Set<string>>(() => new Set());
  const [completedCount, setCompletedCount] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong"; word: StudyWord } | null>(null);
  const word = queue[0];
  const saved = word ? (progress.savedWords ?? []).includes(word.id) : false;
  const feedbackSaved = feedback ? (progress.savedWords ?? []).includes(feedback.word.id) : false;
  const currentWasMissed = word ? missedIds.has(word.id) : false;
  const feedbackWasMissed = feedback ? missedIds.has(feedback.word.id) : false;

  useEffect(() => {
    setQueue(words);
    setMissedIds(new Set());
    setCompletedCount(0);
    setInput("");
    setFeedback(null);
  }, [quizWordKey]);

  if (!word) {
    return (
      <section className="quiz-panel centered">
        <h3>{completeTitle ?? "拼写测试完成。"}</h3>
        <button className="primary-button" type="button" onClick={onDone}>
          <Check size={18} />
          完成
        </button>
      </section>
    );
  }

  function goToNextWord() {
    const shouldRequeue = missedIds.has(word.id);
    if (shouldRequeue) {
      setQueue((current) => (current.length ? [...current.slice(1), current[0]] : current));
      setMissedIds((current) => {
        const next = new Set(current);
        next.delete(word.id);
        return next;
      });
    } else {
      setProgress((current) => ({
        ...current,
        learnedWords: current.learnedWords.includes(word.id)
          ? current.learnedWords
          : [...current.learnedWords, word.id]
      }));
      setQueue((current) => current.slice(1));
      setCompletedCount((current) => current + 1);
    }
    setInput("");
    setFeedback(null);
  }

  function markWrongAnswer() {
    setFeedback({ type: "wrong", word });
    setMissedIds((current) => new Set(current).add(word.id));
    setInput("");
    setProgress((current) => ({
      ...current,
      learnedWords: current.learnedWords.filter((id) => id !== word.id),
      mistakes: {
        ...current.mistakes,
        [word.id]: (current.mistakes[word.id] ?? 0) + 1
      }
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (feedback?.type === "correct") {
      goToNextWord();
      return;
    }
    if (!input.trim()) {
      if (feedback?.type !== "wrong") markWrongAnswer();
      return;
    }
    if (isWordAnswerCorrect(input, word)) {
      setInput("");
      setFeedback({ type: "correct", word });
    } else {
      markWrongAnswer();
    }
  }

  return (
    <section className="quiz-panel centered">
      <div className="quiz-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>
            已首答拼对 {completedCount} / {words.length}
          </h3>
        </div>
        {onCancel && (
          <button className="icon-button" type="button" aria-label="退出拼写测试" title="退出拼写测试" onClick={onCancel}>
            <X size={17} />
          </button>
        )}
      </div>
      <div className="quiz-question-card" key={word.id}>
        <p className="quiz-prompt">{word.zh}</p>
        <p className="quiz-prompt en">{word.en}</p>
        <div className="quiz-support-row">
          <button className="secondary-button" type="button" onClick={() => toggleSavedWord(word.id, setProgress)}>
            {saved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
            {saved ? "已在生词本" : "加入生词本"}
          </button>
          <span>{queue.length} 词待完成</span>
          {currentWasMissed && <span>本题已错过，改对后回队尾</span>}
        </div>
        <form className="quiz-form" onSubmit={submit}>
          <input
            autoFocus
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setFeedback(null);
            }}
            placeholder={feedback?.type === "correct" ? "按 Enter 进入下一个词" : "输入日文单词，可用汉字或假名"}
          />
          <button className="primary-button" type="submit">
            {feedback?.type === "correct" ? <ArrowRight size={18} /> : <Check size={18} />}
            {feedback?.type === "correct" ? (feedbackWasMissed ? "放到队尾" : "下一个") : "检查"}
          </button>
        </form>
      </div>
      {feedback?.type === "correct" && (
        <div className="answer-reveal correct-answer">
          <span>{feedbackWasMissed ? "改对" : "正确"}</span>
          <strong>{feedback.word.japanese} / {feedback.word.kana}</strong>
          <small>{feedback.word.romaji}</small>
          <p>
            {feedbackWasMissed
              ? "第一次已经算错；按 Enter 后这题会回到队尾，稍后重新首答。"
              : "按 Enter 进入下一个词。"}
          </p>
          <button className="secondary-button" type="button" onClick={() => toggleSavedWord(feedback.word.id, setProgress)}>
            {feedbackSaved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
            {feedbackSaved ? "已在生词本" : "加入生词本"}
          </button>
          <button className="secondary-button" type="button" onClick={() => speakJapanese(feedback.word.japanese)}>
            <Volume2 size={17} />
            朗读
          </button>
        </div>
      )}
      {feedback?.type === "wrong" && (
        <div className="answer-reveal wrong-answer">
          <span>正确答案</span>
          <strong>{feedback.word.japanese} / {feedback.word.kana}</strong>
          <small>{feedback.word.romaji}</small>
          <p>第一次已经算错。请重新输入；改对后也会回到队尾再来一次。</p>
          <button className="secondary-button" type="button" onClick={() => toggleSavedWord(feedback.word.id, setProgress)}>
            {feedbackSaved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
            {feedbackSaved ? "已在生词本" : "加入生词本"}
          </button>
          <button className="secondary-button" type="button" onClick={() => speakJapanese(feedback.word.japanese)}>
            <Volume2 size={17} />
            朗读
          </button>
        </div>
      )}
    </section>
  );
}

function VocabularyModeToolbar({
  mode,
  onMode
}: {
  mode: "study" | "library";
  onMode: (mode: "study" | "library") => void;
}) {
  return (
    <section className="mode-toolbar" aria-label="Vocabulary mode">
      <div className="segmented compact">
        <button
          type="button"
          className={mode === "study" ? "active" : ""}
          onClick={() => onMode("study")}
        >
          <BookOpen size={16} />
          背单词
        </button>
        <button
          type="button"
          className={mode === "library" ? "active" : ""}
          onClick={() => onMode("library")}
        >
          <Library size={16} />
          全词库
        </button>
      </div>
    </section>
  );
}

function VocabularyLibrary({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>("N1");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(140);
  const savedSet = useMemo(() => new Set(progress.savedWords ?? []), [progress.savedWords]);
  const learnedSet = useMemo(() => new Set(progress.learnedWords), [progress.learnedWords]);
  const levelCounts = useMemo(
    () =>
      jlptLevels.reduce((counts, level) => {
        counts[level] = vocabulary.filter((word) => (word.jlptLevel ?? "N3") === level).length;
        return counts;
      }, {} as Record<JLPTLevel, number>),
    []
  );

  useEffect(() => {
    setVisibleCount(140);
  }, [selectedLevel, query]);

  const words = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return vocabulary.filter((word) => {
      if ((word.jlptLevel ?? "N3") !== selectedLevel) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        word.japanese,
        word.kana,
        word.romaji,
        word.zh,
        word.en,
        word.partOfSpeech,
        ...(word.readingOptions ?? []),
        ...(word.romajiOptions ?? [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, selectedLevel]);
  const visibleWords = words.slice(0, visibleCount);

  return (
    <section className="library-view">
      <LevelToolbar counts={levelCounts} selectedLevel={selectedLevel} onSelect={setSelectedLevel} />
      <div className="library-tools">
        <label>
          搜索
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="library-count">
          <strong>{selectedLevel}</strong>
          <span>{words.length} 词</span>
        </div>
      </div>
      <div className="word-library-grid">
        {visibleWords.map((word) => (
          <WordListCard
            key={word.id}
            word={word}
            saved={savedSet.has(word.id)}
            learned={learnedSet.has(word.id)}
            setProgress={setProgress}
          />
        ))}
      </div>
      {visibleCount < words.length && (
        <button
          className="secondary-button load-more-button"
          type="button"
          onClick={() => setVisibleCount((count) => count + 140)}
        >
          显示更多
        </button>
      )}
    </section>
  );
}

function GrammarView({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>("N1");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(grammarPoints.find((point) => point.level === "N1")?.id ?? grammarPoints[0]?.id ?? "");
  const learnedGrammar = progress.learnedGrammar ?? [];
  const learnedSet = useMemo(() => new Set(learnedGrammar), [learnedGrammar]);
  const levelCounts = useMemo(
    () =>
      jlptLevels.reduce((counts, level) => {
        counts[level] = grammarPoints.filter((point) => point.level === level).length;
        return counts;
      }, {} as Record<JLPTLevel, number>),
    []
  );
  const levelPoints = useMemo(
    () => grammarPoints.filter((point) => point.level === selectedLevel),
    [selectedLevel]
  );
  const filteredPoints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return levelPoints;
    return levelPoints.filter((point) =>
      [
        point.pattern,
        point.titleZh,
        point.meaningZh,
        point.meaningEn,
        point.formationZh,
        point.exampleJp,
        point.exampleZh,
        point.exampleEn
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [levelPoints, query]);
  const selectedPoint =
    filteredPoints.find((point) => point.id === selectedId) ??
    levelPoints.find((point) => point.id === selectedId) ??
    filteredPoints[0] ??
    levelPoints[0];
  const learnedLevelCount = levelPoints.filter((point) => learnedSet.has(point.id)).length;
  const levelPercent = progressPercent(learnedLevelCount, levelPoints.length);

  useEffect(() => {
    if (selectedPoint) setSelectedId(selectedPoint.id);
  }, [selectedPoint]);

  function chooseLevel(level: JLPTLevel) {
    setSelectedLevel(level);
    setQuery("");
    setSelectedId(grammarPoints.find((point) => point.level === level)?.id ?? "");
  }

  return (
    <section className="grammar-view">
      <LevelToolbar
        counts={levelCounts}
        selectedLevel={selectedLevel}
        onSelect={chooseLevel}
        unit="项"
      />
      <div className="library-tools grammar-tools">
        <label>
          搜索文法
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="library-count">
          <strong>{selectedLevel}</strong>
          <span>{filteredPoints.length} 项</span>
        </div>
      </div>
      <div className="progress-strip">
        <span>
          {selectedLevel} 文法 {learnedLevelCount} / {levelPoints.length}
        </span>
        <div>
          <span style={{ width: `${levelPercent}%` }} />
        </div>
        <strong>{levelPercent}%</strong>
      </div>
      <div className="grammar-layout">
        <div className="grammar-list">
          {filteredPoints.map((point) => (
            <button
              key={point.id}
              className={selectedPoint?.id === point.id ? "grammar-card active" : "grammar-card"}
              type="button"
              onClick={() => setSelectedId(point.id)}
            >
              <span>{point.level} · {point.number}</span>
              <strong>{point.pattern}</strong>
              <small>{point.meaningZh}</small>
              {learnedSet.has(point.id) && <em>已学过</em>}
            </button>
          ))}
        </div>

        {selectedPoint ? (
          <article className="grammar-detail">
            <div className="grammar-detail-head">
              <div>
                <p className="eyebrow">{selectedPoint.titleZh}</p>
                <h3>{selectedPoint.pattern}</h3>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="朗读文法例句"
                title="朗读文法例句"
                onClick={() => speakJapanese(selectedPoint.exampleJp)}
              >
                <Volume2 size={18} />
              </button>
            </div>
            <div className="grammar-source-pill">{grammarSource.name} · {grammarSource.count} 项</div>
            <div className="meaning-block">
              <span>中文释义</span>
              <p>{selectedPoint.meaningZh}</p>
              <span>English meaning</span>
              <p>{selectedPoint.meaningEn}</p>
            </div>
            <div className="meaning-block">
              <span>接续</span>
              <p>{selectedPoint.formationZh}</p>
            </div>
            <ExampleBlock
              japanese={selectedPoint.exampleJp}
              reading={exampleReadingFor(selectedPoint.id)}
              zh={selectedPoint.exampleZh}
              en={selectedPoint.exampleEn}
              wide
            />
            <button
              className={learnedSet.has(selectedPoint.id) ? "secondary-button" : "primary-button"}
              type="button"
              onClick={() => toggleLearnedGrammar(selectedPoint.id, setProgress)}
            >
              <Check size={18} />
              {learnedSet.has(selectedPoint.id) ? "已学过" : "标记学过"}
            </button>
          </article>
        ) : (
          <section className="empty-state">
            <h3>没有找到文法点。</h3>
            <p>换一个关键词或 JLPT 级别试试。</p>
          </section>
        )}
      </div>
    </section>
  );
}

function GamesView({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [selectedId, setSelectedId] = useState(gamePacks[0]?.id ?? "persona5");
  const selectedGame = gamePacks.find((game) => game.id === selectedId) ?? gamePacks[0];

  return (
    <div className="games-shell">
      <aside className="game-picker">
        <p className="eyebrow">Games</p>
        {gamePacks.map((game) => (
          <button
            key={game.id}
            className={selectedGame.id === game.id ? "game-pick-card active" : "game-pick-card"}
            type="button"
            onClick={() => setSelectedId(game.id)}
          >
            <strong>{game.title}</strong>
            <span>{game.titleJp}</span>
            <small>{game.nonDummyLineCount.toLocaleString()} 句文本</small>
          </button>
        ))}
      </aside>
      <GameStudyView game={selectedGame} progress={progress} setProgress={setProgress} />
    </div>
  );
}

function GameStudyView({
  game,
  progress,
  setProgress
}: {
  game: GamePack;
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [data, setData] = useState<GameData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [showDummy, setShowDummy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(80);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const learnedIds = progress.learnedGameLines?.[game.id] ?? [];
  const learnedSet = useMemo(() => new Set(learnedIds), [learnedIds]);
  const pageStyle: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, rgba(10, 10, 10, 0.88), rgba(10, 10, 10, 0.66)), url("${assetUrl(game.backgroundUrl)}")`
  };

  useEffect(() => {
    let alive = true;
    setData(null);
    setLoadError("");
    setSelectedToken(null);
    fetch(assetUrl(game.dataUrl))
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${game.dataUrl}`);
        return response.json() as Promise<GameData>;
      })
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((error) => {
        if (alive) setLoadError(error instanceof Error ? error.message : "游戏文本加载失败。");
      });
    return () => {
      alive = false;
    };
  }, [game.dataUrl]);

  useEffect(() => {
    setVisibleCount(80);
    setSelectedToken(null);
  }, [query, fileQuery, showDummy, game.id]);

  const filteredLines = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedFile = fileQuery.trim().toLowerCase();
    return data.lines.filter((line) => {
      if (!showDummy && line.isDummy) return false;
      if (normalizedFile && !line.file.toLowerCase().includes(normalizedFile)) return false;
      if (!normalizedQuery) return true;
      return [
        line.file,
        line.messageKey,
        line.speakerJp,
        line.speakerEn,
        line.japanese,
        line.english,
        line.zh,
        line.kana,
        line.romaji,
        line.furigana
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data, fileQuery, query, showDummy]);
  const visibleLines = filteredLines.slice(0, visibleCount);
  const learnedGameCount = learnedIds.length;
  const totalForProgress = game.nonDummyLineCount || game.lineCount;
  const percent = progressPercent(learnedGameCount, totalForProgress);

  function toggleLine(lineId: string) {
    setProgress((current) => {
      const gameLines = current.learnedGameLines?.[game.id] ?? [];
      const nextLines = gameLines.includes(lineId)
        ? gameLines.filter((id) => id !== lineId)
        : [...gameLines, lineId];
      return {
        ...current,
        learnedGameLines: {
          ...(current.learnedGameLines ?? {}),
          [game.id]: nextLines
        }
      };
    });
  }

  return (
    <section className="game-page persona5-page" style={pageStyle}>
      <div className="game-hero">
        <div>
          <p className="eyebrow">Game study</p>
          <h3>{game.title}</h3>
          <p>{game.descriptionZh}</p>
        </div>
        <div className="game-stat-panel">
          <strong>{learnedGameCount.toLocaleString()}</strong>
          <span>/ {totalForProgress.toLocaleString()} 句</span>
          <div className="progress-strip inverted">
            <div>
              <span style={{ width: `${percent}%` }} />
            </div>
            <em>{percent}%</em>
          </div>
        </div>
      </div>

      <GameMusicPlayer game={game} progress={progress} setProgress={setProgress} />

      <div className="game-tools">
        <label>
          搜索文本
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          文件筛选
          <input placeholder="例如 0282.bf" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} />
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={showDummy} onChange={(event) => setShowDummy(event.target.checked)} />
          显示 Dummy
        </label>
        <div className="library-count game-count">
          <strong>{filteredLines.length.toLocaleString()}</strong>
          <span>{data ? `${data.fileCount.toLocaleString()} files` : "loading"}</span>
        </div>
      </div>

      {loadError && <section className="empty-state">{loadError}</section>}
      {!data && !loadError && <section className="empty-state">正在加载 Persona 5 全量文本...</section>}

      {data && (
        <div className="game-study-grid">
          <div className="game-line-stack">
            {visibleLines.map((line) => (
              <GameLineCard
                key={line.id}
                line={line}
                learned={learnedSet.has(line.id)}
                selectedTokenId={selectedToken?.id}
                onToken={setSelectedToken}
                onToggle={toggleLine}
              />
            ))}
          </div>
          <aside className="game-token-detail">
            {selectedToken ? (
              <TokenDetail token={selectedToken} progress={progress} setProgress={setProgress} />
            ) : (
              <section className="game-detail-empty">
                <p className="eyebrow">Word detail</p>
                <h3>点一句里的词</h3>
                <p>游戏文本会用现在的单词表匹配；已登记的词可以直接看释义、例句、图片，也能加入生词本。</p>
              </section>
            )}
          </aside>
        </div>
      )}

      {data && visibleCount < filteredLines.length && (
        <button
          className="secondary-button game-load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + 120)}
        >
          显示更多
        </button>
      )}
    </section>
  );
}

function GameLineCard({
  line,
  learned,
  selectedTokenId,
  onToken,
  onToggle
}: {
  line: GameLine;
  learned: boolean;
  selectedTokenId?: string;
  onToken: (token: TokenInfo) => void;
  onToggle: (lineId: string) => void;
}) {
  const speakText = line.japanese || line.speakerJp;
  const tokens = useMemo(() => tokensForGameLine(line), [line]);
  return (
    <article className={learned ? "game-line-card learned" : "game-line-card"}>
      <div className="game-line-meta">
        <span>{line.file} · Id {line.messageId} · {line.messageKey}</span>
        {line.isDummy && <em>Dummy</em>}
      </div>
      {(line.speakerJp || line.speakerEn) && (
        <div className="game-speaker-row">
          {line.speakerJp && <strong>{line.speakerJp}</strong>}
          {line.speakerEn && <span>{line.speakerEn}</span>}
        </div>
      )}
      <div className="game-text-grid">
        <div>
          <span>日本語</span>
          <p className="game-text japanese">{line.japanese || "（日文为空）"}</p>
          {(line.kana || line.romaji) && (
            <div className="game-reading-box">
              {line.kana && (
                <>
                  <span>读音</span>
                  <p>{line.kana}</p>
                </>
              )}
              {line.romaji && (
                <>
                  <span>Romaji</span>
                  <p>{line.romaji}</p>
                </>
              )}
            </div>
          )}
          {line.furigana && <p className="game-text furigana">{line.furigana}</p>}
        </div>
        <div>
          <span>中文</span>
          <p className="game-text">{line.zh}</p>
        </div>
        <div>
          <span>English</span>
          <p className="game-text">{line.english || "No English line in source."}</p>
        </div>
      </div>
      {tokens.length > 0 && (
        <div className="game-token-row token-row" aria-label="句子单词分析">
          {tokens.map((token, index) => (
            <button
              key={`${token.id}-${index}`}
              className={[
                "token-chip",
                token.pos === "unknown" ? "unknown" : "",
                selectedTokenId === token.id ? "active" : ""
              ].filter(Boolean).join(" ")}
              type="button"
              onClick={() => onToken(token)}
            >
              {token.surface}
              <small>{token.vocabularyId ? token.reading : "未登记"}</small>
            </button>
          ))}
        </div>
      )}
      <div className="game-line-actions">
        <button className="secondary-button" type="button" onClick={() => speakJapanese(speakText)} disabled={!speakText}>
          <Volume2 size={17} />
          朗读
        </button>
        <button className={learned ? "secondary-button" : "primary-button"} type="button" onClick={() => onToggle(line.id)}>
          <Check size={18} />
          {learned ? "已学过" : "标记学过"}
        </button>
      </div>
    </article>
  );
}

function GameMusicPlayer({
  game,
  progress,
  setProgress
}: {
  game: GamePack;
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrackId, setActiveTrackId] = useState(game.tracks[0]?.id ?? "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"loop-all" | "shuffle" | "repeat-one">("loop-all");
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);
  const savedOrder = progress.gameMusicOrders?.[game.id] ?? [];
  const orderedTracks = useMemo(() => {
    const byId = new Map(game.tracks.map((track) => [track.id, track]));
    const ordered = savedOrder.map((id) => byId.get(id)).filter((track): track is GameTrack => Boolean(track));
    const missing = game.tracks.filter((track) => !savedOrder.includes(track.id));
    return [...ordered, ...missing];
  }, [game.tracks, savedOrder]);
  const activeTrack = orderedTracks.find((track) => track.id === activeTrackId) ?? orderedTracks[0];

  useEffect(() => {
    if (orderedTracks[0] && !orderedTracks.some((track) => track.id === activeTrackId)) {
      setActiveTrackId(orderedTracks[0].id);
    }
  }, [activeTrackId, orderedTracks]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [activeTrackId, isPlaying]);

  function saveTrackOrder(nextTracks: GameTrack[]) {
    setProgress((current) => ({
      ...current,
      gameMusicOrders: {
        ...(current.gameMusicOrders ?? {}),
        [game.id]: nextTracks.map((track) => track.id)
      }
    }));
  }

  function selectTrack(trackId: string, play = true) {
    setActiveTrackId(trackId);
    setIsPlaying(play);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }

  function nextTrack() {
    if (!activeTrack || orderedTracks.length === 0) return;
    if (playMode === "shuffle") {
      const candidates = orderedTracks.filter((track) => track.id !== activeTrack.id);
      const next = candidates[Math.floor(Math.random() * candidates.length)] ?? activeTrack;
      selectTrack(next.id, true);
      return;
    }
    const index = orderedTracks.findIndex((track) => track.id === activeTrack.id);
    const next = orderedTracks[(index + 1) % orderedTracks.length];
    selectTrack(next.id, true);
  }

  function handleEnded() {
    if (playMode === "repeat-one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }
    nextTrack();
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, targetId: string) {
    event.preventDefault();
    if (!dragTrackId || dragTrackId === targetId) return;
    const fromIndex = orderedTracks.findIndex((track) => track.id === dragTrackId);
    const toIndex = orderedTracks.findIndex((track) => track.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextTracks = [...orderedTracks];
    const [moved] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(toIndex, 0, moved);
    saveTrackOrder(nextTracks);
    setDragTrackId(null);
  }

  return (
    <section className="game-music-panel">
      <div className="game-music-head">
        <div>
          <p className="eyebrow">Soundtrack</p>
          <h3>{activeTrack?.title ?? "No track"}</h3>
        </div>
        <button className="primary-button" type="button" onClick={togglePlay} disabled={!activeTrack}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? "暂停" : "播放"}
        </button>
      </div>
      {activeTrack && (
        <audio
          ref={audioRef}
          src={assetUrl(activeTrack.file)}
          controls
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
        />
      )}
      <div className="segmented compact game-play-modes">
        <button type="button" className={playMode === "loop-all" ? "active" : ""} onClick={() => setPlayMode("loop-all")}>
          <Repeat size={15} />
          循环
        </button>
        <button type="button" className={playMode === "shuffle" ? "active" : ""} onClick={() => setPlayMode("shuffle")}>
          <ShuffleIcon size={15} />
          随机
        </button>
        <button type="button" className={playMode === "repeat-one" ? "active" : ""} onClick={() => setPlayMode("repeat-one")}>
          <Repeat1 size={15} />
          单曲
        </button>
      </div>
      <div className="game-track-list">
        {orderedTracks.map((track) => (
          <button
            key={track.id}
            className={activeTrack?.id === track.id ? "game-track-row active" : "game-track-row"}
            type="button"
            draggable
            onClick={() => selectTrack(track.id)}
            onDragStart={() => setDragTrackId(track.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, track.id)}
          >
            <GripVertical size={16} />
            <span>{track.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SavedWordsView({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [query, setQuery] = useState("");
  const [quizWords, setQuizWords] = useState<StudyWord[] | null>(null);
  const learnedSet = useMemo(() => new Set(progress.learnedWords), [progress.learnedWords]);
  const savedWords = useMemo(
    () =>
      (progress.savedWords ?? [])
        .map((id) => wordById.get(id))
        .filter((word): word is StudyWord => Boolean(word)),
    [progress.savedWords]
  );
  const filteredWords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedWords;
    return savedWords.filter((word) =>
      [
        word.japanese,
        word.kana,
        word.romaji,
        word.zh,
        word.en,
        word.partOfSpeech,
        ...(word.readingOptions ?? []),
        ...(word.romajiOptions ?? [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query, savedWords]);

  if (quizWords) {
    return (
      <WordQuiz
        words={quizWords}
        title="生词本 Vocabulary spelling test"
        completeTitle="生词本拼写测试完成。"
        onDone={() => setQuizWords(null)}
        onCancel={() => setQuizWords(null)}
        progress={progress}
        setProgress={setProgress}
      />
    );
  }

  return (
    <section className="library-view">
      <div className="library-tools">
        <label>
          搜索
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button
          className="primary-button"
          type="button"
          onClick={() => setQuizWords(savedWords)}
          disabled={savedWords.length === 0}
        >
          <PenLine size={17} />
          开始生词本测试
        </button>
        <div className="library-count">
          <strong>{filteredWords.length}</strong>
          <span>生词</span>
        </div>
      </div>
      {filteredWords.length ? (
        <div className="word-library-grid">
          {filteredWords.map((word) => (
            <WordListCard
              key={word.id}
              word={word}
              saved
              learned={learnedSet.has(word.id)}
              setProgress={setProgress}
            />
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <h3>生词本是空的。</h3>
          <p>还没有加入任何生词。</p>
        </section>
      )}
    </section>
  );
}

function WordListCard({
  word,
  saved,
  learned,
  setProgress
}: {
  word: StudyWord;
  saved: boolean;
  learned: boolean;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const readings = word.readingOptions ?? [word.kana];
  const romaji = word.romajiOptions ?? [word.romaji];

  return (
    <article className="word-list-card">
      <div className="word-list-head">
        <div>
          <p className="eyebrow">
            {word.jlptLevel ?? "N3"} {learned ? "learned" : word.partOfSpeech}
          </p>
          <h3>{word.japanese}</h3>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="朗读这个单词"
          title="朗读这个单词"
          onClick={() => speakJapanese(word.japanese)}
        >
          <Volume2 size={17} />
        </button>
      </div>
      <p className="reading-line">{optionLabel(readings)} / {optionLabel(romaji)}</p>
      <WordImageStrip subject={visualSubjectFromWord(word)} limit={1} compact />
      <div className="meaning-grid compact-meaning">
        <div>
          <span>中文</span>
          <strong>{word.zh}</strong>
        </div>
        <div>
          <span>English</span>
          <strong>{word.en}</strong>
        </div>
      </div>
      <p>{word.introZh}</p>
      <p className="english-note">{word.introEn}</p>
      <ExampleBlock
        japanese={word.exampleJp}
        reading={exampleReadingFor(word.id, {
          kana: word.kana,
          romaji: word.romaji
        })}
        zh={word.exampleZh}
        en={word.exampleEn}
      />
      <button className="secondary-button" type="button" onClick={() => toggleSavedWord(word.id, setProgress)}>
        {saved ? <BookmarkCheck size={17} /> : <BookmarkPlus size={17} />}
        {saved ? "移出生词本" : "加入生词本"}
      </button>
    </article>
  );
}

function ProgressView({
  progress,
  setProgress
}: {
  progress: ProgressState;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [learnedQuery, setLearnedQuery] = useState("");
  const [learnedVisibleCount, setLearnedVisibleCount] = useState(80);
  const [quizWords, setQuizWords] = useState<StudyWord[] | null>(null);
  const totalLines = songPacks.reduce((sum, song) => sum + song.lines.length, 0);
  const songPercent = progressPercent(progress.completedSongs.length, songPacks.length);
  const wordPercent = progressPercent(progress.learnedWords.length, vocabulary.length);
  const linePercent = progressPercent(progress.learnedSongLines.length, totalLines);
  const grammarPercent = progressPercent(progress.learnedGrammar?.length ?? 0, grammarPoints.length);
  const totalGameLines = gamePacks.reduce((sum, game) => sum + game.nonDummyLineCount, 0);
  const learnedGameLines = Object.values(progress.learnedGameLines ?? {}).reduce(
    (sum, lines) => sum + lines.length,
    0
  );
  const gamePercent = progressPercent(learnedGameLines, totalGameLines);
  const completedSongs = songPacks.filter((song) => progress.completedSongs.includes(song.id));
  const learnedGrammarPoints = grammarPoints.filter((point) =>
    (progress.learnedGrammar ?? []).includes(point.id)
  );
  const mistakeRows = Object.entries(progress.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const savedSet = useMemo(() => new Set(progress.savedWords ?? []), [progress.savedWords]);
  const learnedWords = useMemo(
    () =>
      progress.learnedWords
        .map((id) => wordById.get(id))
        .filter((word): word is StudyWord => Boolean(word)),
    [progress.learnedWords]
  );
  const filteredLearnedWords = useMemo(() => {
    const normalizedQuery = learnedQuery.trim().toLowerCase();
    if (!normalizedQuery) return learnedWords;
    return learnedWords.filter((word) =>
      [
        word.japanese,
        word.kana,
        word.romaji,
        word.zh,
        word.en,
        word.partOfSpeech,
        ...(word.readingOptions ?? []),
        ...(word.romajiOptions ?? [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [learnedQuery, learnedWords]);
  const visibleLearnedWords = filteredLearnedWords.slice(0, learnedVisibleCount);

  useEffect(() => {
    setLearnedVisibleCount(80);
  }, [learnedQuery]);

  if (quizWords) {
    return (
      <WordQuiz
        words={quizWords}
        title="已背单词 Vocabulary spelling test"
        completeTitle="已背单词拼写测试完成。"
        onDone={() => setQuizWords(null)}
        onCancel={() => setQuizWords(null)}
        progress={progress}
        setProgress={setProgress}
      />
    );
  }

  return (
    <div className="progress-view">
      <section className="stat-grid">
        <Stat label="歌曲完成" value={`${progress.completedSongs.length}/${songPacks.length}`} percent={songPercent} />
        <Stat label="歌词行" value={`${progress.learnedSongLines.length}/${totalLines}`} percent={linePercent} />
        <Stat label="单词" value={`${progress.learnedWords.length}/${vocabulary.length}`} percent={wordPercent} />
        <Stat label="文法" value={`${progress.learnedGrammar?.length ?? 0}/${grammarPoints.length}`} percent={grammarPercent} />
        <Stat label="游戏句子" value={`${learnedGameLines}/${totalGameLines}`} percent={gamePercent} />
        <Stat label="生词本" value={`${progress.savedWords?.length ?? 0}`} percent={progressPercent(progress.savedWords?.length ?? 0, vocabulary.length)} />
      </section>

      <section className="progress-columns">
        <div>
          <div className="section-title">
            <Music2 size={18} />
            <h3>完成歌曲</h3>
          </div>
          <div className="plain-list">
            {completedSongs.length ? (
              completedSongs.map((song) => (
                <span key={song.id}>
                  {song.titleJp} / {song.artistJp}
                </span>
              ))
            ) : (
              <span>还没有整首完成。</span>
            )}
          </div>
        </div>
        <div>
          <div className="section-title">
            <PenLine size={18} />
            <h3>容易拼错</h3>
          </div>
          <div className="plain-list">
            {mistakeRows.length ? (
              mistakeRows.map(([id, count]) => (
                <span key={id}>
                  {id}：{count} 次
                </span>
              ))
            ) : (
              <span>目前没有错题记录。</span>
            )}
          </div>
        </div>
        <div>
          <div className="section-title">
            <ScrollText size={18} />
            <h3>已学文法</h3>
          </div>
          <div className="plain-list">
            {learnedGrammarPoints.length ? (
              learnedGrammarPoints.slice(0, 10).map((point) => (
                <span key={point.id}>
                  {point.level} · {point.pattern}
                </span>
              ))
            ) : (
              <span>还没有标记文法点。</span>
            )}
          </div>
        </div>
        <div>
          <div className="section-title">
            <Gamepad2 size={18} />
            <h3>游戏进度</h3>
          </div>
          <div className="plain-list">
            {gamePacks.map((game) => {
              const count = progress.learnedGameLines?.[game.id]?.length ?? 0;
              return (
                <span key={game.id}>
                  {game.title}：{count.toLocaleString()} / {game.nonDummyLineCount.toLocaleString()} 句
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <section className="library-view">
        <div className="library-tools">
          <label>
            搜索已背单词
            <input value={learnedQuery} onChange={(event) => setLearnedQuery(event.target.value)} />
          </label>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setQuizWords(filteredLearnedWords)}
            disabled={filteredLearnedWords.length === 0}
          >
            <PenLine size={17} />
            已背词拼写测试
          </button>
          <div className="library-count">
            <strong>{filteredLearnedWords.length}</strong>
            <span>已背词</span>
          </div>
        </div>
        {visibleLearnedWords.length ? (
          <div className="word-library-grid">
            {visibleLearnedWords.map((word) => (
              <WordListCard
                key={word.id}
                word={word}
                saved={savedSet.has(word.id)}
                learned
                setProgress={setProgress}
              />
            ))}
          </div>
        ) : (
          <section className="empty-state">
            <h3>还没有已背单词。</h3>
            <p>先在背单词页记住一些词，再回来复习。</p>
          </section>
        )}
        {learnedVisibleCount < filteredLearnedWords.length && (
          <button
            className="secondary-button load-more-button"
            type="button"
            onClick={() => setLearnedVisibleCount((count) => count + 80)}
          >
            显示更多
          </button>
        )}
      </section>

      <p className="fine-print">
        内容版本 {contentVersion}。进度按歌曲、歌词行、单词、文法和游戏句子的稳定 ID 保存；以后新增内容时，旧进度会保留。
      </p>
    </div>
  );
}

function Stat({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="progress-strip">
        <div>
          <span style={{ width: `${percent}%` }} />
        </div>
        <em>{percent}%</em>
      </div>
    </article>
  );
}

function AccountView({ session }: { session: AuthSession }) {
  return (
    <div className="settings-view">
      <section className="settings-panel">
        <div className="section-title">
          <CircleUserRound size={18} />
          <h3>当前账号</h3>
        </div>
        <p>{session.displayName}</p>
        <p className="fine-print">
          当前模式：{session.mode === "api" ? "MongoDB API 同步" : "本地体验模式"}。MongoDB 连接串只放在后端环境变量里，不会进入前端 bundle。
        </p>
      </section>

      <section className="settings-panel">
        <div className="section-title">
          <Volume2 size={18} />
          <h3>学习环境</h3>
        </div>
        <p>后端地址由部署环境自动配置，学习者不需要填写任何地址。</p>
        <p className="fine-print">
          日语朗读使用浏览器内置语音。若某台设备没有日语语音包，按钮会保持可用但实际发声取决于系统支持。
        </p>
      </section>
    </div>
  );
}
