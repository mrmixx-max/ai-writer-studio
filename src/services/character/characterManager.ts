// Character Engine: CRUD + Beziehungen + Auto-Detect (Sprint 23, Agent 5).
//
// Reiner In-Memory-Store ohne DB-Abhängigkeit — bewusst getrennt vom
// DB-gestützten Service unter `src/services/characters/` (Figuren-DB):
// Die Engine verwaltet Charakter-Bögen (Arcs) und wird vom
// `CharacterPanel` direkt genutzt.

export interface Character {
  id: string;
  name: string;
  aliases?: string[];
  age?: number;
  gender?: string;
  occupation?: string;
  appearance?: string;
  personality?: string;
  backstory?: string;
  motivation?: string;
  arc?: "positive" | "negative" | "flat" | "corruption" | "redemption";
  relationships?: { characterId: string; type: string }[];
  firstAppearance?: string; // Kapitel
  color?: string; // für Timeline
}

export interface CharacterArc {
  characterId: string;
  scenes: { id: string; emotionalState: string; change: string }[];
}

const store = new Map<string, Character>();

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Erstellt einen Charakter (ID wird vergeben). */
export async function createCharacter(char: Omit<Character, "id">): Promise<Character> {
  const name = char.name.trim();
  if (!name) throw new Error("Name darf nicht leer sein.");
  const record: Character = { ...clone(char), id: uid("char"), name };
  if (!record.relationships) record.relationships = [];
  store.set(record.id, record);
  return clone(record);
}

/** Aktualisiert einen Charakter partiell. */
export async function updateCharacter(id: string, updates: Partial<Character>): Promise<Character> {
  const existing = store.get(id);
  if (!existing) throw new Error(`Unbekannter Charakter: ${id}`);
  const merged: Character = { ...clone(existing), ...clone(updates), id: existing.id };
  if (merged.name.trim() === "") throw new Error("Name darf nicht leer sein.");
  merged.name = merged.name.trim();
  store.set(id, merged);
  return clone(merged);
}

/** Löscht einen Charakter und räumt Verweise in fremden Beziehungen auf. */
export async function deleteCharacter(id: string): Promise<void> {
  store.delete(id);
  for (const [key, c] of store) {
    if (c.relationships?.some((r) => r.characterId === id)) {
      store.set(key, { ...c, relationships: c.relationships.filter((r) => r.characterId !== id) });
    }
  }
}

/** Alle Charaktere (alphabetisch). */
export async function getCharacters(): Promise<Character[]> {
  return [...store.values()].map(clone).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Ein einzelner Charakter oder undefined. */
export async function getCharacter(id: string): Promise<Character | undefined> {
  const c = store.get(id);
  return c ? clone(c) : undefined;
}

/** Fügt eine gerichtete Beziehung von fromId nach toId hinzu. */
export async function addRelationship(fromId: string, toId: string, type: string): Promise<void> {
  if (fromId === toId) throw new Error("Selbstbeziehung nicht erlaubt.");
  const from = store.get(fromId);
  const to = store.get(toId);
  if (!from) throw new Error(`Unbekannter Charakter: ${fromId}`);
  if (!to) throw new Error(`Unbekannter Charakter: ${toId}`);
  const relType = type.trim();
  if (!relType) throw new Error("Beziehungstyp darf nicht leer sein.");
  const rels = [...(from.relationships ?? [])];
  const existing = rels.findIndex((r) => r.characterId === toId);
  if (existing >= 0) rels[existing] = { characterId: toId, type: relType };
  else rels.push({ characterId: toId, type: relType });
  store.set(fromId, { ...from, relationships: rels });
}

// Häufige deutsche Wörter (Satzanfänge, Artikel, Pronomen …), die keine
// Eigennamen sind. Heuristik: Deutsch schreibt alle Nomen groß, daher
// zählen nur Treffer ≥ 2 Vorkommen oder mehrteilige Namen als Kandidaten.
const STOPWORDS = new Set(
  "der die das den dem des ein eine einer einen einem eines und oder aber denn doch nur auch noch schon sehr ganz vom zum zur beim nach vor bei mit von zu im am um als wie was wer wen wem wo wann warum weil dass wenn dann dort hier da es er sie wir ihr ich mich dich sich uns euch mein dein sein kein keine dieser diese dieses jeden jede jedes alle alles man es ist war waren wird werden hat haben hatte sind bin bist seid warst musste konnte sollte wollte musste sondern jedoch sowie sowohl zwischen durch gegen ohne unter über neben hinter entlang kapitel szene teil".split(" "),
);

/**
 * Erkennt Kandidaten-Namen aus Freitext (Heuristik: großgeschriebene
 * Tokens, Stoppwort-Filter, Mehrfachnennung oder mehrteiliger Name).
 */
export async function detectCharacters(text: string): Promise<Partial<Character>[]> {
  const counts = new Map<string, number>();
  const tokens = text.match(/[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?/g) ?? [];
  for (const t of tokens) {
    if (t.length < 3 || STOPWORDS.has(t.toLowerCase())) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // Mehrteilige Namen ("Anna Berger") zusätzlich erfassen.
  const full = text.match(/[A-ZÄÖÜ][a-zäöüß]{2,}\s+[A-ZÄÖÜ][a-zäöüß]{2,}/g) ?? [];
  const fullNames = new Set<string>();
  for (const f of full) {
    const parts = f.split(/\s+/);
    if (parts.every((p) => !STOPWORDS.has(p.toLowerCase()))) fullNames.add(f);
  }
  const result: Partial<Character>[] = [];
  for (const name of fullNames) result.push({ name });
  for (const [name, n] of counts) {
    if (n >= 2 && ![...fullNames].some((f) => f.includes(name))) result.push({ name });
  }
  return result;
}

/** Exportiert Charaktere als formatiertes JSON. */
export function exportToJSON(characters: Character[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), characters }, null, 2);
}

/** Nur für Tests: Store zurücksetzen. */
export function resetCharacterStore(): void {
  store.clear();
}
