// BulkOrchestrator: Automatisierte Abarbeitung mehrerer Bücher (Sprint 5).
//
// Verantwortlichkeiten:
// 1. CSV-Job-Queue: Bulk-Jobs (Titel, Genre, Target-Wörterzahl, Spezial-Prompt,
//    Sprache) kommen aus csvQueue.parseBulkJobsCsv() und werden hier in
//    Reihenfolge abgearbeitet.
// 2. Ressourcen-Schonung: Cooldown-Phase (Default 60s) zwischen Büchern für
//    lokale Modelle + Context-Cache wird nach JEDEM Buch geleert.
// 3. Resume-on-Crash: Ein fataler Fehler in einem Buch schreibt einen Eintrag
//    in failed_jobs.json (via injizierbarem writeFileFn) und stoppt NICHT die
//    Queue — die restlichen Bücher laufen weiter.
//
// Design-Vertrag:
// - Keine direkten Importe von DB/LLM/FS: alles läuft über das injizierte
//   BulkJobRunner-Interface → deterministisch testbar, keine Nebenwirkungen.
// - Cooldown nach jedem Job AUSSER nach dem letzten.
// - Fehlgeschlagene Jobs werden NICHT erneut eingereiht (kein Endlosloop).

import type { BulkJob } from "./csvQueue";

/** Default-Cooldown zwischen Büchern (lokale Modelle): 60 Sekunden. */
export const DEFAULT_COOLDOWN_MS = 60_000;

/** Dateiname der Fehler-Datei (Resume-on-Crash). */
export const DEFAULT_FAILED_JOBS_FILENAME = "failed_jobs.json";

/** Ergebnis eines einzelnen Buch-Laufs (vom Runner geliefert). */
export interface BulkJobResult {
  projectId: string;
  chaptersWritten: number;
  wordsWritten: number;
}

/** Ein fehlgeschlagener Job (Eintrag in failed_jobs.json). */
export interface BulkFailedJob {
  jobId: string;
  jobTitle: string;
  error: string;
  failedAt: number;
  /** 1-basierte CSV-Zeilennummer (aus der CSV-Queue). */
  sourceRow: number;
  /** true = fataler Fehler (Job konnte nicht abgeschlossen werden). */
  fatal: boolean;
}

/** Format der failed_jobs.json. */
export interface FailedJobsFile {
  generatedAt: number;
  failed: BulkFailedJob[];
}

/**
 * Interface, das der Orchestrator zum Ausführen eines Buchs nutzt.
 * In der App: Adapter über bookwriter-Workflow + DB. In Tests: Fake.
 */
export interface BulkJobRunner {
  /** Führt einen kompletten Buch-Lauf aus. Wirft bei fatalem Fehler. */
  runJob(job: BulkJob): Promise<BulkJobResult>;
  /**
   * Leert den Context-Cache (Fakten-Base im Memory, Prompt-Caches).
   * Optional: Falls der Adapter keinen Cache hat, wird der Aufruf übersprungen.
   */
  clearContextCache?(): Promise<void>;
}

export interface BulkOrchestratorOptions {
  /** Cooldown zwischen Büchern in ms. Default: 60s (lokale Modelle). */
  cooldownMs?: number;
  /** Sleep-Implementierung (injizierbar für Tests). Default: setTimeout. */
  sleepFn?: (ms: number) => Promise<void>;
  /**
   * Schreibt failed_jobs.json. Default: Tauri-FS-Adapter (appDataDir) —
   * in Tests injiziert, um Disk-I/O zu vermeiden.
   */
  writeFileFn?: (filename: string, data: FailedJobsFile) => Promise<void>;
}

export interface BulkRunResult {
  completed: BulkJob[];
  failed: BulkFailedJob[];
  cooldownsTaken: number;
  startedAt: number;
  finishedAt: number;
}

/** Default-Sleep: Promise-basiertes setTimeout. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default-Persistenz: failed_jobs.json ins AppData-Verzeichnis (Tauri).
 * Ohne Tauri-Kontext (Browser/Unit-Test) bewusst still — Resume-on-Crash
 * darf nicht selbst crashen; Aufrufer kann via writeFileFn injizieren.
 */
async function defaultWriteFailedJobs(filename: string, data: FailedJobsFile): Promise<void> {
  try {
    const fs = await import("@tauri-apps/plugin-fs");
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const dir = await appDataDir();
    const path = await join(dir, filename);
    await fs.writeTextFile(path, JSON.stringify(data, null, 2));
  } catch {
    // Kein Tauri-Kontext: still ignorieren (siehe Docstring).
  }
}

export class BulkOrchestrator {
  private readonly runner: BulkJobRunner;
  private readonly cooldownMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly writeFile: (filename: string, data: FailedJobsFile) => Promise<void>;
  private queue: BulkJob[] = [];
  private failed: BulkFailedJob[] = [];

  constructor(runner: BulkJobRunner, options: BulkOrchestratorOptions = {}) {
    this.runner = runner;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.sleep = options.sleepFn ?? defaultSleep;
    this.writeFile = options.writeFileFn ?? defaultWriteFailedJobs;
  }

  /** Fügt Jobs ans Ende der Queue an. */
  enqueue(jobs: BulkJob[]): void {
    this.queue.push(...jobs);
  }

  /** Aktuelle Queue-Länge (restliche, noch nicht gestartete Jobs). */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Baut das persistierbare failed_jobs.json-Format. */
  buildFailedJobsFile(failed: BulkFailedJob[]): FailedJobsFile {
    return { generatedAt: Date.now(), failed };
  }

  /**
   * Arbeitet die Queue ab. Fatale Fehler eines Buchs stoppen NICHT die Queue:
   * der Job landet in failed_jobs.json, der Context-Cache wird geleert und
   * es geht mit dem nächsten Buch weiter.
   */
  async runAll(jobs?: BulkJob[]): Promise<BulkRunResult> {
    if (jobs) this.enqueue(jobs);
    const startedAt = Date.now();

    const completed: BulkJob[] = [];
    let cooldownsTaken = 0;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;

      try {
        await this.runner.runJob(job);
        completed.push(job);
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        const entry: BulkFailedJob = {
          jobId: job.id,
          jobTitle: job.title,
          error: msg,
          failedAt: Date.now(),
          sourceRow: job.sourceRow,
          fatal: true,
        };
        this.failed.push(entry);
        // failed_jobs.json SOFORT schreiben — der Lauf kann jederzeit sterben.
        await this.writeFile(
          DEFAULT_FAILED_JOBS_FILENAME,
          this.buildFailedJobsFile(this.failed),
        );
      }

      // Context-Cache nach JEDEM Buch leeren (auch nach Fehlern) — Ressourcen-
      // Schonung: kein Fakten-/Prompt-Carryover in das nächste Buch.
      if (this.runner.clearContextCache) {
        await this.runner.clearContextCache();
      }

      // Cooldown nur zwischen Büchern — nicht nach dem letzten.
      if (this.queue.length > 0 && this.cooldownMs > 0) {
        await this.sleep(this.cooldownMs);
        cooldownsTaken += 1;
      }
    }

    return {
      completed,
      failed: [...this.failed],
      cooldownsTaken,
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
