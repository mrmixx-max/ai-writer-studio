// Figurenprofile, Ortsprofile und Projektnotizen.
// Diese Entitäten dienen doppelt: als Wissensquelle für RAG und als
// Referenzdaten für den Konsistenz-Checker (Feature 2).

import { getDb, persist } from "@/services/db";
import { uid } from "./util";

export interface CharacterProfile {
  id: string;
  projectId: string;
  name: string;
  /** Komma-separierte Alternativnamen. */
  aliases: string | null;
  age: string | null;
  occupation: string | null;
  appearance: string | null;
  traits: string | null;
  relationships: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LocationProfile {
  id: string;
  projectId: string;
  name: string;
  aliases: string | null;
  region: string | null;
  description: string | null;
  /** Regeln der Welt, die an diesem Ort gelten. */
  rules: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  tags: string | null;
  createdAt: number;
  updatedAt: number;
}

const CHAR_COLS =
  "id, project_id, name, aliases, age, occupation, appearance, traits, relationships, notes, created_at, updated_at";
const LOC_COLS =
  "id, project_id, name, aliases, region, description, rules, notes, created_at, updated_at";
const NOTE_COLS = "id, project_id, title, body, tags, created_at, updated_at";

// ---------- Figuren ----------

export async function createCharacter(
  projectId: string,
  name: string,
  fields: Partial<Omit<CharacterProfile, "id" | "projectId" | "name" | "createdAt" | "updatedAt">> = {},
): Promise<CharacterProfile> {
  const db = getDb();
  const id = uid("char");
  const now = Date.now();
  db.run(
    `INSERT INTO character_profiles (${CHAR_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, projectId, name, fields.aliases ?? null, fields.age ?? null,
      fields.occupation ?? null, fields.appearance ?? null, fields.traits ?? null,
      fields.relationships ?? null, fields.notes ?? null, now, now,
    ],
  );
  await persist();
  return {
    id, projectId, name,
    aliases: fields.aliases ?? null, age: fields.age ?? null,
    occupation: fields.occupation ?? null, appearance: fields.appearance ?? null,
    traits: fields.traits ?? null, relationships: fields.relationships ?? null,
    notes: fields.notes ?? null, createdAt: now, updatedAt: now,
  };
}

export function listCharacters(projectId: string): CharacterProfile[] {
  const res = getDb().exec(
    `SELECT ${CHAR_COLS} FROM character_profiles WHERE project_id = ? ORDER BY name`,
    [projectId],
  );
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, projectId: v[1] as string, name: v[2] as string,
    aliases: (v[3] ?? null) as string | null, age: (v[4] ?? null) as string | null,
    occupation: (v[5] ?? null) as string | null, appearance: (v[6] ?? null) as string | null,
    traits: (v[7] ?? null) as string | null, relationships: (v[8] ?? null) as string | null,
    notes: (v[9] ?? null) as string | null, createdAt: Number(v[10]), updatedAt: Number(v[11]),
  }));
}

export async function updateCharacter(
  id: string,
  patch: Partial<Omit<CharacterProfile, "id" | "projectId" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const map: Record<string, string> = {
    name: "name", aliases: "aliases", age: "age", occupation: "occupation",
    appearance: "appearance", traits: "traits", relationships: "relationships", notes: "notes",
  };
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    const val = (patch as any)[k];
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(val);
    }
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  vals.push(Date.now(), id);
  getDb().run(`UPDATE character_profiles SET ${fields.join(", ")} WHERE id = ?`, vals as any);
  await persist();
}

export async function deleteCharacter(id: string): Promise<void> {
  getDb().run("DELETE FROM character_profiles WHERE id = ?", [id]);
  await persist();
}

/** Rendert ein Figurenprofil als indexierbaren Text. */
export function characterToText(c: CharacterProfile): string {
  const lines = [`# Figur: ${c.name}`];
  if (c.aliases) lines.push(`Auch genannt: ${c.aliases}`);
  if (c.age) lines.push(`Alter: ${c.age}`);
  if (c.occupation) lines.push(`Beruf: ${c.occupation}`);
  if (c.appearance) lines.push(`Aussehen: ${c.appearance}`);
  if (c.traits) lines.push(`Eigenschaften: ${c.traits}`);
  if (c.relationships) lines.push(`Beziehungen: ${c.relationships}`);
  if (c.notes) lines.push(`\n${c.notes}`);
  return lines.join("\n");
}

// ---------- Orte ----------

export async function createLocation(
  projectId: string,
  name: string,
  fields: Partial<Omit<LocationProfile, "id" | "projectId" | "name" | "createdAt" | "updatedAt">> = {},
): Promise<LocationProfile> {
  const db = getDb();
  const id = uid("loc");
  const now = Date.now();
  db.run(
    `INSERT INTO location_profiles (${LOC_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id, projectId, name, fields.aliases ?? null, fields.region ?? null,
      fields.description ?? null, fields.rules ?? null, fields.notes ?? null, now, now,
    ],
  );
  await persist();
  return {
    id, projectId, name,
    aliases: fields.aliases ?? null, region: fields.region ?? null,
    description: fields.description ?? null, rules: fields.rules ?? null,
    notes: fields.notes ?? null, createdAt: now, updatedAt: now,
  };
}

export function listLocations(projectId: string): LocationProfile[] {
  const res = getDb().exec(
    `SELECT ${LOC_COLS} FROM location_profiles WHERE project_id = ? ORDER BY name`,
    [projectId],
  );
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, projectId: v[1] as string, name: v[2] as string,
    aliases: (v[3] ?? null) as string | null, region: (v[4] ?? null) as string | null,
    description: (v[5] ?? null) as string | null, rules: (v[6] ?? null) as string | null,
    notes: (v[7] ?? null) as string | null, createdAt: Number(v[8]), updatedAt: Number(v[9]),
  }));
}

export async function deleteLocation(id: string): Promise<void> {
  getDb().run("DELETE FROM location_profiles WHERE id = ?", [id]);
  await persist();
}

/** Rendert ein Ortsprofil als indexierbaren Text. */
export function locationToText(l: LocationProfile): string {
  const lines = [`# Ort: ${l.name}`];
  if (l.aliases) lines.push(`Auch genannt: ${l.aliases}`);
  if (l.region) lines.push(`Region: ${l.region}`);
  if (l.description) lines.push(`Beschreibung: ${l.description}`);
  if (l.rules) lines.push(`Regeln: ${l.rules}`);
  if (l.notes) lines.push(`\n${l.notes}`);
  return lines.join("\n");
}

// ---------- Notizen ----------

export async function createNote(
  projectId: string,
  title: string,
  body = "",
  tags?: string,
): Promise<ProjectNote> {
  const db = getDb();
  const id = uid("note");
  const now = Date.now();
  db.run(
    `INSERT INTO project_notes (${NOTE_COLS}) VALUES (?,?,?,?,?,?,?)`,
    [id, projectId, title, body, tags ?? null, now, now],
  );
  await persist();
  return { id, projectId, title, body, tags: tags ?? null, createdAt: now, updatedAt: now };
}

export function listNotes(projectId: string): ProjectNote[] {
  const res = getDb().exec(
    `SELECT ${NOTE_COLS} FROM project_notes WHERE project_id = ? ORDER BY updated_at DESC`,
    [projectId],
  );
  if (!res.length) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string, projectId: v[1] as string, title: v[2] as string,
    body: v[3] as string, tags: (v[4] ?? null) as string | null,
    createdAt: Number(v[5]), updatedAt: Number(v[6]),
  }));
}

export async function updateNote(id: string, title: string, body: string, tags?: string | null): Promise<void> {
  getDb().run(
    "UPDATE project_notes SET title = ?, body = ?, tags = ?, updated_at = ? WHERE id = ?",
    [title, body, tags ?? null, Date.now(), id],
  );
  await persist();
}

export async function deleteNote(id: string): Promise<void> {
  getDb().run("DELETE FROM project_notes WHERE id = ?", [id]);
  await persist();
}

/** Rendert eine Notiz als indexierbaren Text. */
export function noteToText(n: ProjectNote): string {
  return `# ${n.title}\n\n${n.body}`;
}
