// Fragment-Service: CRUD für Fragmente (Karten/Textbausteine).
import { getDb, persist } from "@/services/db";
import type { Fragment } from "@/types/project";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createFragment(
  chapterId: string,
  title: string,
  content: string,
  tone?: string,
  speaker?: string,
  timeRef?: string,
): Promise<Fragment> {
  const db = getDb();
  const id = uid("frag");
  const now = Date.now();
  const idxRow = db.exec("SELECT COALESCE(MAX(order_index),-1)+1 AS n FROM fragments WHERE chapter_id = ?", [chapterId]);
  const idx = idxRow.length ? (idxRow[0].values[0][0] as number) : 0;
  db.run(
    "INSERT INTO fragments (id, chapter_id, title, content, tone, speaker, time_ref, order_index, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, chapterId, title, content, tone ?? null, speaker ?? null, timeRef ?? null, idx, now, now],
  );
  await persist();
  return { id, chapterId, title, content, tone: tone ?? null, speaker: speaker ?? null, timeRef: timeRef ?? null, orderIndex: idx, createdAt: now, updatedAt: now };
}

export function listFragments(chapterId: string): Fragment[] {
  const db = getDb();
  const row = db.exec("SELECT id, chapter_id, title, content, tone, speaker, time_ref, order_index, created_at, updated_at FROM fragments WHERE chapter_id = ? ORDER BY order_index", [chapterId]);
  if (!row.length) return [];
  return row[0].values.map(rowToFragment);
}

export function getFragment(id: string): Fragment | null {
  const db = getDb();
  const row = db.exec("SELECT id, chapter_id, title, content, tone, speaker, time_ref, order_index, created_at, updated_at FROM fragments WHERE id = ?", [id]);
  if (!row.length) return null;
  return rowToFragment(row[0].values[0]);
}

export async function updateFragment(id: string, patch: Partial<Pick<Fragment, "title" | "content" | "tone" | "speaker" | "timeRef">>): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { fields.push("title = ?"); vals.push(patch.title); }
  if (patch.content !== undefined) { fields.push("content = ?"); vals.push(patch.content); }
  if (patch.tone !== undefined) { fields.push("tone = ?"); vals.push(patch.tone); }
  if (patch.speaker !== undefined) { fields.push("speaker = ?"); vals.push(patch.speaker); }
  if (patch.timeRef !== undefined) { fields.push("time_ref = ?"); vals.push(patch.timeRef); }
  if (!fields.length) return;
  vals.push(id);
  db.run(`UPDATE fragments SET ${fields.join(", ")} WHERE id = ?`, vals as any);
  await persist();
}

export async function deleteFragment(id: string): Promise<void> {
  getDb().run("DELETE FROM fragments WHERE id = ?", [id]);
  await persist();
}

export async function reorderFragment(id: string, orderIndex: number): Promise<void> {
  getDb().run("UPDATE fragments SET order_index = ? WHERE id = ?", [orderIndex, id]);
  await persist();
}

/** Setzt alle Fragmente eines Kapitels neu (für Drag & Drop). */
export async function reorderFragments(orderedIds: string[]): Promise<void> {
  const db = getDb();
  orderedIds.forEach((id, i) => db.run("UPDATE fragments SET order_index = ? WHERE id = ?", [i, id]));
  await persist();
}

function rowToFragment(v: unknown[]): Fragment {
  return {
    id: v[0] as string,
    chapterId: v[1] as string,
    title: v[2] as string,
    content: v[3] as string,
    tone: v[4] as string | null,
    speaker: v[5] as string | null,
    timeRef: v[6] as string | null,
    orderIndex: v[7] as number,
    createdAt: v[8] as number,
    updatedAt: v[9] as number,
  };
}
