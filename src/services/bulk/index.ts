// Öffentliche API des Bulk-Moduls (Sprint 5, Agent 2).
//
// CSV-Job-Queue + BulkOrchestrator (Cooldown, Context-Cache-Reset,
// Resume-on-Crash via failed_jobs.json).

export {
  parseBulkJobsCsv,
  BULK_CSV_HEADERS,
} from "./csvQueue";
export type {
  BulkJob,
  BulkJobGenre,
  BulkJobLanguage,
  BulkCsvInvalidRow,
  BulkCsvParseResult,
} from "./csvQueue";

export {
  BulkOrchestrator,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILED_JOBS_FILENAME,
} from "./bulkOrchestrator";
export type {
  BulkJobResult,
  BulkFailedJob,
  FailedJobsFile,
  BulkJobRunner,
  BulkOrchestratorOptions,
  BulkRunResult,
} from "./bulkOrchestrator";

export {
  bulkJobToBriefing,
  chapterCountForTargetWords,
  createBookJobRunner,
  runBulkFromCsv,
} from "./bulkRunner";
export type { BookJobRunnerOptions } from "./bulkRunner";
