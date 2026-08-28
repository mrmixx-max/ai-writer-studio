// Migration 017: KI-Langzeit-Gedächtnis — persistente Erinnerungen (Figuren, Orte, Fakten).
import type { Database } from "sql.js";

export const VERSION = 17;
export const NAME = "ki_memory";

export function migration017(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS ki_memory_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      chapter_id TEXT,
      session_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('charakter','ort','fakt','gespraech','stil')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'auto',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
  `);
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_memory_project ON ki_memory_entries(project_id, kind);");
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_memory_created ON ki_memory_entries(created_at);");
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_memory_chapter ON ki_memory_entries(chapter_id);");
}
