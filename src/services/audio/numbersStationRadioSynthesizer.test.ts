// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  buildRadioAtmosphere,
  generateNumbersTransmission,
  createRadioPlayerState,
  buildRadioPlayerPatch,
  createSampleTransmission,
  createSampleRadioPlayerState,
} from "./numbersStationRadioSynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
  it("erzeugt konsistente 32-bit Werte", () => {
    const h = hashString("hello");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("buildRadioAtmosphere", () => {
  it("enthält ein oscillators Array", () => {
    const a = buildRadioAtmosphere();
    expect(Array.isArray(a.oscillators)).toBe(true);
    expect(a.oscillators.length).toBeGreaterThan(0);
  });
  it("hat eine noiseLevel im gültigen Bereich", () => {
    const a = buildRadioAtmosphere();
    expect(a.noiseLevel).toBeGreaterThanOrEqual(0);
    expect(a.noiseLevel).toBeLessThanOrEqual(1);
  });
  it("hat eine fadingRate", () => {
    const a = buildRadioAtmosphere();
    expect(typeof a.fadingRate).toBe("number");
    expect(a.fadingRate).toBeGreaterThanOrEqual(0);
    expect(a.fadingRate).toBeLessThanOrEqual(1);
  });
  it("hat eine Beschreibung", () => {
    const a = buildRadioAtmosphere();
    expect(typeof a.description).toBe("string");
    expect(a.description.length).toBeGreaterThan(0);
  });
});

describe("generateNumbersTransmission", () => {
  it("erzeugt ein blocks Array", () => {
    const t = generateNumbersTransmission(123);
    expect(Array.isArray(t.blocks)).toBe(true);
    expect(t.blocks.length).toBeGreaterThan(0);
  });
  it("hat einen intro und outro", () => {
    const t = generateNumbersTransmission(123);
    expect(typeof t.intro).toBe("string");
    expect(t.intro.length).toBeGreaterThan(0);
    expect(typeof t.outro).toBe("string");
    expect(t.outro.length).toBeGreaterThan(0);
  });
  it("hat einen gültigen voiceType", () => {
    const t = generateNumbersTransmission(123);
    expect(["female", "male", "robot"]).toContain(t.voiceType);
  });
  it("hat eine frequency", () => {
    const t = generateNumbersTransmission(123);
    expect(typeof t.frequency).toBe("string");
    expect(t.frequency).toMatch(/\d+\.\d{3} MHz/);
  });
});

describe("createRadioPlayerState", () => {
  it("ist isPlaying false", () => {
    expect(createRadioPlayerState().isPlaying).toBe(false);
  });
  it("hat currentBlock 0", () => {
    expect(createRadioPlayerState().currentBlock).toBe(0);
  });
  it("hat totalBlocks 3", () => {
    expect(createRadioPlayerState().totalBlocks).toBe(3);
  });
  it("hat elapsedSeconds 0", () => {
    expect(createRadioPlayerState().elapsedSeconds).toBe(0);
  });
  it("hat totalSeconds 180", () => {
    expect(createRadioPlayerState().totalSeconds).toBe(180);
  });
  it("hat eine frequency", () => {
    expect(createRadioPlayerState().frequency).toBe("7.425 MHz");
  });
});

describe("buildRadioPlayerPatch", () => {
  it("erzeugt einen gültigen Patch", () => {
    const p = buildRadioPlayerPatch(createRadioPlayerState());
    expect(Array.isArray(p.oscillators)).toBe(true);
    expect(p.oscillators.length).toBeGreaterThan(0);
    expect(typeof p.noiseLevel).toBe("number");
    expect(Array.isArray(p.gainNodes)).toBe(true);
    expect(Array.isArray(p.connections)).toBe(true);
  });
});

describe("createSampleTransmission und createSampleRadioPlayerState", () => {
  it("createSampleTransmission liefert gültige Werte", () => {
    const t = createSampleTransmission();
    expect(Array.isArray(t.blocks)).toBe(true);
    expect(t.blocks.length).toBeGreaterThan(0);
    expect(typeof t.intro).toBe("string");
    expect(typeof t.outro).toBe("string");
    expect(typeof t.frequency).toBe("string");
  });
  it("createSampleRadioPlayerState liefert gültige Werte", () => {
    const s = createSampleRadioPlayerState();
    expect(s.isPlaying).toBe(true);
    expect(s.currentBlock).toBe(1);
    expect(s.elapsedSeconds).toBeGreaterThan(0);
  });
});