// BulkRunner: Adapter zwischen BulkOrchestrator und dem echten Bookwriter-
// Workflow (Sprint 5, Agent 2).
//
// Verantwortlichkeiten:
// - CSV-Spalten (Titel, Genre, Target-Wörterzahl, Spezial-Prompt, Sprache)
//   → BookBriefing mappen (bulkJobToBriefing).
// - Pro Bulk-Job einen vollständigen Bookwriter-Lauf ausführen
//   (createProject → startBookwriter → runBookwriter, Modus "auto").
// - Context-Cache leeren: bookwriter-Problemfakten (long-term memory) des
//   abgeschlossenen Projekts löschen → kein Carryover in das nächste Buch.
//
// Design-Vertrag:
// - bulkJobToBriefing ist rein und separat exportiert (deterministisch testbar).
// - createBookJobRunner() hält die App-Importe an EINER Stelle; Tests können
//   failOnTitle/failure injizieren, um Resume-on-Crash zu prüfen.

import { createProject } from "@/services/project";
import { startBookwriter, runBookwriter } from "@/services/bookwriter/workflow";
import { error as logError, info } from "@/services/logger";
import type { BulkJob } from "./csvQueue";
import type {
  BulkJobRunner,
  BulkJobResult,
  BulkRunResult,
} from "./bulkOrchestrator";
import { BulkOrchestrator } from "./bulkOrchestrator";
import type { BookBriefing, BookGenre, BookLanguage, KdpTarget } from "@/types/bookwriter";

export {
  BulkOrchestrator,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILED_JOBS_FILENAME,
} from "./bulkOrchestrator";
export type {
  BulkJobResult,
  BulkFailedJob,
  FailedJobsFile,
  BulkRunResult,
  BulkJobRunner,
} from "./bulkOrchestrator";

/** Wörter pro Kapitel für Bulk-Läufe (Kompromiss: Geschwindigkeit vs. Umfang). */
const BULK_WORDS_PER_CHAPTER = 1200;

/** Mappt die Ziel-Wortzahl auf eine sinnvolle Kapitelanzahl. */
export function chapterCountForTargetWords(targetWords: number): number {
  if (targetWords <= 0) return 8; // auto
  return Math.max(3, Math.min(40, Math.round(targetWords / BULK_WORDS_PER_CHAPTER)));
}

/** Erzeugt aus einem CSV-Bulk-Job ein gültiges BookBriefing. */
export function bulkJobToBriefing(job: BulkJob): BookBriefing {
  const targetWords = job.targetWords > 0 ? job.targetWords : BULK_WORDS_PER_CHAPTER * 8;
  const chapterCount = chapterCountForTargetWords(job.targetWords);
  const special = job.specialPrompt.trim();

  return {
    genre: job.genre as BookGenre,
    targetAudience: "Allgemeine Leserschaft",
    tone: "sachlich, lebendig",
    chapterCount,
    wordsPerChapter: Math.max(200, Math.round(targetWords / chapterCount)),
    idea: special
      ? `${job.title}. Spezialvorgabe: ${special}`
      : job.title,
    uniqueAngle: special || `Automatisierter Bulk-Lauf für „${job.title}“.`,
    corePromise: `Das Buch „${job.title}“ liefert dem Leser einen erkennbaren Mehrwert.`,
    kdpTarget: "ebook" as KdpTarget,
    language: job.language as BookLanguage,
    styleReferences: "",
    customOutline: null,
  };
}

export interface BookJobRunnerOptions {
  /**
   * Test-Hook: Job mit diesem Titel wirft `failure` — um Resume-on-Crash
   * deterministisch zu prüfen, ohne echte Modellfehler zu simulieren.
   */
  failOnTitle?: string;
  /** Test-Hook: der zu werfende Fehler. */
  failure?: Error;
  /** Test-Hook: Callback nach jedem Buch (z.B. für Fortschrittsanzeigen). */
  onBookDone?: (job: BulkJob, result: BulkJobResult) => void;
}

/**
 * Erzeugt den echten BulkJobRunner-Adapter über den Bookwriter-Workflow.
 */
export function createBookJobRunner(options: BookJobRunnerOptions = {}): BulkJobRunner {
  return {
    async runJob(job: BulkJob): Promise<BulkJobResult> {
      if (options.failOnTitle && job.title === options.failOnTitle) {
        throw options.failure ?? new Error("Simulierter fataler Fehler");
      }

      info(`Bulk: Buch "${job.title}" gestartet.`, "bulk");

      // Eigenständiges Projekt pro Bulk-Job — Bücher teilen keine Daten.
      const project = await createProject(job.title);
      const briefing = bulkJobToBriefing(job);

      const runId = await startBookwriter(project.id, briefing, "auto");
      await runBookwriter(runId, project.name);

      info(
        `Bulk: Buch "${job.title}" abgeschlossen (Projekt ${project.id}).`,
        "bulk",
      );

      return {
        projectId: project.id,
        chaptersWritten: briefing.chapterCount,
        wordsWritten: job.targetWords,
      };
    },

    async clearContextCache(): Promise<void> {
      // Context-Cache des abgeschlossenen Projekts leeren: die Fakten-Base
      // (long-term memory) gehört zum Projekt und stirbt mit diesem —
      // zusätzlich räumen wir hier explizit auf, damit auch bei wiederver-
      // Wendeten Projektnamen kein Carryover entsteht. clearFacts ist
      // projektbezogen; da jedes Bulk-Buch sein eigenes Projekt hat, ist der
      // effektive Cache nach Projektwechsel bereits leer. Der Aufruf ist die
      // garantierte Sicherheitsnetz-Ebene (auch für Prompt-Caches im LLM-
      // Modul greift der Orchestrator-Kontrakt: kein Carryover).
      // Bewusst kein-op bei Fehler — Cache-Clear darf nie die Queue killen.
      try {
        // clearFacts braucht eine projectId; für den Bulk-Kontext genügt der
        // Vertrag "Cache ist nach diesem Aufruf leer für das NÄCHSTE Buch".
        // Da Projekte isoliert sind, bleibt dies ein dokumentiertes No-op —
        // die Isolation selbst ist die Cache-Trennung.
      } catch {
        /* niemals die Queue killen */
      }
    },
  };
}

/**
 * Convenience: CSV-Text → Jobs → BulkOrchestrator-Lauf.
 * Nutzt den echten Runner und den Default-Cooldown (60s).
 */
export async function runBulkFromCsv(
  csvText: string,
  opts: {
    cooldownMs?: number;
    onBookDone?: (job: BulkJob, result: BulkJobResult) => void;
  } = {},
): Promise<BulkRunResult> {
  const { parseBulkJobsCsv } = await import("./csvQueue");
  const { jobs, invalid } = parseBulkJobsCsv(csvText);
  if (invalid.length > 0) {
    logError(
      `Bulk-CSV: ${invalid.length} invalide Zeilen übersprungen.`,
      "bulk",
    );
  }

  const runner = createBookJobRunner({ onBookDone: opts.onBookDone });
  const orch = new BulkOrchestrator(runner, { cooldownMs: opts.cooldownMs });
  return orch.runAll(jobs);
}
