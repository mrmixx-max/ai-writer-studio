// Sprint 3, Teil 1: ContextManager — Long-Term Memory / Knowledge-Base.
//
// Speichert projektbezogene Fakten, Charakter-Eigenschaften, Entitäten,
// Fachbuch-Strukturen und Zeitlinien-Punkte über alle Kapitel hinweg in
// der Fakten-Base (Migration 021: bookwriter_facts) und injiziert sie als
// kompakten Kontextblock in Prompts — damit Kohärenz über 50k+ Wörter
// erhalten bleibt, ohne den Volltext aller Vorkapitel zu verschicken.
//
// Design-Vertrag:
// - Upsert per (project_id, kind, key): dieselbe Entität wird aktualisiert,
//   nicht dupliziert (Namensdrift wird vom Konsistenz-Prüfer erkannt).
// - buildContextBlock() liefert EINEN deterministischen Textblock (genre-
//   neutrals Label je kind), der direkt an promptWriteChapter/promptOutline
//   als researchNotes-/Kontext-Zeile angehängt werden kann.
// - Reine DB-/String-Logik, kein LLM-Call → deterministisch testbar.

import { getDb, persist } from "@/services/db";
import { uid } from "@/services/knowledge/util";

/** Arten von Fakten in der Memory-Base. */
export type FactKind =
  | "character"
  | "place"
  | "entity"
  | "terminology"
  | "structure"
  | "timeline";

export const FACT_KINDS: FactKind[] = [
  "character", "place", "entity", "terminology", "structure", "timeline",
];

/** Deutsche Labels für den Prompt-Kontextblock. */
const KIND_LABELS: Record<FactKind, string> = {
  character: "Charaktere",
  place: "Orte",
  entity: "Entitäten",
  terminology: "Fachbegriffe",
  structure: "Fachbuch-Struktur",
  timeline: "Zeitlinie",
};

