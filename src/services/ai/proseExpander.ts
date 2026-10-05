// Beat-zu-Prosa-Expander (WP 54.1 — „Show, Don't Tell")
//
// Verwandelt kurze Handlungsstriche (Beats) in ausformulierte Szenenprosa.
// Drei deterministische Werkzeuge:
//
//   1. expandBeats       — Beat-Liste → Fließtext (Pacing-gesteuert)
//   2. showDontTell      — abstrakte Gefühlsaussagen → körperliche Reaktionen
//   3. analyzeTelling    — zählt verbleibende „Tell"-Stellen im Text
//
// Design-Regeln (analog editorialCouncil / stylisticTwin):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (Seeded PRNG, kein Math.random).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse
//     statt zu werfen.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Erzähltempo des Expanders. */
export type Pacing = 'atmospheric' | 'balanced' | 'staccato';

/** Optionales Autoren-Stilprofil (beeinflusst Satzlänge und Detailtiefe). */
export interface StyleProfile {
  /** Durchschnittliche Satzlänge in Wörtern (5–40). */
  avgSentenceLength?: number;
  /** Adjektivdichte 0–1. */
  adjectiveDensity?: number;
  /** Freitext-Tonfall, nur informativ. */
  tone?: string;
}

/** Optionen für die Beat-Expansion. */
export interface ExpandOptions {
  /** Erzähltempo. Default: 'balanced'. */
  pacing?: Pacing;
  /** Autoren-Stilprofil. */
  styleProfile?: StyleProfile | null;
  /** Erzählperspektive, z. B. 'er' | 'sie' | 'ich'. */
  pov?: string;
}

/** Ergebnis der Beat-Expansion. */
export interface ExpandedProse {
  /** Der vollständige Fließtext (Absätze mit Leerzeile getrennt). */
  text: string;
  /** Ein Absatz je Beat (in Eingabe-Reihenfolge). */
  paragraphs: string[];
  /** Anzahl verarbeiteter Beats. */
  beatCount: number;
  /** Wortzahl des erzeugten Texts. */
  wordCount: number;
  /** Tatsächlich verwendetes Tempo. */
  pacing: Pacing;
  /** Anzahl eingebauter Sinnesanker. */
  sensoryAnchors: number;
  /** Anzahl durch „Show, Don't Tell" ersetzter Stellen. */
  shownCount: number;
}

/** Eine einzelne Tell→Show-Ersetzung. */
export interface ShowReplacement {
  /** Die erkannte abstrakte Aussage (Original). */
  tell: string;
  /** Das benannte Gefühl. */
  emotion: string;
  /** Die körperlichen Ersatzreaktionen. */
  reactions: string[];
}

/** Ergebnis von showDontTell. */
export interface ShowDontTellResult {
  /** Text mit ersetzten Tell-Stellen. */
  text: string;
  /** Anzahl der Ersetzungen. */
  replaced: number;
  /** Details zu jeder Ersetzung. */
  replacements: ShowReplacement[];
}

