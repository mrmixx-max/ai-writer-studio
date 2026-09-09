// Genre Analyzer Tests (Sprint 27, Agent 6)
import { describe, it, expect } from "vitest";
import { analyzeGenre } from "./genreAnalyzer";

describe("Genre Analyzer", () => {
  it("analyzeGenre returns analysis", () => {
    const text = "Der Mord wurde vom Detektiv aufgeklärt. Das Opfer wurde gefunden.";
    const analysis = analyzeGenre(text);
    expect(analysis.primaryGenre).toBeDefined();
    expect(analysis.scores.length).toBeGreaterThan(0);
  });

  it("analyzeGenre returns default for empty text", () => {
    const analysis = analyzeGenre("");
    expect(analysis.primaryGenre).toBe("Unbekannt");
  });
});
