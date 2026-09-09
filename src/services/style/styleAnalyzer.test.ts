// Style Analyzer Tests (Sprint 27, Agent 5)
import { describe, it, expect } from "vitest";
import { analyzeStyle } from "./styleAnalyzer";

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
