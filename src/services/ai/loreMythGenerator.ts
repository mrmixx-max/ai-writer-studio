// Mythen-, Prophezeiungs- & Balladen-Generator (WP 57.2)
//
// Erzeugt In-Universe-Folklore: metrisch gebundene Prophezeiungen, schmissige
// Tavernenlieder und feierliche Schöpfungsmythen — mit Reim-Engine und
// Export-Brücke zum Epigraph-Studio (WP 52.2).
//
// Drei deterministische Werkzeuge:
//
//   1. generateLore        — Textsorte + Thema → Vers-Dichtung
//   2. analyzeMeter        — Metrum und Reimschema eines Texts
//   3. toEpigraph          — Brücke zum Epigraph-Studio (Kapitel-Vorspann)
//
// Design-Regeln (analog proseExpander):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

import type { Epigraph, EpigraphKind } from '../typesetting/epigraphAnthology';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Textsorte der Folklore. */
export type LoreKind = 'oracle' | 'tavern-song' | 'creation-myth' | 'battle-chronicle';

/** Versmaß. */
export type Meter = 'trochee' | 'iambus' | 'alliterative';

/** Reimschema. */
export type RhymeScheme = 'AABB' | 'ABAB' | 'none';

/** Optionen für den Generator. */
export interface LoreOptions {
  /** Textsorte. Default: 'oracle'. */
  kind?: LoreKind;
  /** Thema/Stoff, z. B. „der fallende König". */
  subject?: string;
  /** Anzahl Strophen (1–8). Default: 3. */
  stanzas?: number;
  /** Versmaß. Default: hängt von der Textsorte ab. */
  meter?: Meter;
  /** Reimschema. Default: hängt von der Textsorte ab. */
  rhymeScheme?: RhymeScheme;
}

/** Eine Strophe. */
export interface Stanza {
  /** 1-basierte Strophennummer. */
  index: number;
  /** Die Verse der Strophe. */
  lines: string[];
  /** Reimschema der Strophe. */
  rhymeScheme: string;
}

/** Ergebnis der Folklore-Erzeugung. */
export interface LorePiece {
  /** Titel der Dichtung. */
  title: string;
  /** Textsorte. */
  kind: LoreKind;
  /** Alle Strophen. */
  stanzas: Stanza[];
  /** Vollständiger Text (Strophen mit Leerzeile). */
  text: string;
  /** Verwendetes Versmaß. */
  meter: Meter;
  /** Verwendetes Reimschema. */
  rhymeScheme: RhymeScheme;
  /** Gesamtzahl der Verse. */
  lineCount: number;
  /** Gesamtzahl der Wörter. */
  wordCount: number;
}

