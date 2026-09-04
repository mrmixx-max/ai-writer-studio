// Bookwriter-Job-Store: persistenter Status der Vollautomatik-Generierung.
//
// Ziel: Ein Generierungslauf überlebt App-Neustart / Prozess-Kill. Jede
// Statusänderung wird SOFORT via persistNow() auf Platte geschrieben
// (kein Entprellen) — nach jedem abgeschlossenen Kapitel existiert ein
// committed Row. Resume startet bei current_chapter + 1.

import { getDb, persistNow } from "@/services/db";
import { uid } from "@/services/knowledge/util";
import type { BookOutline, BookWriterConfig } from "@/services/writing/bookwriter";

export type BookJobStatus = "running" | "interrupted" | "completed" | "aborted";

export interface BookJob {
  id: string;
  projectId: string;
  config: BookWriterConfig;
  outline: BookOutline | null;
  status: BookJobStatus;
  /** Nummer des zuletzt vollständig gespeicherten Kapitels (0 = noch keins). */
  currentChapter: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

const JOB_COLUMNS = `id, project_id, config_json, outline_json, status, current_chapter, error, created_at, updated_at`;

function parseJson<T>(text: unknown, fallback: T): T {
  if (text === null || text === undefined) return fallback;
  try {
    return JSON.parse(String(text)) as T;
  } catch {
    return fallback;
  }
}

function rowToJob(r: unknown[]): BookJob {
  return {
    id: String(r[0]),
    projectId: String(r[1]),
    config: parseJson<BookWriterConfig>(r[2], {} as BookWriterConfig),
    outline: parseJson<BookOutline | null>(r[3], null),
    status: String(r[4]) as BookJobStatus,
    currentChapter: Number(r[5] ?? 0),
    error: r[6] === null || r[6] === undefined ? null : String(r[6]),
    createdAt: Number(r[7]),
    updatedAt: Number(r[8]),
  };
}

/** Legt einen neuen Job an (status='running', current_chapter=0). */
export function createBookJob(
  projectId: string,
  config: BookWriterConfig,
  outline: BookOutline | null = null,
): BookJob {
  const db = getDb();
  const now = Date.now();
  const job: BookJob = {
    id: uid("bwj"),
    projectId,
    config,
    outline,
    status: "running",
    currentChapter: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO bookwriter_jobs (${JOB_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [job.id, job.projectId, JSON.stringify(config), outline ? JSON.stringify(outline) : null, job.status, 0, null, now, now],
  );
  // Sofort committen — der Job muss jeden Prozess-Kill überleben.
  void persistNow();
  return job;
}

/** Speichert die (nachträglich erzeugte) Gliederung am Job. */
export async function setBookJobOutline(jobId: string, outline: BookOutline): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_jobs SET outline_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(outline), Date.now(), jobId],
  );
  await persistNow();
}

/**
 * Setzt den Fortschritt: current_chapter = Nummer des zuletzt gespeicherten
 * Kapitels. Nach jedem Kapitel aufgerufen → committed Row pro Kapitel.
 */
export async function updateBookJobProgress(
  jobId: string,
  currentChapter: number,
  error: string | null = null,
): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_jobs SET current_chapter = ?, error = ?, updated_at = ? WHERE id = ?`,
    [currentChapter, error, Date.now(), jobId],
  );
  await persistNow();
}

/** Setzt den Job-Status (z.B. interrupted, completed). */
export async function setBookJobStatus(
  jobId: string,
  status: BookJobStatus,
  error: string | null = null,
): Promise<void> {
  getDb().run(
    `UPDATE bookwriter_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
    [status, error, Date.now(), jobId],
  );
  await persistNow();
}

/** Lädt einen Job nach Id. */
export function loadBookJob(jobId: string): BookJob | null {
  const res = getDb().exec(`SELECT ${JOB_COLUMNS} FROM bookwriter_jobs WHERE id = ?`, [jobId]);
  if (!res.length || !res[0].values.length) return null;
  return rowToJob(res[0].values[0]);
}

/**
 * Liefert den fortsetzbaren Job eines Projekts (status 'running' oder
 * 'interrupted' und current_chapter > 0, sonst gibt es nichts
 * fortzusetzen), den jüngsten zuerst — oder null.
 */
export function getResumableBookJob(projectId: string): BookJob | null {
  const res = getDb().exec(
    `SELECT ${JOB_COLUMNS} FROM bookwriter_jobs
     WHERE project_id = ? AND status IN ('running','interrupted') AND current_chapter > 0
     ORDER BY updated_at DESC LIMIT 1`,
    [projectId],
  );
  if (!res.length || !res[0].values.length) return null;
  return rowToJob(res[0].values[0]);
}

/** Markiert den Job als abgeschlossen (nicht mehr fortsetzbar). */
export async function completeBookJob(jobId: string): Promise<void> {
  await setBookJobStatus(jobId, "completed", null);
}

/** Verwirft einen Job (z.B. Nutzer lehnt Resume ab). Kapitel bleiben erhalten. */
export async function deleteBookJob(jobId: string): Promise<void> {
  getDb().run(`DELETE FROM bookwriter_jobs WHERE id = ?`, [jobId]);
  await persistNow();
}
