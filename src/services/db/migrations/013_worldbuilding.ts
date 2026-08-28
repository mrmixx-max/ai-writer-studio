// Migration: Worldbuilding — World-Bible, Orte (Locations), Lore/Glossenar.
import type { Database } from "sql.js";

export const VERSION = 13;
export const NAME = "worldbuilding";

export function migration013(db: Database): void {
  // Zentrale Welt-Bible: ein Eintrag pro Projekt (Abschnitte als JSON).
  db.run(`
    CREATE TABLE IF NOT EXISTS world_bible (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      premise TEXT DEFAULT '',
      rules TEXT DEFAULT '[]',
      history TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Orte mit Koordinaten (für Karten-Export).
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      type TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Lore/Glossenar: Artefakte, Begriffe, Mythen.
  db.run(`
    CREATE TABLE IF NOT EXISTS lore_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Begriff',
      description TEXT DEFAULT '',
      aliases TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lore_project ON lore_entries(project_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lore_category ON lore_entries(project_id, category);`);
}