/** Ergebnis der Metrum-Analyse. */
export interface MeterAnalysis {
  /** Anzahl der Verse. */
  lineCount: number;
  /** Durchschnittliche Silbenzahl je Vers (heuristisch). */
  avgSyllables: number;
  /** Erkanntes Metrum (oder null bei zu wenig Daten). */
  detectedMeter: Meter | null;
  /** Erkanntes Reimschema. */
  detectedRhyme: RhymeScheme;
  /** Anteil gereimter Verspaare (0–1). */
  rhymeRatio: number;
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Textsorte-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Textsorten-Namen. */
export const KIND_LABELS: Record<LoreKind, string> = {
  oracle: 'Ominöser Orakelspruch',
  'tavern-song': 'Tavernenlied',
  'creation-myth': 'Sakraler Schöpfungsmythos',
  'battle-chronicle': 'Schlachtenchronik',
};

/** Standard-Metrum je Textsorte. */
const DEFAULT_METER: Record<LoreKind, Meter> = {
  oracle: 'trochee',
  'tavern-song': 'iambus',
  'creation-myth': 'alliterative',
  'battle-chronicle': 'trochee',
};

/** Standard-Reimschema je Textsorte. */
const DEFAULT_RHYME: Record<LoreKind, RhymeScheme> = {
  oracle: 'ABAB',
  'tavern-song': 'AABB',
  'creation-myth': 'none',
  'battle-chronicle': 'AABB',
};

/** Titel-Vorlagen je Textsorte. */
const TITLE_TEMPLATES: Record<LoreKind, readonly string[]> = {
  oracle: ['Die Verse der Seherin', 'Was kommen wird', 'Die Weissagung von {subject}'],
  'tavern-song': ['Das Lied vom {subject}', 'Beim Wein erzählt', 'Die Ballade von {subject}'],
  'creation-myth': ['Die Schöpfung und das Wort', 'Vom Anfang aller Dinge', 'Die Genesis von {subject}'],
  'battle-chronicle': ['Die Chronik von {subject}', 'Das Jahr des Blutes', 'Von der Schlacht bei {subject}'],
};

// ---------------------------------------------------------------------------
// Vers-Bausteine
// ---------------------------------------------------------------------------

/** Orakel-Verse (zweideutig, drohend). */
const ORACLE_LINES: readonly string[] = [
  'Wenn der Rabe schweigt und der Fluss sich dreht',
  'Wird das Kind aus Eisen seinen Vater sehn',
  'In der dritten Nacht, wenn der Mond sich neigt',
  'Wird ein Reich in seiner eigenen Asche stehn',
  'Hüte dich vor dem, der zu spät erwacht',
  'Denn sein Wort zerbricht, was das Wort gemacht',
  'Zwei Wege bleiben, einer führt hinab',
  'Und der andere endet in demselben Grab',
];

/** Tavernenlied-Verse (schmissig, fröhlich). */
const TAVERN_LINES: readonly string[] = [
  'Hebt die Krüge, singt vom Held',
  'Der sein Leben nicht gezählt',
  'Dreißig Fässer hat er leer',
  'Und sein Schwert war schwer und mehr',
  'Doch die Nacht wird niemals alt',
  'Und der Wirt schenkt ohne Halt',
  'Also trinkt, bis niemand steht',
  'Und die Sonne untergeht',
];

/** Schöpfungsmythos-Verse (feierlich, archaisch). */
const CREATION_LINES: readonly string[] = [
  'Ehe die Berge standen, ehe das Meer noch schwieg',
  'War das Wort allein, und das Wort genügte',
  'Da ward aus dem Nichts ein Atem, der sich bewegte',
  'Und die Finsternis empfing einen Namen',
  'Die Erde lag nackt unter einem leeren Himmel',
  'Bis die Hand sich öffnete und Licht hervorließ',
  'So ward das Erste, und es war gut',
  'Und es ward das Zweite, und es war genug',
];

/** Schlachtenchronik-Verse (hart, nüchtern). */
const BATTLE_LINES: readonly string[] = [
  'Im dritten Jahr zog das Heer nach Norden',
  'Zweitausend standen, achthundert kehrten',
  'Der Feldherr fiel beim ersten Sturm',
  'Und niemand sang für ihn',
  'Die Mauern hielten vierzehn Tage',
  'Am fünfzehnten brach der Ostturm',
  'Was übrig blieb, vergrub sich selbst',
  'Und die Chronik schweigt darüber',
];

/** Alle Vers-Pools je Textsorte. */
const LINE_POOLS: Record<LoreKind, readonly string[]> = {
  oracle: ORACLE_LINES,
  'tavern-song': TAVERN_LINES,
  'creation-myth': CREATION_LINES,
  'battle-chronicle': BATTLE_LINES,
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Textsorte defensiv prüfen. */
function normalizeKind(value: unknown): LoreKind {
  const kinds: LoreKind[] = ['oracle', 'tavern-song', 'creation-myth', 'battle-chronicle'];
  return typeof value === 'string' && (kinds as string[]).includes(value)
    ? (value as LoreKind)
    : 'oracle';
}

/** Metrum defensiv prüfen. */
function normalizeMeter(value: unknown, fallback: Meter): Meter {
  const meters: Meter[] = ['trochee', 'iambus', 'alliterative'];
  return typeof value === 'string' && (meters as string[]).includes(value)
    ? (value as Meter)
    : fallback;
}

/** Reimschema defensiv prüfen. */
function normalizeRhyme(value: unknown, fallback: RhymeScheme): RhymeScheme {
  const schemes: RhymeScheme[] = ['AABB', 'ABAB', 'none'];
  return typeof value === 'string' && (schemes as string[]).includes(value)
    ? (value as RhymeScheme)
    : fallback;
}

/** Strophenzahl begrenzen. */
function normalizeStanzas(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.round(value)));
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Silbenzahl eines Verses heuristisch schätzen: Vokalgruppen zählen,
 * stummes Schluss-e abziehen.
 */
function estimateSyllables(line: string): number {
  const words = line.toLowerCase().replace(/[^a-zäöüß\s]/g, ' ').split(/\s+/).filter((w) => w.length > 0);
  let total = 0;
  for (const word of words) {
    const groups = word.match(/[aeiouäöü]+/g);
    let count = groups ? groups.length : 0;
    // Stummes Schluss-e.
    if (word.endsWith('e') && count > 1) count--;
    total += Math.max(1, count);
  }
  return total;
}

/**
 * Reim-Endung eines Verses: letzte zwei Laute, Umlaute normalisiert.
 * „Wein"/„allein" → „in"; „alt"/„kalt" → „lt"; „schweigt"/„neigt" → „gt".
 */
function rhymeEnding(line: string): string {
  const clean = line
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 's')
    .replace(/[^a-z]/g, '');
  if (clean.length < 2) return clean;
  return clean.slice(-2);
}

