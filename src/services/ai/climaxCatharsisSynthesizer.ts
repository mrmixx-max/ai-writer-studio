// Klimax- & Katharsis-Synthesizer (WP 59.2)
//
// Das Finale entscheidet über den Nachruhm: verknüpft die äußere Lebensgefahr
// mit der inneren Wandlung des Helden, erzeugt den Entscheidungsmoment in
// mitreißender Prosa und formuliert den ruhigen Ausklang (Katharsis).
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeClimax   — Konflikt-Kollision → Klimax + Katharsis
//   2. analyzeCatharsis   — Intensitätskurve: Spitze und Abfall prüfen
//   3. extractCharacterFlaw — fatale Charakterschwäche im Text finden
//
// Design-Regeln (analog proseExpander / combatChoreographyGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art der fatalen Charakterschwäche. */
export type CharacterFlaw =
  | 'pride'
  | 'fear'
  | 'guilt'
  | 'isolation'
  | 'revenge';

/** Optionen für die Klimax-Erzeugung. */
export interface ClimaxOptions {
  /** Held der Geschichte. */
  protagonist?: string;
  /** Antagonist oder Bedrohung. */
  antagonist?: string;
  /** Fatale Charakterschwäche (sonst deterministisch gewählt). */
  flaw?: CharacterFlaw;
  /** Äußere Lebensgefahr, konkret. */
  danger?: string;
  /** Ort des Finales. */
  location?: string;
}

/** Ergebnis der Klimax-Erzeugung. */
export interface ClimaxScene {
  /** Der Entscheidungsmoment (Klimax). */
  climax: string;
  /** Der ruhige Ausklang (Katharsis). */
  catharsis: string;
  /** Vollständiger Text (Klimax + Leerzeile + Katharsis). */
  text: string;
  /** Verwendete Charakterschwäche. */
  flaw: CharacterFlaw;
  /** Menschenlesbarer Name der Schwäche. */
  flawLabel: string;
  /** Die innere Wandlung in einem Satz. */
  transformation: string;
  /** Wortzahl des Gesamttexts. */
  wordCount: number;
  /** Intensitätskurve 0–1 (Klimax hoch, Katharsis niedrig). */
  intensityCurve: number[];
}

/** Ergebnis der Katharsis-Analyse. */
export interface CatharsisAnalysis {
  /** Höchste Intensität (Klimax-Spitze) 0–1. */
  peak: number;
  /** Position der Spitze (0-basiert, Satzindex). */
  peakIndex: number;
  /** Intensität des letzten Satzes 0–1. */
  ending: number;
  /** Wie stark fällt die Intensität nach der Spitze? 0–1. */
  resolutionDrop: number;
  /** true, wenn Spitze und Abfall beide ausgeprägt sind. */
  wellFormed: boolean;
}

