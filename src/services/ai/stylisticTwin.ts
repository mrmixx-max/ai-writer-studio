/**
 * Stil-DNA-Service (WP 22.1 — Autoren-Zwilling & Stil-DNA-Mimikry)
 *
 * Lokaler, deterministischer Service für:
 * - Extraktion der persönlichen Schreibstil-DNA aus Kapiteln
 * - dynamische Umformung von Hermes-Prompts zur Stil-Imitierung
 * - Analyse des Satzrhythmus
 *
 * KEINE LLM-Aufrufe, KEIN Netzwerk. Defensive Fallbacks überall.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface SentencePattern {
  type: 'participle' | 'paratactic' | 'hypotactic';
  frequency: number;
}

export interface StyleDNA {
  adjectiveVerbRatio: number;
  sentencePatterns: SentencePattern[];
  vocabularyDensity: number;
  regionalWords: string[];
  avgSentenceLength: number;
}

export interface SentenceRhythmProfile {
  avgLength: number;
  variance: number;
  shortSentences: number;
  longSentences: number;
}

// ─── Konstanten ─────────────────────────────────────────────────────────────

/** Deutsche Adjektiv-Endungen (Heuristik) */
const ADJECTIVE_SUFFIXES = [
  'lich', 'isch', 'bar', 'sam', 'haft', 'los', 'voll', 'ig',
  'e', 'er', 'es', // deklinierte Adjektive (schnelle, schneller, schnelles)
];

/** Deutsche Verb-Endungen (Heuristik, Infinitiv) */
const VERB_SUFFIXES = ['en', 'n', 'ern', 'eln'];

/** Partizip-I-Endungen */
const PARTICIPLE_SUFFIXES = ['end'];

/** Partizip-II-Präfix */
const PARTICIPLE_II_PREFIX = 'ge';

/** Parataktische Konjunktionen (Hauptsatzverbindungen) */
const PARATACTIC_CONJUNCTIONS = ['und', 'oder', 'aber', 'denn', 'sondern', 'doch'];

/** Hypotaktische Konjunktionen (Nebensatzeinleitung) */
const HYPOTACTIC_CONJUNCTIONS = [
  'weil', 'dass', 'obwohl', 'wenn', 'als', 'damit', 'sodass', 'während',
  'nachdem', 'bevor', 'falls', 'sofern', 'ob', 'wie', 'was', 'wer', 'wo',
  'wann', 'warum', 'wieso', 'weshalb', 'womit', 'wodurch', 'wogegen',
  'worauf', 'worin', 'woran', 'wovon', 'wovor', 'wozu', 'wobei',
];

/** Bekannte regionale Wörter (Auswahl) */
const REGIONAL_WORDS = [
  // Berlin/Brandenburg
  'plauze', 'bemme', 'kneipe', 'schnute', 'mucke', 'kohle', 'kiste', 'bock',
  'schnauze', 'kumpel', 'bub', 'mädle', 'buwe', 'göre', 'ladde',
  'püpp', 'trulla', 'fresse', 'bude', 'schnaps', 'korn', 'zaster',
  'kies', 'moos', 'knete', 'bockwurst', 'brathering', 'frikadelle',
  'bulette', 'kloß', 'knödel', 'sauerkraut', 'eintopf', 'bauernfrühstück',
  'käsespätzle', 'maultaschen', 'schupfnudeln',
  // Bayern/Österreich
  'oachkatzlschwoaf', 'gschaftlhuber', 'pfiatsch', 'schnood', 'griaßdi',
  'servus', 'pfati', 'oida', 'buam', 'madl', 'gschmier',
  // Norddeutschland
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  'kinner', 'kinners', 'kinnern',
  // Rheinland
  'kölsch', 'kappes', 'köpp', 'jeck', 'bützje', 'kütt',
  // Sachsen
  'görlitzer', 'sächsisch',
  // Schwaben
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Hessen
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Baden
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Pfalz
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Thüringen
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Brandenburg
  'plauze', 'bemme', 'kneipe', 'schnute', 'mucke', 'kohle', 'kiste', 'bock',
  // Mecklenburg-Vorpommern
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  // Niedersachsen
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  // Schleswig-Holstein
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  // Hamburg
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  // Bremen
  'moin', 'tach', 'icke', 'wa', 'wat', 'wo', 'wie', 'wann',
  // Saarland
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
  // Sachsen-Anhalt
  'griaßdi', 'servus', 'pfati', 'oida', 'buam', 'madl',
];

