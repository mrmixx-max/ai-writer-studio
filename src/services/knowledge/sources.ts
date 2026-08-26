// Repository für knowledge_sources — reines CRUD, keine Indexierungslogik.
import { getDb, persist } from "@/services/db";
import type { KnowledgeSource, KnowledgeSourceType, KnowledgeIndexStatus } from "@/types/knowledge";
import { uid, contentHash } from "./util";

const COLS =
  "id, project_id, source_type, ref_id, title, content, tags, status, content_hash, last_error, created_at, updated_at, indexed_at";

function rowToSource(v: unknown[]): KnowledgeSource {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    sourceType: v[2] as KnowledgeSourceType,
    refId: (v[3] ?? null) as string | null,
    title: v[4] as string,
    content: v[5] as string,
    tags: (v[6] ?? null) as string | null,
    status: v[7] as KnowledgeIndexStatus,
    contentHash: v[8] as string,
    lastError: (v[9] ?? null) as string | null,
    createdAt: Number(v[10]),
    updatedAt: Number(v[11]),
    indexedAt: v[12] == null ? null : Number(v[12]),
  };
}

export function listSources(projectId: string): KnowledgeSource[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_sources WHERE project_id = ? ORDER BY source_type, title`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToSource) : [];
}

export function getSource(id: string): KnowledgeSource | null {
  const res = getDb().exec(`SELECT ${COLS} FROM knowledge_sources WHERE id = ?`, [id]);
  return res.length ? rowToSource(res[0].values[0]) : null;
}

/** Findet eine Quelle über ihre Ursprungsentität (z. B. chapter.id). */
export function findSourceByRef(
  projectId: string,
  sourceType: KnowledgeSourceType,
  refId: string,
): KnowledgeSource | null {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_sources WHERE project_id = ? AND source_type = ? AND ref_id = ?`,
    [projectId, sourceType, refId],
  );
  return res.length ? rowToSource(res[0].values[0]) : null;
}

export interface UpsertSourceInput {
  projectId: string;
  sourceType: KnowledgeSourceType;
  refId: string | null;
  title: string;
  content: string;
  tags?: string | null;
}

/**
 * Legt eine Quelle an oder aktualisiert sie.
 * Setzt den Status automatisch auf "stale", wenn sich der Inhalt geändert hat —
 * damit die UI zuverlässig anzeigt, was neu indexiert werden muss.
 */
export async function upsertSource(input: UpsertSourceInput): Promise<KnowledgeSource> {
  const db = getDb();
  const now = Date.now();
  const hash = contentHash(input.content);

  const existing = input.refId
    ? findSourceByRef(input.projectId, input.sourceType, input.refId)
    : null;

  if (existing) {
    const changed = existing.contentHash !== hash;
    const status: KnowledgeIndexStatus = changed ? "stale" : existing.status;
    db.run(
      `UPDATE knowledge_sources
       SET title = ?, content = ?, tags = ?, content_hash = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [input.title, input.content, input.tags ?? null, hash, status, now, existing.id],
    );
    await persist();
    return { ...existing, title: input.title, content: input.content, tags: input.tags ?? null, contentHash: hash, status, updatedAt: now };
  }

  const id = uid("ksrc");
  db.run(
    `INSERT INTO knowledge_sources
     (id, project_id, source_type, ref_id, title, content, tags, status, content_hash, last_error, created_at, updated_at, indexed_at)
     VALUES (?,?,?,?,?,?,?,'pending',?,NULL,?,?,NULL)`,
    [id, input.projectId, input.sourceType, input.refId, input.title, input.content, input.tags ?? null, hash, now, now],
  );
  await persist();
  return {
    id, projectId: input.projectId, sourceType: input.sourceType, refId: input.refId,
    title: input.title, content: input.content, tags: input.tags ?? null,
    status: "pending", contentHash: hash, lastError: null,
    createdAt: now, updatedAt: now, indexedAt: null,
  };
}

/** Manuell hinzugefügter Referenztext (kein refId). */
export async function addReferenceText(
  projectId: string,
  title: string,
  content: string,
  tags?: string,
): Promise<KnowledgeSource> {
  return upsertSource({ projectId, sourceType: "reference", refId: null, title, content, tags: tags ?? null });
}

export async function deleteSource(id: string): Promise<void> {
  const db = getDb();
  db.run("DELETE FROM knowledge_chunks WHERE source_id = ?", [id]);
  db.run("DELETE FROM knowledge_sources WHERE id = ?", [id]);
  await persist();
}

export async function setSourceStatus(
  id: string,
  status: KnowledgeIndexStatus,
  lastError?: string | null,
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  if (status === "indexed") {
    db.run(
      "UPDATE knowledge_sources SET status = ?, last_error = NULL, indexed_at = ?, updated_at = ? WHERE id = ?",
      [status, now, now, id],
    );
  } else {
    db.run(
      "UPDATE knowledge_sources SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
      [status, lastError ?? null, now, id],
    );
  }
  await persist();
}

/** Markiert alle Quellen eines Projekts als veraltet (z. B. nach Modellwechsel). */
export async function markAllStale(projectId: string): Promise<void> {
  getDb().run(
    "UPDATE knowledge_sources SET status = 'stale', updated_at = ? WHERE project_id = ?",
    [Date.now(), projectId],
  );
  await persist();
}

export interface SourceStats {
  total: number;
  indexed: number;
  stale: number;
  failed: number;
  pending: number;
  chunkCount: number;
}

/** Aggregierte Kennzahlen für die Statusanzeige im Tab „Projektwissen". */
export function sourceStats(projectId: string): SourceStats {
  const db = getDb();
  const res = db.exec(
    `SELECT status, COUNT(*) FROM knowledge_sources WHERE project_id = ? GROUP BY status`,
    [projectId],
  );
  const stats: SourceStats = { total: 0, indexed: 0, stale: 0, failed: 0, pending: 0, chunkCount: 0 };
  if (res.length) {
    for (const row of res[0].values) {
      const status = String(row[0]) as KnowledgeIndexStatus;
      const n = Number(row[1]);
      stats.total += n;
      if (status === "indexed") stats.indexed = n;
      else if (status === "stale") stats.stale = n;
      else if (status === "failed") stats.failed = n;
      else if (status === "pending") stats.pending = n;
    }
  }
  const c = db.exec("SELECT COUNT(*) FROM knowledge_chunks WHERE project_id = ?", [projectId]);
  stats.chunkCount = c.length ? Number(c[0].values[0][0]) : 0;
  return stats;
}
