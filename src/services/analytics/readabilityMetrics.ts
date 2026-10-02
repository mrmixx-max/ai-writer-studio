// Lesbarkeits-Metriken (WP 13.2): Flesch Reading Ease (deutsch/Amstad),
// Wiener Sachtextformel, Gunning Fog Index, Satzlängen-Analyse.
//
// Rein deterministisch, keine LLM-Abhängigkeit, defensive Fallbacks.
// Alle Funktionen geben 0 oder leeres Array zurück, wenn Eingabe leer ist.

export interface SentenceLengthWarning {
  sentence: string;
  wordCount: number;
  position: number; // 0-basierter Index im Text
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Wörter tokenisieren: Buchstaben-/Ziffernfolgen inkl. Umlaute. */
function tokenizeWords(text: string): string[] {
  const hits = text.toLowerCase().match(/[a-zäöüß0-9]+(?:[''-][a-zäöüß0-9]+)*/gu);
  return hits ?? [];
}

/** Sätze splitten an . ! ? … */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Silbenzählung (deutsche Heuristik: Vokalgruppen, stummes -e). */
function countSyllablesGerman(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/gu, "");
  if (w.length === 0) return 0;
  if (w.length <= 2) return 1;
  const groups = w.match(/[aeiouyäöü]+/gu);
  let n = groups ? groups.length : 0;
  // Stummes -e am Ende abziehen
  if (/[^aeiouyäöü]e$/u.test(w) && n > 1) n -= 1;
  return Math.max(1, n);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Flesch Reading Ease (deutsch nach Amstad):
 * FRE = 180 - (W/S) - 58.5 * (Syl/W)
 * W = Wörter, S = Sätze, Syl = Silben
 * Ergebnis: 0 (sehr schwer) .. 100 (sehr leicht)
 */
export function calculateFleschReadingEase(text: string): number {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) return 0;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllablesGerman(w), 0);
  const wps = wordCount / sentenceCount;
  const spw = totalSyllables / wordCount;

  const score = 180 - wps - 58.5 * spw;
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

/**
 * Wiener Sachtextformel:
 * WSF = 0.1935*MS + 0.1672*SL + 0.1297*IW - 0.0327*L - 0.875
 * MS = % Wörter mit ≥3 Silben, SL = mittlere Satzlänge,
 * IW = % Wörter mit >6 Buchstaben, L = % Wörter mit 1-2 Buchstaben
 */
export function calculateWienerSachtextformel(text: string): number {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) return 0;

  const syllableCounts = words.map(countSyllablesGerman);
  const longSyllableWords = syllableCounts.filter((s) => s >= 3).length;
  const longCharWords = words.filter((w) => w.length > 6).length;
  const shortWords = words.filter((w) => w.length <= 2).length;

  const MS = (longSyllableWords / wordCount) * 100;
  const SL = wordCount / sentenceCount;
  const IW = (longCharWords / wordCount) * 100;
  const L = (shortWords / wordCount) * 100;

  const score = 0.1935 * MS + 0.1672 * SL + 0.1297 * IW - 0.0327 * L - 0.875;
  return Math.round(score * 10) / 10;
}

/**
 * Gunning Fog Index:
 * GFI = 0.4 * [(W/S) + 100 * (komplexe Wörter / W)]
 * Komplexe Wörter = Wörter mit ≥3 Silben
 */
export function calculateGunningFog(text: string): number {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) return 0;

  const complexWords = words.filter((w) => countSyllablesGerman(w) >= 3).length;
  const wps = wordCount / sentenceCount;
  const complexRatio = (complexWords / wordCount) * 100;

  const score = 0.4 * (wps + complexRatio);
  return Math.round(score * 10) / 10;
}

/**
 * Sätze mit > 35 Wörtern markieren.
 * Gibt Warnungen mit Satztext, Wortzahl und Position zurück.
 */
export function analyzeSentenceLength(text: string): SentenceLengthWarning[] {
  const warnings: SentenceLengthWarning[] = [];
  const sentences = splitSentences(text);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const wordCount = tokenizeWords(sentence).length;
    if (wordCount > 35) {
      warnings.push({ sentence, wordCount, position: i });
    }
  }

  return warnings;
}
