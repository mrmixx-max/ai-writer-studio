// Literarischer Stil-Transmuter & Tonfall-Shifter (WP 55.2)
//
// Überträgt einen Text in eine andere literarische Tonalität, ohne den
// Handlungsverlauf zu verändern: Figuren, Aktionen und Dialogbedeutungen
// bleiben erhalten, nur die Oberfläche (Wortwahl, Satzbau, Rhythmus) wandelt
// sich.
//
// Drei deterministische Werkzeuge:
//
//   1. transmuteStyle    — Text → Text im Zielstil
//   2. verifyContentPreserved — prüft, ob Figuren/Aktionen erhalten blieben
//   3. compareStyles     — Stilometrischer Vergleich zweier Texte
//
// Design-Regeln (analog proseExpander / stylisticTwin):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Inhalts-Garantie: Eigennamen und Zahlen werden nie verändert.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Unterstützte Stil-Presets. */
export type StylePreset = 'hardboiled' | 'gothic' | 'epic-fantasy' | 'hemingway';

/** Ein Stil-Preset mit seinen Ersetzungsregeln. */
export interface StyleDefinition {
  /** Preset-Kennung. */
  id: StylePreset;
  /** Menschenlesbarer Name. */
  label: string;
  /** Kurzbeschreibung. */
  description: string;
  /** Ziel-Satzlänge in Wörtern. */
  targetSentenceLength: number;
}

/** Ergebnis einer Stil-Transmutation. */
export interface TransmutedText {
  /** Der umgeschriebene Text. */
  text: string;
  /** Verwendeter Stil. */
  style: StylePreset;
  /** Anzahl vorgenommener Wortersetzungen. */
  substitutions: number;
  /** Anzahl umgebauter Sätze. */
  rewrittenSentences: number;
  /** Wortzahl vor der Wandlung. */
  originalWordCount: number;
  /** Wortzahl nach der Wandlung. */
  wordCount: number;
}

/** Ergebnis der Inhaltsprüfung. */
export interface ContentPreservation {
  /** Im Original gefundene Eigennamen. */
  names: string[];
  /** Im Ergebnis fehlende Eigennamen (sollte leer sein). */
  missingNames: string[];
  /** true, wenn alle Namen und Zahlen erhalten blieben. */
  preserved: boolean;
  /** Erhaltungsquote 0–1. */
  preservationRate: number;
}

/** Stilometrisches Profil eines Texts. */
export interface StyleMetrics {
  /** Anzahl Sätze. */
  sentenceCount: number;
  /** Durchschnittliche Satzlänge in Wörtern. */
  avgSentenceLength: number;
  /** Anteil langer Wörter (≥ 8 Zeichen). */
  longWordRatio: number;
  /** Anzahl Adjektiv-Verdachtsfälle (grobe Heuristik). */
  adjectiveCount: number;
  /** Verhältnis Wörter zu Sätzen (Textdichte). */
  density: number;
}

/** Ergebnis des Stilvergleichs. */
export interface StyleComparison {
  /** Profil des ersten Texts. */
  a: StyleMetrics;
  /** Profil des zweiten Texts. */
  b: StyleMetrics;
  /** Wie stark sich beide unterscheiden (0 = identisch). */
  divergence: number;
}

// ---------------------------------------------------------------------------
// Stil-Definitionen
// ---------------------------------------------------------------------------

/** Die vier Stil-Presets. */
export const STYLE_PRESETS: readonly StyleDefinition[] = [
  {
    id: 'hardboiled',
    label: 'Hardboiled Noir',
    description: 'Lakonischer Zynismus, Schatten, Regen, scharfe Vergleiche.',
    targetSentenceLength: 10,
  },
  {
    id: 'gothic',
    label: 'Gothic Horror',
    description: 'Düstere Opulenz, Verfall, psychologische Beklemmung.',
    targetSentenceLength: 24,
  },
  {
    id: 'epic-fantasy',
    label: 'Epische High Fantasy',
    description: 'Archaischer Wortschatz, feierliche Satzbauten, mythologisches Gewicht.',
    targetSentenceLength: 22,
  },
  {
    id: 'hemingway',
    label: 'Hemingway-Minimalismus',
    description: 'Kurze Hauptsätze, Verzicht auf unnötige Adjektive, nackte Wahrheit.',
    targetSentenceLength: 8,
  },
];