/** Ergebnis der Schwächen-Erkennung. */
export interface FlawFinding {
  /** Gefundene Schwäche (oder null). */
  flaw: CharacterFlaw | null;
  /** Menschenlesbarer Name. */
  label: string | null;
  /** Auslösende Signalwörter. */
  signals: string[];
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
// Schwächen-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Schwächen-Namen. */
export const FLAW_LABELS: Record<CharacterFlaw, string> = {
  pride: 'Hochmut',
  fear: 'Angst',
  guilt: 'Schuld',
  isolation: 'Selbstisolation',
  revenge: 'Rachsucht',
};

/** Die innere Wandlung je Schwäche (Überwindung). {protagonist} wird ersetzt. */
const TRANSFORMATIONS: Record<CharacterFlaw, readonly string[]> = {
  pride: [
    '{protagonist} bat um Hilfe, zum ersten Mal überhaupt',
    '{protagonist} gab zu, dass ein einzelner nicht genug war',
    '{protagonist} ließ einen anderen die Führung übernehmen',
  ],
  fear: [
    '{protagonist} ging hinein, obwohl jede Faser sich wehrte',
    '{protagonist} tat das Einzige, wovor {protagonist} sich immer gefürchtet hatte',
    '{protagonist} blieb stehen, statt zu fliehen',
  ],
  guilt: [
    '{protagonist} vergab sich selbst, endlich, und es war nicht zu spät',
    '{protagonist} hörte auf, für etwas zu büßen, das nie die eigene Schuld war',
    '{protagonist} legte die Last ab und richtete sich auf',
  ],
  isolation: [
    '{protagonist} ließ jemanden bis auf Armeslänge heran',
    '{protagonist} sagte den Satz, der nie ausgesprochen werden sollte',
    '{protagonist} nahm die ausgestreckte Hand an',
  ],
  revenge: [
    '{protagonist} ließ den Schlag fallen, obwohl er verdient gewesen wäre',
    '{protagonist} wählte das Leben statt der Vergeltung',
    '{protagonist} vergab, und es machte nicht schwach',
  ],
};

/** Äußere Gefahr je Schwäche (Kollision von außen und innen). */
const DANGER_TEMPLATES: readonly string[] = [
  'Die Klinge kam von oben, und es gab kein Ausweichen',
  'Das Wasser stieg bis an die Brust und weiter',
  'Die Flammen hatten den einzigen Ausgang erreicht',
  'Der Boden unter den Füßen begann zu brechen',
  'Die Zeit lief ab, und sie hörte es ticken',
];

/** Klimax-Bausteine (Zeitdehnung, Sinnesüberflutung). */
const CLIMAX_BEATS: readonly string[] = [
  'Alles wurde gleichzeitig laut und gleichzeitig langsam',
  'Die Sekunden dehnten sich zu Minuten',
  'Jeder Sinn brannte auf einmal',
  'Es gab kein Gestern und kein Morgen, nur diese eine Sekunde',
  'Der Körper tat, was er gelernt hatte, und der Kopf kam später nach',
];

/** Schmerz- und Triumph-Bausteine. */
const TRIUMPH_BEATS: readonly string[] = [
  'Es tat weh, und es war trotzdem richtig',
  'Der Schmerz blieb, aber er war jetzt der eigene',
  'Etwas brach, und das Gebrochene ließ Luft herein',
  'Es war kein Sieg. Es war ein Stehenbleiben.',
];

/** Katharsis-Bausteine (ruhiger Ausklang). */
const CATHARSIS_BEATS: readonly string[] = [
  'Danach war es still, und die Stille tat nicht mehr weh',
  'Das erste Licht kam grau und gleichgültig, und das war genug',
  'Jemand atmete neben ihr, und sie war nicht allein',
  'Die Narben blieben, aber sie brannten nicht mehr',
  'Der Morgen fragte nicht, was geschehen war. Er kam einfach.',
];

/** Narben- und Friedens-Bausteine. */
const PEACE_BEATS: readonly string[] = [
  'Sie würde es nie vergessen, aber sie würde damit leben',
  'Der Frieden kam nicht von außen. Er war innen geblieben.',
  'Was übrig war, genügte für einen Anfang',
  'Es war vorbei, und vorbei war ein gutes Wort',
];

/** Signalwörter je Schwäche. */
const FLAW_SIGNALS: Record<CharacterFlaw, readonly string[]> = {
  pride: ['stolz', 'allein', 'niemals zugeben', 'selbst', 'eigenen kräften', 'hochmut'],
  fear: ['angst', 'fürchtete', 'zitterte', 'floh', 'weglaufen', 'feige'],
  guilt: ['schuld', 'büßen', 'vorwurf', 'vergebung', 'versagen', 'bereute'],
  isolation: ['allein', 'niemanden', 'abstand', 'ferne', 'verschloss', 'einsam'],
  revenge: ['rache', 'vergeltung', 'rächen', 'hasste', 'zahlen lassen', 'blut für'],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Schwäche defensiv prüfen. */
function normalizeFlaw(value: unknown): CharacterFlaw | null {
  const all: CharacterFlaw[] = ['pride', 'fear', 'guilt', 'isolation', 'revenge'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as CharacterFlaw)
    : null;
}

/** Namen defensiv normalisieren. */
function normalizeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Satzende sicherstellen. */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?»"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Sätze zerlegen. */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// 1) Klimax- und Katharsis-Synthese
// ---------------------------------------------------------------------------

/**
 * Erzeugt Klimax und Katharsis.
 *
 * Die Klimax verknüpft die äußere Gefahr mit der inneren Wandlung: der Held
 * überwindet genau die Schwäche, die ihn bisher definiert hat. Die Katharsis
 * senkt die Intensität bewusst ab — Stille, Narben, erstes Licht.
 *
 * Defensiv: ohne Angaben entsteht ein vollständiges, generisches Finale.
 */
export function synthesizeClimax(options?: ClimaxOptions | null): ClimaxScene {
  const protagonist = normalizeName(options?.protagonist, 'Sie');
  const antagonist = normalizeName(options?.antagonist, 'der Gegner');
  const location = normalizeName(options?.location, 'an diesem Ort');
  const danger = typeof options?.danger === 'string' && options.danger.trim()
    ? options.danger.trim()
    : '';

  const requested = normalizeFlaw(options?.flaw);
  const rand = createSeededRandom(
    hashString(`${protagonist}#${antagonist}#${location}#${requested ?? 'auto'}`),
  );

  const flaw: CharacterFlaw =
    requested ??
    pick(['pride', 'fear', 'guilt', 'isolation', 'revenge'] as CharacterFlaw[], rand);

  const transformation = pick(TRANSFORMATIONS[flaw], rand).replace(
    /\{protagonist\}/g,
    protagonist,
  );

  // --- Klimax ---
  const climaxParts: string[] = [];
  climaxParts.push(ensurePeriod(`${location.charAt(0).toUpperCase()}${location.slice(1)}`));
  climaxParts.push(ensurePeriod(danger || pick(DANGER_TEMPLATES, rand)));
  climaxParts.push(ensurePeriod(pick(CLIMAX_BEATS, rand)));
  // Innere Wandlung im Entscheidungsmoment.
  climaxParts.push(ensurePeriod(transformation));
  climaxParts.push(ensurePeriod(pick(TRIUMPH_BEATS, rand)));
  const climax = climaxParts.join(' ');

  // --- Katharsis ---
  const catharsisParts: string[] = [];
  catharsisParts.push(ensurePeriod(pick(CATHARSIS_BEATS, rand)));
  catharsisParts.push(ensurePeriod(pick(PEACE_BEATS, rand)));
  if (antagonist !== 'der Gegner' && rand() < 0.5) {
    catharsisParts.push(ensurePeriod(`${antagonist} war nicht mehr da, und das war in Ordnung`));
  }
  const catharsis = catharsisParts.join(' ');

  const text = `${climax}\n\n${catharsis}`;

  // Intensitätskurve: Klimax hoch, Katharsis niedrig.
  const intensityCurve = buildIntensityCurve(climax, catharsis);

  return {
    climax,
    catharsis,
    text,
    flaw,
    flawLabel: FLAW_LABELS[flaw],
    transformation: ensurePeriod(transformation),
    wordCount: countWords(text),
    intensityCurve,
  };
}

/**
 * Baut die Intensitätskurve aus Klimax- und Katharsis-Sätzen.
 * Klimax-Sätze erhalten einen hohen Grundwert, Katharsis-Sätze einen niedrigen.
 */
function buildIntensityCurve(climax: string, catharsis: string): number[] {
  const climaxSentences = splitSentences(climax);
  const catharsisSentences = splitSentences(catharsis);

  const curve: number[] = [];

  climaxSentences.forEach((_s, i) => {
    // Innerhalb der Klimax bis zur Spitze ansteigen.
    const base = 0.55 + (i / Math.max(1, climaxSentences.length - 1)) * 0.4;
    curve.push(Math.round(Math.min(1, base) * 100) / 100);
  });

  catharsisSentences.forEach((_, i) => {
    // Katharsis fällt schnell ab und bleibt niedrig.
    const base = Math.max(0.1, 0.3 - i * 0.1);
    curve.push(Math.round(base * 100) / 100);
  });

  return curve;
}

// ---------------------------------------------------------------------------
// 2) Katharsis-Analyse
// ---------------------------------------------------------------------------

/**
 * Prüft, ob eine Intensitätskurve wohlgeformt ist.
 *
 * Ein gutes Finale hat eine ausgeprägte Spitze **und** einen deutlichen Abfall
 * danach. Fehlt der Abfall, wirkt die Katharsis überhastet.
 *
 * Defensiv: leerer Text liefert Nullen.
 */
export function analyzeCatharsis(text: unknown): CatharsisAnalysis {
  const empty: CatharsisAnalysis = {
    peak: 0,
    peakIndex: 0,
    ending: 0,
    resolutionDrop: 0,
    wellFormed: false,
  };

  if (typeof text !== 'string' || text.trim().length === 0) return empty;

  const sentences = splitSentences(text);
  if (sentences.length === 0) return empty;

  // Intensität je Satz heuristisch: Satzlänge und Signalwörter.
  const HIGH_SIGNALS = ['schlag', 'schuss', 'schrie', 'blut', 'riss', 'brannte', 'brach', 'schmerz'];
  const LOW_SIGNALS = ['still', 'licht', 'morgen', 'narben', 'atmete', 'frieden', 'vorbei', 'genug'];

  const intensities = sentences.map((s) => {
    const lower = s.toLowerCase();
    const high = HIGH_SIGNALS.filter((w) => lower.includes(w)).length;
    const low = LOW_SIGNALS.filter((w) => lower.includes(w)).length;
    const words = countWords(s);
    // Längere Sätze leicht intensiver, Signale dominieren.
    const base = 0.3 + Math.min(0.2, words / 100);
    const value = Math.max(0, Math.min(1, base + high * 0.2 - low * 0.15));
    return Math.round(value * 100) / 100;
  });

  const peak = Math.max(...intensities);
  const peakIndex = intensities.indexOf(peak);
  const ending = intensities[intensities.length - 1];

  // Abfall: Differenz zwischen Spitze und Ende, normiert.
  const resolutionDrop = Math.round(Math.max(0, peak - ending) * 10000) / 10000;

  // Wohlgeformt: deutliche Spitze (>=0.5) und deutlicher Abfall (>=0.2).
  const wellFormed = peak >= 0.5 && resolutionDrop >= 0.2 && peakIndex < intensities.length - 1;

  return { peak, peakIndex, ending, resolutionDrop, wellFormed };
}

// ---------------------------------------------------------------------------
// 3) Schwächen-Erkennung
// ---------------------------------------------------------------------------

/**
 * Findet die fatale Charakterschwäche in einem Text.
 *
 * Defensiv: leerer/ungültiger Text liefert `flaw: null`.
 */
export function extractCharacterFlaw(text: unknown): FlawFinding {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { flaw: null, label: null, signals: [] };
  }

  const lower = text.toLowerCase();
  const all: CharacterFlaw[] = ['pride', 'fear', 'guilt', 'isolation', 'revenge'];

  let best: { flaw: CharacterFlaw; signals: string[] } | null = null;
  for (const flaw of all) {
    const signals = FLAW_SIGNALS[flaw].filter((s) => lower.includes(s));
    if (signals.length > 0 && (!best || signals.length > best.signals.length)) {
      best = { flaw, signals };
    }
  }

  if (!best) return { flaw: null, label: null, signals: [] };
  return { flaw: best.flaw, label: FLAW_LABELS[best.flaw], signals: best.signals };
}
