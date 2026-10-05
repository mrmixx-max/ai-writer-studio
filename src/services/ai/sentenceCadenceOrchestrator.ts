// Kadenz- & Satzrhythmus-Orchestrator (WP 63.1)
//
// Monotone Satzlängen wirken einschläfernd. Meisterhafte Prosa wechselt
// 3-Wort-Stakkatos mit 30-Wort-Wellen ab (Gary Provosts Formel).
//
// Drei deterministische Werkzeuge:
//
//   1. analyzeCadence  — Satzlängen-Wellenform + Monotonie-Alarm
//   2. polishCadence   — 1-Klick-Kadenz-Politur (Schachtelsätze zerlegen)
//   3. scoreRhythm     — Rhythmus-Qualität 0–1
//
// Design-Regeln (analog proseExpander / chapterSceneSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Satz mit seiner Länge. */
export interface SentenceMetric {
  /** Satzindex (0-basiert). */
  index: number;
  /** Der Satz. */
  sentence: string;
  /** Wortzahl. */
  words: number;
  /** Kategorie. */
  category: 'staccato' | 'medium' | 'wave';
}

/** Monotonie-Warnung. */
export interface MonotonyWarning {
  /** Startindex der monotonen Kette. */
  startIndex: number;
  /** Länge der Kette. */
  length: number;
  /** Durchschnittliche Satzlänge der Kette. */
  averageWords: number;
  /** Beschreibung. */
  message: string;
}

/** Ergebnis der Kadenz-Analyse. */
export interface CadenceAnalysis {
  /** Alle Sätze mit Metriken. */
  sentences: SentenceMetric[];
  /** Satzlängen in Wörtern (die Wellenform). */
  waveform: number[];
  /** Anzahl Sätze. */
  sentenceCount: number;
  /** Durchschnittliche Satzlänge. */
  averageWords: number;
  /** Standardabweichung der Satzlängen. */
  stdDeviation: number;
  /** Monotonie-Warnungen. */
  warnings: MonotonyWarning[];
  /** Rhythmus-Qualität 0–1. */
  rhythmScore: number;
}