/**
 * Wortersetzungen je Stil. Schlüssel ist das Wort im Original (klein), Wert
 * ist die stilgerechte Alternative. Die Schlüssel sind bewusst gewöhnliche
 * Wörter, deren Wahl den Inhalt nicht verändert.
 */
const STYLE_LEXICON: Record<StylePreset, Record<string, string>> = {
  hardboiled: {
    ging: 'schlenderte',
    gehen: 'schlendern',
    sagte: 'knurrte',
    sagen: 'knurren',
    sah: 'muste',
    sehen: 'mustern',
    groß: 'verdammt groß',
    sehr: 'reichlich',
    regen: 'Schmutzregen',
    dunkel: 'stockdunkel',
    'er war': 'der Kerl war',
  },
  gothic: {
    ging: 'wandelte',
    gehen: 'wandeln',
    sagte: 'hauchte',
    sagen: 'hauchen',
    sah: 'erblicke',
    sehen: 'erblicken',
    groß: 'unermesslich',
    sehr: 'auf unheimliche Weise',
    regen: 'ein kalter, klagender Regen',
    dunkel: 'von undurchdringlicher Schwärze',
    alt: 'uralt und dem Verfall geweiht',
  },
  'epic-fantasy': {
    ging: 'schritt',
    gehen: 'schreiten',
    sagte: 'sprach',
    sagen: 'sprechen',
    sah: 'erblicke',
    sehen: 'erblicken',
    groß: 'gewaltig',
    sehr: 'in hohem Maße',
    regen: 'der Regen der Urzeit',
    alt: 'alt wie die Berge',
    stark: 'von uralter Stärke',
  },
  hemingway: {
    ging: 'ging',
    sagte: 'sagte',
    sehr: '',
    wirklich: '',
    eigentlich: '',
    irgendwie: '',
    groß: 'groß',
    regen: 'Regen',
    dunkel: 'dunkel',
  },
};

/** Füllwörter, die der Minimalismus entfernt. */
const FILLER_WORDS: readonly string[] = [
  'eigentlich',
  'grundsätzlich',
  'sozusagen',
  'gewissermaßen',
  'irgendwie',
  'wirklich',
  'ziemlich',
  'recht',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Stil defensiv prüfen (Fallback: hardboiled). */
function normalizeStyle(value: unknown): StylePreset {
  const ids: StylePreset[] = ['hardboiled', 'gothic', 'epic-fantasy', 'hemingway'];
  return typeof value === 'string' && (ids as string[]).includes(value)
    ? (value as StylePreset)
    : 'hardboiled';
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Sätze zerlegen (Satzzeichen bleiben am Satz). */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Eigennamen heuristisch finden: großgeschriebene Wörter, die keine gängigen
 * Satzstarter oder Funktionswörter sind.
 *
 * Auch das erste Wort eines Satzes wird geprüft: für die Inhalts-Garantie ist
 * ein zusätzlicher Kandidat unschädlich (er muss im Zieltext ebenfalls
 * vorkommen), ein übersehener Eigenname dagegen nicht.
 */
function extractProperNames(text: string): string[] {
  if (typeof text !== 'string' || !text) return [];
  const names = new Set<string>();
  const words = text.split(/\s+/);

  const STOPWORDS = new Set([
    'Der', 'Die', 'Das', 'Ein', 'Eine', 'Einen', 'Einem', 'Eines',
    'Und', 'Aber', 'Dann', 'Er', 'Sie', 'Es', 'Ich', 'Wir', 'Ihr',
    'Als', 'Wenn', 'Weil', 'Doch', 'Nur', 'Auch', 'Noch', 'Hier', 'Dort',
  ]);

  words.forEach((raw) => {
    const word = raw.replace(/[^A-Za-zÄÖÜäöüß-]/g, '');
    if (word.length < 2) return;
    // Nur großgeschriebene Wörter sind Kandidaten.
    if (!/^[A-ZÄÖÜ]/.test(word)) return;
    if (STOPWORDS.has(word)) return;
    // Ein Wort, das direkt auf ein Satzende folgt, beginnt nur einen Satz.
    names.add(word);
  });

  return [...names];
}

/** Zahlen im Text finden (Ziffernfolgen). */
function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+/g);
  return matches ? [...new Set(matches)] : [];
}

