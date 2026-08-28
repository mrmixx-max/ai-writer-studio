// Migration 015: Research — Quellenverwaltung, Zitate, Forschungsnotizen, Web-Clips.
import type { Database } from "sql.js";

export const VERSION = 15;
export const NAME = "research";

export function migration015(db: Database): void {
  // Bibliografische Quellen: Bücher, Artikel, Websites.
  db.run(`
    CREATE TABLE IF NOT EXISTS research_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'book',
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      year TEXT DEFAULT '',
      publisher TEXT DEFAULT '',
      url TEXT DEFAULT '',
      isbn TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Zitate mit Quellenangabe (und optionaler Seitenzahl).
  db.run(`
    CREATE TABLE IF NOT EXISTS research_quotes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT,
      text TEXT NOT NULL,
      page TEXT DEFAULT '',
      comment TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Freie Forschungsnotizen.
  db.run(`
    CREATE TABLE IF NOT EXISTS research_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Web-Clips: gespeicherte URLs mit extrahiertem Inhalt.
  db.run(`
    CREATE TABLE IF NOT EXISTS research_clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      selected_text TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      clipped_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_research_sources_project ON research_sources(project_id, kind);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_research_quotes_project ON research_quotes(project_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_research_quotes_source ON research_quotes(source_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_research_notes_project ON research_notes(project_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_research_clips_project ON research_clips(project_id);`);
}
