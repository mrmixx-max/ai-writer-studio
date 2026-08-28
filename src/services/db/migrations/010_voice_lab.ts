// Migration 010: VoiceLab-Features — Audio-Notizen (Sprachmemos) + Transcript-Korrekturen.
import type { Database } from "sql.js";

export function migration010(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS audio_notes (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      label TEXT NOT NULL,
      duration_ms INTEGER,
      mime_type TEXT,
      audio_data TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
  `);

  // Transcript-Editor: korrigierte Texte markieren + Änderungszeitpunkt halten.
  try {
    d.run("ALTER TABLE whisper_transcriptions ADD COLUMN is_edited INTEGER NOT NULL DEFAULT 0;");
  } catch {
    /* Spalte existiert bereits (idempotenter Re-Run). */
  }
  try {
    d.run("ALTER TABLE whisper_transcriptions ADD COLUMN updated_at INTEGER;");
  } catch {
    /* idem */
  }

  d.run("CREATE INDEX IF NOT EXISTS idx_audio_notes_chapter ON audio_notes(chapter_id);");
}
