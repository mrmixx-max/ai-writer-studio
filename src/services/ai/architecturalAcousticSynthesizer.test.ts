/**
 * Tests: ArchitecturalAcousticSynthesizer (WP 79.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  computeReverbTime,
  computeFlutterEcho,
  computeSpeechClarity,
  computeAcoustics,
  formatAcousticResult,
  createSampleAcousticResult,
  MATERIAL_LABELS,
  LIGHT_LABELS,
} from "./architecturalAcousticSynthesizer";

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

describe("computeReverbTime", () => {
  it("berechnet Nachhallzeit", () => {
    const rt = computeReverbTime({ ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    expect(rt).toBeGreaterThan(0);
  });

  it("gibt 0 für ungültiges Material", () => {
    const rt = computeReverbTime({ ceilingHeightM: 8, volumeM3: 500, material: "concrete", lightSource: "candle" });
    expect(rt).toBeGreaterThan(0);
  });
});

describe("computeFlutterEcho", () => {
  it("berechnet Flutterecho", () => {
    const fe = computeFlutterEcho({ ceilingHeightM: 8, volumeM3: 500, material: "concrete", lightSource: "candle" });
    expect(fe).toBeGreaterThanOrEqual(0);
    expect(fe).toBeLessThanOrEqual(100);
  });
});

describe("computeSpeechClarity", () => {
  it("berechnet Sprachverständlichkeit", () => {
    const sc = computeSpeechClarity({ ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    expect(sc).toBeGreaterThanOrEqual(0);
    expect(sc).toBeLessThanOrEqual(100);
  });
});

describe("computeAcoustics", () => {
  it("berechnet vollständige Akustik", () => {
    const result = computeAcoustics({ ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    expect(result.reverbTimeSec).toBeGreaterThan(0);
    expect(result.flutterEcho).toBeGreaterThanOrEqual(0);
    expect(result.speechClarity).toBeGreaterThanOrEqual(0);
  });

  it("ist deterministisch", () => {
    const r1 = computeAcoustics({ ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    const r2 = computeAcoustics({ ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    expect(r1).toEqual(r2);
  });
});

describe("formatAcousticResult", () => {
  it("formatiert Ergebnis als Text", () => {
    const result = createSampleAcousticResult();
    const text = formatAcousticResult(result, { ceilingHeightM: 8, volumeM3: 500, material: "limestone", lightSource: "candle" });
    expect(text).toContain("RAUM-AKUSTIK");
  });
});

describe("createSampleAcousticResult", () => {
  it("erstellt Beispiel-Ergebnis", () => {
    const result = createSampleAcousticResult();
    expect(result.reverbTimeSec).toBeGreaterThan(0);
  });
});

describe("MATERIAL_LABELS", () => {
  it("hat alle Material-Labels", () => {
    expect(Object.keys(MATERIAL_LABELS)).toHaveLength(6);
  });
});

describe("LIGHT_LABELS", () => {
  it("hat alle Licht-Labels", () => {
    expect(Object.keys(LIGHT_LABELS)).toHaveLength(5);
  });
});
