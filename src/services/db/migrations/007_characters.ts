// Migration: characters Tabelle für Figuren-Datenbank.
import type { Database } from "sql.js";

export const VERSION = 7;
export const NAME = "characters";

export function migration007(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT DEFAULT '[]',
      age TEXT DEFAULT '',
      role TEXT DEFAULT '',
      traits TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
}