/** Schwellenwerte für Satzrhythmus */
const SHORT_SENTENCE_THRESHOLD = 8;
const LONG_SENTENCE_THRESHOLD = 20;

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
  return num;
}

function splitSentences(text: string): string[] {
  const safeText = sanitizeString(text, '');
  if (safeText.length === 0) return [];
  return safeText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitWords(text: string): string[] {
  const safeText = sanitizeString(text, '');
  if (safeText.length === 0) return [];
  return safeText
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zäöüß]/g, ''))
    .filter((w) => w.length > 0);
}

function isAdjective(word: string): boolean {
  const lower = word.toLowerCase();
  // Ausschluss: Wörter auf "-en" sind meist Verben (laufen, gehen, etc.)
  if (lower.endsWith('en')) return false;
  return ADJECTIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isVerb(word: string): boolean {
  const lower = word.toLowerCase();
  return VERB_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isParticiple(word: string): boolean {
  const lower = word.toLowerCase();
  return PARTICIPLE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isParticipleII(word: string): boolean {
  const lower = word.toLowerCase();
  return lower.startsWith(PARTICIPLE_II_PREFIX) && lower.length > 3;
}

function isParatactic(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return PARATACTIC_CONJUNCTIONS.some((conj) => {
    const regex = new RegExp(`\\b${conj}\\b`, 'i');
    return regex.test(lower);
  });
}

function isHypotactic(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return HYPOTACTIC_CONJUNCTIONS.some((conj) => {
    const regex = new RegExp(`\\b${conj}\\b`, 'i');
    return regex.test(lower);
  });
}

function findRegionalWords(text: string): string[] {
  const words = splitWords(text);
  const found = new Set<string>();
  for (const word of words) {
    if (REGIONAL_WORDS.includes(word)) {
      found.add(word);
    }
  }
  return Array.from(found);
}

// ─── Öffentliche API ────────────────────────────────────────────────────────

/**
 * Extrahiert die persönliche Schreibstil-DNA aus den letzten Kapiteln.
 * Defensiv: leeres Array → Default-Werte.
 */
export function extractStyleDNA(chapters: string[]): StyleDNA {
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const validChapters = safeChapters.filter((c) => typeof c === 'string' && c.trim().length > 0);

  if (validChapters.length === 0) {
    return {
      adjectiveVerbRatio: 0,
      sentencePatterns: [],
      vocabularyDensity: 0,
      regionalWords: [],
      avgSentenceLength: 0,
    };
  }

  const allText = validChapters.join(' ');
  const allWords = splitWords(allText);
  const allSentences = splitSentences(allText);

  // Adjektiv-Verhältnis
  const adjectives = allWords.filter(isAdjective);
  const verbs = allWords.filter(isVerb);
  const adjectiveVerbRatio = verbs.length > 0 ? adjectives.length / verbs.length : 0;

  // Satzrhythmus
  const sentenceLengths = allSentences.map((s) => splitWords(s).length);
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;

  // Satzmuster
  const participleCount = allSentences.filter((s) => {
    const words = splitWords(s);
    return words.some(isParticiple) || words.some(isParticipleII);
  }).length;
  const paratacticCount = allSentences.filter(isParatactic).length;
  const hypotacticCount = allSentences.filter(isHypotactic).length;

  const totalSentences = allSentences.length || 1;
  const sentencePatterns: SentencePattern[] = [
    { type: 'participle', frequency: participleCount / totalSentences },
    { type: 'paratactic', frequency: paratacticCount / totalSentences },
    { type: 'hypotactic', frequency: hypotacticCount / totalSentences },
  ];

  // Vokabular-Dichte (Type-Token-Ratio)
  const uniqueWords = new Set(allWords);
  const vocabularyDensity = allWords.length > 0 ? uniqueWords.size / allWords.length : 0;

  // Regionale Wörter
  const regionalWords = findRegionalWords(allText);

  return {
    adjectiveVerbRatio,
    sentencePatterns,
    vocabularyDensity,
    regionalWords,
    avgSentenceLength,
  };
}

/**
 * Formt einen Hermes-Prompt dynamisch um, sodass generierte Textteile
 * die persönliche Tonalität imitieren.
 * Defensiv: fehlende Daten → Defaults.
 */
export function buildPersonaPrompt(styleDNA: StyleDNA, context: string): string {
  const safeContext = sanitizeString(context, '');
  const safeDNA = styleDNA && typeof styleDNA === 'object' ? styleDNA : null;

  if (!safeDNA) {
    return `Schreibe im persönlichen Stil. Kontext: ${safeContext}`;
  }

  const parts: string[] = [];

  // Basis-Anweisung
  parts.push('Schreibe im persönlichen Schreibstil des Autors.');

  // Adjektiv-Verhältnis
  const ratio = sanitizeNumber(safeDNA.adjectiveVerbRatio, 0);
  if (ratio > 0) {
    parts.push(`Verhältnis Adjektive zu Verben: ${ratio.toFixed(2)}`);
  }

  // Satzmuster
  const patterns = Array.isArray(safeDNA.sentencePatterns) ? safeDNA.sentencePatterns : [];
  if (patterns.length > 0) {
    const patternDesc = patterns
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const type = sanitizeString(p.type, 'unbekannt');
        const freq = sanitizeNumber(p.frequency, 0);
        return `${type}: ${(freq * 100).toFixed(0)}%`;
      })
      .join(', ');
    if (patternDesc) {
      parts.push(`Satzmuster: ${patternDesc}`);
    }
  }

  // Vokabular-Dichte
  const density = sanitizeNumber(safeDNA.vocabularyDensity, 0);
  if (density > 0) {
    parts.push(`Vokabular-Dichte: ${density.toFixed(2)}`);
  }

  // Regionale Wörter
  const regional = Array.isArray(safeDNA.regionalWords) ? safeDNA.regionalWords : [];
  if (regional.length > 0) {
    parts.push(`Regionale Wörter: ${regional.join(', ')}`);
  }

  // Durchschnittliche Satzlänge
  const avgLen = sanitizeNumber(safeDNA.avgSentenceLength, 0);
  if (avgLen > 0) {
    parts.push(`Durchschnittliche Satzlänge: ${avgLen.toFixed(1)} Wörter`);
  }

  // Kontext
  if (safeContext) {
    parts.push(`Kontext: ${safeContext}`);
  }

  return parts.join('\n');
}

/**
 * Analysiert den Satzrhythmus eines Textes.
 * Defensiv: leerer Text → Default-Werte.
 */
export function analyzeSentenceRhythm(text: string): SentenceRhythmProfile {
  const safeText = sanitizeString(text, '');
  if (safeText.length === 0) {
    return {
      avgLength: 0,
      variance: 0,
      shortSentences: 0,
      longSentences: 0,
    };
  }

  const sentences = splitSentences(safeText);
  if (sentences.length === 0) {
    return {
      avgLength: 0,
      variance: 0,
      shortSentences: 0,
      longSentences: 0,
    };
  }

  const lengths = sentences.map((s) => splitWords(s).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Varianz
  const squaredDiffs = lengths.map((l) => Math.pow(l - avgLength, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length;

  // Kurze und lange Sätze
  const shortSentences = lengths.filter((l) => l < SHORT_SENTENCE_THRESHOLD).length;
  const longSentences = lengths.filter((l) => l > LONG_SENTENCE_THRESHOLD).length;

  return {
    avgLength,
    variance,
    shortSentences,
    longSentences,
  };
}
