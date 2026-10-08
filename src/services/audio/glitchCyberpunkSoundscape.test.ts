// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SOUNDSCAPE_LAYERS,
  getSoundscapeLayer,
  generateSoundscapePreset,
  buildWebAudioPatch,
  NETRUNNING_EFFECTS,
  getNetrunningEffect,
  createInitialPlayerState,
  createSampleSoundscapePreset,
  createSampleWebAudioPatch,
} from "./glitchCyberpunkSoundscape";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(31);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("SOUNDSCAPE_LAYERS", () => {
  it("enthält fünf Soundscape-Schichten", () => {
    expect(SOUNDSCAPE_LAYERS).toHaveLength(5);
  });
  it("jede Schicht hat Frequenz, Modulation und Lautstärke", () => {
    for (const l of SOUNDSCAPE_LAYERS) {
      expect(l.baseFrequency).toBeGreaterThan(0);
      expect(l.modulationRate).toBeGreaterThanOrEqual(0);
      expect(l.modulationDepth).toBeGreaterThanOrEqual(0);
      expect(l.modulationDepth).toBeLessThanOrEqual(1);
      expect(l.gain).toBeGreaterThanOrEqual(0);
      expect(l.gain).toBeLessThanOrEqual(1);
    }
  });
  it("Bass-Drone hat die tiefste Frequenz", () => {
    const bass = getSoundscapeLayer("bassDrone")!;
    for (const l of SOUNDSCAPE_LAYERS) {
      if (l.id !== "bassDrone") expect(bass.baseFrequency).toBeLessThanOrEqual(l.baseFrequency);
    }
  });
  it("getSoundscapeLayer lieferv undefined für unbekannt", () => {
    expect(getSoundscapeLayer("xyz" as never)).toBeUndefined();
  });
});

describe("generateSoundscapePreset", () => {
  it("ist deterministisch", () => {
    expect(generateSoundscapePreset("Test", ["bassDrone", "serverHum"], 30, 42).id).toBe(
      generateSoundscapePreset("Test", ["bassDrone", "serverHum"], 30, 42).id
    );
  });
  it("enthält die gewünschten Schichten", () => {
    const p = generateSoundscapePreset("Neon", ["bassDrone", "glitchImpulse"], 60, 42);
    expect(p.layers).toHaveLength(2);
    expect(p.layers[0].id).toBe("bassDrone");
    expect(p.layers[1].id).toBe("glitchImpulse");
  });
  it("begrenzt die Dauer auf 5–300 Sekunden", () => {
    expect(generateSoundscapePreset("T", ["bassDrone"], 1, 42).durationSeconds).toBe(5);
    expect(generateSoundscapePreset("T", ["bassDrone"], 9999, 42).durationSeconds).toBe(300);
  });
  it("unbekannte Schichten werden ignoriert", () => {
    const p = generateSoundscapePreset("T", ["bassDrone", "xyz" as never], 30, 42);
    expect(p.layers).toHaveLength(1);
  });
});

describe("buildWebAudioPatch", () => {
  it("ist deterministisch", () => {
    const p = createSampleSoundscapePreset();
    expect(buildWebAudioPatch(p).instruction).toBe(buildWebAudioPatch(p).instruction);
  });
  it("enthält einen Oszillator je Schicht", () => {
    const p = createSampleSoundscapePreset();
    const patch = buildWebAudioPatch(p);
    expect(patch.oscillators).toHaveLength(p.layers.length);
  });
  it("Master-Gain bleibt im Bereich 0..1", () => {
    const patch = buildWebAudioPatch(createSampleSoundscapePreset());
    expect(patch.masterGain).toBeGreaterThanOrEqual(0);
    expect(patch.masterGain).toBeLessThanOrEqual(1);
  });
  it("Sample-Rate ist 44100", () => {
    expect(buildWebAudioPatch(createSampleSoundscapePreset()).sampleRate).toBe(44100);
  });
  it("Anweisung nennt Frequenzen", () => {
    const patch = buildWebAudioPatch(createSampleSoundscapePreset());
    expect(patch.instruction).toContain("Hz");
  });
});

describe("NETRUNNING_EFFECTS", () => {
  it("enthält fünf Netrunning-Effekte", () => {
    expect(NETRUNNING_EFFECTS).toHaveLength(5);
  });
  it("jeder Effekt hat Dauer, Frequenz und Beschreibung", () => {
    for (const e of NETRUNNING_EFFECTS) {
      expect(e.durationMs).toBeGreaterThan(0);
      expect(e.frequency).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
    }
  });
  it("getNetrunningEffect findet Modem-Handshake", () => {
    expect(getNetrunningEffect("handshake")?.name).toBe("Modem-Handshake");
  });
  it("getNetrunningEffect lieferv undefined für unbekannt", () => {
    expect(getNetrunningEffect("xyz")).toBeUndefined();
  });
});

describe("createInitialPlayerState", () => {
  it("ist initial auf stopped", () => {
    const s = createInitialPlayerState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentLayer).toBeNull();
    expect(s.elapsedSeconds).toBe(0);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleSoundscapePreset liefert Neon Rain", () => {
    expect(createSampleSoundscapePreset().name).toBe("Neon Rain");
  });
  it("createSampleWebAudioPatch liefert einen Patch", () => {
    expect(createSampleWebAudioPatch().oscillators.length).toBeGreaterThan(0);
  });
});
