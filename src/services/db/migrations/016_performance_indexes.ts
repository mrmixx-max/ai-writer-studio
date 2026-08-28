// Migration 016 — Performance-Indizes für Tabellen aus 010–015.
// Behebt Full-Table-Scans: Diese Tabellen wurden in 009 noch nicht abgedeckt,
// weil die Migrationen 010–015 erst später dazukamen.

import type { Database } from "sql.js";

export function migration016(d: Database): void {
  // Migration 010 — Voice Lab
  d.run("CREATE INDEX IF NOT EXISTS idx_audio_notes_chapter ON audio_notes(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_audio_notes_created ON audio_notes(chapter_id, created_at);");

  // Migration 011 — Relationships (idx_rel_project existiert bereits in 011)
  d.run("CREATE INDEX IF NOT EXISTS idx_rel_from ON character_relationships(from_char_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_rel_to ON character_relationships(to_char_id);");

  // Migration 012 — KI-Chat: Sessions werden chronologisch gelesen.
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_chat_session ON ki_chat_messages(session_id, created_at);");
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_chat_chapter ON ki_chat_messages(chapter_id);");

  // Migration 013 — Worldbuilding
  d.run("CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_lore_project ON lore_entries(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_lore_project_category ON lore_entries(project_id, category);");
  // world_bible.project_id ist UNIQUE — braucht keinen zusätzlichen Index.

  // Migration 014 — Collaboration
  d.run("CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_comments_chapter_status ON comments(chapter_id, status);");
  d.run("CREATE INDEX IF NOT EXISTS idx_track_changes_chapter ON track_changes(chapter_id, position);");
  d.run("CREATE INDEX IF NOT EXISTS idx_suggestions_chapter ON suggestions(chapter_id);");

  // Migration 015 — Research
  d.run("CREATE INDEX IF NOT EXISTS idx_research_sources_project ON research_sources(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_research_quotes_project ON research_quotes(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_research_quotes_source ON research_quotes(source_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_research_notes_project ON research_notes(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_research_clips_project ON research_clips(project_id);");
  d.run("CREATE INDEX IF NOT EXISTS idx_research_clips_url ON research_clips(url);");
}
