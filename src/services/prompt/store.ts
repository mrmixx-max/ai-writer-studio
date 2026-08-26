// DB-Zugriff für writing_prompts-Tabelle.
import { getDb, persist } from "@/services/db";
import type { StoredPrompt, GeneratedPrompt } from "./types";

function uid(): string {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Speichert einen generierten Prompt in der DB. */
export async function savePrompt(
  p: GeneratedPrompt,
  provider: string,
  model: string,
  projectId: string | null = null,
): Promise<StoredPrompt> {
  const db = getDb();
  const id = uid();
  const now = Date.now();
  db.run(
    `INSERT INTO writing_prompts (id, text, genre, prompt_type, tone, target_length, is_favorite, created_at, provider, model, project_id)
     VALUES (?,?,?,?,?,?,0,?,?,?,?)`,
    [
      id,
      p.text,
      p.genre,
      p.type,
      null,
      null,
      now,
      provider,
      model,
      projectId,
    ],
  );
  await persist();
  return getPrompt(id)!;
}

/** Setzt/entfernt Favoriten-Flag. */
export async function setFavorite(id: string, fav: boolean): Promise<void> {
  getDb().run("UPDATE writing_prompts SET is_favorite = ? WHERE id = ?", [fav ? 1 : 0, id]);
  await persist();
}

/** Verknüpft Prompt mit einem Projekt (wenn daraus ein Kapitel entstand). */
export async function linkToProject(id: string, projectId: string): Promise<void> {
  getDb().run("UPDATE writing_prompts SET project_id = ? WHERE id = ?", [projectId, id]);
  await persist();
}

export function getPrompt(id: string): StoredPrompt | null {
  const row = getDb().exec("SELECT * FROM writing_prompts WHERE id = ?", [id]);
  if (!row.length) return null;
  return rowToPrompt(row[0].values[0]);
}

/** Listet Prompts, optional nur Favoriten + Genre-Filter + Suche. */
export function listPrompts(opts: {
  favoritesOnly?: boolean;
  genre?: string;
  search?: string;
} = {}): StoredPrompt[] {
  const db = getDb();
  let sql = "SELECT * FROM writing_prompts WHERE 1=1";
  const params: unknown[] = [];
  if (opts.favoritesOnly) {
    sql += " AND is_favorite = 1";
  }
  if (opts.genre) {
    sql += " AND genre = ?";
    params.push(opts.genre);
  }
  if (opts.search) {
    sql += " AND text LIKE ?";
    params.push(`%${opts.search}%`);
  }
  sql += " ORDER BY created_at DESC";
  const row = db.exec(sql, params as any);
  if (!row.length) return [];
  return row[0].values.map(rowToPrompt);
}

export function deletePrompt(id: string): void {
  getDb().run("DELETE FROM writing_prompts WHERE id = ?", [id]);
}

/** Exportiert alle Favoriten als Markdown. */
export function exportFavoritesMarkdown(): string {
  const favs = listPrompts({ favoritesOnly: true });
  if (!favs.length) return "# Favoriten\n\n(keine)\n";
  const lines = favs.map(
    (p) => `## ${p.genre ?? "?"}${p.prompt_type ? " · " + p.prompt_type : ""}\n\n${p.text}\n`,
  );
  return `# Favoriten-Prompts\n\n${lines.join("\n")}`;
}

function rowToPrompt(v: unknown[]): StoredPrompt {
  const [
    id,
    text,
    genre,
    prompt_type,
    tone,
    target_length,
    is_favorite,
    created_at,
    provider,
    model,
    project_id,
  ] = v as [string, string, string | null, string | null, string | null, string | null, number, number, string | null, string | null, string | null];
  return {
    id,
    text,
    genre,
    prompt_type,
    tone,
    target_length,
    is_favorite: !!is_favorite,
    created_at,
    provider,
    model,
    project_id,
  };
}
