// Pacing Map Tests (Sprint 28, Agent 4)
import { describe, it, expect } from "vitest";
import { generatePacingMap } from "./pacingMap";

describe("Pacing Map", () => {
  it("generatePacingMap returns map", () => {
    const text = "Der Hund bellt. Die Katze schläft. Der Vogel singt. Die Maus läuft.";
    const map = generatePacingMap(text, 2);
    expect(map.segments.length).toBeGreaterThan(0);
    expect(map.totalWords).toBeGreaterThan(0);
  });
});
