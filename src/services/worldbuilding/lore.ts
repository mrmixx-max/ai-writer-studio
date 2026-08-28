// Lore/Glossenar-Service: Artefakte, Begriffe, Mythen.
import { getDb, persist } from "@/services/db";

export const LORE_CATEGORIES = ["Begriff", "Artefakt", "Mythos", "Organisation", "Ritual"] as const;
export type LoreCategory = (typeof LORE_CATEGORIES)[number];

export interface LoreEntry {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description: string;
  aliases: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const COLS = "id, project_id, name, category, description, aliases, notes, created_at, updated_at";

function rowToLore(v: unknown[]): LoreEntry {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    name: (v[2] as string) || "",
    category: (v[3] as string) || "Begriff",
    description: (v[4] as string) || "",
    aliases: JSON.parse((v[5] as string) || "[]"),
    notes: (v[6] as string) || "",
    createdAt: Number(v[7]),
    updatedAt: Number(v[8]),
  };
}

function uid(): string {
  return "lore_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Alle Lore-Einträge, optional nach Kategorie gefiltert. */
export function listLore(projectId: string, category?: string): LoreEntry[] {
  const res = getDb().exec(
    `SELECT ${COLS} FROM lore_entries WHERE project_id = ? ORDER BY name COLLATE NOCASE`,
    [projectId],
  );
  const all = res.length ? res[0].values.map(rowToLore) : [];
  return category ? all.filter((e) => e.category === category) : all;
}

/** Einen Eintrag laden. */
export function getLoreEntry(id: string): LoreEntry | null {
  const res = getDb().exec(`SELECT ${COLS} FROM lore_entries WHERE id = ?`, [id]);
  return res.length ? rowToLore(res[0].values[0]) : null;
}

/** Eintrag speichern (Create oder Update). */
export async function saveLoreEntry(
  entry: Omit<LoreEntry, "createdAt" | "updatedAt">,
): Promise<LoreEntry> {
  const now = Date.now();
  const existing = getLoreEntry(entry.id);
  const record: LoreEntry = {
    ...entry, category: entry.category || "Begriff",
    createdAt: existing?.createdAt ?? now, updatedAt: now,
  };
  getDb().exec(
    `INSERT OR REPLACE INTO lore_entries (${COLS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [record.id, record.projectId, record.name, record.category,
      record.description, JSON.stringify(record.aliases), record.notes,
      record.createdAt, record.updatedAt],
  );
  await persist();
  return record;
}

/** Neuen Eintrag anlegen. */
export async function createLoreEntry(
  projectId: string,
  data: Pick<LoreEntry, "name"> & Partial<Omit<LoreEntry, "name" | "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<LoreEntry> {
  return saveLoreEntry({
    id: uid(), projectId,
    name: data.name.trim(),
    category: data.category ?? "Begriff",
    description: data.description ?? "",
    aliases: data.aliases ?? [],
    notes: data.notes ?? "",
  });
}

/** Eintrag löschen. */
export async function deleteLoreEntry(id: string): Promise<void> {
  getDb().run("DELETE FROM lore_entries WHERE id = ?", [id]);
  await persist();
}

/** Zählt Fundstellen eines Lore-Begriffs (+ Aliase) in einem Text. */
export function countLoreMentions(entry: LoreEntry, text: string): number {
  const names = [entry.name, ...entry.aliases].filter((n) => n.trim());
  let total = 0;
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    total += (text.match(re) || []).length;
  }
  return total;
}
