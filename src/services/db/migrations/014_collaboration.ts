// Migration 014: Collaboration — Kommentare, Track Changes, Vorschläge.
import type { Database } from "sql.js";

export const VERSION = 14;
export const NAME = "collaboration";

export function migration014(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      anchor_start INTEGER NOT NULL,
      anchor_end INTEGER NOT NULL,
      anchor_text TEXT DEFAULT '',
      author TEXT DEFAULT 'Autor',
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS track_changes (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      position INTEGER NOT NULL,
      text TEXT NOT NULL,
      replaced_text TEXT,
      author TEXT DEFAULT 'Autor',
      created_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      anchor_start INTEGER NOT NULL,
      anchor_end INTEGER NOT NULL,
      original_text TEXT DEFAULT '',
      proposed_text TEXT DEFAULT '',
      author TEXT DEFAULT 'Lektor',
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      decided_at INTEGER
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_id, status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_track_changes_chapter ON track_changes(chapter_id, created_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_chapter ON suggestions(chapter_id, status);`);
}
