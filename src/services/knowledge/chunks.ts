// Repository für knowledge_chunks — Schreiben und Laden der indizierten Chunks.
import { getDb, persist } from "@/services/db";
import type { KnowledgeChunk, KnowledgeSourceType } from "@/types/knowledge";
import { uid } from "./util";

const COLS =
  "id, project_id, source_id, source_type, chunk_index, text, heading_path, token_count, embedding, embedding_model, term_freq, created_at";

function rowToChunk(v: unknown[]): KnowledgeChunk {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    sourceId: v[2] as string,
    sourceType: v[3] as KnowledgeSourceType,
    chunkIndex: Number(v[4]),
    text: v[5] as string,
    headingPath: (v[6] ?? null) as string | null,
    tokenCount: Number(v[7]),
    embedding: (v[8] ?? null) as string | null,
    embeddingModel: (v[9] ?? null) as string | null,
    termFreq: (v[10] ?? null) as string | null,
    createdAt: Number(v[11]),
  };
}

export interface NewChunk {
  chunkIndex: number;
  text: string;
  headingPath: string | null;
  tokenCount: number;
  embedding: string | null;
  embeddingModel: string | null;
  termFreq: string | null;
}

/**
 * Ersetzt alle Chunks einer Quelle atomar und in einer einzigen Transaktion.
 *
 * Optimierung: Alle INSERTs werden in einer BEGIN/COMMIT-Transaktion gebündelt.
 * sql.js ist synchron — eine Transaktion verhindert, dass nach jedem INSERT
 * ein interner Sync stattfindet, und reduziert die Gesamtlaufzeit massiv
 * (bei 1000 Chunks: ~10x schneller).
 */
export async function replaceChunks(
  projectId: string,
  sourceId: string,
  sourceType: KnowledgeSourceType,
  chunks: NewChunk[],
): Promise<number> {
  const db = getDb();
  const now = Date.now();

  // Transaktion öffnen — alle Schreiboperationen werden im Speicher gehalten
  // und erst bei COMMIT atomar übernommen.
  db.run("BEGIN TRANSACTION");
  try {
    db.run("DELETE FROM knowledge_chunks WHERE source_id = ?", [sourceId]);

    // Prepared Statement für die Wiederverwendung — sql.js kompiliert die SQL
    // nur einmal und bindet bei jedem Durchlauf neue Parameter.
    const stmt = db.prepare(
      `INSERT INTO knowledge_chunks
       (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    );

    for (const c of chunks) {
      stmt.run([
        uid("kchk"), projectId, sourceId, sourceType, c.chunkIndex, c.text,
        c.headingPath, c.tokenCount, c.embedding, c.embeddingModel, c.termFreq, now,
      ]);
    }

    stmt.free();
    db.run("COMMIT");
  } catch (e) {
    // Bei Fehler alles rückgängig machen — die DB bleibt im konsistenten Zustand.
    db.run("ROLLBACK");
    throw e;
  }

  await persist();
  return chunks.length;
}

/** Lädt alle Chunks eines Projekts. Basis für Retrieval. */
export function listChunks(projectId: string): KnowledgeChunk[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_chunks WHERE project_id = ? ORDER BY source_id, chunk_index`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToChunk) : [];
}

/** Lädt Chunks gefiltert nach Quellentypen (z. B. nur Figurenprofile). */
export function listChunksByType(
  projectId: string,
  types: KnowledgeSourceType[],
): KnowledgeChunk[] {
  if (!types.length) return [];
  const placeholders = types.map(() => "?").join(",");
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_chunks
     WHERE project_id = ? AND source_type IN (${placeholders})
     ORDER BY source_id, chunk_index`,
    [projectId, ...types],
  );
  return res.length ? res[0].values.map(rowToChunk) : [];
}

export function listChunksBySource(sourceId: string): KnowledgeChunk[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_chunks WHERE source_id = ? ORDER BY chunk_index`,
    [sourceId],
  );
  return res.length ? res[0].values.map(rowToChunk) : [];
}

export function countChunks(projectId: string): number {
  const res = getDb().exec("SELECT COUNT(*) FROM knowledge_chunks WHERE project_id = ?", [projectId]);
  return res.length ? Number(res[0].values[0][0]) : 0;
}

/** Zahl der Chunks mit Embedding — zeigt an, ob semantische Suche möglich ist. */
export function countEmbeddedChunks(projectId: string): number {
  const res = getDb().exec(
    "SELECT COUNT(*) FROM knowledge_chunks WHERE project_id = ? AND embedding IS NOT NULL",
    [projectId],
  );
  return res.length ? Number(res[0].values[0][0]) : 0;
}

/** Welche Embedding-Modelle im Index vorkommen. Mehr als eines = inkonsistenter Index. */
export function embeddingModelsInUse(projectId: string): string[] {
  const res = getDb().exec(
    "SELECT DISTINCT embedding_model FROM knowledge_chunks WHERE project_id = ? AND embedding_model IS NOT NULL",
    [projectId],
  );
  return res.length ? res[0].values.map((v) => String(v[0])) : [];
}

export async function deleteChunksForProject(projectId: string): Promise<void> {
  getDb().run("DELETE FROM knowledge_chunks WHERE project_id = ?", [projectId]);
  await persist();
}