// ---------------------------------------------------------------------------
// 1) Folklore-Generator
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Folklore-Stück (Orakel, Tavernenlied, Mythos oder Chronik).
 *
 * Metrum und Reimschema folgen der Textsorte, lassen sich aber überschreiben.
 * Das Thema fließt in Titel und Verse ein. Alles ist deterministisch.
 *
 * Defensiv: ungültige Eingaben fallen auf sinnvolle Standardwerte zurück.
 */
export function generateLore(options?: LoreOptions | null): LorePiece {
  const kind = normalizeKind(options?.kind);
  const meter = normalizeMeter(options?.meter, DEFAULT_METER[kind]);
  const rhymeScheme = normalizeRhyme(options?.rhymeScheme, DEFAULT_RHYME[kind]);
  const stanzasTarget = normalizeStanzas(options?.stanzas);
  const subject =
    typeof options?.subject === 'string' && options.subject.trim().length > 0
      ? options.subject.trim()
      : '';

  const rand = createSeededRandom(hashString(`${kind}#${subject}#${stanzasTarget}#${meter}#${rhymeScheme}`));

  const title = pick(TITLE_TEMPLATES[kind], rand).replace(
    /\{subject\}/g,
    subject || (kind === 'tavern-song' ? 'alten Recken' : 'dem Reich'),
  );

  const pool = LINE_POOLS[kind];
  const stanzas: Stanza[] = [];
  const usedLines = new Set<string>();

  for (let s = 0; s < stanzasTarget; s++) {
    const lines: string[] = [];

    // 4 Verse je Strophe; bei "none" ohne Reimzwang.
    for (let l = 0; l < 4; l++) {
      let line = pick(pool, rand);

      // Für Reimschemata: den 2./4. Vers an den 1./3. Vers angleichen.
      if (rhymeScheme === 'AABB' && (l === 1 || l === 3)) {
        const partner = lines[l - 1];
        if (partner) line = matchRhyme(line, partner, pool, rand);
      } else if (rhymeScheme === 'ABAB' && (l === 2 || l === 3)) {
        const partner = lines[l - 2];
        if (partner) line = matchRhyme(line, partner, pool, rand);
      }

      // Wiederholungen in derselben Strophe vermeiden.
      if (usedLines.has(line) && usedLines.size < pool.length) {
        const alt = pick(pool, rand);
        if (!usedLines.has(alt)) line = alt;
      }
      usedLines.add(line);
      lines.push(line);
    }

    stanzas.push({
      index: s + 1,
      lines,
      rhymeScheme,
    });
  }

  const text = stanzas.map((s) => s.lines.join('\n')).join('\n\n');

  return {
    title,
    kind,
    stanzas,
    text,
    meter,
    rhymeScheme,
    lineCount: stanzas.reduce((sum, s) => sum + s.lines.length, 0),
    wordCount: countWords(text),
  };
}

/** Sucht eine Zeile aus dem Pool mit passender Reim-Endung. */
function matchRhyme(
  line: string,
  partner: string,
  pool: readonly string[],
  rand: () => number,
): string {
  const target = rhymeEnding(partner);
  const candidates = pool.filter((c) => rhymeEnding(c) === target && c !== line);
  if (candidates.length > 0) return pick(candidates, rand);
  // Kein passender Reim: Zeile unverändert lassen (Reim ist optional).
  return line;
}

