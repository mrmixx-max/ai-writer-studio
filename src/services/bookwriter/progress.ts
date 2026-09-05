// GUI-Fortschritts-Helper für das BookWriter-Dashboard (Sprint 6, Agent 5).
//
// Das CLI (Sprint 4) und das Panel (Sprint 2/4) committen ihren Fortschritt
// in bookwriter_jobs. Das Dashboard liest diese Rows und leitet daraus einen
// Anzeige-Zustand ab. Diese Datei hält die Ableitung als reine Funktionen —
// damit ist der Kern der GUI-Logik ohne DOM testbar.

import type { BookJob } from "./jobs";

/** Poll-Intervall des Dashboards (ms). Sekundenbereich: spürbar live, aber
 *  keine DB-Spam-Last. */
export const PROGRESS_POLL_INTERVAL_MS = 2000;

/** Ab wie viel Stillstand (kein updatedAt) gilt ein 'running'-Job als stalled? */
export const STALE_THRESHOLD_MS = 5 * 60_000;

/** Anzeige-Zustand eines Jobs im Dashboard. */
export type JobProgressState = "running" | "stalled" | "interrupted" | "completed";

export const JOB_STATE_LABELS: Record<JobProgressState, string> = {
  running: "Läuft",
  stalled: "Stillstand",
  interrupted: "Unterbrochen",
  completed: "Fertig",
};

export const JOB_STATE_COLORS: Record<JobProgressState, string> = {
  running: "#3b82f6",
  stalled: "#f59e0b",
  interrupted: "#ef4444",
  completed: "#10b981",
};

/**
 * Leitet den Anzeige-Zustand aus einem Job-Row ab.
 * 'running' + kein Update seit STALE_THRESHOLD_MS → 'stalled' (der Prozess
 * wurde vermutlich getötet, ohne 'interrupted' schreiben zu können).
 * 'aborted' wird für die GUI wie 'interrupted' behandelt.
 */
export function deriveJobProgressState(
  job: Pick<BookJob, "status" | "updatedAt">,
  now: number = Date.now(),
): JobProgressState {
  if (job.status === "completed") return "completed";
  if (job.status === "interrupted" || job.status === "aborted") return "interrupted";
  // status 'running':
  if (now - job.updatedAt >= STALE_THRESHOLD_MS) return "stalled";
  return "running";
}

/** Kapitel-Fortschritt als Prozent (0–100, ganzzahlig), divisionssicher. */
export function formatProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

/** Relative Zeit auf Deutsch ('gerade eben', 'vor 3 min', 'vor 2 h'). */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return "gerade eben";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.floor(hours / 24);
  return `vor ${days} d`;
}

/**
 * Ist ein Job im Recovery-Sinne fortsetzbar? Gleiche Semantik wie
 * getResumableBookJob / findInterruptedJobs: running|interrupted und
 * current_chapter > 0.
 */
export function isJobRecoverable(
  job: Pick<BookJob, "status" | "currentChapter">,
): boolean {
  return (
    (job.status === "running" || job.status === "interrupted") &&
    job.currentChapter > 0
  );
}
