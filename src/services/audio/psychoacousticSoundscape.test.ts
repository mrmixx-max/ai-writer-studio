/**
 * Tests: PsychoacousticSoundscape (WP 85.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createSoundscape,
  formatSoundscape,
  computeBinauralFrequency,
  createSampleSoundscape,
  BINAURAL_PRESETS,
  NATURE_PROFILES,
} from "./psychoacousticSoundscape";

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

describe("createSoundscape", () => {
  it("erstellt Klanglandschaft", () => {
    const ss = createSoundscape("Test", "alpha", ["fire"], 45, 42);
    expect(ss.name).toBe("Test");
    expect(ss.binauralFreq).toBe("alpha");
  });

  it("ist deterministisch", () => {
    const s1 = createSoundscape("Test", "alpha", ["fire"], 45, 42);
    const s2 = createSoundscape("Test", "alpha", ["fire"], 45, 42);
    expect(s1).toEqual(s2);
  });
});

describe("formatSoundscape", () => {
  it("formatiert Klanglandschaft als Text", () => {
    const ss = createSampleSoundscape();
    const text = formatSoundscape(ss);
    expect(text).toContain("KLANG LANDSCHAFT");
  });
});

describe("computeBinauralFrequency", () => {
  it("berechnet binaurale Frequenz", () => {
    expect(computeBinauralFrequency(200, 40)).toBe(220);
  });
});

describe("createSampleSoundscape", () => {
  it("erstellt Beispiel-Klanglandschaft", () => {
    const ss = createSampleSoundscape();
    expect(ss.name).toBeTruthy();
  });
});

describe("BINAURAL_PRESETS", () => {
  it("hat alle Presets", () => {
    expect(Object.keys(BINAURAL_PRESETS)).toHaveLength(5);
  });
});

describe("NATURE_PROFILES", () => {
  it("hat alle Profile", () => {
    expect(Object.keys(NATURE_PROFILES)).toHaveLength(6);
  });
});