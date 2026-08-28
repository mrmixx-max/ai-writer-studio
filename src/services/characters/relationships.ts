// Charakter-Beziehungen: gerichtete Kanten zwischen Figuren (für Beziehungsgraph).
import { getDb, persist } from "@/services/db";

export interface CharacterRelationship {
  id: string;
  projectId: string;
  fromCharId: string;
  toCharId: string;
  relType: string;
  description: string;
  createdAt: number;
}

const REL_COLS =
  "id, project_id, from_char_id, to_char_id, rel_type, description, created_at";

function rowToRel(v: unknown[]): CharacterRelationship {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    fromCharId: v[2] as string,
    toCharId: v[3] as string,
    relType: (v[4] as string) || "",
    description: (v[5] as string) || "",
    createdAt: Number(v[6]),
  };
}

function uid(): string {
  return "rel_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Alle Beziehungen eines Projekts. */
export function listRelationships(projectId: string): CharacterRelationship[] {
  const res = getDb().exec(
    `SELECT ${REL_COLS} FROM character_relationships WHERE project_id = ? ORDER BY created_at`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToRel) : [];
}

/** Beziehung speichern (neu oder Update). */
export async function saveRelationship(
  rel: Omit<CharacterRelationship, "createdAt">,
): Promise<CharacterRelationship> {
  const record: CharacterRelationship = { ...rel, createdAt: Date.now() };
  getDb().exec(
    `INSERT OR REPLACE INTO character_relationships (${REL_COLS}) VALUES (?,?,?,?,?,?,?)`,
    [
      record.id || uid(), record.projectId, record.fromCharId,
      record.toCharId, record.relType, record.description, record.createdAt,
    ],
  );
  await persist();
  return record;
}

/** Beziehung löschen. */
export async function deleteRelationship(id: string): Promise<void> {
  getDb().run("DELETE FROM character_relationships WHERE id = ?", [id]);
  await persist();
}

/** Alle Beziehungen, die eine Figur betreffen (für Graph-Isolation). */
export function relationshipsFor(projectId: string, charId: string): CharacterRelationship[] {
  const res = getDb().exec(
    `SELECT ${REL_COLS} FROM character_relationships
     WHERE project_id = ? AND (from_char_id = ? OR to_char_id = ?)`,
    [projectId, charId, charId],
  );
  return res.length ? res[0].values.map(rowToRel) : [];
}
