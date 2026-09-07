// Qualitäts-Report (Sprint 17, Agent 6): Markdown-Qualitätsbericht für ein Buch.
//
// Reuse der Export-Infrastruktur:
// - `normalizeTypography` aus ./export/typography (Report-Texte normalisiert)
// - Blob-Typ `text/markdown;charset=utf-8` wie in ./export/index (markdown)
// - `BookChapterInput` / `ExportBookInput`-kompatible Typen aus ./export/types
//
// API: `generateQualityReport(book, options): Promise<Blob>`
// - summary: Gesamt-Score, Ampel-Verteilung, Kapitelanzahl
// - per-chapter scores: Tabelle + Detailsektion je Kapitel
// - top suggestions: Top-N-Empfehlungen über alle Kapitel
// - trend chart: ASCII-Balken (Code-Block) + CSS-Balken (HTML) je Kapitel

import { normalizeTypography } from "./export/typography";
import type { BookChapterInput } from "./export/types";
import type { ChapterQualityResult } from "./quality";
import { DIMENSION_LABELS } from "@/types/bookwriter";

/** Eingabebuch — kompatibel zu ExportBookInput. */
export interface QualityReportBook {
  title: string;
  author?: string;
  language?: string;
  chapters: BookChapterInput[];
}

export interface QualityReportOptions {
  /** Vorgefertigte Kapitel-Ergebnisse (z. B. aus runQualityLoop). */
  results?: ChapterQualityResult[];
  /** Max. Anzahl Top-Empfehlungen (Default: 5). */
  maxSuggestions?: number;
  /** Trend-Diagramm einschließen (Default: true). */
  includeTrend?: boolean;
  /** Stichtag (Default: jetzt). */
  generatedAt?: Date;
}

export interface ChapterScore {
  chapterIndex: number;
  title: string;
  score: number;
  level: "green" | "yellow" | "red";
  issues: string[];
  suggestions: string[];
}

const LEVEL_ICON: Record<ChapterScore["level"], string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const LEVEL_LABEL: Record<ChapterScore["level"], string> = {
  green: "Gut",
  yellow: "Überarbeiten",
  red: "Kritisch",
};

