// Style Analyzer Tests (Sprint 27, Agent 5; Sprint 30: Autoren-Vergleich)
import { describe, it, expect } from "vitest";
import { analyzeStyle, analyzeTextProfile, compareToAllAuthors, getAvailableAuthors } from "./styleAnalyzer";

describe("Style Analyzer", () => {
  it("analyzeStyle returns analysis", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const analysis = analyzeStyle(text);
    expect(analysis.style).toBeDefined();
    expect(analysis.metrics.vocabularyRichness).toBeGreaterThan(0);
  });

  it("analyzeStyle returns default for empty text", () => {
    const analysis = analyzeStyle("");
    expect(analysis.style).toBe("conversational");
  });
});

describe("Style Autoren-Vergleich (Sprint 30)", () => {
  const sample = "Er rannte durch die Nacht. \"Bleib stehen!\", rief sie. Der Regen peitschte ihm ins Gesicht. Er blieb nicht stehen. Nie wieder.";

  it("getAvailableAuthors liefert 10 Autoren-Namen als Strings", () => {
    const authors = getAvailableAuthors();
    expect(authors).toHaveLength(10);
    expect(authors).toContain("Ernest Hemingway");
    expect(authors).toContain("Jerry Cotton");
  });

  it("analyzeTextProfile misst echte Metriken", () => {
    const p = analyzeTextProfile(sample);
    expect(p.author).toBe("Dein Text");
    expect(p.avgSentenceLength).toBeGreaterThan(0);
    expect(["slow", "medium", "fast"]).toContain(p.pacing);
  });

  it("compareToAllAuthors liefert sortierte Vergleiche + Verdict", () => {
    const r = compareToAllAuthors(sample);
    expect(r.comparisons).toHaveLength(10);
    expect(r.verdict).toContain("Am nächsten an");
    for (let i = 1; i < r.comparisons.length; i++) {
      expect(r.comparisons[i - 1].similarity).toBeGreaterThanOrEqual(r.comparisons[i].similarity);
      expect(r.comparisons[i].similarity).toBeGreaterThanOrEqual(0);
      expect(r.comparisons[i].similarity).toBeLessThanOrEqual(100);
    }
  });
});
