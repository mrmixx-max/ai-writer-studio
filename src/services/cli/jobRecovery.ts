// Job-Recovery (Sprint 4, Agent 1): Prüfung beim CLI-Start, ob abgebrochene
// Buch-Generierungsläufe in der DB liegen, und Fortsetzungs-Prompt.
//
// Baut auf dem Job-Store (src/services/bookwriter/jobs.ts, Migration 018)
// auf: ein Job ist fortsetzbar, wenn status running|interrupted und
// current_chapter > 0 (identische Semantik wie getResumableBookJob).

import { getDb } from "@/services/db";
import { loadBookJob, deleteBookJob, type BookJob } from "@/services/bookwriter/jobs";
export interface InterruptedJobInfo {
  jobId: string;
  job: BookJob;
  projectId: string;
  status: BookJob["status"];
  /** Nummer des zuletzt gespeicherten Kapitels. */
  currentChapter: number;
  /** Titel des Buchprojekts (aus der Outline, sonst Projektname). */
  projectTitle: string;
  /** Kapitel, bei dem fortgesetzt wird (current_chapter + 1). */
  resumeAtChapter: number;
  totalChapters: number;
  updatedAt: number;
}

/** Prüft, ob die DB bereits initialisiert wurde (ohne sie anzulegen). */
function dbAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

/**
 * Findet ALLE fortsetzbaren Jobs (running/interrupted mit Fortschritt),
 * jüngster zuerst. Erweiterung von getResumableBookJob (LIMIT 1, projekt-
 * gebunden) auf projektübergreifende Übersicht für das CLI.
 * Ohne initialisierte DB (z.B. nackter CLI-Start vor der App) → leere Liste.
 */
export function findInterruptedJobs(): InterruptedJobInfo[] {
  if (!dbAvailable()) return [];
  const res = getDb().exec(
    `SELECT j.id, j.project_id, p.name, j.outline_json, j.current_chapter, j.updated_at, j.config_json
     FROM bookwriter_jobs j
     LEFT JOIN projects p ON p.id = j.project_id
     WHERE j.status IN ('running','interrupted') AND j.current_chapter > 0
     ORDER BY j.updated_at DESC`,
  );
  if (!res.length) return [];
  return res[0].values.map((r) => {
    const job = loadBookJob(String(r[0]));
    if (!job) return null;
    const outline = job.outline;
    const projectTitle = outline?.title?.trim() || String(r[2] ?? "Unbenanntes Projekt");
    return {
      jobId: job.id,
      job,
      projectId: job.projectId,
      status: job.status,
      currentChapter: job.currentChapter,
      projectTitle,
      resumeAtChapter: job.currentChapter + 1,
      totalChapters: outline?.chapters?.length ?? job.config.chapterCount ?? 0,
      updatedAt: job.updatedAt,
    } as InterruptedJobInfo;
  }).filter((x): x is InterruptedJobInfo => x !== null);
}

/**
 * Formatierung des interaktiven Recovery-Prompts:
 * 'Möchten Sie das Buchprojekt [Titel] bei Kapitel X fortsetzen?'
 */
export function formatRecoveryPrompt(info: InterruptedJobInfo): string {
  return (
    `Möchten Sie das Buchprojekt "${info.projectTitle}" bei Kapitel ${info.resumeAtChapter} fortsetzen? ` +
    `(${info.job.currentChapter}/${info.totalChapters} Kapitel bereits gespeichert)`
  );
}

export type RecoveryAction = "resume" | "discard";

export interface RecoveryChoice {
  action: RecoveryAction;
  jobId: string;
  /** Kapitel, ab dem fortgesetzt wird (nur bei action=resume relevant). */
  startChapter: number;
}

/**
 * Wendet die Nutzerwahl an. 'discard' löscht den Job (Kapitel bleiben wie
 * beim Verwerfen im Panel erhalten); 'resume' ändert nur den State-Pfad —
 * das Fortsetzen selbst übernimmt der Aufrufer mit der gespeicherten Outline.
 */
export async function buildRecoveryChoice(info: InterruptedJobInfo, action: RecoveryAction): Promise<RecoveryChoice> {
  if (action === "discard") {
    await deleteBookJob(info.job.id);
  }
  return { action, jobId: info.job.id, startChapter: info.resumeAtChapter };
}
