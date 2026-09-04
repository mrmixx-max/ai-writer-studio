// Migration 019 — Revisions-Loop: style_profiles + chapter_revisions.
//
// INTERFACE-CHANGE (DB-Schema):
// 1. Neue Tabelle style_profiles: Stilprofile { id, name, systemHint, rules[] }
//    pro Projekt (project_id NULL = global). 3 Presets werden beim ersten
//    Zugriff Seed-seitig in styleProfiles.ts erzeugt (nicht hier — Migration
//    bleibt rein strukturell).
// 2. Neue Tabelle chapter_revisions: Revisionshistorie pro Kapitel. Jede
//    Revision (straffen/vertiefen/stil) committet Vorher/Nachher-Metriken,
//    damit der Redaktions-Loop nachvollziehbar bleibt.

import type { Database } from "sql.js";

export const VERSION = 19;
export const NAME = "revision_loop";

export function migration019(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS style_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      system_hint TEXT NOT NULL DEFAULT '',
      rules_json TEXT NOT NULL DEFAULT '[]',
      is_preset INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS chapter_revisions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      model TEXT,
      before_words INTEGER NOT NULL DEFAULT 0,
      after_words INTEGER NOT NULL DEFAULT 0,
      before_filler REAL NOT NULL DEFAULT 0,
      after_filler REAL NOT NULL DEFAULT 0,
      note TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);

  d.run(`CREATE INDEX IF NOT EXISTS idx_style_profiles_project ON style_profiles(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_chapter_revisions_chapter ON chapter_revisions(chapter_id);`);
}