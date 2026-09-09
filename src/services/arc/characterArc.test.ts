// Character Arc Tests (Sprint 28, Agent 3)
import { describe, it, expect } from "vitest";
import { analyzeCharacterArc } from "./characterArc";

describe("Character Arc", () => {
  it("analyzeCharacterArc returns arc", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const arc = analyzeCharacterArc(text);
    expect(arc.points.length).toBeGreaterThan(0);
    expect(arc.arcType).toBeDefined();
  });
});
