// Hook Analyzer Tests (Sprint 28, Agent 1)
import { describe, it, expect } from "vitest";
import { analyzeHook, analyzeAllHooks } from "./hookAnalyzer";

describe("Hook Analyzer", () => {
  it("analyzeHook returns hook analysis", () => {
    const text = "Plötzlich explodierte die Bombe.";
    const analysis = analyzeHook(text);
    expect(analysis.type).toBeDefined();
    expect(analysis.strength).toBeGreaterThanOrEqual(0);
  });

  it("analyzeAllHooks returns report", () => {
    const text = "Plötzlich explodierte die Bombe.\n\nEs war einmal ein Hund.";
    const report = analyzeAllHooks(text);
    expect(report.hooks.length).toBeGreaterThan(0);
  });
});
