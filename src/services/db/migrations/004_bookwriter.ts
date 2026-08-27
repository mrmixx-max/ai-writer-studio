// Migration 004 — Bookwriter.

import type { Database } from "sql.js";

export function migration004(d: Database): void {
  // -------------------------------------------------------------------------
  //  bookwriter_runs — ein Durchlauf des Workflows
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      mode TEXT NOT NULL DEFAULT 'phase',
      current_phase TEXT NOT NULL DEFAULT 'briefing',
      phase_progress REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_phases — Status je Phase
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_phases (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0,
      error TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_artifacts — was eine Phase erzeugt hat
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_approvals — Nutzerentscheidungen
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_approvals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      decision TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_quality_scores — Qualitätsampel
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_quality_scores (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      level TEXT NOT NULL,
      score REAL NOT NULL,
      details TEXT,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_research_notes — Recherchepunkte je Kapitel
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_research_notes (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      chapter_index INTEGER NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  bookwriter_metadata — KDP-Metadaten
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_metadata (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      blurb_variants TEXT NOT NULL,
      short_description TEXT,
      keywords TEXT NOT NULL,
      categories TEXT NOT NULL,
      author_bio TEXT,
      series_idea TEXT,
      marketing_notes TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES bookwriter_runs(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  Indizes
  // -------------------------------------------------------------------------
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwr_project ON bookwriter_runs(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwr_status ON bookwriter_runs(status);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwp_run ON bookwriter_phases(run_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwa_run ON bookwriter_artifacts(run_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwa_type ON bookwriter_artifacts(artifact_type);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwap_run ON bookwriter_approvals(run_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwq_run ON bookwriter_quality_scores(run_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_bwrn_run ON bookwriter_research_notes(run_id);`);
}