/** Ergebnis der Kadenz-Politur. */
export interface CadencePolish {
  /** Der polierte Text. */
  text: string;
  /** Anzahl zerlegter Schachtelsätze. */
  splitCount: number;
  /** Anzahl verbundener Kurzsätze. */
  mergedCount: number;
  /** Rhythmus-Score vorher. */
  scoreBefore: number;
  /** Rhythmus-Score nachher. */
  scoreAfter: number;
  /** true, wenn sich der Rhythmus verbessert hat. */
  improved: boolean;
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
// Konstanten
// ---------------------------------------------------------------------------

/** Stakkato: bis zu dieser Wortzahl. */
export const STACCATO_MAX_WORDS = 6;

/** Welle: ab dieser Wortzahl. */
export const WAVE_MIN_WORDS = 20;

/** Ab dieser Kettenlänge ähnlicher Sätze wird gewarnt. */
export const MONOTONY_CHAIN_LENGTH = 5;

/** Toleranzfenster für „ähnliche" Satzlängen (Wörter). */
export const MONOTONY_TOLERANCE = 3;

/** Rhythmus-Zielbereich (Wörter). */
export const TARGET_MIN_WORDS = 6;
export const TARGET_MAX_WORDS = 18;

/** Verbindungs-Bausteine für Kurzsatz-Verschmelzung. */
const MERGE_CONNECTORS: readonly string[] = [' und ', ' doch ', ' während ', ' als '];

/** Faktor der Wellenlänge, ab dem ein Satz als Schachtelsatz gilt. */
export const SPLIT_THRESHOLD_FACTOR = 1.25;

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Sätze zerlegen (Satzzeichen bleiben am Satz). */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  if (!matches) return [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Rundet auf 4 Nachkommastellen. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Kategorisiert eine Satzlänge. */
function categorize(words: number): SentenceMetric['category'] {
  if (words <= STACCATO_MAX_WORDS) return 'staccato';
  if (words >= WAVE_MIN_WORDS) return 'wave';
  return 'medium';
}

// ---------------------------------------------------------------------------
// 1) Kadenz-Analyse
// ---------------------------------------------------------------------------

/**
 * Analysiert die Satzlängen-Wellenform eines Texts.
 *
 * Erkennt monotone Ketten (mehr als 5 Sätze ähnlicher Länge) und berechnet
 * einen Rhythmus-Score: Abwechslung zwischen kurz und lang ist gut, monotone
 * Gleichförmigkeit schlecht.
 *
 * Defensiv: leerer/ungültiger Text liefert eine leere Analyse.
 */
export function analyzeCadence(text: unknown): CadenceAnalysis {
  const empty: CadenceAnalysis = {
    sentences: [],
    waveform: [],
    sentenceCount: 0,
    averageWords: 0,
    stdDeviation: 0,
    warnings: [],
    rhythmScore: 0,
  };

  if (typeof text !== 'string' || text.trim().length === 0) return empty;

  const raw = splitSentences(text);
  if (raw.length === 0) return empty;

  const sentences: SentenceMetric[] = raw.map((sentence, index) => {
    const words = countWords(sentence);
    return { index, sentence, words, category: categorize(words) };
  });

  const waveform = sentences.map((s) => s.words);
  const average = waveform.reduce((a, b) => a + b, 0) / waveform.length;
  const variance = waveform.reduce((s, w) => s + (w - average) ** 2, 0) / waveform.length;
  const stdDeviation = Math.sqrt(variance);

  // Monotonie-Erkennung: Ketten ähnlicher Länge.
  const warnings: MonotonyWarning[] = [];
  let chainStart = 0;
  for (let i = 1; i <= sentences.length; i++) {
    const prev = sentences[i - 1];
    const curr = sentences[i];
    const similar = curr !== undefined && Math.abs(curr.words - prev.words) <= MONOTONY_TOLERANCE;

    if (!similar) {
      const chainLength = i - chainStart;
      if (chainLength > MONOTONY_CHAIN_LENGTH) {
        const chain = sentences.slice(chainStart, i);
        const avg = chain.reduce((s, c) => s + c.words, 0) / chain.length;
        warnings.push({
          startIndex: chainStart,
          length: chainLength,
          averageWords: round4(avg),
          message: `${chainLength} Sätze in Folge mit ähnlicher Länge (Ø ${Math.round(avg)} Wörter) — der Rhythmus schläft ein`,
        });
      }
      chainStart = i;
    }
  }

  // Rhythmus-Score: Standardabweichung im Zielband, Abzug je Warnung.
  const idealDeviation = 6;
  const deviationScore = Math.max(0, 1 - Math.abs(stdDeviation - idealDeviation) / idealDeviation);
  const warningPenalty = Math.min(0.6, warnings.length * 0.2);
  const rhythmScore = round4(Math.max(0, Math.min(1, deviationScore - warningPenalty + 0.3)));

  return {
    sentences,
    waveform,
    sentenceCount: sentences.length,
    averageWords: round4(average),
    stdDeviation: round4(stdDeviation),
    warnings,
    rhythmScore,
  };
}

// ---------------------------------------------------------------------------
// 2) Kadenz-Politur
// ---------------------------------------------------------------------------

/**
 * Poliert den Satzrhythmus in einem Durchgang.
 *
 * Zwei Eingriffe:
 *   - **Schachtelsätze zerlegen:** überlange Sätze werden am Komma geteilt,
 *     damit die Wellenform kurze Akzente bekommt.
 *   - **Kurzsätze verbinden:** lange Stakkato-Ketten werden zu einem
 *     fließenderen Satz verschmolzen.
 *
 * Defensiv: leerer/ungültiger Text wird unverändert zurückgegeben.
 */
export function polishCadence(text: unknown): CadencePolish {
  const safe = typeof text === 'string' ? text : '';
  const before = analyzeCadence(safe);

  if (!safe.trim()) {
    return {
      text: safe,
      splitCount: 0,
      mergedCount: 0,
      scoreBefore: 0,
      scoreAfter: 0,
      improved: false,
    };
  }

  const rand = createSeededRandom(hashString(safe));
  const sentences = splitSentences(safe);
  const result: string[] = [];
  let splitCount = 0;
  let mergedCount = 0;

  let i = 0;
  while (i < sentences.length) {
    const sentence = sentences[i];
    const words = countWords(sentence);

    // 1. Schachtelsatz zerlegen.
    if (words >= WAVE_MIN_WORDS * SPLIT_THRESHOLD_FACTOR) {
      const parts = sentence.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
      if (parts.length > 1) {
        splitCount++;
        parts.forEach((p) => result.push(/[.!?]$/.test(p) ? p : `${p}.`));
        i++;
        continue;
      }
    }

    // 2. Kurzsatz-Ketten verbinden (drei Stakkato-Sätze → einer).
    if (words <= STACCATO_MAX_WORDS && i + 1 < sentences.length) {
      const next = sentences[i + 1];
      const nextWords = countWords(next);
      if (nextWords <= STACCATO_MAX_WORDS) {
        const connector = pick(MERGE_CONNECTORS, rand);
        const left = sentence.replace(/[.!?]+$/, '');
        const right = next.replace(/[.!?]+$/, '');
        mergedCount++;
        result.push(`${left}${connector}${right.charAt(0).toLowerCase()}${right.slice(1)}.`);
        i += 2;
        continue;
      }
    }

    result.push(sentence);
    i++;
  }

  const polished = result.join(' ');
  const after = analyzeCadence(polished);

  return {
    text: polished,
    splitCount,
    mergedCount,
    scoreBefore: before.rhythmScore,
    scoreAfter: after.rhythmScore,
    improved: after.rhythmScore > before.rhythmScore,
  };
}

// ---------------------------------------------------------------------------
// 3) Rhythmus-Bewertung
// ---------------------------------------------------------------------------

/**
 * Bewertet die Rhythmus-Qualität eines Texts.
 *
 * Ideal ist ein Wechsel aus kurzen und langen Sätzen mit mittlerer Streuung;
 * sowohl Monotonie (Streuung ≈ 0) als auch Chaos (Streuung sehr hoch) senken
 * den Wert.
 *
 * Defensiv: leerer Text liefert 0.
 */
export function scoreRhythm(text: unknown): number {
  return analyzeCadence(text).rhythmScore;
}

// ---------------------------------------------------------------------------
// 4) Wellenform-Export
// ---------------------------------------------------------------------------

/**
 * Formatiert die Wellenform als ASCII-Grafik (für die UI/Tests).
 * Defensiv: leere Texte liefern einen leeren String.
 */
export function renderWaveform(text: unknown, maxWidth = 60): string {
  const analysis = analyzeCadence(text);
  if (analysis.waveform.length === 0) return '';

  const max = Math.max(...analysis.waveform);
  if (max === 0) return '';

  return analysis.waveform
    .map((w, i) => {
      const barLength = Math.max(1, Math.round((w / max) * maxWidth));
      const bar = '█'.repeat(barLength);
      const cat = analysis.sentences[i]?.category ?? 'medium';
      return `${String(i + 1).padStart(2)} | ${bar} ${w} (${cat})`;
    })
    .join('\n');
}

/** Zählt Sätze je Kategorie. */
export function countCategories(text: unknown): Record<SentenceMetric['category'], number> {
  const analysis = analyzeCadence(text);
  const counts: Record<SentenceMetric['category'], number> = {
    staccato: 0,
    medium: 0,
    wave: 0,
  };
  for (const s of analysis.sentences) counts[s.category]++;
  return counts;
}
