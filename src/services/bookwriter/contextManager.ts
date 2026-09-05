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
  | "timeline"
  // Sprint 5 (Agent 3): Publishing-Metadaten für den KDP-Upload-Flow.
  | "isbn"
  | "pricing";

export const FACT_KINDS: FactKind[] = [
  "character", "place", "entity", "terminology", "structure", "timeline",
  "isbn", "pricing",
];

/** Publishing-relevante Fakten-Arten (Sprint 5: ISBN + Preisstrategie). */
export const PUBLISHING_FACT_KINDS: FactKind[] = ["isbn", "pricing"];

/** Deutsche Labels für den Prompt-Kontextblock. */
const KIND_LABELS: Record<FactKind, string> = {
  character: "Charaktere",
  place: "Orte",
  entity: "Entitäten",
  terminology: "Fachbegriffe",
  structure: "Fachbuch-Struktur",
  timeline: "Zeitlinie",
  // Sprint 5 (Agent 3): Publishing-Metadaten.
  isbn: "ISBNs",
  pricing: "Preisstrategie",
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
 * Validiert Publishing-Fakten (Sprint 5): ISBN-Formate (paperback|ebook|
 * hardcover), Preisstrategie-Ids und Preise in den KDP-Grenzen (0.99-200).
 */
export function validatePublishingFact(kind: "isbn" | "pricing", key: string, value: string): void {
  if (kind === "isbn") {
    if (!(ISBN_FACT_FORMATS as string[]).includes(key)) {
      throw new Error(`Ungültiges ISBN-Format: "${key}". Erlaubt: ${ISBN_FACT_FORMATS.join(", ")}.`);
    }
    return;
  }
  // kind === "pricing"
  if (key === "strategy") {
    getPricingStrategy(value); // wirft bei unbekannter Strategie
    return;
  }
  if (key === "USD" || key === "EUR" || key === "GBP") {
    const n = Number(value);
    if (Number.isNaN(n)) {
      throw new Error(`Preis "${key}" muss numerisch sein (aktuell: "${value}").`);
    }
    if (n < 0.99 || n > 200) {
      throw new Error(`Preis "${key}" verletzt die KDP-Grenzen 0.99-200 (aktuell: ${n}).`);
    }
    return;
  }
  throw new Error(`Ungültiger Pricing-Schlüssel: "${key}". Erlaubt: strategy, USD, EUR, GBP.`);
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
  // Sprint 5 (Agent 3): Publishing-Fakten (isbn/pricing) validieren.
  if (input.kind === "isbn" || input.kind === "pricing") {
    validatePublishingFact(input.kind, key, value);
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


// --- Publishing: ISBN & Preisstrategie (Sprint 5, Agent 3) --------------------------

import { getPricingStrategy, computePrices, type PriceOverrides } from "@/services/kdp/pricingStrategy";
import { ISBN_FORMATS, isbnPlaceholder, type IsbnFormat } from "@/services/kdp/uploadSheet";

/** Gültige ISBN-Formate als key der "isbn"-Fakten. */
export const ISBN_FACT_FORMATS = ISBN_FORMATS;


/**
 * Liest die ISBNs eines Projekts. Vergebene ISBNs als Wert, offene Slots als
 * Platzhalter-Token ("{{ISBN:FORMAT}}") — substituierbar per resolveIsbnPlaceholders.
 */
export function resolveProjectIsbns(projectId: string): Record<IsbnFormat, string> {
  const out = {} as Record<IsbnFormat, string>;
  for (const fmt of ISBN_FORMATS) {
    const fact = getFact(projectId, "isbn", fmt);
    out[fmt] = fact?.value?.trim() ? fact.value.trim() : isbnPlaceholder(fmt);
  }
  return out;
}

/** Pricing-Konfiguration eines Projekts (Strategie-Id + konkrete Preise). */
export interface ProjectPricing {
  strategy: string;
  prices: { USD: number; EUR: number; GBP: number };
}

/** Liest die Preisstrategie aus der Fakten-Base (Default: "standard"). */
export function getProjectPricing(projectId: string): ProjectPricing {
  const strategyFact = getFact(projectId, "pricing", "strategy");
  const strategyId = strategyFact?.value?.trim() || "standard";
  const strategy = getPricingStrategy(strategyId);
  const overrides: PriceOverrides = {};
  for (const cur of ["USD", "EUR", "GBP"] as const) {
    const f = getFact(projectId, "pricing", cur);
    if (f?.value?.trim()) {
      const n = Number(f.value);
      if (!Number.isNaN(n)) overrides[cur] = n;
    }
  }
  return { strategy: strategy.id, prices: computePrices(strategyId, overrides) };
}

/**
 * Speichert die Preisstrategie (und optional Override-Preise) als pricing-Fakten.
 * Konfigurierbar per Strategie-Id; Preise werden deterministisch aus der
 * Strategie berechnet (Overrides überschreiben pro Währung).
 */
export async function setProjectPricingStrategy(
  projectId: string,
  strategyId: string,
  overrides?: PriceOverrides,
): Promise<ProjectPricing> {
  const strategy = getPricingStrategy(strategyId); // wirft bei unbekannter Strategie
  await upsertFact(projectId, { kind: "pricing", key: "strategy", value: strategy.id });
  const prices = computePrices(strategy.id, overrides);
  for (const cur of ["USD", "EUR", "GBP"] as const) {
    await upsertFact(projectId, { kind: "pricing", key: cur, value: prices[cur].toFixed(2) });
  }
  return { strategy: strategy.id, prices };
}

/**
 * Baut den Publishing-Kontextblock (ISBNs + Preisstrategie) für den Upload-Flow.
 * Deterministisch; leer, wenn weder ISBNs noch Pricing gesetzt sind.
 */
export function buildPublishingContextBlock(projectId: string): string {
  const lines: string[] = [];
  const isbns = resolveProjectIsbns(projectId);
  const hasIsbn = (ISBN_FORMATS as IsbnFormat[]).some((f) => !isbns[f].startsWith("{{ISBN:"));
  if (hasIsbn) {
    lines.push("ISBNs:");
    for (const fmt of ISBN_FORMATS) {
      lines.push(`- ${fmt}: ${isbns[fmt]}`);
    }
  }
  const pricing = getProjectPricing(projectId);
  const hasPricing = getFact(projectId, "pricing", "strategy") !== null;
  if (hasPricing) {
    lines.push(
      `Preisstrategie: ${pricing.strategy} (USD ${pricing.prices.USD.toFixed(2)} / EUR ${pricing.prices.EUR.toFixed(2)} / GBP ${pricing.prices.GBP.toFixed(2)})`,
    );
  }
  if (lines.length === 0) return "";
  return `Publishing-Kontext (KDP-Upload):\n${lines.join("\n")}`;
}
