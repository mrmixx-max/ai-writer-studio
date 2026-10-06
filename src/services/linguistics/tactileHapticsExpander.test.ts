/**
 * Tests: TactileHapticsExpander (WP 78.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  analyzeTexture,
  expandDescription,
  formatHapticAnalysis,
  createSampleAnalysis,
  DIMENSION_LABELS,
} from "./tactileHapticsExpander";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("analyzeTexture", () => {
  it("analysiert Textur", () => {
    const analysis = analyzeTexture("Test", 42);
    expect(analysis.object).toBe("Test");
    expect(analysis.profiles).toHaveLength(5);
  });

  it("ist deterministisch", () => {
    const a1 = analyzeTexture("Test", 42);
    const a2 = analyzeTexture("Test", 42);
    expect(a1).toEqual(a2);
  });

  it("hat Intensität zwischen 0 und 100", () => {
    const analysis = analyzeTexture("Test", 42);
    expect(analysis.overallIntensity).toBeGreaterThanOrEqual(0);
    expect(analysis.overallIntensity).toBeLessThanOrEqual(100);
  });
});

describe("expandDescription", () => {
  it("erweitert Beschreibung", () => {
    const expanded = expandDescription("Die Tür war alt.", 42);
    expect(expanded.length).toBeGreaterThan("Die Tür war alt.".length);
  });

  it("ist deterministisch", () => {
    const e1 = expandDescription("Test", 42);
    const e2 = expandDescription("Test", 42);
    expect(e1).toBe(e2);
  });
});

describe("formatHapticAnalysis", () => {
  it("formatiert Analyse als Text", () => {
    const analysis = createSampleAnalysis();
    const text = formatHapticAnalysis(analysis);
    expect(text).toContain("HAPTISCHE ANALYSE");
  });
});

describe("createSampleAnalysis", () => {
  it("erstellt Beispiel-Analyse", () => {
    const analysis = createSampleAnalysis();
    expect(analysis.object).toBeTruthy();
    expect(analysis.profiles.length).toBe(5);
  });
});

describe("DIMENSION_LABELS", () => {
  it("hat alle Dimensionen", () => {
    expect(Object.keys(DIMENSION_LABELS)).toHaveLength(5);
  });
});
