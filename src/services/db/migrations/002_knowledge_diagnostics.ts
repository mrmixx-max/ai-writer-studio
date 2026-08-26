// Migration 002 — Projektwissen/RAG, Diagnostik, Preflight, Snapshots.
// Idempotent via IF NOT EXISTS. Wird von migrate() nach den Basistabellen ausgeführt.

import type { Database } from "sql.js";

export function migration002(d: Database): void {
  // ---------- Projektwissen / RAG ----------
  d.run(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      ref_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      content_hash TEXT NOT NULL DEFAULT '',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      indexed_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_ks_project ON knowledge_sources(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_ks_ref ON knowledge_sources(ref_id);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      heading_path TEXT,
      token_count INTEGER NOT NULL DEFAULT 0,
      embedding TEXT,
      embedding_model TEXT,
      term_freq TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_kc_project ON knowledge_chunks(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_kc_source ON knowledge_chunks(source_id);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS knowledge_index_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0,
      total_sources INTEGER NOT NULL DEFAULT 0,
      processed_sources INTEGER NOT NULL DEFAULT 0,
      total_chunks INTEGER NOT NULL DEFAULT 0,
      strategy TEXT NOT NULL DEFAULT 'hybrid',
      message TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // ---------- Konsistenz- und Stil-Checker ----------
  d.run(`
    CREATE TABLE IF NOT EXISTS consistency_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      chapter_id TEXT,
      categories TEXT NOT NULL DEFAULT '[]',
      used_llm INTEGER NOT NULL DEFAULT 0,
      notice TEXT,
      finding_count INTEGER NOT NULL DEFAULT 0,
      critical_count INTEGER NOT NULL DEFAULT 0,
      metrics TEXT,
      created_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Ein gemeinsames Findings-Schema für Konsistenz UND Stil; getrennt über category.
  d.run(`
    CREATE TABLE IF NOT EXISTS consistency_findings (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chapter_id TEXT,
      category TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'possible',
      severity TEXT NOT NULL DEFAULT 'warning',
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      excerpt TEXT,
      char_start INTEGER,
      char_end INTEGER,
      suggestion TEXT,
      rule_id TEXT NOT NULL DEFAULT '',
      rule_based INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (report_id) REFERENCES consistency_reports(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_cf_report ON consistency_findings(report_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_cf_project ON consistency_findings(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_cf_status ON consistency_findings(status);`);

  // Separate Tabelle für rein stilistische Kennzahlen pro Kapitel (Zeitreihe).
  d.run(`
    CREATE TABLE IF NOT EXISTS style_findings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      chapter_id TEXT,
      metrics TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // ---------- KDP-/Export-Preflight ----------
  d.run(`
    CREATE TABLE IF NOT EXISTS preflight_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      target_format TEXT,
      blocker_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0,
      hint_count INTEGER NOT NULL DEFAULT 0,
      checked_frontmatter INTEGER NOT NULL DEFAULT 0,
      checked_backmatter INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS preflight_findings (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chapter_id TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      rule_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      recommendation TEXT,
      excerpt TEXT,
      affected_formats TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (report_id) REFERENCES preflight_reports(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pf_report ON preflight_findings(report_id);`);

  // ---------- Snapshot-Versionierung ----------
  d.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      chapter_count INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      preflight_report_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_snap_project ON snapshots(project_id);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS snapshot_items (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      order_index INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_si_snapshot ON snapshot_items(snapshot_id);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS snapshot_diffs (
      id TEXT PRIMARY KEY,
      from_snapshot_id TEXT NOT NULL,
      to_snapshot_id TEXT NOT NULL,
      entries TEXT NOT NULL DEFAULT '[]',
      structure_summary TEXT NOT NULL DEFAULT '',
      tone_summary TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // ---------- Figuren- und Ortsprofile (Wissensquellen für RAG + Konsistenz) ----------
  d.run(`
    CREATE TABLE IF NOT EXISTS character_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      age TEXT,
      occupation TEXT,
      appearance TEXT,
      traits TEXT,
      relationships TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS location_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      region TEXT,
      description TEXT,
      rules TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS project_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}
