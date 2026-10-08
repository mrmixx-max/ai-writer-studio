// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  HEARING_THRESHOLD_HZ,
  FEAR_FREQUENCY_HZ,
  BINAURAL_OFFSET_HZ,
  buildInfrasoundPatch,
  generateEVP,
  createFearPlayerState,
  buildFearPlayerPatch,
  createSampleInfrasoundPatch,
  createSampleEVP,
  type EVPBackgroundNoise,
} from "./fearFrequencySynthesizer";

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("ist deterministisch für denselben Input", () => {
    expect(hashString("horror")).toBe(hashString("horror"));
    expect(hashString("")).toBe(hashString(""));
    expect(hashString("Infraschall 18.9 Hz")).toBe(
      hashString("Infraschall 18.9 Hz")
    );
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    const hashes = new Set(
      ["a", "b", "c", "alpha", "beta", "gamma", "18.9", "19.0"].map(
        hashString
      )
    );
    expect(hashes.size).toBe(8);
  });

  it("liefert einen unsigned 32-bit Integer", () => {
    const h = hashString("Urangst");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("reaktiert auf Case-Sensitivity", () => {
    expect(hashString("Fear")).not.toBe(hashString("fear"));
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------
describe("createSeededRandom", () => {
  it("ist deterministisch für denselben Seed", () => {
    const rng1 = createSeededRandom(12345);
    const rng2 = createSeededRandom(12345);
    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it("liefert unterschiedliche Sequenzen für unterschiedliche Seeds", () => {
    const seq1 = Array.from({ length: 10 }, () =>
      createSeededRandom(1)()
    );
    const seq2 = Array.from({ length: 10 }, () =>
      createSeededRandom(2)()
    );
    expect(seq1).not.toEqual(seq2);
  });

  it("liefert Werte im Bereich [0, 1)", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("verteilt Werte gleichmäßig über den Bereich", () => {
    const rng = createSeededRandom(99);
    const buckets = new Array(10).fill(0);
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const v = rng();
      buckets[Math.min(9, Math.floor(v * 10))]++;
    }
    // Jeder Bucket sollte ~N/10 Einträge haben (mit großzügiger Toleranz)
    for (const b of buckets) {
      expect(b).toBeGreaterThan(N / 10 * 0.8);
      expect(b).toBeLessThan(N / 10 * 1.2);
    }
  });

  it("akzeptiert Seed = 0", () => {
    const rng = createSeededRandom(0);
    const v = rng();
    expect(Number.isNaN(v)).toBe(false);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------
describe("Konstanten", () => {
  it("HEARING_THRESHOLD_HZ ist 20", () => {
    expect(HEARING_THRESHOLD_HZ).toBe(20);
  });

  it("FEAR_FREQUENCY_HZ ist 18.9", () => {
    expect(FEAR_FREQUENCY_HZ).toBe(18.9);
  });

  it("BINAURAL_OFFSET_HZ ist 0.1", () => {
    expect(BINAURAL_OFFSET_HZ).toBe(0.1);
  });

  it("FEAR_FREQUENCY_HZ liegt unter der Hörschwelle", () => {
    expect(FEAR_FREQUENCY_HZ).toBeLessThan(HEARING_THRESHOLD_HZ);
  });
});

// ---------------------------------------------------------------------------
// buildInfrasoundPatch
// ---------------------------------------------------------------------------
describe("buildInfrasoundPatch", () => {
  it("liefert zwei Oszillatoren", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.oscillators).toHaveLength(2);
  });

  it("Oszillatoren sind Sinus-Wellen", () => {
    const patch = buildInfrasoundPatch();
    for (const osc of patch.oscillators) {
      expect(osc.type).toBe("sine");
    }
  });

  it("erster Oszillator bei FEAR_FREQUENCY_HZ", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.oscillators[0].frequency).toBe(
      Math.round(FEAR_FREQUENCY_HZ * 1000) / 1000
    );
  });

  it("zweiter Oszillator um BINAURAL_OFFSET_HZ erhöht", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.oscillators[1].frequency).toBe(
      Math.round((FEAR_FREQUENCY_HZ + BINAURAL_OFFSET_HZ) * 1000) / 1000
    );
  });

  it("liefert einen masterGain größer 0 und kleiner 1", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.masterGain).toBeGreaterThan(0);
    expect(patch.masterGain).toBeLessThanOrEqual(1);
  });

  it("dauerSeconds ist 90", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.durationSeconds).toBe(90);
  });

  it("instruction ist ein nicht-leerer String mit Frequenz-Infos", () => {
    const patch = buildInfrasoundPatch();
    expect(typeof patch.instruction).toBe("string");
    expect(patch.instruction.length).toBeGreaterThan(0);
    expect(patch.instruction).toContain("Hz");
  });

  it("benutzerdefinierte Basisfrequenz wird respektiert", () => {
    const patch = buildInfrasoundPatch(17.5);
    expect(patch.oscillators[0].frequency).toBe(17.5);
    expect(patch.oscillators[1].frequency).toBe(17.6);
  });

  it("negative oder null Basisfrequenz fällt zurück auf FEAR_FREQUENCY_HZ", () => {
    expect(buildInfrasoundPatch(0).oscillators[0].frequency).toBe(
      FEAR_FREQUENCY_HZ
    );
    expect(buildInfrasoundPatch(-5).oscillators[0].frequency).toBe(
      FEAR_FREQUENCY_HZ
    );
  });

  it("ist deterministisch für dieselbe Basisfrequenz", () => {
    expect(buildInfrasoundPatch()).toEqual(buildInfrasoundPatch());
    expect(buildInfrasoundPatch(20)).toEqual(buildInfrasoundPatch(20));
  });

  it("Gains der Oszillatoren sind gleich und positiv", () => {
    const patch = buildInfrasoundPatch();
    expect(patch.oscillators[0].gain).toBe(patch.oscillators[1].gain);
    expect(patch.oscillators[0].gain).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateEVP
// ---------------------------------------------------------------------------
describe("generateEVP", () => {
  it("ist deterministisch für denselben Seed", () => {
    expect(generateEVP(42)).toEqual(generateEVP(42));
  });

  it("unterschiedliche Seeds liefern unterschiedliche Ergebnisse", () => {
    const evp1 = generateEVP(1);
    const evp2 = generateEVP(2);
    // Wenigstens ein Feld sollte sich unterscheiden
    expect(
      evp1.whisper !== evp2.whisper ||
        evp1.backgroundNoise !== evp2.backgroundNoise ||
        evp1.clarity !== evp2.clarity ||
        evp1.durationMs !== evp2.durationMs
    ).toBe(true);
  });

  it("whisper ist ein nicht-leerer String", () => {
    const evp = generateEVP(7);
    expect(typeof evp.whisper).toBe("string");
    expect(evp.whisper.length).toBeGreaterThan(0);
  });

  it("backgroundNoise ist einer der drei erlaubten Werte", () => {
    const valid: EVPBackgroundNoise[] = ["wind", "rain", "static"];
    for (let seed = 0; seed < 50; seed++) {
      const evp = generateEVP(seed);
      expect(valid).toContain(evp.backgroundNoise);
    }
  });

  it("clarity liegt im Bereich [0, 1]", () => {
    for (let seed = 0; seed < 100; seed++) {
      const evp = generateEVP(seed);
      expect(evp.clarity).toBeGreaterThanOrEqual(0);
      expect(evp.clarity).toBeLessThanOrEqual(1);
    }
  });

  it("durationMs liegt im Bereich 800–5000 ms", () => {
    for (let seed = 0; seed < 100; seed++) {
      const evp = generateEVP(seed);
      expect(evp.durationMs).toBeGreaterThanOrEqual(800);
      expect(evp.durationMs).toBeLessThanOrEqual(5000);
    }
  });

  it("durationMs ist ein Vielfaches von 10", () => {
    const evp = generateEVP(5);
    expect(evp.durationMs % 10).toBe(0);
  });

  it("description enthält Hintergrundrauschen und Klarheit", () => {
    const evp = generateEVP(99);
    expect(evp.description).toContain("Klarheit");
    expect(evp.description).toContain("ms");
  });

  it("whisper besteht aus 2–5 Silben getrennt durch '… '", () => {
    const evp = generateEVP(123);
    const syllables = evp.whisper.split("… ");
    expect(syllables.length).toBeGreaterThanOrEqual(2);
    expect(syllables.length).toBeLessThanOrEqual(5);
  });

  it("Silben im Whisper sind eindeutig", () => {
    const evp = generateEVP(321);
    const syllables = evp.whisper.split("… ");
    expect(new Set(syllables).size).toBe(syllables.length);
  });

  it("behandelt Seed 0 korrekt", () => {
    const evp = generateEVP(0);
    expect(evp).toBeDefined();
    expect(evp.clarity).toBeGreaterThanOrEqual(0);
    expect(evp.clarity).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// createFearPlayerState
// ---------------------------------------------------------------------------
describe("createFearPlayerState", () => {
  it("isPlaying beginnt mit false", () => {
    const state = createFearPlayerState();
    expect(state.isPlaying).toBe(false);
  });

  it("currentFrequency beginnt bei FEAR_FREQUENCY_HZ", () => {
    const state = createFearPlayerState();
    expect(state.currentFrequency).toBe(FEAR_FREQUENCY_HZ);
  });

  it("elapsedSeconds beginnt bei 0", () => {
    const state = createFearPlayerState();
    expect(state.elapsedSeconds).toBe(0);
  });

  it("totalSeconds beginnt bei 90", () => {
    const state = createFearPlayerState();
    expect(state.totalSeconds).toBe(90);
  });

  it("intensity beginnt bei 0", () => {
    const state = createFearPlayerState();
    expect(state.intensity).toBe(0);
  });

  it("jeder Aufruf liefert ein neues unabhängiges Objekt", () => {
    const s1 = createFearPlayerState();
    const s2 = createFearPlayerState();
    expect(s1).not.toBe(s2);
    s1.intensity = 1;
    expect(s2.intensity).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildFearPlayerPatch
// ---------------------------------------------------------------------------
describe("buildFearPlayerPatch", () => {
  it("liefert zwei Oszillatoren", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.oscillators).toHaveLength(2);
  });

  it("progress ist 0 bei frischem State", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.progress).toBe(0);
  });

  it("remainingSeconds ist 90 bei frischem State", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.remainingSeconds).toBe(90);
  });

  it("binauralFrequency ist FEAR_FREQUENCY_HZ + BINAURAL_OFFSET_HZ", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.binauralFrequency).toBe(
      Math.round((FEAR_FREQUENCY_HZ + BINAURAL_OFFSET_HZ) * 1000) / 1000
    );
  });

  it("progress ist 0.5 bei der Hälfte der Dauer", () => {
    const state = createFearPlayerState();
    state.elapsedSeconds = 45;
    state.isPlaying = true;
    const patch = buildFearPlayerPatch(state);
    expect(patch.progress).toBe(0.5);
  });

  it("remainingSeconds ist 0 bei abgelaufener Dauer", () => {
    const state = createFearPlayerState();
    state.elapsedSeconds = 90;
    state.isPlaying = true;
    const patch = buildFearPlayerPatch(state);
    expect(patch.remainingSeconds).toBe(0);
    expect(patch.progress).toBe(1);
  });

  it("instruction enthält Pausen-Hinweis bei isPlaying=false", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.instruction).toContain("pausiert");
  });

  it("instruction enthält Wiedergabe-Hinweis bei isPlaying=true", () => {
    const state = createFearPlayerState();
    state.isPlaying = true;
    state.elapsedSeconds = 10;
    const patch = buildFearPlayerPatch(state);
    expect(patch.instruction).toContain("Wiedergabe läuft");
    expect(patch.instruction).toContain("80"); // remainingSeconds ~80
  });

  it("Intensität 0 → niedriger masterGain, Intensität 1 → hoher masterGain", () => {
    const s1 = createFearPlayerState();
    s1.intensity = 0;
    const s2 = createFearPlayerState();
    s2.intensity = 1;
    const p1 = buildFearPlayerPatch(s1);
    const p2 = buildFearPlayerPatch(s2);
    expect(p2.masterGain).toBeGreaterThan(p1.masterGain);
  });

  it("masterGain liegt im Bereich [0, 1]", () => {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const state = createFearPlayerState();
      state.intensity = intensity;
      const patch = buildFearPlayerPatch(state);
      expect(patch.masterGain).toBeGreaterThanOrEqual(0);
      expect(patch.masterGain).toBeLessThanOrEqual(1);
    }
  });

  it("Oszillator-Gains steigen mit Intensität", () => {
    const s1 = createFearPlayerState();
    s1.intensity = 0;
    const s2 = createFearPlayerState();
    s2.intensity = 1;
    const p1 = buildFearPlayerPatch(s1);
    const p2 = buildFearPlayerPatch(s2);
    expect(p2.oscillators[0].gain).toBeGreaterThan(p1.oscillators[0].gain);
  });

  it("custom currentFrequency wird übernommen", () => {
    const state = createFearPlayerState();
    state.currentFrequency = 17.3;
    const patch = buildFearPlayerPatch(state);
    expect(patch.oscillators[0].frequency).toBe(17.3);
    expect(patch.binauralFrequency).toBe(17.4);
  });

  it("intensity > 1 wird auf 1 geklemmt", () => {
    const state = createFearPlayerState();
    state.intensity = 5;
    const patch = buildFearPlayerPatch(state);
    expect(patch.masterGain).toBeLessThanOrEqual(1);
    expect(patch.oscillators[0].gain).toBeLessThanOrEqual(1);
  });

  it("intensity < 0 wird auf 0 geklemmt", () => {
    const state = createFearPlayerState();
    state.intensity = -3;
    const patch = buildFearPlayerPatch(state);
    expect(patch.masterGain).toBeGreaterThanOrEqual(0);
    expect(patch.oscillators[0].gain).toBeGreaterThanOrEqual(0);
  });

  it("totalSeconds = 0 führt zu validem progress statt NaN", () => {
    const state = createFearPlayerState();
    state.totalSeconds = 0;
    state.elapsedSeconds = 10;
    const patch = buildFearPlayerPatch(state);
    expect(Number.isNaN(patch.progress)).toBe(false);
    expect(patch.progress).toBe(1); // elapsed(10) / fallback-total(1) → clamped to 1
  });

  it("both oscillator frequencies differ by BINAURAL_OFFSET_HZ", () => {
    const patch = buildFearPlayerPatch(createFearPlayerState());
    expect(patch.oscillators[1].frequency - patch.oscillators[0].frequency).toBeCloseTo(
      BINAURAL_OFFSET_HZ,
      10
    );
  });
});

// ---------------------------------------------------------------------------
// createSampleInfrasoundPatch & createSampleEVP
// ---------------------------------------------------------------------------
describe("createSampleInfrasoundPatch", () => {
  it("liefert einen gültigen Infraschall-Patch mit Standard-Frequenz", () => {
    const patch = createSampleInfrasoundPatch();
    expect(patch.oscillators).toHaveLength(2);
    expect(patch.oscillators[0].frequency).toBe(FEAR_FREQUENCY_HZ);
    expect(patch.oscillators[1].frequency).toBe(
      FEAR_FREQUENCY_HZ + BINAURAL_OFFSET_HZ
    );
    expect(patch.masterGain).toBeGreaterThan(0);
    expect(patch.durationSeconds).toBe(90);
    expect(typeof patch.instruction).toBe("string");
  });

  it("ist identisch mit buildInfrasoundPatch(FEAR_FREQUENCY_HZ)", () => {
    expect(createSampleInfrasoundPatch()).toEqual(
      buildInfrasoundPatch(FEAR_FREQUENCY_HZ)
    );
  });
});

describe("createSampleEVP", () => {
  it("ist deterministisch", () => {
    expect(createSampleEVP()).toEqual(createSampleEVP());
  });

  it("liefert gültige EVP-Werte", () => {
    const evp = createSampleEVP();
    expect(typeof evp.whisper).toBe("string");
    expect(evp.whisper.length).toBeGreaterThan(0);
    expect(["wind", "rain", "static"]).toContain(evp.backgroundNoise);
    expect(evp.clarity).toBeGreaterThanOrEqual(0);
    expect(evp.clarity).toBeLessThanOrEqual(1);
    expect(evp.durationMs).toBeGreaterThanOrEqual(800);
    expect(evp.durationMs).toBeLessThanOrEqual(5000);
    expect(typeof evp.description).toBe("string");
    expect(evp.description.length).toBeGreaterThan(0);
  });

  it("entspricht generateEVP(42)", () => {
    expect(createSampleEVP()).toEqual(generateEVP(42));
  });
});