// ---------------------------------------------------------------------------
// 2) Metrum-Analyse
// ---------------------------------------------------------------------------

/**
 * Analysiert Metrum und Reimschema eines Vers-Texts.
 *
 * Defensiv: leerer/ungültiger Text liefert Nullen.
 */
export function analyzeMeter(text: unknown): MeterAnalysis {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      lineCount: 0,
      avgSyllables: 0,
      detectedMeter: null,
      detectedRhyme: 'none',
      rhymeRatio: 0,
    };
  }

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      lineCount: 0,
      avgSyllables: 0,
      detectedMeter: null,
      detectedRhyme: 'none',
      rhymeRatio: 0,
    };
  }

  const syllableCounts = lines.map(estimateSyllables);
  const avgSyllables =
    Math.round((syllableCounts.reduce((a, b) => a + b, 0) / syllableCounts.length) * 100) / 100;

  // Metrum heuristisch: gleichmäßige Silbenzahl → trochäisch/jambisch,
  // stark schwankend mit Alliteration → stabreimend.
  const variance =
    syllableCounts.reduce((sum, c) => sum + (c - avgSyllables) ** 2, 0) / syllableCounts.length;
  const stdDev = Math.sqrt(variance);

  let detectedMeter: Meter | null = null;
  if (avgSyllables >= 4 && stdDev <= 2.5) {
    detectedMeter = 'trochee';
  } else if (avgSyllables >= 4) {
    detectedMeter = 'iambus';
  }

  // Alliteration prüfen (Stabreim): gleiche Anfangsbuchstaben in Nachbarversen.
  const initials = lines.map((l) => l.trim().charAt(0).toLowerCase());
  const allitHits = initials.filter((c, i) => i > 0 && c === initials[i - 1]).length;
  if (allitHits >= 2) detectedMeter = 'alliterative';

  // Reimschema: Endungen paarweise vergleichen.
  const endings = lines.map(rhymeEnding);
  let rhymePairs = 0;
  let totalPairs = 0;
  for (let i = 0; i + 1 < endings.length; i += 2) {
    totalPairs++;
    if (endings[i] === endings[i + 1]) rhymePairs++;
  }
  const rhymeRatio = totalPairs > 0 ? Math.round((rhymePairs / totalPairs) * 10000) / 10000 : 0;

  let detectedRhyme: RhymeScheme = 'none';
  if (rhymeRatio >= 0.75) detectedRhyme = 'AABB';
  else if (endings.length >= 4 && endings[0] === endings[2] && endings[1] === endings[3]) {
    detectedRhyme = 'ABAB';
  }

  return {
    lineCount: lines.length,
    avgSyllables,
    detectedMeter,
    detectedRhyme,
    rhymeRatio,
  };
}

// ---------------------------------------------------------------------------
// 3) Epigraph-Brücke
// ---------------------------------------------------------------------------

/**
 * Wandelt ein Folklore-Stück in ein Epigraph für das Kapitel-Vorspann-Studio
 * (WP 52.2) um.
 *
 * Fiktive In-Universe-Texte werden als `kind: 'fictional'` markiert, damit der
 * Public-Domain-Wächter sie nicht als reale Zitate behandelt.
 *
 * Defensiv: ungültige Eingaben liefern null.
 */
export function toEpigraph(
  piece: LorePiece | null | undefined,
  options?: { chapter?: number; author?: string; fleuron?: boolean },
): Epigraph | null {
  if (!piece || typeof piece !== 'object' || typeof piece.text !== 'string' || !piece.text.trim()) {
    return null;
  }

  const author =
    typeof options?.author === 'string' && options.author.trim().length > 0
      ? options.author.trim()
      : `${KIND_LABELS[piece.kind]} aus alter Zeit`;

  const chapter =
    typeof options?.chapter === 'number' && Number.isFinite(options.chapter)
      ? Math.max(1, Math.round(options.chapter))
      : undefined;

  // In-Universe-Texte sind immer fiktiv.
  const kind: EpigraphKind = 'fictional';

  return {
    id: `lore-${piece.kind}-${hashString(piece.text).toString(16)}`,
    text: piece.text,
    source: piece.title,
    author,
    kind,
    chapter,
    fleuron: options?.fleuron === true,
  };
}
