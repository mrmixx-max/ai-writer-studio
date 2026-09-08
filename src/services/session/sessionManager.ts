// Sitzungs-Manager (Sprint 24, Agent 3): Multiple Sessions speichern/laden.
// Persistenz: localStorage (Key unten) + In-Memory-Cache. Keine neuen Deps.
// saveSession() snapshotet den aktuellen projectStore-Zustand (Projekt,
// offene Tabs = Kapitel-IDs, aktives Tab); restoreState() stellt ihn wieder her.
import { useProjectStore } from "@/store/projectStore";

export interface Session {
  id: string;
  name: string;
  projectId: string;
  openTabs: string[];
  activeTab?: string;
  sidebarMode?: string;
  editorScroll?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SessionState {
  sessions: Session[];
  activeSession?: string;
}

const STORAGE_KEY = "ai-writer-studio:sessions:v1";

let cache: Session[] | null = null;
let activeSessionId: string | undefined;

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function readStore(): Session[] {
  if (cache) return [...cache];
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      cache = [];
      return [];
    }
    const parsed = JSON.parse(raw) as Session[];
    cache = Array.isArray(parsed) ? parsed : [];
    return [...cache];
  } catch {
    cache = [];
    return [];
  }
}

function writeStore(sessions: Session[]): void {
  cache = [...sessions];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    }
  } catch {
    // Quota/SSR — Cache bleibt konsistent, Persistenz entfällt.
  }
}

/** Test-Hook: setzt den Cache zurück (isoliert Tests voneinander). */
export function __resetSessionsForTests(): void {
  cache = [];
  activeSessionId = undefined;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function snapshotCurrent(): Pick<Session, "projectId" | "openTabs" | "activeTab"> {
  try {
    const s = useProjectStore.getState();
    return {
      projectId: s.activeProjectId ?? "",
      openTabs: s.chapters.map((c) => c.id),
      activeTab: s.activeChapterId ?? undefined,
    };
  } catch {
    return { projectId: "", openTabs: [] };
  }
}

export async function saveSession(name: string): Promise<Session> {
  const label = name?.trim() ? name.trim() : "Unbenannte Sitzung";
  const snap = snapshotCurrent();
  const now = Date.now();
  const session: Session = {
    id: genId(),
    name: label,
    projectId: snap.projectId,
    openTabs: snap.openTabs,
    activeTab: snap.activeTab,
    createdAt: now,
    updatedAt: now,
  };
  const sessions = readStore();
  sessions.push(session);
  writeStore(sessions);
  activeSessionId = session.id;
  return session;
}

export async function loadSession(id: string): Promise<Session> {
  const sessions = readStore();
  const found = sessions.find((s) => s.id === id);
  if (!found) throw new Error(`Session nicht gefunden: ${id}`);
  activeSessionId = found.id;
  return { ...found };
}

export async function getSessions(): Promise<Session[]> {
  return readStore().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveSessionId(): string | undefined {
  return activeSessionId;
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = readStore().filter((s) => s.id !== id);
  writeStore(sessions);
  if (activeSessionId === id) activeSessionId = undefined;
}

export async function renameSession(id: string, name: string): Promise<void> {
  const label = name?.trim();
  if (!label) throw new Error("Session-Name darf nicht leer sein.");
  const sessions = readStore();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`Session nicht gefunden: ${id}`);
  sessions[idx] = { ...sessions[idx], name: label, updatedAt: Date.now() };
  writeStore(sessions);
}

export async function restoreState(session: Session): Promise<void> {
  const store = useProjectStore.getState();
  if (session.projectId) {
    try {
      store.openProject(session.projectId);
    } catch {
      /* Projekt evtl. gelöscht — Tabs trotzdem bestmöglich öffnen */
    }
  }
  if (session.activeTab) {
    try {
      store.openChapter(session.activeTab);
    } catch {
      /* Kapitel evtl. gelöscht — kein harter Fehler */
    }
  }
  activeSessionId = session.id;
  if (typeof window !== "undefined" && session.sidebarMode) {
    window.dispatchEvent(
      new CustomEvent<string>("bookwriter:open-mode", { detail: session.sidebarMode }),
    );
  }
  if (typeof window !== "undefined" && typeof session.editorScroll === "number") {
    requestAnimationFrame(() => {
      const el = document.querySelector(".editor-scroll, .editor, [data-editor-scroll]");
      if (el) el.scrollTop = session.editorScroll as number;
    });
  }
}

export function getSessionState(): SessionState {
  return { sessions: readStore(), activeSession: activeSessionId };
}
