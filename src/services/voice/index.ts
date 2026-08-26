// Stimmen-Labor-Service: Stilprofile für Übersetzungen.
import { getDb, persist } from "@/services/db";
import type { Voice } from "@/types/project";

function uid(p: string): string {
  return p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createVoice(name: string, description: string, promptTemplate: string): Promise<Voice> {
  const db = getDb();
  const id = uid("voice");
  db.run(
    "INSERT INTO voices (id, name, description, prompt_template, is_favorite, created_at) VALUES (?,?,?,?,0,?)",
    [id, name, description, promptTemplate, Date.now()],
  );
  await persist();
  return { id, name, description, promptTemplate, isFavorite: false, createdAt: Date.now() };
}

export function listVoices(): Voice[] {
  const db = getDb();
  const row = db.exec("SELECT id, name, description, prompt_template, is_favorite, created_at FROM voices ORDER BY created_at DESC");
  if (!row.length) return [];
  return row[0].values.map((v) => ({
    id: v[0] as string, name: v[1] as string, description: v[2] as string | null,
    promptTemplate: v[3] as string, isFavorite: !!(v[4] as number), createdAt: v[5] as number,
  }));
}

export async function deleteVoice(id: string): Promise<void> {
  getDb().run("DELETE FROM voices WHERE id = ?", [id]);
  await persist();
}

export async function toggleFavoriteVoice(id: string, fav: boolean): Promise<void> {
  getDb().run("UPDATE voices SET is_favorite = ? WHERE id = ?", [fav ? 1 : 0, id]);
  await persist();
}
