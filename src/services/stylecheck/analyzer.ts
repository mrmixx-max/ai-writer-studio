// Stil-Analyse: Füllwörter, Adverbien, Passiv, Wortwiederholungen, Flesch-Score.
//
// Rein lokal, kein LLM. Arbeitet auf dem übergebenen Text.

export interface StyleIssue {
  type: "filler" | "adverb" | "passive" | "repetition";
  start: number;
  end: number;
  text: string;
  message: string;
}

export interface StyleAnalysis {
  issues: StyleIssue[];
  wordCount: number;
  readabilityScore: number; // 0–100
  fillerCount: number;
  adverbCount: number;
  passiveCount: number;
  repetitionCount: number;
}

// Deutsche Füllwörter (konservativ — nur die offensichtlichsten).
const FILLER_WORDS = new Set([
  "eigentlich", "irgendwie", "irgendwo", "irgendwann", "irgendwas",
  "quasi", "gewissermaßen", "sozusagen", "gewissermaßen", "letztendlich",
  "schlussendlich", "im Grunde", "im Endeffekt", "im Kern", "an sich",
  "von Natur aus", "gewissermaßen", "sozusagen", "irgendwie", "eben",
  "halt", "einfach", "irgendwie", "total", "voll", "echt", "wirklich",
  "genau", "eigentlich", "nämlich", "quasi", "praktisch", "sozusagen",
]);

// Passiv-Indikatoren: werden + Partiziv (vereinfacht).
const PASSIVE_PATTERN = /\b(wurde|wurden|wird|werden|wirst|worden)\s+[\p{L}]+(?:t|et|en)\b/giu;

// Adverbien auf -weise und -lich.
const ADVERB_PATTERN = /\b[\p{L}\p{N}]{3,}(?:weise|lich)\b/giu;

/** Zählt Wörter im Text. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Flesch-Reading-Ease für Deutsch (angepasst). */
function fleschScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = countWords(text);
  const syllables = countSyllables(text);

  if (sentences.length === 0 || words === 0) return 0;

  const avgSentenceLen = words / sentences.length;
  const avgSyllablesPerWord = syllables / words;

  // Deutsche Anpassung: 206 statt 205, Faktor angepasst
  const score = 206 - (avgSentenceLen * 1.0) - (avgSyllablesPerWord * 84);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Zählt Silben (vereinfacht: Vokale = Silbe). */
function countSyllables(text: string): number {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  let count = 0;
  for (const w of words) {
    const vowels = w.toLowerCase().match(/[aeiouäöü]+/g);
    count += vowels ? vowels.length : 1;
  }
  return count;
}

/** Findet Füllwörter. */
function findFillers(text: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  const lower = text.toLowerCase();

  for (const filler of FILLER_WORDS) {
    let pos = 0;
    while ((pos = lower.indexOf(filler.toLowerCase(), pos)) !== -1) {
      issues.push({
        type: "filler",
        start: pos,
        end: pos + filler.length,
        text: text.slice(pos, pos + filler.length),
        message: `Füllwort: "${filler}"`,
      });
      pos += filler.length;
    }
  }

  return issues;
}

/** Findet Adverbien auf -weise und -lich. */
function findAdverbs(text: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  let match: RegExpExecArray | null;

  ADVERB_PATTERN.lastIndex = 0;
  while ((match = ADVERB_PATTERN.exec(text)) !== null) {
    issues.push({
      type: "adverb",
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      message: `Adverb: "${match[0]}"`,
    });
  }

  return issues;
}

/** Findet Passiv-Konstruktionen. */
function findPassive(text: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  let match: RegExpExecArray | null;

  PASSIVE_PATTERN.lastIndex = 0;
  while ((match = PASSIVE_PATTERN.exec(text)) !== null) {
    issues.push({
      type: "passive",
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      message: `Passiv: "${match[0]}"`,
    });
  }

  return issues;
}

/** Findet Wortwiederholungen im Umkreis von 100 Wörtern. */
function findRepetitions(text: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  const words = text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
  const positions: number[] = [];
  let pos = 0;
  for (const w of words) {
    const idx = text.indexOf(w, pos);
    positions.push(idx);
    pos = idx + w.length;
  }

  const windowSize = 100;
  const lowerWords = words.map((w) => w.toLowerCase());

  for (let i = 0; i < words.length; i++) {
    const w = lowerWords[i];
    if (w.length < 4) continue; // Kurze Wörter ignorieren

    for (let j = i + 1; j < words.length && j <= i + windowSize; j++) {
      if (lowerWords[j] === w) {
        issues.push({
          type: "repetition",
          start: positions[j],
          end: positions[j] + words[j].length,
          text: words[j],
          message: `Wiederholung: "${words[i]}" (${j - i} Wörter Abstand)`,
        });
      }
    }
  }

  return issues;
}

/** Führt eine vollständige Stil-Analyse durch. */
export function analyzeStyle(text: string): StyleAnalysis {
  const issues: StyleIssue[] = [
    ...findFillers(text),
    ...findAdverbs(text),
    ...findPassive(text),
    ...findRepetitions(text),
  ];

  return {
    issues,
    wordCount: countWords(text),
    readabilityScore: fleschScore(text),
    fillerCount: issues.filter((i) => i.type === "filler").length,
    adverbCount: issues.filter((i) => i.type === "adverb").length,
    passiveCount: issues.filter((i) => i.type === "passive").length,
    repetitionCount: issues.filter((i) => i.type === "repetition").length,
  };
}