// ---------------------------------------------------------------------------
// 1) Stil-Transmutation
// ---------------------------------------------------------------------------

/**
 * Schreibt einen Text in den Zielstil um.
 *
 * Inhalts-Garantie: Eigennamen und Zahlen werden nicht angetastet; die
 * Ersetzungen betreffen nur gewöhnliche Wörter und Satzbau.
 *
 * Defensiv: leerer/ungültiger Text wird unverändert zurückgegeben.
 */
export function transmuteStyle(text: unknown, style?: StylePreset): TransmutedText {
  const safe = typeof text === 'string' ? text : '';
  const target = normalizeStyle(style);

  if (!safe.trim()) {
    return {
      text: safe,
      style: target,
      substitutions: 0,
      rewrittenSentences: 0,
      originalWordCount: 0,
      wordCount: 0,
    };
  }

  const originalWordCount = countWords(safe);
  const lexicon = STYLE_LEXICON[target];

  // Eigennamen und Zahlen schützen, damit die Ersetzung sie nicht trifft.
  const protectedNames = extractProperNames(safe);

  let substitutions = 0;

  // Wortweise ersetzen (Wortgrenzen respektieren, Großschreibung erhalten).
  const substituted = safe.replace(/\b[A-Za-zÄÖÜäöüß]+\b/g, (match) => {
    const lower = match.toLowerCase();
    // Eigennamen nie anfassen.
    if (protectedNames.includes(match)) return match;
    const replacement = lexicon[lower];
    if (replacement === undefined) return match;

    substitutions++;
    if (replacement === '') return '';
    // Großschreibung am Satzanfang erhalten.
    return /^[A-ZÄÖÜ]/.test(match)
      ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
      : replacement;
  });

  // Mehrfache Leerzeichen nach entfernten Füllwörtern bereinigen.
  let result = substituted.replace(/\s{2,}/g, ' ').trim();

  // Füllwörter beim Minimalismus tilgen.
  let rewrittenSentences = 0;
  if (target === 'hemingway') {
    const before = result;
    for (const filler of FILLER_WORDS) {
      const pattern = new RegExp(`\\b${filler}\\b\\s*`, 'gi');
      result = result.replace(pattern, '');
    }
    result = result.replace(/\s{2,}/g, ' ').trim();
    if (result !== before) rewrittenSentences++;
  }

  // Satzbau an die Ziel-Satzlänge anpassen.
  const targetLength = (STYLE_PRESETS.find((s) => s.id === target) as StyleDefinition)
    .targetSentenceLength;
  const sentences = splitSentences(result);

  const reshaped = sentences.map((sentence) => {
    const words = countWords(sentence);
    if (words <= targetLength) return sentence;

    // Überlange Sätze am Komma teilen, wenn möglich.
    const parts = sentence.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length > 1 && words > targetLength) {
      rewrittenSentences++;
      return parts.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(' ');
    }
    return sentence;
  });

  result = reshaped.join(' ').replace(/\s{2,}/g, ' ').trim();
  // Kurze Stile dürfen nicht mit Punkten überladen werden.
  if (target === 'hardboiled' || target === 'hemingway') {
    result = result.replace(/\.\s*\./g, '.');
  }

  return {
    text: result,
    style: target,
    substitutions,
    rewrittenSentences,
    originalWordCount,
    wordCount: countWords(result),
  };
}