/** Ergebnis von analyzeTelling. */
export interface TellingAnalysis {
  /** Anzahl erkannter Tell-Stellen im Text. */
  tellCount: number;
  /** Verhältnis Tell-Stellen zu Sätzen (0–1). */
  tellRatio: number;
  /** Die gefundenen Tell-Phrasen (dedupliziert, in Fundreihenfolge). */
  tells: string[];
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall (FNV-1a + mulberry32, wie readerChoicePlaytester)
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

/** Deterministische Auswahl aus einem Array (nie leer bei leerem Input). */
function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Tell → Show-Tabelle
// ---------------------------------------------------------------------------

interface TellRule {
  /** Erkennungsmuster (global, case-insensitive). */
  pattern: RegExp;
  /** Benanntes Gefühl. */
  emotion: string;
  /** Körperliche Reaktionen, die das Gefühl ersetzbar machen. */
  reactions: readonly string[];
}

/**
 * Tabelle abstrakter Gefühlsaussagen → körperlich spürbare Reaktionen.
 * Reihenfolge ist bindend (längere/spezifischere Muster zuerst), damit
 * z. B. „Todesangst" nicht von „Angst" verschluckt wird.
 */
const TELL_RULES: readonly TellRule[] = [
  {
    pattern: /\b(er|sie|ich)\s+(hatte|hatten|habe)\s+Todesangst\b/gi,
    emotion: 'Todesangst',
    reactions: [
      'Kalter Schweiß lief ihm den Nacken hinab',
      'Ein Engegefühl schnürte die Brust zusammen',
      'Der Finger am Abzug zitterte',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+wütend\b/gi,
    emotion: 'Wut',
    reactions: [
      'Die Kiefermuskeln mahlten',
      'Die Fäuste ballten sich, bis die Knöchel weiß hervortraten',
      'Die Stimme sank eine Oktave tiefer',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+traurig\b/gi,
    emotion: 'Trauer',
    reactions: [
      'Der Blick sank zu Boden und blieb dort',
      'Die Schultern sackten nach vorn',
      'Ein brennendes Ziehen stieg hinter die Augen',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+nervös\b/gi,
    emotion: 'Nervosität',
    reactions: [
      'Die Finger trommelten auf der Tischkante',
      'Der Fuß wippte in kurzen, unruhigen Stößen',
      'Der Atem ging flacher als gewollt',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+erleichtert\b/gi,
    emotion: 'Erleichterung',
    reactions: [
      'Die Schultern sanken um Zentimeter',
      'Ein langer Atem entwich zwischen den Zähnen',
      'Die Anspannung fiel aus dem Nacken wie eine gelöste Schraube',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+müde\b/gi,
    emotion: 'Müdigkeit',
    reactions: [
      'Die Lider wurden bleiern schwer',
      'Ein Gähnen stieg auf, das sich nicht mehr unterdrücken ließ',
      'Die Beine trugen wie unter Wasser',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(hatte|hatten|habe)\s+Angst\b/gi,
    emotion: 'Angst',
    reactions: [
      'Die Kehle wurde trocken und eng',
      'Die Hände suchten nach einem Halt, der nicht da war',
      'Jedes Geräusch schien doppelt so laut',
    ],
  },
  {
    pattern: /\b(er|sie|ich)\s+(war|waren|bin)\s+glücklich\b/gi,
    emotion: 'Glück',
    reactions: [
      'Die Mundwinkel zogen sich nach oben, ohne dass es jemand befahl',
      'Ein warmes Kribbeln breitete sich im Brustkorb aus',
      'Die Schritte wurden leicht und schnell',
    ],
  },
];

// ---------------------------------------------------------------------------
// Sinnes- und Detailbausteine
// ---------------------------------------------------------------------------

/** Sinnesanker je Sinneskategorie (deterministische Auswahl). */
const SENSORY_BANK: readonly string[] = [
  'Der Geruch von verbranntem Diesel hing in der Luft',
  'Ein eisiger Wind pfiff durch die Ritzen',
  'Der Geschmack von Kupfer lag auf der Zunge',
  'Staub legte sich auf die Lippen und knirschte',
  'Irgendwo tropfte Wasser in gleichmäßigem Takt',
  'Das Licht brach sich in Scherben auf dem Boden',
  'Ferngeräusche drangen dumpf durch die Wände',
  'Die Luft schmeckte nach altem Papier und Rauch',
];

/** Atmosphärische Zwischensätze (nur beim Zeitlupen-Tempo). */
const ATMOSPHERIC_FILLERS: readonly string[] = [
  'Einen Herzschlag lang bewegte sich nichts',
  'Die Stille dazwischen war dichter als der Lärm',
  'Die Zeit schien sich zu dehnen',
  'Alles andere trat für einen Moment zurück',
];

/** Kurze, harte Verben für das Stakkato-Tempo. */
const STACCATO_VERBS: readonly string[] = [
  'Ein Satz.',
  'Dann Stille.',
  'Kein Zurück.',
  'Dann der Knall.',
  'Kein Ausweg.',
  'Nur noch Tempo.',
];

/** Standard-Satzlänge je Tempo (Wörter). */
const PACING_SENTENCE_LENGTH: Record<Pacing, number> = {
  atmospheric: 18,
  balanced: 13,
  staccato: 7,
};

/** Anzahl erzeugter Sätze je Beat und Tempo. */
const PACING_SENTENCE_COUNT: Record<Pacing, number> = {
  atmospheric: 5,
  balanced: 3,
  staccato: 2,
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Gültiges Tempo erzwingen (Fallback: balanced). */
function normalizePacing(value: unknown): Pacing {
  return value === 'atmospheric' || value === 'balanced' || value === 'staccato'
    ? value
    : 'balanced';
}

/** Beat-Liste defensiv normalisieren (Strings, getrimmt, ohne Leere). */
function normalizeBeats(beats: unknown): string[] {
  if (!Array.isArray(beats)) return [];
  return beats
    .filter((b): b is string => typeof b === 'string')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/** Satzlänge auf sinnvollen Bereich begrenzen. */
function clampSentenceLength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(40, Math.max(5, Math.round(value)));
}

/** Wortzahl eines Texts. */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Ersten Buchstaben groß schreiben (restliche Schreibweise erhalten). */
function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Satzenden sicherstellen. */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Zielt auf die gewünschte Satzlänge: verlängert knappe Sätze mit
 * Detail-Anhängen, kürzt überlange am Komma.
 */
function shapeSentence(sentence: string, targetLength: number): string {
  const base = ensurePeriod(sentence);
  const words = countWords(base);
  if (words === 0) return '';
  if (words > targetLength) {
    // Am letzten Komma abschneiden, wenn dadurch nicht zu kurz.
    const parts = base.split(',');
    if (parts.length > 1) {
      const head = ensurePeriod(parts[0].trim());
      if (countWords(head) >= Math.max(4, targetLength - 4)) return head;
    }
    return base;
  }
  return base;
}

// ---------------------------------------------------------------------------
// 1) Beat-Expansion
// ---------------------------------------------------------------------------

/**
 * Expandiert eine Beat-Liste zu Fließtext.
 *
 * Jeder Beat wird zu einem Absatz. Das Tempo steuert Satzanzahl und -länge,
 * das optionale Stilprofil überschreibt die tempo-typische Satzlänge.
 * Sinnesanker werden deterministisch aus dem Beat-Hash gezogen; das Ergebnis
 * ist bei gleichem Input immer identisch.
 *
 * Defensiv: leere/ungültige Beat-Listen liefern einen leeren Text.
 */
export function expandBeats(beats: unknown, options?: ExpandOptions): ExpandedProse {
  const list = normalizeBeats(beats);
  const pacing = normalizePacing(options?.pacing);
  const styleLength =
    options?.styleProfile && typeof options.styleProfile.avgSentenceLength === 'number'
      ? clampSentenceLength(options.styleProfile.avgSentenceLength)
      : 0;
  const targetLength = styleLength > 0 ? styleLength : PACING_SENTENCE_LENGTH[pacing];
  const sentenceCount = PACING_SENTENCE_COUNT[pacing];

  if (list.length === 0) {
    return {
      text: '',
      paragraphs: [],
      beatCount: 0,
      wordCount: 0,
      pacing,
      sensoryAnchors: 0,
      shownCount: 0,
    };
  }

  const rand = createSeededRandom(hashString(`${list.join('|')}#${pacing}#${targetLength}`));
  let sensoryAnchors = 0;
  let shownCount = 0;

  const paragraphs = list.map((beat, index) => {
    // Beat zu einem sauberen Startsatz formen.
    const opening = shapeSentence(capitalize(beat), targetLength);
    const sentences: string[] = [opening];

    // Beim Zeitlupen-Tempo einen atmosphärischen Zwischensatz einweben.
    if (pacing === 'atmospheric' && sentences.length < sentenceCount) {
      sentences.push(ensurePeriod(pick(ATMOSPHERIC_FILLERS, rand)));
    }

    // Sinnesanker einbauen (mindestens einer pro Absatz).
    const anchorCount = pacing === 'staccato' ? 1 : 2;
    for (let i = 0; i < anchorCount; i++) {
      sentences.push(ensurePeriod(pick(SENSORY_BANK, rand)));
      sensoryAnchors++;
    }

    // Stakkato: harte Kurzsätze statt langer Beschreibung.
    if (pacing === 'staccato') {
      sentences.push(pick(STACCATO_VERBS, rand));
    } else {
      // Auffüllen bis zur tempo-typischen Satzanzahl.
      while (sentences.length < sentenceCount) {
        sentences.push(ensurePeriod(pick(SENSORY_BANK, rand)));
        sensoryAnchors++;
      }
    }

    // „Show, Don't Tell" auf jeden erzeugten Absatz anwenden.
    const raw = sentences.join(' ');
    const shown = showDontTell(raw);
    shownCount += shown.replaced;

    // Optionaler Perspektiv-Hinweis als eigener Nachsatz (nur informativ).
    void index;
    return shown.text;
  });

  const text = paragraphs.join('\n\n');

  return {
    text,
    paragraphs,
    beatCount: list.length,
    wordCount: countWords(text),
    pacing,
    sensoryAnchors,
    shownCount,
  };
}

// ---------------------------------------------------------------------------
// 2) Show, Don't Tell
// ---------------------------------------------------------------------------

/**
 * Ersetzt abstrakte Gefühlsaussagen durch körperlich spürbare Reaktionen.
 *
 * „Er hatte Todesangst" → „Kalter Schweiß lief ihm den Nacken hinab. Ein
 * Engegefühl schnürte die Brust zusammen. Der Finger am Abzug zitterte."
 *
 * Defensiv: leerer/ungültiger Text wird unverändert zurückgegeben.
 */
export function showDontTell(text: unknown): ShowDontTellResult {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: typeof text === 'string' ? text : '', replaced: 0, replacements: [] };
  }

  let result = text;
  const replacements: ShowReplacement[] = [];

  for (const rule of TELL_RULES) {
    // Frische Regex-Instanz: lastIndex darf nicht zwischen Aufrufen lecken.
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (!pattern.test(result)) continue;

    result = result.replace(pattern, () => {
      replacements.push({
        tell: rule.emotion,
        emotion: rule.emotion,
        reactions: [...rule.reactions],
      });
      return rule.reactions.map((r) => ensurePeriod(r)).join(' ');
    });
  }

  return { text: result, replaced: replacements.length, replacements };
}

// ---------------------------------------------------------------------------
// 3) Telling-Analyse
// ---------------------------------------------------------------------------

/**
 * Zählt verbleibende „Tell"-Stellen (abstrakte Gefühlsaussagen) in einem Text.
 *
 * `tellRatio` setzt sie ins Verhältnis zur Satzanzahl. Defensiv: leerer Text
 * liefert Nullen.
 */
export function analyzeTelling(text: unknown): TellingAnalysis {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { tellCount: 0, tellRatio: 0, tells: [] };
  }

  const tells: string[] = [];
  let tellCount = 0;

  for (const rule of TELL_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      tellCount += matches.length;
      if (!tells.includes(rule.emotion)) tells.push(rule.emotion);
    }
  }

  const sentenceCount = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const tellRatio = sentenceCount > 0 ? Math.round((tellCount / sentenceCount) * 10000) / 10000 : 0;

  return { tellCount, tellRatio, tells };
}
