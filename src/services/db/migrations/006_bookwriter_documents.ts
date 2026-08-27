// Migration: bookwriter_documents Tabelle für RAG.
//
// Speichert hochgeladene Dokumente chunkiert, damit sie über BM25
// durchsuchbar sind und als Kontext ins Kapitel-Prompt eingespeist werden können.

import type { Database } from "sql.js";

export const VERSION = 6;
export const NAME = "bookwriter_documents";

export function migration006(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookwriter_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'txt',
      file_name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_bookwriter_docs_project
    ON bookwriter_documents (project_id)
  `);
}
