// Migration: timeline_events Tabelle für Story-Timeline.
import type { Database } from "sql.js";

export const VERSION = 8;
export const NAME = "timeline_events";

export function migration008(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      chapter_ref TEXT DEFAULT '',
      story_date TEXT DEFAULT '',
      participants TEXT DEFAULT '',
      description TEXT DEFAULT '',
      order_num INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
}
