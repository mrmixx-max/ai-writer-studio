// Lesbarkeits-Metriken: rein lokale Heuristiken, kein LLM-Call.
//
// - Flesch Reading Ease (deutsche Anpassung nach Amstad et al., 1977/1997):
//   FRE_de = 180 − ASL − (58.5 × ASW)
//   (englische Formel 206.835 − ... gilt NICHT für Deutsch)
// - Ø-Satzlänge (Wörter/Satz)
// - Füllwort-Quote: Anteil deutscher Füllwörter an allen Wörtern
// - Passiv-Schätzung: "werden"-Periphrase + Partizip-II-Endungen

import type { Chapter } from "@/types/project";
import { countWords } from "./chapterPlan";

/** Lesbarkeits-Metriken für einen Text. */
export interface ReadabilityMetrics {
  words: number;
  sentences: number;
  /** Wörter pro Satz. */
  avgSentenceLength: number;
  /** Silben pro Wort (deutsche Heuristik). */
  avgSyllablesPerWord: number;
  /** Flesch Reading Ease (deutsch). Höher = leichter. */
  fleschReadingEase: number;
  /** Anteil Füllwörter an allen Wörtern, 0..1. */
  fillerRatio: number;
  /** Anzahl Passiv-Sätze (Heuristik). */
  passiveSentences: number;
  /** Anteil Passiv-Sätze an allen Sätzen, 0..1. */
  passiveRatio: number;
}

/** Konfigurierbare Schwellenwerte (pro Projekt überschreibbar). */
export interface ReadabilityThresholds {
  /** Warnung, wenn Ø-Satzlänge über diesem Wert liegt. */
  avgSentenceLength: number;
  /** Warnung, wenn Füllwort-Quote über diesem Wert liegt (0..1). */
  fillerRatio: number;
  /** Warnung, wenn Passiv-Anteil über diesem Wert liegt (0..1). */
  passiveRatio: number;
  /** Warnung, wenn Flesch unter diesem Wert liegt. */
  fleschReadingEase: number;
}

export const DEFAULT_THRESHOLDS: ReadabilityThresholds = {
  avgSentenceLength: 18,
  fillerRatio: 0.08,
  passiveRatio: 0.2,
  fleschReadingEase: 50,
};

/** Ein Metrikwert mit Schwellenwert-Auswertung. */
export interface MetricBadge {
  key: keyof ReadabilityMetrics;
  label: string;
  value: number;
  formatted: string;
  warn: boolean;
  threshold: number;
}

// --- Deutsche Füllwort-Liste (verzichtbare Konjunktionen/Adverbien/Floskeln) ---
const FILLER_WORDS = [
  "also", "eigentlich", "gewissermaßen", "irgendwie", "ja", "halt", "ebend", "ebenso",
  "sogar", "wohl", "ziemlich", "recht", "gewiss", "wahrlich", "natürlich", "tatsächlich",
  "letztendlich", "schlußendlich", "schlussendlich", "faktisch", "praktisch", "gewissermassen",
  "bekanntlich", "selbstverständlich", "übrigens", "übrigens", "im grunde", "an sich",
  "durchaus", "ohnehin", "sowieso", "dennoch", "indes", "jedoch", "allerdings",
  "damals", "dann", "doch", "nun", "sozusagen", "quasi", "hinsichtlich", "bezüglich",
  "vollkommen", "total", "sehr", "wirklich", "einfach", "eben", "mal",
];

const FILLER_PHRASES = [
  "im grunde", "an sich", "wie bereits erwähnt", "es ist wichtig zu beachten",
  "es sollte beachtet werden", "unter anderem", "und so weiter", "und dergleichen mehr",
];

/** Passiv-Signalwörter: werden/wurde/worden/wird + Partizip II. */
const PASSIVE_AUX = /\b(?:wird|wurde|wurden|werden|worden|sei|seien|wäre(?:n)?|kann|könnte|kann\b.{0,30})\b/i;
const PARTIZIP_II = /\b\w+(?:iert|t|en|et|esen|onnen|ommen|gangen|rungen|funden|lassen|geschehen)\b/i;
const HAT_PASSIV = /\b(?:ist|sind|war|waren)\s+\w+(?:t|en|iert)\b/i;

/** Zählt Silben eines deutschen Wortes (Vokalgruppen-Heuristik). */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouäöüy]+/g);
  let count = Math.max(1, groups ? groups.length : 1);
  // stummes e am Wortende (typisch Duden-Empfehlung: zählen, aber -en/-el mildern)
  if (/e$/.test(w) && w.length > 3 && count > 1) count -= 0.25;
  return count;
}

