// KDP-Upload-Status-Tracking (Sprint 7, Agent 1).
//
// Status-Maschine + Observable für KDP-Uploads. Die Render-Logik ist eine
// reine Funktion (UploadState → String) — damit sind CLI (cli.ts) und das
// Dashboard (progress.ts-Muster) ohne Terminal/DOM testbar.
//
// Status-Graph:
//
//   idle ──▶ uploading ──▶ processing ──▶ live
//              │              │
//              └──────────────┴──▶ rejected (terminal)
//
// `live` und `rejected` sind terminal. Jede Transition hängt einen
// Verlaufs-Eintrag an (Audit); Listener werden synchron benachrichtigt.

/** Alle KDP-Upload-Statuswerte. */
export const KDP_UPLOAD_STATUSES = ["idle", "uploading", "processing", "live", "rejected"] as const;

export type UploadStatus = (typeof KDP_UPLOAD_STATUSES)[number];

/** Ein Eintrag im Status-Verlauf (Audit-Trail). */
export interface UploadHistoryEntry {
  from: UploadStatus;
  to: UploadStatus;
  at: number;
  message: string;
}

/** Vollständiger Zustand eines Uploads (persistierbar/serialisierbar). */
export interface UploadState {
  /** Eindeutige Upload-ID (vom Service vergeben). */
  uploadId: string;
  /** Verweis auf den Bookwriter-Job (falls vorhanden). */
  jobId: string | null;
  /** Buchtitel (Anzeige). */
  title: string;
  status: UploadStatus;
  /** Fortschritt 0–100. */
  progressPercent: number;
  /** Status-Grund (z. B. Ablehnungsgrund bei rejected). */
  reason: string | null;
  /** Remote-ID der KDP-API (nach erfolgreichem Upload). */
  remoteId: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  history: UploadHistoryEntry[];
}

/** Erlaubte Status-Übergänge. */
const ALLOWED_TRANSITIONS: Record<UploadStatus, UploadStatus[]> = {
  idle: ["uploading", "rejected"],
  uploading: ["uploading", "processing", "rejected"],
  processing: ["processing", "live", "rejected"],
  live: [],
  rejected: [],
};

/** Deutsche Labels für CLI/Dashboard. */
export const UPLOAD_STATUS_LABELS: Record<UploadStatus, string> = {
  idle: "Bereit",
  uploading: "Wird hochgeladen",
  processing: "In Verarbeitung (KDP)",
  live: "Live",
  rejected: "Abgelehnt",
};

/** Farben für das Dashboard (Konsistenz mit progress.ts). */
export const UPLOAD_STATUS_COLORS: Record<UploadStatus, string> = {
  idle: "#6b7280",
  uploading: "#3b82f6",
  processing: "#f59e0b",
  live: "#10b981",
  rejected: "#ef4444",
};

/** true, wenn der Status ein Endzustand ist. */
export function isTerminalStatus(status: UploadStatus): boolean {
  return status === "live" || status === "rejected";
}

/** Legt den initialen Upload-Zustand an. */
export function createUploadState(
  jobId: string | null,
  title: string,
  uploadId: string = `kdp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  now: number = Date.now(),
): UploadState {
  return {
    uploadId,
    jobId,
    title,
    status: "idle",
    progressPercent: 0,
    reason: null,
    remoteId: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    history: [],
  };
}

/** Transition-Fehler (verbotener Übergang). */
export class KdpUploadTransitionError extends Error {
  constructor(from: UploadStatus, to: UploadStatus) {
    super(`Ungültiger KDP-Upload-Status-Übergang: ${from} → ${to} ist nicht erlaubt.`);
    this.name = "KdpUploadTransitionError";
  }
}

/** Klemmt den Fortschritt auf 0–100. */
function clampProgress(percent: number | undefined): number {
  if (percent === undefined || Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * Führt eine Status-Transition aus (pure): wirft bei verbotenem Übergang,
 * hängt einen Verlaufs-Eintrag an und aktualisiert die Zeitstempel.
 * Eine Transition im selben Status (uploading→uploading) dient als
 * Fortschritts-Update, ohne History-Spam mit identischen Einträgen.
 */
export function transitionUpload(
  state: UploadState,
  to: UploadStatus,
  opts: {
    now?: number;
    progressPercent?: number;
    reason?: string | null;
    remoteId?: string | null;
    message?: string;
  } = {},
): UploadState {
  if (!ALLOWED_TRANSITIONS[state.status].includes(to)) {
    throw new KdpUploadTransitionError(state.status, to);
  }
  const now = opts.now ?? Date.now();
  // live bedeutet: komplett durch → Fortschritt 100 % (falls nicht explizit gesetzt).
  const effective = { ...opts };
  if (to === "live" && opts.progressPercent === undefined) effective.progressPercent = 100;
  const progressPercent = clampProgress(effective.progressPercent);
  const entering = state.status !== to;
  const terminal = isTerminalStatus(to);
  const history = [...state.history];
  if (entering) {
    history.push({
      from: state.status,
      to,
      at: now,
      message: opts.message ?? "",
    });
  }
  return {
    ...state,
    status: to,
    progressPercent: progressPercent !== 0 || opts.progressPercent !== undefined ? progressPercent : state.progressPercent,
    reason: opts.reason !== undefined ? opts.reason : state.reason,
    remoteId: opts.remoteId !== undefined ? opts.remoteId : state.remoteId,
    updatedAt: now,
    startedAt: state.startedAt ?? (to === "uploading" ? now : null),
    finishedAt: terminal ? now : null,
    history,
  };
}

/** Ein abonnierbarer Upload-Tracker (Observer-Pattern). */
export type UploadListener = (state: UploadState) => void;

export interface UploadTracker {
  get(): UploadState;
  setState(state: UploadState): void;
  transition(
    to: UploadStatus,
    opts?: { now?: number; progressPercent?: number; reason?: string | null; remoteId?: string | null; message?: string },
  ): UploadState;
  subscribe(listener: UploadListener): () => void;
}

/** Erstellt einen Tracker um einen initialen Zustand. */
export function createUploadTracker(initial: UploadState = createUploadState(null, "")): UploadTracker {
  let state = initial;
  const listeners = new Set<UploadListener>();
  const notify = () => {
    for (const l of listeners) l(state);
  };
  return {
    get: () => state,
    setState(next: UploadState) {
      state = next;
      notify();
    },
    transition(to, opts) {
      state = transitionUpload(state, to, opts);
      notify();
      return state;
    },
    subscribe(listener: UploadListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Rendert die Fortschrittsanzeige (CLI + Dashboard, reine Funktion).
 * Beispiel:
 *   [KDP] Der lange Weg — Wird hochgeladen [██████────] 40 %
 */
export function renderUploadProgress(state: UploadState, now: number = Date.now()): string {
  const label = UPLOAD_STATUS_LABELS[state.status];
  const segments = 10;
  const filled = Math.round((state.progressPercent / 100) * segments);
  const bar = "█".repeat(filled) + "─".repeat(segments - filled);
  let line = `[KDP] ${state.title || "—"} — ${label} [${bar}] ${state.progressPercent}%`;
  if (state.status === "rejected" && state.reason) {
    line += `\n  ↳ Grund: ${state.reason}`;
  }
  if (isTerminalStatus(state.status) && state.finishedAt && state.startedAt) {
    const secs = Math.max(1, Math.round((state.finishedAt - state.startedAt) / 1000));
    line += `\n  ↳ Dauer: ${secs}s`;
  }
  void now;
  return line;
}
