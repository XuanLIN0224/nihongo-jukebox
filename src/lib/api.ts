import { contentVersion, type JLPTLevel } from "../data/studyContent";

export interface ProgressState {
  learnedSongLines: string[];
  completedSongs: string[];
  learnedWords: string[];
  lastWordQuizMilestone: number;
  wordQuizMilestones: Partial<Record<JLPTLevel, number>>;
  mistakes: Record<string, number>;
  contentVersion: string;
  updatedAt: string;
}

export interface AuthSession {
  username: string;
  displayName: string;
  token?: string;
  mode: "api" | "local";
}

interface StoredUser {
  username: string;
  displayName: string;
  password: string;
}

const sessionKey = "nihongo-jukebox-session";
const usersKey = "nihongo-jukebox-local-users";
const progressKey = (username: string) => `nihongo-jukebox-progress-${username}`;

export const emptyProgress = (): ProgressState => ({
  learnedSongLines: [],
  completedSongs: [],
  learnedWords: [],
  lastWordQuizMilestone: 0,
  wordQuizMilestones: {},
  mistakes: {},
  contentVersion,
  updatedAt: new Date().toISOString()
});

export function getApiBase(): string {
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) || "").replace(/\/$/, "");
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

export function storeSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(sessionKey);
    return;
  }
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function readLocalUsers(): StoredUser[] {
  const raw = localStorage.getItem(usersKey);
  if (!raw) {
    const seeded = [{ username: "demo", displayName: "Demo", password: "demo1234" }];
    localStorage.setItem(usersKey, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as StoredUser[];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: StoredUser[]): void {
  localStorage.setItem(usersKey, JSON.stringify(users));
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Request failed with ${response.status}`);
  }
  return data as T;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const apiBase = getApiBase();
  if (apiBase) {
    const data = await request<{ token: string; user: { username: string; displayName: string } }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password })
      }
    );
    return {
      username: data.user.username,
      displayName: data.user.displayName || data.user.username,
      token: data.token,
      mode: "api"
    };
  }

  const user = readLocalUsers().find((item) => item.username === username);
  if (!user || user.password !== password) {
    throw new Error("账号或密码不对。当前部署未配置后端 API 时，可用 demo / demo1234 体验。");
  }
  return {
    username: user.username,
    displayName: user.displayName,
    mode: "local"
  };
}

export async function register(
  username: string,
  password: string,
  displayName: string,
  inviteCode: string
): Promise<AuthSession> {
  const apiBase = getApiBase();
  if (apiBase) {
    const data = await request<{ token: string; user: { username: string; displayName: string } }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ username, password, displayName, inviteCode })
      }
    );
    return {
      username: data.user.username,
      displayName: data.user.displayName || data.user.username,
      token: data.token,
      mode: "api"
    };
  }

  const users = readLocalUsers();
  if (users.some((item) => item.username === username)) {
    throw new Error("这个本地账号已经存在。");
  }
  users.push({ username, password, displayName: displayName || username });
  writeLocalUsers(users);
  return {
    username,
    displayName: displayName || username,
    mode: "local"
  };
}

export async function loadProgress(session: AuthSession): Promise<ProgressState> {
  if (session.mode === "api" && session.token) {
    const data = await request<{ progress?: ProgressState }>("/api/progress", {}, session.token);
    return { ...emptyProgress(), ...(data.progress ?? {}) };
  }

  const raw = localStorage.getItem(progressKey(session.username));
  if (!raw) return emptyProgress();
  try {
    return { ...emptyProgress(), ...(JSON.parse(raw) as ProgressState) };
  } catch {
    return emptyProgress();
  }
}

export async function saveProgress(session: AuthSession, progress: ProgressState): Promise<void> {
  const next = {
    ...progress,
    contentVersion,
    updatedAt: new Date().toISOString()
  };

  if (session.mode === "api" && session.token) {
    await request(
      "/api/progress",
      {
        method: "PUT",
        body: JSON.stringify({ progress: next })
      },
      session.token
    );
    return;
  }

  localStorage.setItem(progressKey(session.username), JSON.stringify(next));
}
