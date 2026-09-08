// Readability-Engine (Sprint 25, Agent 4): 6 Lesbarkeits-Metriken.
//
// Rein deterministisch, keine LLM-Abhaengigkeit, keine neuen Dependencies.
// Ergaenzt `bookwriter/quality.ts` (Flesch/Amstad deutsch) um die klassischen
// englischen Grade-Level-Metriken: Flesch-Kincaid, Gunning Fog, Coleman-Liau,
// ARI und SMOG — plus Flesch Reading Ease als 6. Metrik.

export interface ReadabilityScore {
  fleschKincaid: number; // Grade-Level (US-Klassenstufe)
  fleschReadingEase: number; // 0 (sehr schwer) .. 100 (sehr leicht)
  gunningFog: number; // Grade-Level
  colemanLiau: number; // Grade-Level
  ari: number; // Automated Readability Index (Grade-Level)
  smog: number; // Grade-Level
  averageAge: number; // Zielgruppe Alter (Jahre)
  educationLevel: string; // Bildungs-Level
}

export interface ReadabilityResult {
  score: ReadabilityScore;
  words: number;
  sentences: number;
  syllables: number;
  complexWords: number; // 3+ Silben
}

export interface ReadabilityComparison {
  text1: ReadabilityResult;
  text2: ReadabilityResult;
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/** Woerter: Buchstaben-/Ziffernfolgen (inkl. Umlaute, Apostroph). */
export function tokenizeReadabilityWords(text: string): string[] {
  const hits = text.toLowerCase().match(/[a-zäöüß0-9]+(?:[''\-][a-zäöüß0-9]+)*/gu);
  return hits ?? [];
}

/** Saetze: Split an . ! ? (Mehrfachzeichen + Abkürzungs-Schutz minimal). */
export function splitReadabilitySentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Silbenzaehlung (englische Heuristik, Vokalgruppen + stummes -e).
 * Für deutsche Texte bleibt sie eine Näherung — dokumentiert, nicht versteckt.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/gu, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouyäöü]+/gu);
  let n = groups ? groups.length : 0;
  // Stummes -e / -es / -ed am Ende (englisch) abziehen
  if (/[^aeiouyäöü]e$/u.test(w) && n > 1) n -= 1;
  return Math.max(1, n);
}

/** Buchstaben (A-Z, Umlaute) für Coleman-Liau / ARI. */
export function countLetters(text: string): number {
  const hits = text.match(/[a-zäöüß]/giu);
  return hits ? hits.length : 0;
}

function clampGrade(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return round1(Math.max(0, n));
}

/** FK-Grade -> Bildungs-Level (US-Stufen, deutsch beschriftet). */
export function getEducationLevel(grade: number): string {
  if (!Number.isFinite(grade)) return "Unbekannt";
  if (grade < 1) return "Leseanfänger";
  if (grade < 3) return "Grundschule (Unterstufe)";
  if (grade < 6) return "Grundschule (Oberstufe)";
  if (grade < 9) return "Mittelstufe";
  if (grade < 12) return "Oberstufe";
  if (grade < 14) return "Studium (Bachelor)";
  if (grade < 17) return "Studium (Master)";
  return "Akademisch (Promotion)";
}

/** Flesch-Reading-Ease (0..100) -> verbale Bewertung. */
export function getScoreDescription(fleschReadingEase: number): string {
  if (!Number.isFinite(fleschReadingEase)) return "Keine Bewertung möglich";
  if (fleschReadingEase >= 90) return "Sehr leicht lesbar";
  if (fleschReadingEase >= 80) return "Leicht lesbar";
  if (fleschReadingEase >= 70) return "Ziemlich leicht lesbar";
  if (fleschReadingEase >= 60) return "Standard — durchschnittlich lesbar";
  if (fleschReadingEase >= 50) return "Ziemlich schwer lesbar";
  if (fleschReadingEase >= 30) return "Schwer lesbar";
  return "Sehr schwer lesbar — Fachpublikum";
}

/** Alle 6 Metriken für einen Text berechnen. */
export function analyze(text: string): ReadabilityResult {
  const words = tokenizeReadabilityWords(text);
  const sentences = splitReadabilitySentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) {
    return {
      score: {
        fleschKincaid: 0,
        fleschReadingEase: 0,
        gunningFog: 0,
        colemanLiau: 0,
        ari: 0,
        smog: 0,
        averageAge: 0,
        educationLevel: "Unbekannt",
      },
      words: 0,
      sentences: 0,
      syllables: 0,
      complexWords: 0,
    };
  }

  const syllableCounts = words.map(countSyllables);
  const totalSyllables = syllableCounts.reduce((a, b) => a + b, 0);
  const complexWords = syllableCounts.filter((s) => s >= 3).length;
  const letters = countLetters(text);

  const wps = wordCount / sentenceCount; // Woerter pro Satz
  const spw = totalSyllables / wordCount; // Silben pro Wort

  // Flesch-Kincaid Grade: 0.39 * (W/S) + 11.8 * (Syl/W) - 15.59
  const fleschKincaid = clampGrade(0.39 * wps + 11.8 * spw - 15.59);
  // Flesch Reading Ease: 206.835 - 1.015 * (W/S) - 84.6 * (Syl/W)
  const fleschReadingEase = round1(
    Math.min(100, Math.max(0, 206.835 - 1.015 * wps - 84.6 * spw)),
  );
  // Gunning Fog: 0.4 * [(W/S) + 100 * (komplex/W)]
  const gunningFog = clampGrade(0.4 * (wps + 100 * (complexWords / wordCount)));
  // Coleman-Liau: 0.0588 * L - 0.296 * S - 15.8
  // (L = Buchstaben/100 Woerter, S = Saetze/100 Woerter)
  const L = (letters / wordCount) * 100;
  const S = (sentenceCount / wordCount) * 100;
  const colemanLiau = clampGrade(0.0588 * L - 0.296 * S - 15.8);
  // ARI: 4.71 * (Zeichen/Woerter) + 0.5 * (Woerter/Saetze) - 21.43
  const ari = clampGrade(4.71 * (letters / wordCount) + 0.5 * wps - 21.43);
  // SMOG: 1.043 * sqrt(komplex * 30/Saetze) + 3.1291
  const smog = clampGrade(1.043 * Math.sqrt((complexWords * 30) / sentenceCount) + 3.1291);

  // Zielgruppen-Alter: Grade-Level + ~5 Jahre (Grade 0 -> ~5-6 Jahre)
  const averageAge = round1(Math.min(25, Math.max(5, fleschKincaid + 5)));

  return {
    score: {
      fleschKincaid,
      fleschReadingEase,
      gunningFog,
      colemanLiau,
      ari,
      smog,
      averageAge,
      educationLevel: getEducationLevel(fleschKincaid),
    },
    words: wordCount,
    sentences: sentenceCount,
    syllables: totalSyllables,
    complexWords,
  };
}

/** Zwei Texte mit derselben Engine vergleichen. */
export function compareTexts(text1: string, text2: string): ReadabilityComparison {
  return { text1: analyze(text1), text2: analyze(text2) };
}