/** Splittet einen Text in Sätze (Deutsches Satzende: . ! ? …). */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?…])\s+(?=[A-ZÄÖÜ„"'0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function tokenizeWords(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []);
}

/** Zählt Füllwörter in einem Wort-Array (Mehrwort-Phrasen via Textsuche). */
export function countFillers(text: string): { count: number; total: number } {
  const words = tokenizeWords(text);
  const total = words.length;
  if (total === 0) return { count: 0, total: 0 };
  let count = 0;
  for (const w of words) {
    const lw = w.toLowerCase();
    if (FILLER_WORDS.includes(lw)) count++;
  }
  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    const m = text.match(re);
    if (m) count += m.length;
  }
  return { count, total };
}

/** Schätzt die Anzahl Passiv-Sätze (werden-Periphrase + Partizip II). */
export function estimatePassiveSentences(sentences: string[]): number {
  let n = 0;
  for (const s of sentences) {
    if (PASSIVE_AUX.test(s) && PARTIZIP_II.test(s)) n++;
    else if (/\bworden\b/i.test(s)) n++;
    else if (HAT_PASSIV.test(s)) n++;
  }
  return n;
}

/** Berechnet alle Metriken für einen Rohtext (Markdown-bereinigt). */
export function computeReadability(text: string, thresholds: Partial<ReadabilityThresholds> = {}): ReadabilityMetrics & { thresholds: Required<ReadabilityThresholds> } {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };
  // Markdown-Syntax wie in countWords entfernen.
  const cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, "$2")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();

  const words = tokenizeWords(cleaned);
  const wordCount = words.length;
  const sentences = splitSentences(cleaned);
  const sentenceCount = Math.max(1, sentences.length);

  const avgSentenceLength = wordCount / sentenceCount;
  const syllablesTotal = words.reduce((sum, w) => sum + syllables(w), 0);
  const avgSyllablesPerWord = wordCount > 0 ? syllablesTotal / wordCount : 0;
  // Flesch (deutsch): 180 − ASL − 58.5·ASW, geklemmt auf 0..100.
  const fleschRaw = 180 - avgSentenceLength - 58.5 * avgSyllablesPerWord;
  const fleschReadingEase = Math.max(0, Math.min(100, fleschRaw));

  const { count: fillerCount, total } = countFillers(cleaned);
  const fillerRatio = total > 0 ? fillerCount / total : 0;

  const passiveSentences = estimatePassiveSentences(sentences);
  const passiveRatio = sentenceCount > 0 ? passiveSentences / sentenceCount : 0;

  return {
    words: wordCount,
    sentences: sentences.length,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fillerRatio: Math.round(fillerRatio * 1000) / 1000,
    passiveSentences,
    passiveRatio: Math.round(passiveRatio * 1000) / 1000,
    thresholds: th,
  };
}

/** Rundet Füllwort-Quote auf Prozent (0..100). */
export function fillerPercent(ratio: number): number {
  return Math.round(ratio * 1000) / 10;
}

/** Formatiert Metriken für UI-Badges. */
export function formatMetric(key: keyof ReadabilityMetrics, value: number): string {
  switch (key) {
    case "fillerRatio":
    case "passiveRatio":
      return `${Math.round(value * 1000) / 10}%`;
    case "avgSentenceLength":
      return `${Math.round(value * 10) / 10} W/S`;
    case "fleschReadingEase":
      return `FRE ${Math.round(value)}`;
    default:
      return String(value);
  }
}

/** Liefert Warn-Badges für ein Kapitel (Schwellen konfigurierbar). */
export function metricBadges(
  chapter: Chapter,
  thresholds: Partial<ReadabilityThresholds> = {},
): MetricBadge[] {
  const m = computeReadability(chapter.content || chapter.generatedContent || "", thresholds);
  const defs: Array<{ key: keyof ReadabilityMetrics; label: string; value: number; threshold: number; cmp: (v: number, t: number) => boolean }> = [
    { key: "avgSentenceLength", label: "Ø Satzlänge", value: m.avgSentenceLength, threshold: m.thresholds.avgSentenceLength, cmp: (v, t) => v > t },
    { key: "fillerRatio", label: "Füllwörter", value: m.fillerRatio, threshold: m.thresholds.fillerRatio, cmp: (v, t) => v > t },
    { key: "passiveRatio", label: "Passiv", value: m.passiveRatio, threshold: m.thresholds.passiveRatio, cmp: (v, t) => v > t },
    { key: "fleschReadingEase", label: "Flesch", value: m.fleschReadingEase, threshold: m.thresholds.fleschReadingEase, cmp: (v, t) => v < t },
  ];
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    value: d.value,
    formatted: formatMetric(d.key, d.value),
    warn: d.cmp(d.value, d.threshold),
    threshold: d.threshold,
  }));
}

/** Prüft, ob das Straffen-Ergebnis die Füllwort-Quote messbar senkt (≥ 10 % relativ). */
export function fillerReduced(before: number, after: number): boolean {
  if (before <= 0) return false;
  return (before - after) / before >= 0.1;
}

// Re-Export für revise.ts (eine Import-Stelle).
export { countWords };