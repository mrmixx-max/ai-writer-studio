// Writing Pace Analysis Tests (Sprint 27, Agent 4)
import { describe, it, expect } from "vitest";
import {
  analyzeWritingPace,
  generatePaceAscii,
} from "./writingPaceAnalysis";

describe("Writing Pace Analysis", () => {
  it("analyzeWritingPace returns analysis", () => {
    const text = "Der Hund bellt. Die Katze schläft. Der Vogel singt. Die Maus läuft.";
    const analysis = analyzeWritingPace(text);
    expect(analysis.overallPace).toBeDefined();
    expect(analysis.points.length).toBeGreaterThan(0);
  });

  it("generatePaceAscii returns string", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const analysis = analyzeWritingPace(text);
    const ascii = generatePaceAscii(analysis);
    expect(ascii.length).toBeGreaterThan(0);
  });
});
