// Literarische Evolution: Versionen mit semantischen Markierungen.
import { getDb, persist } from "@/services/db";
import type { LiteraryVersion } from "@/types/project";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createVersion(
  chapterId: string, label: string, content: string, versionType: string, metrics?: any
): Promise<LiteraryVersion> {
  const db = getDb();
  const id = uid("ver");
  db.run(
    "INSERT INTO literary_versions (id, chapter_id, label, content, version_type, metrics, created_at) VALUES (?,?,?,?,?,?,?)",
    [id, chapterId, label, content, versionType, metrics ? JSON.stringify(metrics) : null, Date.now()],
  );
  await persist();
  return { id, chapterId, label, content, versionType, metrics: metrics ? JSON.stringify(metrics) : null, createdAt: Date.now() };
}

export function listVersions(chapterId: string): LiteraryVersion[] {
  const db = getDb();
  const row = db.exec("SELECT id, chapter_id, label, content, version_type, metrics, created_at FROM literary_versions WHERE chapter_id = ? ORDER BY created_at", [chapterId]);
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string, chapterId: v[1] as string, label: v[2] as string,
    content: v[3] as string, versionType: v[4] as string, metrics: v[5] as string | null, createdAt: v[6] as number,
  }));
}

export async function deleteVersion(id: string): Promise<void> {
  getDb().run("DELETE FROM literary_versions WHERE id = ?", [id]);
  await persist();
}