// ---------------------------------------------------------------------------
// 2) Inhaltsprüfung
// ---------------------------------------------------------------------------

/**
 * Prüft, ob Eigennamen und Zahlen eines Originaltexts im Ergebnis erhalten
 * geblieben sind — die Inhalts-Garantie des Transmuters.
 *
 * Defensiv: fehlende Eingaben gelten als „nichts zu prüfen" → preserved true.
 */
export function verifyContentPreserved(original: unknown, transmuted: unknown): ContentPreservation {
  const src = typeof original === 'string' ? original : '';
  const dst = typeof transmuted === 'string' ? transmuted : '';

  if (!src.trim()) {
    return { names: [], missingNames: [], preserved: true, preservationRate: 1 };
  }

  const names = extractProperNames(src);
  const numbers = extractNumbers(src);
  const items = [...names, ...numbers];

  if (items.length === 0) {
    return { names: [], missingNames: [], preserved: true, preservationRate: 1 };
  }

  const missingNames = items.filter((item) => !dst.includes(item));
  const preservationRate =
    Math.round(((items.length - missingNames.length) / items.length) * 10000) / 10000;

  return {
    names,
    missingNames,
    preserved: missingNames.length === 0,
    preservationRate,
  };
}

// ---------------------------------------------------------------------------
// 3) Stilvergleich
// ---------------------------------------------------------------------------

/**
 * Erstellt ein stilometrisches Profil eines Texts.
 *
 * Defensiv: leerer Text liefert ein Nullprofil.
 */
export function measureStyle(text: unknown): StyleMetrics {
  const safe = typeof text === 'string' ? text : '';
  const sentences = splitSentences(safe);
  const words = safe.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return {
      sentenceCount: 0,
      avgSentenceLength: 0,
      longWordRatio: 0,
      adjectiveCount: 0,
      density: 0,
    };
  }

  const longWords = words.filter((w) => w.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length >= 8);
  // Adjektiv-Heuristik: typische Endungen inkl. Komparativ/Superlativ.
  const adjectives = words.filter((w) =>
    /(lich|ig|isch|sam|voll|los|licher|licher|igem|igen|licher|lichste?)$/i.test(
      w.replace(/[^A-Za-zÄÖÜäöüß]/g, ''),
    ),
  );

  return {
    sentenceCount: sentences.length,
    avgSentenceLength: Math.round((words.length / Math.max(1, sentences.length)) * 100) / 100,
    longWordRatio: Math.round((longWords.length / words.length) * 10000) / 10000,
    adjectiveCount: adjectives.length,
    density: Math.round((words.length / Math.max(1, sentences.length)) * 100) / 100,
  };
}

/**
 * Vergleicht die stilometrischen Profile zweier Texte.
 *
 * `divergence` ist 0 bei identischem Profil und steigt mit dem Abstand der
 * Kennzahlen. Defensiv: leere Texte ergeben divergence 0.
 */
export function compareStyles(a: unknown, b: unknown): StyleComparison {
  const metricsA = measureStyle(a);
  const metricsB = measureStyle(b);

  if (metricsA.sentenceCount === 0 && metricsB.sentenceCount === 0) {
    return { a: metricsA, b: metricsB, divergence: 0 };
  }

  const lengthDelta =
    Math.abs(metricsA.avgSentenceLength - metricsB.avgSentenceLength) /
    Math.max(1, Math.max(metricsA.avgSentenceLength, metricsB.avgSentenceLength));
  const longWordDelta = Math.abs(metricsA.longWordRatio - metricsB.longWordRatio);
  const adjectiveDelta =
    Math.abs(metricsA.adjectiveCount - metricsB.adjectiveCount) /
    Math.max(1, Math.max(metricsA.adjectiveCount, metricsB.adjectiveCount));

  const divergence = Math.round(((lengthDelta + longWordDelta + adjectiveDelta) / 3) * 10000) / 10000;

  return {
    a: metricsA,
    b: metricsB,
    divergence: Math.min(1, Math.max(0, divergence)),
  };
}
