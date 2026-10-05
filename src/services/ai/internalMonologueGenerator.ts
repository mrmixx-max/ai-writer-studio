// Deep POV & Innerer Monolog (WP 57.1)
//
// Erzeugt erlebte Rede (Free Indirect Discourse): der Erzähler verschmilzt mit
// dem unmittelbaren Gedankenstrom einer Figur — ohne distanziertes „dachte er
// bei sich". Drei psychologische Zustände mit je eigenem Rhythmus.
//
// Drei deterministische Werkzeuge:
//
//   1. generateInternalMonologue — Zustand → Gedankenstrom
//   2. analyzeMonologueDepth     — wie tief ist der POV eines Texts?
//   3. stripThoughtTags          — distanzierende Marker entfernen (Deep-POV-Fix)
//
// Design-Regeln (analog proseExpander):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Psychologischer Zustand der Figur. */
export type MentalState = 'panic' | 'calculation' | 'grief';

/** Optionen für den Monolog-Generator. */
export interface MonologueOptions {
  /** Name der Figur (optional, für den Kontext). */
  character?: string;
  /** Situation/Auslöser, z. B. „im brennenden Haus". */
  situation?: string;
  /** Anzahl der Gedankenfragmente (3–14). Default: 7. */
  fragments?: number;
  /** Erlebte Rede statt Ich-Form (entfernt „ich dachte"). Default: true. */
  freeIndirect?: boolean;
}

/** Ergebnis des Monolog-Generators. */
export interface InternalMonologue {
  /** Der Gedankenstrom als Text. */
  text: string;
  /** Einzelne Gedankenfragmente. */
  fragments: string[];
  /** Verwendeter Zustand. */
  state: MentalState;
  /** Anzahl der Fragmente. */
  fragmentCount: number;
  /** Durchschnittliche Fragmentlänge in Wörtern. */
  avgFragmentLength: number;
  /** Anzahl distanzierender Marker (sollte 0 sein). */
  distancingMarkers: number;
}

