// ConcordanceIndexMatrix (WP 79.2)
//
// Extrahiert Eigennamen, Schlachten, Artefakte und Fachbegriffe aus
// Manuskripten und erstellt ein hierarchisches Sach- und Personenregister.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index-Eintrag-Typ. */
export type IndexEntryType = "person" | "place" | "battle" | "artifact" | "term";

/** Ein Index-Eintrag. */
export interface IndexEntry {
  term: string;
  type: IndexEntryType;
  pageRefs: number[];
  subEntries: string[];
  seeAlso: string[];
}

/** Ein Konkordanz-Index. */
export interface ConcordanceIndex {
  title: string;
  entries: IndexEntry[];
  totalEntries: number;
}

/** Typ-Labels. */
export const TYPE_LABELS: Record<IndexEntryType, string> = {
  person: "Personen",
  place: "Orte",
  battle: "Schlachten",
  artifact: "Artefakte",
  term: "Fachbegriffe",
};

/** Extrahiert Eigennamen aus einem Text. */
export function extractNames(text: string): string[] {
  const names: string[] = [];
  const regex = /\b[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g;
  const matches = text.match(regex);
  if (matches) {
    for (const m of matches) {
      if (m.length > 2 && !names.includes(m)) {
        names.push(m);
      }
    }
  }
  return names;
}

/** Extrahiert Schlachten aus einem Text. */
export function extractBattles(text: string): string[] {
  const battles: string[] = [];
  const regex = /Schlacht\s+(?:von|bei|um)\s+([A-ZÄÖÜ][a-zäöüß]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = `Schlacht von ${match[1]}`;
    if (!battles.includes(name)) {
      battles.push(name);
    }
  }
  return battles;
}

/** Extrahiert Artefakte aus einem Text. */
export function extractArtifacts(text: string): string[] {
  const artifacts: string[] = [];
  const regex = /(?:der|die|das|ein|eine)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1];
    if (name.length > 3 && !artifacts.includes(name)) {
      artifacts.push(name);
    }
  }
  return artifacts;
}

/** Extrahiert Fachbegriffe aus einem Text. */
export function extractTerms(text: string): string[] {
  const terms: string[] = [];
  const regex = /„([^"]+)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!terms.includes(match[1])) {
      terms.push(match[1]);
    }
  }
  return terms;
}

/** Erstellt einen vollständigen Konkordanz-Index. */
export function createConcordanceIndex(title: string, text: string): ConcordanceIndex {
  const entries: IndexEntry[] = [];

  const names = extractNames(text);
  for (const name of names) {
    entries.push({
      term: name,
      type: "person",
      pageRefs: [1],
      subEntries: [],
      seeAlso: [],
    });
  }

  const battles = extractBattles(text);
  for (const battle of battles) {
    entries.push({
      term: battle,
      type: "battle",
      pageRefs: [1],
      subEntries: [],
      seeAlso: [],
    });
  }

  const artifacts = extractArtifacts(text);
  for (const artifact of artifacts) {
    entries.push({
      term: artifact,
      type: "artifact",
      pageRefs: [1],
      subEntries: [],
      seeAlso: [],
    });
  }

  const terms = extractTerms(text);
  for (const term of terms) {
    entries.push({
      term,
      type: "term",
      pageRefs: [1],
      subEntries: [],
      seeAlso: [],
    });
  }

  return { title, entries, totalEntries: entries.length };
}

/** Formatiert einen Konkordanz-Index als Text. */
export function formatConcordanceIndex(index: ConcordanceIndex): string {
  const lines: string[] = [];
  lines.push(`=== KONKORDANZ: ${index.title} ===`);
  lines.push(`Einträge: ${index.totalEntries}`);
  lines.push("");

  for (const entry of index.entries) {
    lines.push(`${entry.term} [${TYPE_LABELS[entry.type]}]`);
    if (entry.pageRefs.length > 0) {
      lines.push(`  Seiten: ${entry.pageRefs.join(", ")}`);
    }
    if (entry.subEntries.length > 0) {
      lines.push(`  Untereinträge: ${entry.subEntries.join(", ")}`);
    }
    if (entry.seeAlso.length > 0) {
      lines.push(`  Siehe auch: ${entry.seeAlso.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Erstellt einen Beispiel-Index. */
export function createSampleIndex(): ConcordanceIndex {
  const text = 'Der Held Falkenstein zog in die Schlacht von Düsterwald. Er trug das Schwert „Klinge des Lichts“. Die Schlacht von Düsterwald war blutig.';
  return createConcordanceIndex("Die Chroniken der Aetherie", text);
}
