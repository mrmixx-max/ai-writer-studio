// Migration 001 — Basistabellen (Projekte, Kapitel, Settings, Prompts, Avantgarde-Module).
// Entspricht dem bisherigen Inline-Schema aus db/index.ts, unverändert übernommen.

import type { Database } from "sql.js";

export function migration001(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS writing_prompts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      genre TEXT,
      prompt_type TEXT,
      tone TEXT,
      target_length TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      provider TEXT,
      model TEXT,
      project_id TEXT
    );
  `);

  // --- Avantgarde-Features ---
  d.run(`
    CREATE TABLE IF NOT EXISTS fragments (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tone TEXT,
      speaker TEXT,
      time_ref TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS voices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS semantic_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      label TEXT NOT NULL,
      node_type TEXT NOT NULL,
      description TEXT,
      x REAL,
      y REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS semantic_edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS obstruction_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS chapter_dialogues (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS literary_versions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      version_type TEXT NOT NULL,
      metrics TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS whisper_transcriptions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT,
      audio_hash TEXT,
      text TEXT NOT NULL,
      language TEXT,
      model TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    );
  `);
}
