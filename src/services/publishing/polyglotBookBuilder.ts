// PolyglotBookBuilder (WP 84.2)
//
// Zweisprachiger Parallel-Buch-Satz (Facing-Page) für Sprachlerner
// und klassische Ausgaben. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

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

/** Sprachpaar. */
export type LanguagePair = "de-en" | "en-de" | "de-fr" | "fr-de" | "de-es" | "es-de" | "en-fr" | "fr-en" | "en-es" | "es-en";

/** Ein Absatz-Paar. */
export interface ParagraphPair {
  left: string;   // Originalsprache (Verso)
  right: string;  // Übersetzung (Recto)
  height: number; // Berechnete Höhe in Punkten
}

/** Ein zweisprachiges Buch. */
export interface BilingualBook {
  title: string;
  author: string;
  languagePair: LanguagePair;
  pairs: ParagraphPair[];
  gutterWidth: number; // Bundsteg in mm
  marginOuter: number; // Außerrand in mm
  marginInner: number; // Bundsteg in mm
  marginTop: number;   // Kopfrand in mm
  marginBottom: number; // Fußrand in mm
  baselineGrid: number; // Grundlinienraster in pt
}

/** Erstellt ein leeres zweisprachiges Buch. */
export function createEmptyBilingualBook(title: string, languagePair: LanguagePair): BilingualBook {
  return {
    title,
    author: "",
    languagePair,
    pairs: [],
    gutterWidth: 20,
    marginOuter: 25,
    marginInner: 15,
    marginTop: 20,
    marginBottom: 25,
    baselineGrid: 12,
  };
}

/** Fügt ein Absatz-Paar hinzu. */
export function addParagraphPair(book: BilingualBook, left: string, right: string): BilingualBook {
  const height = Math.max(left.length, right.length) * 0.15 + 12;
  const pair: ParagraphPair = { left, right, height: Math.round(height) };
  return { ...book, pairs: [...book.pairs, pair] };
}

/** Prüft die Grundlinien-Ausrichtung. */
export function checkBaselineAlignment(book: BilingualBook): boolean {
  const tolerance = 2; // 2 Punkte Toleranz
  return book.pairs.every(pair => {
    const diff = Math.abs(pair.left.length - pair.right.length) * 0.15;
    return diff <= tolerance;
  });
}

/** Berechnet den optischen Durchschuss für ungleiche Längen. */
export function calculateOpticalCompensation(left: string, right: string, baselineGrid: number): number {
  const diff = Math.abs(left.length - right.length);
  return Math.round(diff * 0.15 * baselineGrid / 12);
}

/** Formatiert ein zweisprachiges Buch als Text. */
export function formatBilingualBook(book: BilingualBook): string {
  const lines: string[] = [];
  lines.push(`=== ZWEISPRACHIGES BUCH: ${book.title} ===`);
  lines.push(`Sprachpaar: ${book.languagePair}`);
  lines.push(`Absätze: ${book.pairs.length}`);
  lines.push(`Grundlinienraster: ${book.baselineGrid}pt`);
  lines.push(`Bundsteg: ${book.gutterWidth}mm`);
  lines.push("");
  lines.push("ABSÄTZE:");
  for (let i = 0; i < book.pairs.length; i++) {
    const p = book.pairs[i];
    lines.push(`  ${i + 1}. [L] ${p.left.substring(0, 50)}...`);
    lines.push(`       [R] ${p.right.substring(0, 50)}...`);
    lines.push(`       Höhe: ${p.height}pt`);
  }
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Buch. */
export function createSampleBilingualBook(): BilingualBook {
  let book = createEmptyBilingualBook("Die Chroniken der Aetherie", "de-en");
  book.author = "Erik Gieske";
  book = addParagraphPair(book, "Der Held stand auf dem Dach.", "The hero stood on the roof.");
  book = addParagraphPair(book, "Die Stadt brannte unter ihm.", "The city burned beneath him.");
  book = addParagraphPair(book, "Er musste handeln.", "He had to act.");
  return book;
}