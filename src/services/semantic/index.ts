// Semantische Kartografie: Knoten (Figuren, Motive, Orte, Konflikte) + Verbindungen.
import { getDb, persist } from "@/services/db";
import type { SemanticNode, SemanticEdge } from "@/types/project";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createNode(
  projectId: string, label: string, nodeType: string, description?: string, x?: number, y?: number
): Promise<SemanticNode> {
  const db = getDb();
  const id = uid("node");
  db.run(
    "INSERT INTO semantic_nodes (id, project_id, label, node_type, description, x, y, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, projectId, label, nodeType, description ?? null, x ?? null, y ?? null, Date.now()],
  );
  await persist();
  return { id, projectId, label, nodeType, description: description ?? null, x: x ?? null, y: y ?? null, createdAt: Date.now() };
}

export function listNodes(projectId: string): SemanticNode[] {
  const db = getDb();
  const row = db.exec("SELECT id, project_id, label, node_type, description, x, y, created_at FROM semantic_nodes WHERE project_id = ?", [projectId]);
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string, projectId: v[1] as string, label: v[2] as string, nodeType: v[3] as string,
    description: v[4] as string | null, x: v[5] as number | null, y: v[6] as number | null, createdAt: v[7] as number,
  }));
}

export async function deleteNode(id: string): Promise<void> {
  getDb().run("DELETE FROM semantic_nodes WHERE id = ?", [id]);
  await persist();
}

export async function createEdge(projectId: string, sourceId: string, targetId: string, label?: string): Promise<SemanticEdge> {
  const db = getDb();
  const id = uid("edge");
  db.run(
    "INSERT INTO semantic_edges (id, project_id, source_id, target_id, label, created_at) VALUES (?,?,?,?,?,?)",
    [id, projectId, sourceId, targetId, label ?? null, Date.now()],
  );
  await persist();
  return { id, projectId, sourceId, targetId, label: label ?? null, createdAt: Date.now() };
}

export function listEdges(projectId: string): SemanticEdge[] {
  const db = getDb();
  const row = db.exec("SELECT id, project_id, source_id, target_id, label, created_at FROM semantic_edges WHERE project_id = ?", [projectId]);
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string, projectId: v[1] as string, sourceId: v[2] as string, targetId: v[3] as string,
    label: v[4] as string | null, createdAt: v[5] as number,
  }));
}

export async function deleteEdge(id: string): Promise<void> {
  getDb().run("DELETE FROM semantic_edges WHERE id = ?", [id]);
  await persist();
}
