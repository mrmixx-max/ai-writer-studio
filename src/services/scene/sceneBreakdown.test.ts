// Scene Breakdown Tests (Sprint 27, Agent 1)
import { describe, it, expect } from "vitest";
import {
  detectScenes,
  generateSceneBreakdown,
} from "./sceneBreakdown";

describe("Scene Breakdown", () => {
  it("detectScenes finds scenes by headings", () => {
    const text = "# Kapitel 1\nDer Hund bellt.\n\n# Kapitel 2\nDie Katze schläft.";
    const scenes = detectScenes(text);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
  });

  it("detectScenes finds scenes by double newlines", () => {
    const text = "Der Hund bellt. Die Katze schläft.\n\nDer Vogel singt. Die Maus läuft.";
    const scenes = detectScenes(text);
    expect(scenes.length).toBeGreaterThanOrEqual(1);
  });

  it("generateSceneBreakdown returns report", () => {
    const text = "# Kapitel 1\nDer Hund bellt.\n\n# Kapitel 2\nDie Katze schläft.";
    const report = generateSceneBreakdown(text);
    expect(report.totalScenes).toBeGreaterThanOrEqual(2);
    expect(report.scenes.length).toBeGreaterThanOrEqual(2);
  });
});
