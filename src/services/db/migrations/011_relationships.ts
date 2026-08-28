// Migration: character_relationships Tabelle für den Beziehungsgraph.
import type { Database } from "sql.js";

export const VERSION = 11;
export const NAME = "character_relationships";

export function migration011(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS character_relationships (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      from_char_id TEXT NOT NULL,
      to_char_id TEXT NOT NULL,
      rel_type TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_rel_project ON character_relationships(project_id);");
}
