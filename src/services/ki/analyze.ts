// Feature: KI-Analysen — Sentiment, Stil und Lesbarkeit.
// Rein heuristisch (offline, keine Netzwerkkosten) auf deutschem Text.
// Ergebnisse strukturiert für die Anzeige im KI-Panel.

export type SentimentLabel = "positiv" | "neutral" | "negativ";

export interface SentimentResult {
  label: SentimentLabel;
  score: number; // -1..+1
  hits: string[];
}

export interface StyleResult {
  avgSentenceLength: number; // Wörter/Satz
  avgWordLength: number; // Zeichen/Wort
  adverbRatio: number; // Anteil -weise/-lich-Adverbien grob
  passiveHits: string[]; // erkannte Passiv-Konstruktionen
  fillerHits: string[]; // Füllwörter
  dialogueRatio: number; // Anteil Absätze mit direkter Rede
}

export interface ReadabilityResult {
  lix: number; // LIX-Index (deutsch üblich): 20-30 einfach … >60 sehr schwer
  level: string;
  longWordRatio: number; // Wörter > 6 Buchstaben
}

export interface AnalysisResult {
  sentiment: SentimentResult;
  style: StyleResult;
  readability: ReadabilityResult;
}

const POSITIVE = ["glücklich", "freude", "lächeln", "liebe", "hoffnung", "licht", "gewinnen", "froh", "schön", "mut", "herzlich", "freuen", "frieden", "strahlend", "gelungen", "wunderbar", "sanft", "warm"];
const NEGATIVE = ["angst", "schmerz", "tod", "trauer", "hass", "dunkel", "blut", "weinen", "furcht", "kalt", "elend", "verzweiflung", "schreien", "wut", "hass", "verloren", "einsam", "grausam", "fluch", "zittern"];

const FILLER = ["irgendwie", "eigentlich", "gewissermaßen", "sozusagen", "übrigens", "bekanntlich", "quasi", "praktisch", "wirklich", "sehr"];

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{M}'-]+/gu) ?? [];
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Sentiment: Lexikon-basierte Stimmungsanalyse (positiv/negativ/neutral). */
export function analyzeSentiment(text: string): SentimentResult {
  const w = words(text);
  if (!w.length) return { label: "neutral", score: 0, hits: [] };
  let score = 0;
  const hits: string[] = [];
  for (const word of w) {
    if (POSITIVE.some((p) => word.includes(p))) { score += 1; hits.push(word); }
    else if (NEGATIVE.some((n) => word.includes(n))) { score -= 1; hits.push(word); }
  }
  const normalized = Math.max(-1, Math.min(1, score / Math.max(12, w.length / 40)));
  const label: SentimentLabel = normalized > 0.15 ? "positiv" : normalized < -0.15 ? "negativ" : "neutral";
  return { label, score: Math.round(normalized * 100) / 100, hits: [...new Set(hits)].slice(0, 10) };
}

/** Stil: Satzlänge, Wortlänge, Füllwörter, Passiv, Dialoganteil. */
export function analyzeStyle(text: string): StyleResult {
  const w = words(text);
  const sents = sentences(text);
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
  const adverbs = w.filter((x) => x.endsWith("weise") || x.endsWith("barlich"));
  const passiveHits: string[] = [];
  const passiveRe = /\bw(?:urde[n]?|erden)\b[^.!?]{0,60}?\b\p{L}+(?:t|en)\b/giu;
  for (const m of text.matchAll(passiveRe)) passiveHits.push(m[0].trim().slice(0, 80));
  const fillerHits = [...new Set(w.filter((x) => FILLER.includes(x)))];
  const dialogueParas = paras.filter((p) => /[»«"„“]|\u2014 /.test(p) || /^[»"„“]/.test(p.trim())).length;
  return {
    avgSentenceLength: sents.length ? Math.round((w.length / sents.length) * 10) / 10 : 0,
    avgWordLength: w.length ? Math.round((w.join("").length / w.length) * 100) / 100 : 0,
    adverbRatio: w.length ? Math.round((adverbs.length / w.length) * 1000) / 1000 : 0,
    passiveHits: passiveHits.slice(0, 5),
    fillerHits,
    dialogueRatio: paras.length ? Math.round((dialogueParas / paras.length) * 100) / 100 : 0,
  };
}

/** Lesbarkeit: LIX (deutsch etabliert) + Anteil langer Wörter. */
export function analyzeReadability(text: string): ReadabilityResult {
  const w = words(text);
  const sents = sentences(text);
  const longWords = w.filter((x) => x.length > 6).length;
  if (!w.length || !sents.length) return { lix: 0, level: "—", longWordRatio: 0 };
  const lix = Math.round((w.length / sents.length + (100 * longWords) / w.length) * 10) / 10;
  const level =
    lix < 30 ? "sehr einfach (Kinderbuch)" :
    lix < 40 ? "einfach (Sachtext breit)" :
    lix < 50 ? "mittel (Standard-Literatur)" :
    lix < 60 ? "schwer (Fachtext)" :
    "sehr schwer (wissenschaftlich)";
  return { lix, level, longWordRatio: Math.round((longWords / w.length) * 100) / 100 };
}

/** Vollständige Analyse: Sentiment + Stil + Lesbarkeit in einem Aufruf. */
export function analyzeText(text: string): AnalysisResult {
  return {
    sentiment: analyzeSentiment(text),
    style: analyzeStyle(text),
    readability: analyzeReadability(text),
  };
}

/** Formatiert ein Analyseergebnis als lesbaren Text (für Panel/Dokument). */
export function formatAnalysis(r: AnalysisResult): string {
  const s = r.sentiment;
  const st = r.style;
  const rd = r.readability;
  return [
    `KI-Analyse`,
    `──────────`,
    `Sentiment: ${s.label} (Score ${s.score})${s.hits.length ? ` – Treffer: ${s.hits.join(", ")}` : ""}`,
    `Stil: ⌀ Satzlänge ${st.avgSentenceLength} Wörter · ⌀ Wortlänge ${st.avgWordLength} Zeichen` +
      `${st.fillerHits.length ? ` · Füllwörter: ${st.fillerHits.join(", ")}` : ""}` +
      `${st.passiveHits.length ? ` · Passiv: ${st.passiveHits.length}×` : ""}` +
      ` · Dialoganteil ${Math.round(st.dialogueRatio * 100)}%`,
    `Lesbarkeit: LIX ${rd.lix} – ${rd.level} · lange Wörter ${Math.round(rd.longWordRatio * 100)}%`,
  ].join("\n");
}
