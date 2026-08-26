// Repository für knowledge_index_jobs — sichtbarer Status für Hintergrundläufe.
import { getDb, persist } from "@/services/db";
import type { KnowledgeIndexJob, IndexJobStatus, RetrievalStrategy } from "@/types/knowledge";
import { uid } from "./util";

const COLS =
  "id, project_id, source_id, status, progress, total_sources, processed_sources, total_chunks, strategy, message, started_at, finished_at";

function rowToJob(v: unknown[]): KnowledgeIndexJob {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    sourceId: (v[2] ?? null) as string | null,
    status: v[3] as IndexJobStatus,
    progress: Number(v[4]),
    totalSources: Number(v[5]),
    processedSources: Number(v[6]),
    totalChunks: Number(v[7]),
    strategy: v[8] as RetrievalStrategy,
    message: (v[9] ?? null) as string | null,
    startedAt: Number(v[10]),
    finishedAt: v[11] == null ? null : Number(v[11]),
  };
}

export async function createJob(
  projectId: string,
  sourceId: string | null,
  totalSources: number,
  strategy: RetrievalStrategy,
): Promise<KnowledgeIndexJob> {
  const db = getDb();
  const id = uid("kjob");
  const now = Date.now();
  db.run(
    `INSERT INTO knowledge_index_jobs
     (${COLS}) VALUES (?,?,?,'running',0,?,0,0,?,NULL,?,NULL)`,
    [id, projectId, sourceId, totalSources, strategy, now],
  );
  await persist();
  return {
    id, projectId, sourceId, status: "running", progress: 0,
    totalSources, processedSources: 0, totalChunks: 0,
    strategy, message: null, startedAt: now, finishedAt: null,
  };
}

export async function updateJobProgress(
  id: string,
  processedSources: number,
  totalChunks: number,
  message?: string | null,
): Promise<void> {
  const db = getDb();
  const res = db.exec("SELECT total_sources FROM knowledge_index_jobs WHERE id = ?", [id]);
  const total = res.length ? Number(res[0].values[0][0]) : 0;
  const progress = total > 0 ? Math.round((processedSources / total) * 100) : 0;
  db.run(
    "UPDATE knowledge_index_jobs SET processed_sources = ?, total_chunks = ?, progress = ?, message = ? WHERE id = ?",
    [processedSources, totalChunks, progress, message ?? null, id],
  );
  await persist();
}

export async function finishJob(
  id: string,
  status: Extract<IndexJobStatus, "done" | "failed" | "cancelled">,
  message?: string | null,
): Promise<void> {
  getDb().run(
    "UPDATE knowledge_index_jobs SET status = ?, progress = ?, message = ?, finished_at = ? WHERE id = ?",
    [status, status === "done" ? 100 : null, message ?? null, Date.now(), id],
  );
  await persist();
}

/** Der aktuell laufende Job eines Projekts, falls vorhanden. */
export function runningJob(projectId: string): KnowledgeIndexJob | null {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_index_jobs
     WHERE project_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1`,
    [projectId],
  );
  return res.length ? rowToJob(res[0].values[0]) : null;
}

export function getJob(id: string): KnowledgeIndexJob | null {
  const res = getDb().exec(`SELECT ${COLS} FROM knowledge_index_jobs WHERE id = ?`, [id]);
  return res.length ? rowToJob(res[0].values[0]) : null;
}

export function recentJobs(projectId: string, limit = 10): KnowledgeIndexJob[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM knowledge_index_jobs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?`,
    [projectId, limit],
  );
  return res.length ? res[0].values.map(rowToJob) : [];
}

/**
 * Setzt hängengebliebene Jobs zurück.
 * Wird beim App-Start aufgerufen: ein Absturz während der Indexierung
 * darf nicht dazu führen, dass die UI dauerhaft „läuft" anzeigt.
 */
export async function resetStaleJobs(projectId: string): Promise<number> {
  const db = getDb();
  const res = db.exec(
    "SELECT COUNT(*) FROM knowledge_index_jobs WHERE project_id = ? AND status = 'running'",
    [projectId],
  );
  const n = res.length ? Number(res[0].values[0][0]) : 0;
  if (n > 0) {
    db.run(
      "UPDATE knowledge_index_jobs SET status = 'cancelled', message = ?, finished_at = ? WHERE project_id = ? AND status = 'running'",
      ["Abgebrochen, weil die App beendet wurde.", Date.now(), projectId],
    );
    await persist();
  }
  return n;
}
