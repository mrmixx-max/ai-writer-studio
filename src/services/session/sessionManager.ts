// Sitzungs-Manager (Sprint 24, Agent 3): Multiple Sessions speichern/laden.
// Rein clientseitig, ohne neue Dependencies. Laeuft in Browser und Node
// (Tests). Persistenz: In-Memory als Source of Truth, optional localStorage.

export interface Session {
  id: string;
  name: string;
  projectId: string;
  /** Kapitel-IDs der offenen Tabs. */
  openTabs: string[];
  activeTab?: string;
  sidebarMode?: string;
  editorScroll?: number;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "ai-writer-studio-sessions";
const CURRENT_KEY = "ai-writer-studio-current-session";

let sessions: Session[] = [];
let lastRestoredId: string | null = null;
let counter = 0;

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

function persist(): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Speicher voll oder blockiert — In-Memory bleibt gueltig.
  }
}

function hydrate(): void {
  if (!hasLocalStorage() || sessions.length > 0) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Session[];
    if (Array.isArray(parsed)) {
      sessions = parsed.filter((s) => s && typeof s.id === "string" && typeof s.name === "string");
    }
  } catch {
    // Korrupte Daten ignorieren.
  }
}

interface CapturedState {
  projectId: string;
  openTabs: string[];
  activeTab?: string;
  sidebarMode?: string;
  editorScroll?: number;
}

/** Liest den aktuellen App-Zustand (Projekt-Store + Editor-Scroll). */
function captureCurrentState(): CapturedState {
  let projectId = "";
  let openTabs: string[] = [];
  let activeTab: string | undefined;
  try {
    const raw = hasLocalStorage() ? localStorage.getItem("ai-writer-studio-projects") : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string }[];
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0]?.id === "string") {
        projectId = parsed[0].id as string;
      }
    }
  } catch {
    // Fallback unten.
  }
  if (hasLocalStorage()) {
    try {
      const tabs = localStorage.getItem("ai-writer-studio-open-tabs");
      if (tabs) {
        const parsed = JSON.parse(tabs) as string[];
        if (Array.isArray(parsed)) openTabs = parsed.filter((t) => typeof t === "string");
      }
      activeTab = localStorage.getItem("ai-writer-studio-active-tab") ?? undefined;
      const scroll = localStorage.getItem("ai-writer-studio-editor-scroll");
      if (scroll !== null && !Number.isNaN(Number(scroll))) {
        return { projectId, openTabs, activeTab, editorScroll: Number(scroll) };
      }
    } catch {
      // Ignorieren — Defaults verwenden.
    }
  }
  return { projectId, openTabs, activeTab };
}

/** Speichert den aktuellen Zustand unter dem gegebenen Namen. */
export async function saveSession(name: string): Promise<Session> {
  hydrate();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Session-Name darf nicht leer sein.");
  counter += 1;
  const now = Date.now();
  const state = captureCurrentState();
  const session: Session = {
    id: `session-${now}-${counter}`,
    name: trimmed,
    projectId: state.projectId,
    openTabs: state.openTabs,
    activeTab: state.activeTab,
    sidebarMode: state.sidebarMode,
    editorScroll: state.editorScroll,
    createdAt: now,
    updatedAt: now,
  };
  sessions = [...sessions, session];
  persist();
  return session;
}

/** Laedt eine Session anhand ihrer ID (wirft bei unbekannter ID). */
export async function loadSession(id: string): Promise<Session> {
  hydrate();
  const found = sessions.find((s) => s.id === id);
  if (!found) throw new Error(`Session nicht gefunden: ${id}`);
  return { ...found, openTabs: [...found.openTabs] };
}

/** Gibt alle Sessions zurueck, neueste zuerst. */
export async function getSessions(): Promise<Session[]> {
  hydrate();
  return [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => ({ ...s, openTabs: [...s.openTabs] }));
}

/** Loescht eine Session (wirft bei unbekannter ID). */
export async function deleteSession(id: string): Promise<void> {
  hydrate();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Session nicht gefunden: ${id}`);
  sessions = sessions.filter((s) => s.id !== id);
  persist();
}

/** Benennt eine Session um (wirft bei unbekannter ID / leerem Namen). */
export async function renameSession(id: string, name: string): Promise<void> {
  hydrate();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Session-Name darf nicht leer sein.");
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Session nicht gefunden: ${id}`);
  sessions = sessions.map((s) =>
    s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s,
  );
  persist();
}

/**
 * Stellt den Zustand einer Session wieder her: setzt das aktive Projekt,
 * die offenen Tabs und den Editor-Zustand (soweit verfuegbar) und merkt
 * sich die Session als "current". Wirft bei unbekannter ID.
 */
export async function restoreState(session: Session): Promise<void> {
  hydrate();
  const found = sessions.find((s) => s.id === session.id);
  if (!found) throw new Error(`Session nicht gefunden: ${session.id}`);
  lastRestoredId = found.id;
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(found));
      localStorage.setItem("ai-writer-studio-open-tabs", JSON.stringify(found.openTabs));
      if (found.activeTab) localStorage.setItem("ai-writer-studio-active-tab", found.activeTab);
      if (typeof found.editorScroll === "number") {
        localStorage.setItem("ai-writer-studio-editor-scroll", String(found.editorScroll));
      }
    } catch {
      // Persistenz optional — Restore gilt trotzdem.
    }
  }
  // Projekt-Store synchronisieren (best effort, kein harter Fehler).
  try {
    const { useProjectStore } = await import("@/store/projectStore");
    if (found.projectId) {
      useProjectStore.getState().openProject(found.projectId);
      if (found.activeTab) useProjectStore.getState().openChapter(found.activeTab);
    }
  } catch {
    // Store nicht verfuegbar (z. B. isolierte Tests) — ignorieren.
  }
}

/** ID der zuletzt wiederhergestellten Session (oder null). */
export function getLastRestoredId(): string | null {
  return lastRestoredId;
}

/** Setzt den In-Memory-Zustand zurueck (nur fuer Tests). */
export async function __resetSessionState(): Promise<void> {
  sessions = [];
  lastRestoredId = null;
  counter = 0;
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_KEY);
    } catch {
      // Ignorieren.
    }
  }
}
