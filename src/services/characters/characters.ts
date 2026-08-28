// Figuren-Datenbank: CRUD + Auto-Detection + Konsistenz-Warnungen.
//
// Speichert Figuren in der projects-Tabelle als JSON, um keine
// zusätzliche Migration zu benötigen.

import { getDb, persist } from "@/services/db";

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  age: string;
  role: string;
  traits: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const CHAR_COLS =
  "id, project_id, name, aliases, age, role, traits, notes, created_at, updated_at";

function rowToChar(v: unknown[]): Character {
  return {
    id: v[0] as string,
    projectId: v[1] as string,
    name: v[2] as string,
    aliases: JSON.parse((v[3] as string) || "[]"),
    age: (v[4] as string) || "",
    role: (v[5] as string) || "",
    traits: (v[6] as string) || "",
    notes: (v[7] as string) || "",
    createdAt: Number(v[8]),
    updatedAt: Number(v[9]),
  };
}

/** Listet alle Figuren eines Projekts. */
export function listCharacters(projectId: string): Character[] {
  const res = getDb().exec(
    `SELECT ${CHAR_COLS} FROM characters WHERE project_id = ? ORDER BY name`,
    [projectId],
  );
  return res.length ? res[0].values.map(rowToChar) : [];
}

/** Eine Figur laden. */
export function getCharacter(id: string): Character | null {
  const res = getDb().exec(`SELECT ${CHAR_COLS} FROM characters WHERE id = ?`, [id]);
  return res.length ? rowToChar(res[0].values[0]) : null;
}

/** Figur erstellen oder aktualisieren. */
export async function saveCharacter(char: Omit<Character, "createdAt" | "updatedAt">): Promise<Character> {
  const now = Date.now();
  const existing = getCharacter(char.id);

  const record: Character = {
    ...char,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  getDb().exec(
    `INSERT OR REPLACE INTO characters (${CHAR_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      record.id, record.projectId, record.name,
      JSON.stringify(record.aliases), record.age, record.role,
      record.traits, record.notes, record.createdAt, record.updatedAt,
    ],
  );
  await persist();
  return record;
}

/** Figur löschen. */
export async function deleteCharacter(id: string): Promise<void> {
  getDb().run("DELETE FROM characters WHERE id = ?", [id]);
  await persist();
}

export interface ConsistencyWarning {
  characterId: string;
  characterName: string;
  field: string;
  message: string;
}

/** Prüft Konsistenz einer Figur gegen die bestehenden Daten. */
export function checkCharacterConsistency(character: Character): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];

  if (!character.name.trim()) {
    warnings.push({
      characterId: character.id,
      characterName: "(unbenannt)",
      field: "name",
      message: "Figur hat keinen Namen.",
    });
  }

  // Alter als Zahl prüfen
  if (character.age && !/^\d+$/.test(character.age.trim())) {
    warnings.push({
      characterId: character.id,
      characterName: character.name,
      field: "age",
      message: `Alter "${character.age}" ist keine Zahl.`,
    });
  }

  return warnings;
}

/** Parst LLM-Ausgabe mit Figuren-Vorschlägen. */
export function parseCharacterSuggestions(llmText: string): Partial<Character>[] {
  const suggestions: Partial<Character>[] = [];

  // Erwartetes Format: Name|Alter|Rolle|Merkmale (eine Zeile pro Figur)
  const lines = llmText.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 2 && parts[0]) {
      suggestions.push({
        name: parts[0],
        age: parts[1] || "",
        role: parts[2] || "",
        traits: parts[3] || "",
      });
    }
  }

  return suggestions;
}