/** Ein gespeicherter Fakt. */
export interface StoredFact {
  id: string;
  projectId: string;
  kind: FactKind;
  key: string;
  value: string;
  /** Kapitel, in dem der Fakt zuletzt gesehen wurde (null = manuell/briefing). */
  sourceChapter: number | null;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

const FACT_COLUMNS =
  "id, project_id, kind, key, value, source_chapter, confidence, created_at, updated_at";

function rowToFact(v: unknown[]): StoredFact {
  return {
    id: String(v[0]),
    projectId: String(v[1]),
    kind: String(v[2]) as FactKind,
    key: String(v[3]),
    value: String(v[4]),
    sourceChapter: v[5] === null || v[5] === undefined ? null : Number(v[5]),
    confidence: Number(v[6] ?? 1),
    createdAt: Number(v[7]),
    updatedAt: Number(v[8]),
  };
}

/** Eingabe für upsertFact — id/Timestamps werden vergeben. */
export interface FactInput {
  kind: FactKind;
  key: string;
  value: string;
  sourceChapter?: number | null;
  confidence?: number;
}

/**
 * Speichert oder aktualisiert einen Fakt (Upsert per Projekt+Art+Schlüssel).
 * Wirft bei leerem key/value — sonst ist der Kontextblock später Müll.
 */
export async function upsertFact(
  projectId: string,
  input: FactInput,
): Promise<StoredFact> {
  const key = input.key.trim();
  const value = input.value.trim();
  if (!key) throw new Error("Fakt ohne key kann nicht gespeichert werden.");
  if (!value) throw new Error(`Fakt "${key}" ohne value kann nicht gespeichert werden.`);
  if (!FACT_KINDS.includes(input.kind)) {
    throw new Error(`Unbekannte Fakt-Art: ${input.kind}`);
  }

  const db = getDb();
  const now = Date.now();
  const existing = getFact(projectId, input.kind, key);

  if (existing) {
    db.run(
      `UPDATE bookwriter_facts
       SET value = ?, source_chapter = COALESCE(?, source_chapter), confidence = ?, updated_at = ?
       WHERE id = ?`,
      [value, input.sourceChapter ?? null, input.confidence ?? existing.confidence, now, existing.id],
    );
    await persist();
    return { ...existing, value, sourceChapter: input.sourceChapter ?? existing.sourceChapter, confidence: input.confidence ?? existing.confidence, updatedAt: now };
  }

  const fact: StoredFact = {
    id: uid("bwf"),
    projectId,
    kind: input.kind,
    key,
    value,
    sourceChapter: input.sourceChapter ?? null,
    confidence: input.confidence ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    `INSERT INTO bookwriter_facts (${FACT_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?)`,
    [fact.id, fact.projectId, fact.kind, fact.key, fact.value, fact.sourceChapter, fact.confidence, fact.createdAt, fact.updatedAt],
  );
  await persist();
  return fact;
}

/** Bulk-Upsert (ignoriert einzelne Fehler nicht — Validierung vorher). */
export async function upsertFacts(
  projectId: string,
  facts: FactInput[],
): Promise<StoredFact[]> {
  const out: StoredFact[] = [];
  for (const f of facts) out.push(await upsertFact(projectId, f));
  return out;
}

/** Liest einen konkreten Fakt. */
export function getFact(
  projectId: string,
  kind: FactKind,
  key: string,
): StoredFact | null {
  const res = getDb().exec(
    `SELECT ${FACT_COLUMNS} FROM bookwriter_facts
     WHERE project_id = ? AND kind = ? AND key = ?`,
    [projectId, kind, key.trim()],
  );
  if (!res.length || !res[0].values.length) return null;
  return rowToFact(res[0].values[0]);
}

/** Alle Fakten eines Projekts, optional nach Art gefiltert. */
export function listFacts(projectId: string, kind?: FactKind): StoredFact[] {
  const rows = kind
    ? getDb().exec(
        `SELECT ${FACT_COLUMNS} FROM bookwriter_facts WHERE project_id = ? AND kind = ? ORDER BY key`,
        [projectId, kind],
      )
    : getDb().exec(
        `SELECT ${FACT_COLUMNS} FROM bookwriter_facts WHERE project_id = ? ORDER BY kind, key`,
        [projectId],
      );
  if (!rows.length) return [];
  return rows[0].values.map(rowToFact);
}

/** Löscht einen Fakt. */
export async function deleteFact(id: string): Promise<void> {
  getDb().run("DELETE FROM bookwriter_facts WHERE id = ?", [id]);
  await persist();
}

/** Löscht alle Fakten eines Projekts (z.B. nach Projekt-Reset). */
export async function clearFacts(projectId: string): Promise<void> {
  getDb().run("DELETE FROM bookwriter_facts WHERE project_id = ?", [projectId]);
  await persist();
}

/** Extrahiert Fakt-Schlüsselwörter (groß geschriebene Tokens) aus einem Text. */
export function extractFactKeys(text: string): string[] {
  const names = text.match(/\p{Lu}\p{L}{2,}/gu) ?? [];
  const stop = new Set([
    "Der", "Die", "Das", "Ein", "Eine", "Ich", "Er", "Sie", "Es", "Wir",
    "Und", "Aber", "Denn", "Doch", "Wie", "Was", "Wer", "Wo", "Wann",
    "Kapitel", "Zusammenfassung", "Ergebnis", "Ziel", "Konflikt",
  ]);
  return [...new Set(names)].filter((n) => !stop.has(n));
}

/**
 * Baut den Kontextblock für einen Prompt aus der Memory-Base.
 * Deterministisch: Art-Reihenfolge wie FACT_KINDS, Keys alphabetisch,
 * Limit pro Art (Budget-Schutz für 50k+-Wörter-Projekte).
 *
 * @param maxPerKind maximale Zeilen je Art (Default 10).
 */
export function buildContextBlock(
  projectId: string,
  maxPerKind = 10,
): string {
  const grouped: string[] = [];
  for (const kind of FACT_KINDS) {
    const facts = listFacts(projectId, kind).slice(0, maxPerKind);
    if (facts.length === 0) continue;
    grouped.push(`${KIND_LABELS[kind]}:`);
    for (const f of facts) grouped.push(`- ${f.key}: ${f.value}`);
  }
  if (grouped.length === 0) return "";
  return `Stabiler Kontext (verbindlich für alle Kapitel):\n${grouped.join("\n")}`;
}
