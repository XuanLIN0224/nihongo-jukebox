import {
  BookOpen,
  Check,
  CircleUserRound,
  LogOut,
  Music2,
  PenLine,
  RefreshCcw,
  Search,
  Volume2,
  X
} from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  contentVersion,
  legalNotice,
  songPacks,
  type Category,
  type JLPTLevel,
  type SongPack,
  type StudyLine,
  type StudyWord,
  vocabulary
} from "./data/studyContent";
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
  shuffle,
  tokensForLine
} from "./lib/study";

type View = "lyrics" | "words" | "progress" | "account";

const categoryLabels: Record<Category | "all", string> = {
  all: "全部歌手",
  "fujii-kaze": "藤井風",
  "togenashi-togeari": "トゲナシトゲアリ"
};

const jlptLevels: JLPTLevel[] = ["N1", "N2", "N3", "N4", "N5"];

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
            {view === "progress" && <ProgressView progress={progress} />}
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
                <strong>{line.text}</strong>
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
        {selectedToken && <TokenDetail token={selectedToken} />}
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

function TokenDetail({ token }: { token: ReturnType<typeof tokensForLine>[number] }) {
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
        <strong>{token.reading}</strong>
        <span>罗马音</span>
        <strong>{token.romaji}</strong>
        <span>词性</span>
        <strong>{token.pos}</strong>
      </div>
      <div className="meaning-block">
        <p>{token.zh}</p>
        <p>{token.en}</p>
      </div>
      <p>{token.noteZh}</p>
      <div className="example-block">
        <strong>{token.exampleJp}</strong>
        <span>{token.exampleZh}</span>
        <span>{token.exampleEn}</span>
      </div>
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
      <p className="quiz-prompt">{line.zh}</p>
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
      {status === "wrong" && <p className="wrong-text">还差一点，拼错了需要重拼。</p>}
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
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>("N1");
  const [currentIndex, setCurrentIndex] = useState(0);
  const learnedSet = useMemo(() => new Set(progress.learnedWords), [progress.learnedWords]);

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
  const dueQuizWords = learnedLevelIds
    .slice(quizMilestone, quizMilestone + 10)
    .map((id) => levelWords.find((word) => word.id === id))
    .filter((word): word is StudyWord => Boolean(word));
  const needsQuiz = dueQuizWords.length >= 10;
  const remaining = levelWords.filter((word) => !learnedSet.has(word.id));
  const currentWord = remaining[currentIndex % Math.max(remaining.length, 1)];
  const percent = progressPercent(learnedLevelIds.length, levelWords.length);
  const quizGap = Math.max(0, 10 - (learnedLevelIds.length - quizMilestone));

  function markWord(word: StudyWord) {
    setProgress((current) => ({
      ...current,
      learnedWords: current.learnedWords.includes(word.id)
        ? current.learnedWords
        : [...current.learnedWords, word.id]
    }));
    setCurrentIndex((current) => current + 1);
  }

  function chooseLevel(level: JLPTLevel) {
    setSelectedLevel(level);
    setCurrentIndex(0);
  }

  if (needsQuiz) {
    return (
      <div className="word-stage-shell">
        <LevelToolbar counts={levelCounts} selectedLevel={selectedLevel} onSelect={chooseLevel} />
        <WordQuiz
          words={dueQuizWords}
          setProgress={setProgress}
          level={selectedLevel}
          onDone={() =>
            setProgress((current) => ({
              ...current,
              wordQuizMilestones: {
                ...(current.wordQuizMilestones ?? {}),
                [selectedLevel]: quizMilestone + dueQuizWords.length
              },
              lastWordQuizMilestone: current.lastWordQuizMilestone + dueQuizWords.length
            }))
          }
        />
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="word-stage-shell">
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
              {currentWord.kana} / {currentWord.romaji}
            </p>
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
            <div className="example-block wide">
              <strong>{currentWord.exampleJp}</strong>
              <span>{currentWord.exampleZh}</span>
              <span>{currentWord.exampleEn}</span>
            </div>
            <div className="word-actions">
              <button className="secondary-button" type="button" onClick={() => setCurrentIndex((value) => value + 1)}>
                <RefreshCcw size={17} />
                先放一放
              </button>
              <button className="primary-button" type="button" onClick={() => markWord(currentWord)}>
                <Check size={18} />
                记住了
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
  onSelect
}: {
  selectedLevel: JLPTLevel;
  counts: Record<JLPTLevel, number>;
  onSelect: (level: JLPTLevel) => void;
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
            <small>{counts[level]} 词</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function WordQuiz({
  words,
  level,
  onDone,
  setProgress
}: {
  words: StudyWord[];
  level: JLPTLevel;
  onDone: () => void;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
}) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const word = words[index];

  if (!word) {
    return (
      <section className="quiz-panel centered">
        <h3>{level} 10 词拼写测试完成。</h3>
        <button className="primary-button" type="button" onClick={onDone}>
          <Check size={18} />
          回到背单词
        </button>
      </section>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isWordAnswerCorrect(input, word)) {
      setStatus("correct");
    } else {
      setStatus("wrong");
      setProgress((current) => ({
        ...current,
        mistakes: {
          ...current.mistakes,
          [word.id]: (current.mistakes[word.id] ?? 0) + 1
        }
      }));
    }
  }

  return (
    <section className="quiz-panel centered">
      <p className="eyebrow">{level} Vocabulary spelling test</p>
      <h3>
        {index + 1} / {words.length}
      </h3>
      <p className="quiz-prompt">{word.zh}</p>
      <p className="quiz-prompt en">{word.en}</p>
      <form className="quiz-form" onSubmit={submit}>
        <input
          autoFocus
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setStatus("idle");
          }}
          placeholder="输入日文单词，可用汉字或假名"
        />
        <button className="primary-button" type="submit">
          <Check size={18} />
          检查
        </button>
      </form>
      {status === "wrong" && <p className="wrong-text">拼错了，先重拼这个词。</p>}
      {status === "correct" && (
        <div className="correct-row">
          <span>{word.japanese} / {word.kana}</span>
          <div className="quiz-actions">
            <button className="secondary-button" type="button" onClick={() => speakJapanese(word.japanese)}>
              <Volume2 size={17} />
              朗读
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setIndex((current) => current + 1);
                setInput("");
                setStatus("idle");
              }}
            >
              下一个
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProgressView({ progress }: { progress: ProgressState }) {
  const totalLines = songPacks.reduce((sum, song) => sum + song.lines.length, 0);
  const songPercent = progressPercent(progress.completedSongs.length, songPacks.length);
  const wordPercent = progressPercent(progress.learnedWords.length, vocabulary.length);
  const linePercent = progressPercent(progress.learnedSongLines.length, totalLines);
  const completedSongs = songPacks.filter((song) => progress.completedSongs.includes(song.id));
  const mistakeRows = Object.entries(progress.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="progress-view">
      <section className="stat-grid">
        <Stat label="歌曲完成" value={`${progress.completedSongs.length}/${songPacks.length}`} percent={songPercent} />
        <Stat label="歌词行" value={`${progress.learnedSongLines.length}/${totalLines}`} percent={linePercent} />
        <Stat label="单词" value={`${progress.learnedWords.length}/${vocabulary.length}`} percent={wordPercent} />
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
      </section>

      <p className="fine-print">
        内容版本 {contentVersion}。进度按歌曲、歌词行、单词的稳定 ID 保存；以后新增内容时，旧进度会保留。
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