function levelForScore(score: number): ChapterScore["level"] {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Deterministische Heuristik-Bewertung (Fallback ohne LLM-Ergebnisse). */
export function heuristicChapterScore(
  chapterIndex: number,
  title: string,
  content: string,
): ChapterScore {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 85;

  const words = countWords(content);
  if (words === 0) {
    return {
      chapterIndex,
      title,
      score: 0,
      level: "red",
      issues: ["Kapitel ist leer."],
      suggestions: ["Kapitelinhalt ergänzen."],
    };
  }
  if (words < 50) {
    score -= 25;
    issues.push(`Sehr kurz (${words} Wörter).`);
    suggestions.push("Kapitel mit Beispiel oder Szene vertiefen.");
  } else if (words < 200) {
    score -= 10;
    issues.push(`Kurz (${words} Wörter).`);
    suggestions.push("Kapitel ggf. um Details ergänzen.");
  }

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const long = sentences.filter((s) => countWords(s) > 35);
  if (long.length > 2) {
    score -= Math.min(15, long.length * 3);
    issues.push(`${long.length} sehr lange Sätze (über 35 Wörter).`);
    suggestions.push("Lange Sätze in kürzere Einheiten aufteilen.");
  }

  const fillers = ["eigentlich", "irgendwie", "quasi", "letztlich", "gewissermassen", "gewissermaßen"];
  const found = fillers.filter((f) => content.toLowerCase().includes(f));
  if (found.length >= 2) {
    score -= 8;
    issues.push(`Füllwörter gefunden: ${found.join(", ")}.`);
    suggestions.push("Füllwörter streichen oder ersetzen.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { chapterIndex, title, score, level: levelForScore(score), issues, suggestions };
}

/** Normiert ChapterQualityResult[] → ChapterScore[] (aggregiert Scores/Issues). */
export function toChapterScores(
  book: QualityReportBook,
  results?: ChapterQualityResult[],
): ChapterScore[] {
  return book.chapters.map((c, i) => {
    const r = results?.find((x) => x.chapterIndex === i);
    if (!r) return heuristicChapterScore(i, c.title, plainText(c.content));
    const avg =
      r.scores.length > 0
        ? Math.round(r.scores.reduce((s, x) => s + x.score, 0) / r.scores.length)
        : 50;
    return {
      chapterIndex: i,
      title: r.chapterTitle || c.title,
      score: avg,
      level: r.overallLevel,
      issues: r.issues,
      suggestions: r.suggestions,
    };
  });
}

/** Extrahiert Klartext aus TipTap-JSON (Fallback: Rohtext). */
function plainText(content: string): string {
  if (!content) return "";
  const t = content.trim();
  if (t.startsWith("{")) {
    try {
      const doc = JSON.parse(t);
      const out: string[] = [];
      const walk = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        const node = n as Record<string, unknown>;
        if (typeof node.text === "string") out.push(node.text);
        if (Array.isArray(node.content)) node.content.forEach(walk);
      };
      walk(doc);
      return out.join(" ");
    } catch {
      return content;
    }
  }
  return content;
}

/** ASCII-Balken (20 Zeichen) für einen Score. */
export function asciiBar(score: number): string {
  const filled = Math.round(score / 5);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

/** Trend-Diagramm als ASCII-Code-Block. */
export function buildTrendChart(scores: ChapterScore[]): string {
  if (scores.length === 0) return "Keine Kapitel vorhanden — kein Trend verfügbar.";
  const lines = scores.map(
    (s) => `Kap. ${s.chapterIndex + 1} ${asciiBar(s.score)} ${s.score}/100 ${LEVEL_ICON[s.level]}`,
  );
  return lines.join("\n");
}

/** CSS-Balken (HTML, Markdown-kompatibel) je Kapitel. */
export function buildCssBars(scores: ChapterScore[]): string {
  if (scores.length === 0) return "";
  const color = (l: ChapterScore["level"]): string =>
    l === "green" ? "#2da44e" : l === "yellow" ? "#bf8700" : "#cf222e";
  return scores
    .map(
      (s) =>
        `<div>Kap. ${s.chapterIndex + 1} — ${escapeHtml(s.title)}: ` +
        `<div style="background:#eee;border-radius:4px;width:220px;display:inline-block;vertical-align:middle;">` +
        `<div style="background:${color(s.level)};width:${s.score}%;height:10px;border-radius:4px;"></div>` +
        `</div> ${s.score}/100</div>`,
    )
    .join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Top-N-Empfehlungen über alle Kapitel (Häufigkeit + Kapitelreferenz). */
export function topSuggestions(scores: ChapterScore[], max = 5): string[] {
  const counts = new Map<string, { n: number; chapters: number[] }>();
  for (const s of scores) {
    for (const sug of s.suggestions) {
      const e = counts.get(sug) ?? { n: 0, chapters: [] };
      e.n += 1;
      e.chapters.push(s.chapterIndex + 1);
      counts.set(sug, e);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, Math.max(1, max))
    .map(([sug, e]) => `${sug} (Kap. ${[...new Set(e.chapters)].join(", ")})`);
}

/** Reiner Markdown-Builder (synchron, testbar). */
export function buildQualityMarkdown(
  book: QualityReportBook,
  options: QualityReportOptions = {},
): string {
  const { maxSuggestions = 5, includeTrend = true, generatedAt = new Date() } = options;
  const title = normalizeTypography(book.title || "Unbenanntes Buch");
  const author = book.author ?? "Unbekannt";
  const date = generatedAt.toISOString().slice(0, 10);
  const scores = toChapterScores(book, options.results);

  const avg =
    scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : 0;
  const overall = scores.length > 0 ? levelForScore(avg) : "yellow";
  const dist = {
    green: scores.filter((s) => s.level === "green").length,
    yellow: scores.filter((s) => s.level === "yellow").length,
    red: scores.filter((s) => s.level === "red").length,
  };

  const parts: string[] = [];
  parts.push(`# Qualitätsbericht: ${title}\n`);
  parts.push(`**Autor:** ${author} | **Datum:** ${date} | **Kapitel:** ${scores.length}\n`);

  parts.push(`## Zusammenfassung\n`);
  if (scores.length === 0) {
    parts.push(`Das Buch enthält keine Kapitel — keine Bewertung möglich.\n`);
  } else {
    parts.push(
      `- **Gesamtbewertung:** ${avg}/100 ${LEVEL_ICON[overall]} (${LEVEL_LABEL[overall]})\n` +
        `- **Verteilung:** 🟢 ${dist.green} · 🟡 ${dist.yellow} · 🔴 ${dist.red}\n` +
        `- **Kapitel bewertet:** ${scores.length}\n`,
    );
  }

  parts.push(`## Kapitelbewertungen\n`);
  if (scores.length === 0) {
    parts.push(`Keine Kapitelbewertungen vorhanden.\n`);
  } else {
    parts.push(
      `| Kapitel | Titel | Score | Status |\n|---|---|---|---|\n` +
        scores
          .map(
            (s) =>
              `| ${s.chapterIndex + 1} | ${normalizeTypography(s.title)} | ${s.score}/100 | ${LEVEL_ICON[s.level]} ${LEVEL_LABEL[s.level]} |`,
          )
          .join("\n") + `\n`,
    );
    for (const s of scores) {
      const label = DIMENSION_LABELS.kapitelqualitaet;
      parts.push(
        `### Kapitel ${s.chapterIndex + 1}: ${normalizeTypography(s.title)}\n\n` +
          `- **${label}:** ${s.score}/100 ${LEVEL_ICON[s.level]}\n` +
          (s.issues.length > 0
            ? `- **Auffälligkeiten:**\n${s.issues.map((i) => `  - ${normalizeTypography(i)}`).join("\n")}\n`
            : `- **Auffälligkeiten:** keine\n`) +
          (s.suggestions.length > 0
            ? `- **Empfehlungen:**\n${s.suggestions.map((g) => `  - ${normalizeTypography(g)}`).join("\n")}\n`
            : ``),
      );
    }
  }

  parts.push(`## Top-Empfehlungen\n`);
  const top = topSuggestions(scores, maxSuggestions);
  parts.push(
    top.length === 0
      ? `Keine Empfehlungen — alle Kapitel ohne Befund.\n`
      : top.map((t, i) => `${i + 1}. ${normalizeTypography(t)}`).join("\n") + `\n`,
  );

  if (includeTrend) {
    parts.push(`## Trend\n`);
    parts.push(`\`\`\`\n${buildTrendChart(scores)}\n\`\`\`\n`);
    const css = buildCssBars(scores);
    if (css) parts.push(css + `\n`);
  }

  return parts.join("\n") + "\n";
}

/**
 * Generiert den Qualitätsbericht als Markdown-Blob (Export-Infrastruktur-kompatibel:
 * `text/markdown;charset=utf-8`, per `saveExportBlob(..., "md")` speicherbar).
 */
export async function generateQualityReport(
  book: QualityReportBook,
  options: QualityReportOptions = {},
): Promise<Blob> {
  const md = buildQualityMarkdown(book, options);
  return new Blob([md], { type: "text/markdown;charset=utf-8" });
}

/** Dateiname für den Report (analog zu sanitizeFilename im Export). */
export function qualityReportFilename(title: string): string {
  const safe = title.replace(/[<>:"/\\|?*]/g, "_").trim() || "qualitaetsbericht";
  return `${safe}-qualitaetsbericht.md`;
}