/** Ergebnis der POV-Tiefenanalyse. */
export interface MonologueDepth {
  /** Tiefe 0–1 (hoch = unmittelbar, ohne Distanz). */
  depth: number;
  /** Gefundene distanzierende Marker. */
  distancingMarkers: string[];
  /** Anzahl der Fragmentsätze. */
  fragmentCount: number;
  /** Anteil sehr kurzer Fragmente (< 4 Wörter) — Maß für Fragmentierung. */
  fragmentationRatio: number;
  /** Erkannte sensorische Reize. */
  sensoryHits: number;
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
// Zustands-Bausteine
// ---------------------------------------------------------------------------

/** Zustands-Beschreibungen (Menschenlesbar). */
export const STATE_LABELS: Record<MentalState, string> = {
  panic: 'Rasende Panik',
  calculation: 'Kühle Berechnung',
  grief: 'Trauer & Betäubung',
};

/** Kurze, fragmentierte Ausrufe (Panik). */
const PANIC_FRAGMENTS: readonly string[] = [
  'Zu schnell.',
  'Kein Ausweg.',
  'Nicht jetzt.',
  'Atmen. Atmen.',
  'Wo?',
  'Hinter mir.',
  'Nicht hinsehen.',
  'Raus hier.',
  'Bewegen.',
  'Zu viele.',
];

/** Analytische Beobachtungen (Berechnung). */
const CALCULATION_FRAGMENTS: readonly string[] = [
  'Zwei Ausgänge, einer blockiert',
  'Die Hand am Gürtel verrät ihn',
  'Sechs Schritte bis zur Tür',
  'Der Winkel ist falsch',
  'Er zögert, bevor er links antwortet',
  'Erst abwarten, dann handeln',
  'Der Boden trägt, die Wand nicht',
  'Drei Sekunden, dann muss es sitzen',
  'Er weiß es. Er weiß es nicht.',
  'Die Reihenfolge ist entscheidend',
];

/** Gedämpfte, fixierte Beobachtungen (Trauer). */
const GRIEF_FRAGMENTS: readonly string[] = [
  'Der Stuhl steht noch schief',
  'Jemand hat die Tasse nicht ausgetrunken',
  'Das Licht ist zu hell für heute',
  'Seine Jacke hängt am Haken',
  'Die Uhr tickt weiter, als wäre nichts',
  'Sie hätte den Mantel mitnehmen sollen',
  'Der Staub auf dem Regal',
  'Das Fenster war nie ganz dicht',
  'Es riecht noch nach ihm',
  'Morgen ist auch ein Tag',
];

/** Sensorische Überreizung (Panik). */
const PANIC_SENSES: readonly string[] = [
  'Der Puls im Hals',
  'Alles zu laut',
  'Die Sicht verschwimmt an den Rändern',
  'Die Hände sind kalt',
  'Der Boden schwankt',
];

/** Sensorische Details (Berechnung). */
const CALCULATION_SENSES: readonly string[] = [
  'Der Geruch von Öl',
  'Ein Klicken links',
  'Der Wind dreht',
  'Der Boden knarrt an der dritten Diele',
  'Sein Atem geht zu schnell',
];

/** Gedämpfte Sinneseindrücke (Trauer). */
const GRIEF_SENSES: readonly string[] = [
  'Das Ticken der Uhr',
  'Der Geruch von altem Papier',
  'Kaltes Licht auf dem Tisch',
  'Ein Flugzeug irgendwo weit oben',
  'Das Rascheln der Vorhänge',
];

/**
 * Distanzierende Marker, die Deep POV zerstören — als Regex-Quellen, damit
 * Pronomen-Varianten („er dachte" / „dachte an sie" / „fragte sich") alle
 * greifen. Das `id`-Feld ist die menschenlesbare Bezeichnung.
 */
const DISTANCING_MARKERS: readonly { id: string; pattern: string }[] = [
  { id: 'dachte', pattern: '\\b(dachte|dachten|denke ich)\\b' },
  { id: 'fragte sich', pattern: '\\b(fragte|fragten|frage ich)\\s+(?:sie|er|es|ich|man)?\\s*sich\\b' },
  { id: 'fühlte', pattern: '\\b(fühlte|fühlten)\\b' },
  { id: 'spürte', pattern: '\\b(spürte|spürten)\\b' },
  { id: 'bemerkte', pattern: '\\b(bemerkte|bemerkten|merkte|merkten)\\b' },
  { id: 'wurde klar', pattern: '\\b(wurde|ward)\\s+(ihm|ihr|mir)\\s+(klar|bewusst)\\b' },
  { id: 'bei sich', pattern: '\\b(bei sich|in Gedanken|im Stillen)\\b' },
];

/** Sensorische Signalwörter (für die Analyse). */
const SENSORY_SIGNALS: readonly string[] = [
  'geruch', 'ticken', 'kalt', 'laut', 'puls', 'licht', 'boden', 'wind',
  'raschel', 'atem', 'schmeckt', 'klingt', 'sieht', 'hört', 'fühlt',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zustand defensiv prüfen. */
function normalizeState(value: unknown): MentalState {
  return value === 'panic' || value === 'calculation' || value === 'grief' ? value : 'calculation';
}

/** Fragmentzahl auf sinnvollen Bereich begrenzen. */
function normalizeFragments(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 7;
  return Math.min(14, Math.max(3, Math.round(value)));
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Fragmente eines Texts (Zeilen oder Sätze). */
function splitFragments(text: string): string[] {
  const byLine = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (byLine.length > 1) return byLine;
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Zählt distanzierende Marker im Text. */
function countDistancingMarkers(text: string): { count: number; found: string[] } {
  const found: string[] = [];
  let count = 0;
  for (const marker of DISTANCING_MARKERS) {
    const hits = (text.match(new RegExp(marker.pattern, 'gi')) ?? []).length;
    if (hits > 0) {
      found.push(marker.id);
      count += hits;
    }
  }
  return { count, found };
}

// ---------------------------------------------------------------------------
// 1) Monolog-Generator
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen inneren Monolog in erlebter Rede.
 *
 * Der Zustand bestimmt Rhythmus und Inhalt:
 *   - `panic`       — kurze, abgehackte Fragmente und sensorische Überreizung,
 *   - `calculation` — analytische Beobachtungen und taktische Optionen,
 *   - `grief`       — gedämpfte Außenwelt, Fixierung auf Nebensächliches.
 *
 * In erlebter Rede (Standard) entfallen distanzierende Marker wie „dachte er"
 * vollständig — die Gedanken stehen unmittelbar im Text.
 *
 * Defensiv: ungültige Zustände fallen auf `calculation` zurück.
 */
export function generateInternalMonologue(
  state?: MentalState,
  options?: MonologueOptions | null,
): InternalMonologue {
  const mentalState = normalizeState(state);
  const fragmentTarget = normalizeFragments(options?.fragments);
  const situation = typeof options?.situation === 'string' ? options.situation.trim() : '';
  const freeIndirect = options?.freeIndirect !== false;

  const rand = createSeededRandom(
    hashString(`${mentalState}#${situation}#${fragmentTarget}#${options?.character ?? ''}`),
  );

  const pool =
    mentalState === 'panic'
      ? PANIC_FRAGMENTS
      : mentalState === 'grief'
        ? GRIEF_FRAGMENTS
        : CALCULATION_FRAGMENTS;

  const senses =
    mentalState === 'panic'
      ? PANIC_SENSES
      : mentalState === 'grief'
        ? GRIEF_SENSES
        : CALCULATION_SENSES;

  const fragments: string[] = [];

  // Situation als erster Gedanke, wenn angegeben.
  if (situation) {
    fragments.push(freeIndirect ? `${situation}.` : `Ich denke an ${situation}.`);
  }

  const usedPool = new Set<string>();
  let guard = 0;
  while (fragments.length < fragmentTarget && guard < fragmentTarget * 4) {
    guard++;
    const roll = rand();
    // Etwa jedes dritte Fragment ist ein Sinneseindruck.
    if (roll < 0.33) {
      fragments.push(`${pick(senses, rand)}.`);
    } else {
      const line = pick(pool, rand);
      if (usedPool.has(line) && usedPool.size < pool.length) continue;
      usedPool.add(line);
      fragments.push(line.endsWith('.') ? line : `${line}.`);
    }
  }

  // Auf die Zielzahl kürzen, falls die Situation eins vorweggenommen hat.
  const finalFragments = fragments.slice(0, Math.max(1, fragmentTarget));
  const text = finalFragments.join(' ');

  const distancing = freeIndirect ? { count: 0 } : countDistancingMarkers(text);

  return {
    text,
    fragments: finalFragments,
    state: mentalState,
    fragmentCount: finalFragments.length,
    avgFragmentLength:
      finalFragments.length > 0
        ? Math.round((countWords(text) / finalFragments.length) * 100) / 100
        : 0,
    distancingMarkers: distancing.count,
  };
}

// ---------------------------------------------------------------------------
// 2) POV-Tiefenanalyse
// ---------------------------------------------------------------------------

/**
 * Misst, wie tief der POV eines Texts ist.
 *
 * `depth` sinkt mit jedem distanzierenden Marker und steigt mit
 * Fragmentierung und sensorischen Reizen. Defensiv: leerer Text → depth 0.
 */
export function analyzeMonologueDepth(text: unknown): MonologueDepth {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      depth: 0,
      distancingMarkers: [],
      fragmentCount: 0,
      fragmentationRatio: 0,
      sensoryHits: 0,
    };
  }

  const fragments = splitFragments(text);
  const lengths = fragments.map(countWords);
  const shortCount = lengths.filter((l) => l < 4).length;
  const fragmentationRatio =
    lengths.length > 0 ? Math.round((shortCount / lengths.length) * 10000) / 10000 : 0;

  const lower = text.toLowerCase();
  const sensoryHits = SENSORY_SIGNALS.filter((s) => lower.includes(s)).length;

  const distancing = countDistancingMarkers(text);

  // Tiefe: Ausgangspunkt 1, Abzug je Marker, Bonus für Fragmentierung/Sensorik.
  const markerPenalty = Math.min(0.6, distancing.count * 0.15);
  const fragmentBonus = Math.min(0.25, fragmentationRatio * 0.35);
  const sensoryBonus = Math.min(0.25, sensoryHits * 0.05);
  const depth = Math.round(Math.max(0, Math.min(1, 1 - markerPenalty + fragmentBonus + sensoryBonus)) * 10000) / 10000;

  return {
    depth,
    distancingMarkers: distancing.found,
    fragmentCount: fragments.length,
    fragmentationRatio,
    sensoryHits,
  };
}

// ---------------------------------------------------------------------------
// 3) Deep-POV-Fix
// ---------------------------------------------------------------------------

/**
 * Entfernt distanzierende Marker aus einem Text (Deep-POV-Bereinigung).
 *
 * „Er wusste, dass es zu spät war", dachte er. → „Er wusste, dass es zu spät
 * war." Die Gedanken bleiben, die Distanz fällt.
 *
 * Defensiv: leerer/ungültiger Text wird unverändert zurückgegeben.
 */
export function stripThoughtTags(text: unknown): { text: string; removed: number } {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: typeof text === 'string' ? text : '', removed: 0 };
  }

  let result = text;
  let removed = 0;

  for (const marker of DISTANCING_MARKERS) {
    // Marker mit optional vorangehendem Komma und umgebenden Leerzeichen.
    const pattern = new RegExp(`[,;]?\\s*${marker.pattern}`, 'gi');
    const hits = (result.match(pattern) ?? []).length;
    if (hits > 0) {
      result = result.replace(pattern, '');
      removed += hits;
    }
  }

  // Aufräumen: doppelte Leerzeichen, verwaiste Satzzeichen.
  result = result
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.!?,;])/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*\./g, '.')
    .trim();

  return { text: result, removed };
}
