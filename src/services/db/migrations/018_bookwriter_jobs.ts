// Migration 018 — bookwriter_jobs + Kapitel-Planungsspalten.
//
// INTERFACE-CHANGE (DB-Schema):
// 1. Neue Tabelle bookwriter_jobs: Job-Status der vollautomatischen
//    Buchgenerierung überlebt App-Neustart (Resume nach Crash/Abort).
// 2. Neue Spalten auf chapters: status, target_word_count, minimum_word_count,
//    maximum_word_count, current_word_count, purpose, synopsis, last_error.
//    Kapitel werden jetzt inkrementell (Status draft) in die DB geschrieben —
//    ohne diese Spalten wären Planungs-/Statusfelder nach einem Neustart weg.

import type { Database } from "sql.js";

export const VERSION = 18;
export const NAME = "bookwriter_jobs";

/** Fügt eine Spalte hinzu, falls sie noch nicht existiert (idempotent). */
function addColumnIfMissing(d: Database, table: string, ddl: string, column: string): void {
  const res = d.exec(`PRAGMA table_info(${table})`);
  if (!res.length) return;
  const names = res[0].values.map((v) => String(v[1]));
  if (!names.includes(column)) d.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

export function migration018(d: Database): void {
  // -------------------------------------------------------------------------
  //  bookwriter_jobs —Status eines Generierungslaufs (crash-sicher)
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      outline_json TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      current_chapter INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  chapters — Planungs-/Statusfelder für inkrementelles Speichern
  // -------------------------------------------------------------------------
  addColumnIfMissing(d, "chapters", "status TEXT NOT NULL DEFAULT 'planned'", "status");
  addColumnIfMissing(d, "chapters", "target_word_count INTEGER NOT NULL DEFAULT 2000", "target_word_count");
  addColumnIfMissing(d, "chapters", "minimum_word_count INTEGER NOT NULL DEFAULT 1600", "minimum_word_count");
  addColumnIfMissing(d, "chapters", "maximum_word_count INTEGER NOT NULL DEFAULT 2400", "maximum_word_count");
  addColumnIfMissing(d, "chapters", "current_word_count INTEGER NOT NULL DEFAULT 0", "current_word_count");
  addColumnIfMissing(d, "chapters", "purpose TEXT", "purpose");
  addColumnIfMissing(d, "chapters", "synopsis TEXT", "synopsis");
  addColumnIfMissing(d, "chapters", "last_error TEXT", "last_error");

  // -------------------------------------------------------------------------
  //  Indizes
  // -------------------------------------------------------------------------
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwj_project ON bookwriter_jobs(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwj_status ON bookwriter_jobs(status);`);
}
