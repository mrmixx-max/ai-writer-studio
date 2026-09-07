// Qualitäts-Report Tests (Sprint 17, Agent 6): Struktur, Leerbuch,
// Kapitel-Scores, Markdown-Format, Summary, Top-Empfehlungen, Trend,
// Heuristik-Fallback, Typografie.

import { describe, it, expect } from "vitest";
import {
  generateQualityReport,
  buildQualityMarkdown,
  heuristicChapterScore,
  toChapterScores,
  asciiBar,
  buildTrendChart,
  topSuggestions,
  qualityReportFilename,
} from "./qualityReport";
import type { ChapterQualityResult } from "./quality";

function result(
  idx: number,
  title: string,
  score: number,
  level: ChapterQualityResult["overallLevel"] = "green",
  suggestions: string[] = ["Sätze kürzen."],
  issues: string[] = ["Ein Hinweis."],
): ChapterQualityResult {
  return {
    chapterIndex: idx,
    chapterTitle: title,
    scores: [
      { id: "q1", runId: "r", dimension: "kapitelqualitaet", level, score, details: null },
    ],
    overallLevel: level,
    issues,
    suggestions,
  };
}

const book2 = {
  title: "Testbuch",
  author: "Testautor",
  chapters: [
    { title: "Anfang", content: "Dies ist ein längerer Kapitelinhalt. ".repeat(30) },
    { title: "Mitte", content: "Noch mehr Inhalt hier für das zweite Kapitel. ".repeat(30) },
  ],
};

describe("qualityReport Struktur", () => {
  it("enthält alle Pflichtsektionen", async () => {
    const blob = await generateQualityReport(book2, {
      results: [result(0, "Anfang", 80), result(1, "Mitte", 60, "yellow")],
      generatedAt: new Date("2026-01-15"),
    });
    const md = await blob.text();
    expect(md).toContain("# Qualitätsbericht: Testbuch");
    expect(md).toContain("## Zusammenfassung");
    expect(md).toContain("## Kapitelbewertungen");
    expect(md).toContain("## Top-Empfehlungen");
    expect(md).toContain("## Trend");
  });

  it("Blob ist Markdown", async () => {
    const blob = await generateQualityReport(book2);
    expect(blob.type).toContain("text/markdown");
    const md = await blob.text();
    expect(md.length).toBeGreaterThan(100);
    expect(md.endsWith("\n")).toBe(true);
  });
});

describe("qualityReport leeres Buch", () => {
  it("wirft nicht, meldet fehlende Kapitel", async () => {
    const blob = await generateQualityReport({ title: "Leer", chapters: [] });
    const md = await blob.text();
    expect(md).toContain("keine Kapitel");
    expect(md).toContain("## Zusammenfassung");
    expect(md).toContain("## Top-Empfehlungen");
  });

  it("Trend bei leerem Buch ohne Crash", () => {
    expect(buildTrendChart([])).toContain("kein Trend");
  });
});

describe("qualityReport Kapitel-Scores", () => {
  it("listet jedes Kapitel mit Score in Tabelle + Detail", async () => {
    const md = buildQualityMarkdown(book2, {
      results: [result(0, "Anfang", 80), result(1, "Mitte", 45, "yellow")],
    });
    expect(md).toContain("| 1 | Anfang | 80/100 |");
    expect(md).toContain("| 2 | Mitte | 45/100 |");
    expect(md).toContain("### Kapitel 1: Anfang");
    expect(md).toContain("### Kapitel 2: Mitte");
  });

  it("Summary-Mittelwert stimmt (80+60)/2=70", () => {
    const md = buildQualityMarkdown(book2, {
      results: [result(0, "Anfang", 80), result(1, "Mitte", 60, "yellow")],
    });
    expect(md).toContain("**Gesamtbewertung:** 70/100");
    expect(md).toContain("🟢 1 · 🟡 1 · 🔴 0");
  });
});

describe("qualityReport Empfehlungen & Trend", () => {
  it("Top-Empfehlungen aggregiert + limitiert", () => {
    const scores = toChapterScores(book2, [
      result(0, "Anfang", 80, "green", ["Sätze kürzen.", "Mehr Dialog."]),
      result(1, "Mitte", 60, "yellow", ["Sätze kürzen."]),
    ]);
    const top = topSuggestions(scores, 1);
    expect(top).toHaveLength(1);
    expect(top[0]).toContain("Sätze kürzen.");
    expect(top[0]).toContain("Kap. 1, 2");
  });

  it("Trend-Chart enthält ASCII-Balken je Kapitel", () => {
    const scores = toChapterScores(book2, [result(0, "Anfang", 80), result(1, "Mitte", 60, "yellow")]);
    const chart = buildTrendChart(scores);
    expect(chart).toContain("Kap. 1");
    expect(chart).toContain("Kap. 2");
    expect(chart).toMatch(/[█░]+/);
    expect(asciiBar(100)).toBe("█".repeat(20));
    expect(asciiBar(0)).toBe("░".repeat(20));
  });

  it("includeTrend=false blendet Trend aus", () => {
    const md = buildQualityMarkdown(book2, { includeTrend: false });
    expect(md).not.toContain("## Trend");
  });
});

describe("qualityReport Heuristik & Typografie", () => {
  it("Heuristik ohne Results bewertet Kapitel (Fallback)", () => {
    const scores = toChapterScores(book2, undefined);
    expect(scores).toHaveLength(2);
    expect(scores[0].score).toBeGreaterThan(50);
  });

  it("leeres Kapitel -> Score 0, rot", () => {
    const s = heuristicChapterScore(0, "Leer", "");
    expect(s.score).toBe(0);
    expect(s.level).toBe("red");
    expect(s.issues.join()).toContain("leer");
  });

  it("normalisiert Typografie (gerade Quotes -> deutsch)", () => {
    const md = buildQualityMarkdown(
      { title: 'Test "Report"', chapters: [{ title: "K1", content: "Inhalt. ".repeat(40) }] },
      { generatedAt: new Date("2026-01-15") },
    );
    expect(md).toContain("„Report“");
    expect(md).not.toContain('"Report"');
  });

  it("Dateiname ist filesystem-sicher", () => {
    expect(qualityReportFilename("Mein: Buch?")).toBe("Mein_ Buch_-qualitaetsbericht.md");
  });
});
