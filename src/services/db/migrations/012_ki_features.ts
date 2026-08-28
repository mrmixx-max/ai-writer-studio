// Migration 012: KI-Features — Chatverlauf (Session-Persistenz) + Modell-Slots.
import type { Database } from "sql.js";

export function migration012(d: Database): void {
  // Persistenter KI-Chatverlauf (pro Kapitel bzw. global mit chapter_id = "global")
  d.run(`
    CREATE TABLE IF NOT EXISTS ki_chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      chapter_id TEXT,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_chat_session ON ki_chat_messages(session_id, created_at);");
  d.run("CREATE INDEX IF NOT EXISTS idx_ki_chat_chapter ON ki_chat_messages(chapter_id);");
}
