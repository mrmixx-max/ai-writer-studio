// Migration 021 — Sprint 3: Long-Term Memory & Konsistenz.
//
// INTERFACE-CHANGE (DB-Schema):
// 1. Neue Tabelle bookwriter_facts: projektbezogene Fakten-Base (Long-Term
//    Memory). Der ContextManager speichert hier Fakten, Charakter-Eigenschaften,
//    Entitäten, Fachbuch-Strukturen und Zeitlinien über alle Kapitel hinweg
//    und injiziert sie als Kontext in Prompts.
//    Upsert-Schlüssel: UNIQUE(project_id, kind, key).
// 2. Neue Tabelle bookwriter_consistency_findings: Befunde des
//    Konsistenz-Prüfers (Namensdrift, Zeitlinien-Brüche, Alterskonflikte)
//    je Kapitel, mit Übergabe-Status an den Revisions-Loop (Migration 019).

import type { Database } from "sql.js";

export const VERSION = 21;
export const NAME = "bookwriter_memory";

export function migration021(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_facts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source_chapter INTEGER,
      confidence REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, kind, key),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_consistency_findings (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      chapter_title TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      fact_key TEXT,
      expected TEXT,
      found TEXT,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL
    );
  `);

  d.run(`CREATE INDEX IF NOT EXISTS idx_bw_facts_project ON bookwriter_facts(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bw_facts_kind ON bookwriter_facts(project_id, kind);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bw_consistency_run ON bookwriter_consistency_findings(run_id);`);
}
