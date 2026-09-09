// Story Structure Tests (Sprint 28, Agent 6)
import { describe, it, expect } from "vitest";
import { analyzeStoryStructure } from "./storyStructure";

describe("Story Structure", () => {
  it("analyzeStoryStructure returns structure", () => {
    const text = "Es war einmal ein Hund. Plötzlich explodierte die Bombe. Der Hund bellt. Die Katze schläft. Das Ende.";
    const structure = analyzeStoryStructure(text);
    expect(structure.points.length).toBeGreaterThan(0);
    expect(structure.structureType).toBeDefined();
  });
});
