// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SHEPARD_CENTER_HZ,
  SHEPARD_MIN_HZ,
  SHEPARD_MAX_HZ,
  gaussianEnvelope,
  buildShepardPartials,
  synthesizeShepardTone,
  buildEndlessScale,
  PAREIDOLIA_SOURCES,
  getPareidoliaSource,
  generatePareidoliaLoop,
  buildIllusionPlayerState,
  analyzeIllusion,
  createSampleShepardTone,
  createSampleIllusionReport,
} from "./tonalIllusionSynthesizer";

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
    const r = createSeededRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("gaussianEnvelope", () => {
  it("ist am Maximum 1 bei der Zentrale", () => {
    expect(gaussianEnvelope(SHEPARD_CENTER_HZ)).toBeCloseTo(1, 5);
  });
  it("fällt mit der Distanz zur Zentrale ab", () => {
    expect(gaussianEnvelope(SHEPARD_CENTER_HZ * 2)).toBeLessThan(gaussianEnvelope(SHEPARD_CENTER_HZ));
    expect(gaussianEnvelope(SHEPARD_CENTER_HZ * 4)).toBeLessThan(gaussianEnvelope(SHEPARD_CENTER_HZ * 2));
  });
  it("ist symmetrisch um die Zentrale", () => {
    expect(gaussianEnvelope(SHEPARD_CENTER_HZ * 2)).toBeCloseTo(gaussianEnvelope(SHEPARD_CENTER_HZ / 2), 6);
  });
  it("liefert 0 für ungültige Frequenzen", () => {
    expect(gaussianEnvelope(0)).toBe(0);
    expect(gaussianEnvelope(-100)).toBe(0);
  });
  it("bleibt im Bereich 0..1", () => {
    for (let f = 40; f <= 8000; f *= 1.5) {
      const e = gaussianEnvelope(f);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildShepardPartials", () => {
  it("erzeugt Partialtöne innerhalb des Hörbereichs", () => {
    for (const p of buildShepardPartials(0)) {
      expect(p.frequencyHz).toBeGreaterThanOrEqual(SHEPARD_MIN_HZ);
      expect(p.frequencyHz).toBeLessThanOrEqual(SHEPARD_MAX_HZ);
    }
  });
  it("bei Schritt 0 liegt die Zentrale auf 440 Hz", () => {
    const partials = buildShepardPartials(0);
    expect(partials.some((p) => Math.abs(p.frequencyHz - SHEPARD_CENTER_HZ) < 0.01)).toBe(true);
  });
  it("Amplituden folgen der Gauß-Hüllkurve", () => {
    const partials = buildShepardPartials(0);
    const center = partials.find((p) => p.octave === 0)!;
    for (const p of partials) {
      expect(p.amplitude).toBeLessThanOrEqual(center.amplitude + 0.001);
    }
  });
  it("Schritt wird auf 0..1 normalisiert", () => {
    expect(buildShepardPartials(1.5).length).toBe(buildShepardPartials(0.5).length);
    expect(buildShepardPartials(-0.25).length).toBe(buildShepardPartials(0.75).length);
  });
  it("deckt mehrere Oktaven ab", () => {
    const octaves = buildShepardPartials(0).map((p) => p.octave);
    expect(Math.max(...octaves) - Math.min(...octaves)).toBeGreaterThanOrEqual(4);
  });
});

describe("synthesizeShepardTone", () => {
  it("ist deterministisch", () => {
    expect(synthesizeShepardTone(0.3, "ascending", 1.1).id).toBe(synthesizeShepardTone(0.3, "ascending", 1.1).id);
  });
  it("liefert Partialtöne und Energie", () => {
    const t = synthesizeShepardTone(0);
    expect(t.partialCount).toBeGreaterThan(0);
    expect(t.energy).toBeGreaterThan(0);
  });
  it("merkt sich die Richtung", () => {
    expect(synthesizeShepardTone(0, "descending").direction).toBe("descending");
  });
  it("normiert den Schritt auf 0..1", () => {
    const t = synthesizeShepardTone(2.25);
    expect(t.step).toBeGreaterThanOrEqual(0);
    expect(t.step).toBeLessThan(1);
  });
});

describe("buildEndlessScale", () => {
  it("erzeugt die angeforderte Schrittzahl", () => {
    expect(buildEndlessScale(12)).toHaveLength(12);
  });
  it("aufsteigend endet höher als der Start", () => {
    const scale = buildEndlessScale(12, "ascending");
    expect(scale[scale.length - 1].step).toBeGreaterThan(scale[0].step);
  });
  it("absteigend beginnt höher als das Ende", () => {
    const scale = buildEndlessScale(12, "descending");
    expect(scale[0].step).toBeGreaterThan(scale[scale.length - 1].step);
  });
  it("ist deterministisch", () => {
    expect(buildEndlessScale(6).map((t) => t.id)).toEqual(buildEndlessScale(6).map((t) => t.id));
  });
  it("mindestens ein Schritt", () => {
    expect(buildEndlessScale(0)).toHaveLength(1);
  });
});

describe("PAREIDOLIA_SOURCES", () => {
  it("enthält vier Rauschquellen", () => {
    expect(PAREIDOLIA_SOURCES).toHaveLength(4);
  });
  it("jede Quelle hat Filter und Formant", () => {
    for (const s of PAREIDOLIA_SOURCES) {
      expect(s.cutoffHz).toBeGreaterThan(0);
      expect(s.formantHz).toBeGreaterThan(0);
    }
  });
  it("getPareidoliaSource findet das Windrauschen", () => {
    expect(getPareidoliaSource("wind")?.name).toContain("Wind");
  });
  it("getPareidoliaSource liefert undefined für unbekannt", () => {
    expect(getPareidoliaSource("xyz" as never)).toBeUndefined();
  });
});

describe("generatePareidoliaLoop", () => {
  it("ist deterministisch", () => {
    expect(generatePareidoliaLoop("rain", 3, 42).id).toBe(generatePareidoliaLoop("rain", 3, 42).id);
  });
  it("erzeugt die angeforderte Silbenzahl ohne Duplikate", () => {
    const loop = generatePareidoliaLoop("crowd", 4, 7);
    expect(loop.whisperedSyllables).toHaveLength(4);
    expect(new Set(loop.whisperedSyllables).size).toBe(4);
  });
  it("Modulationsrate liegt im flüsternden Bereich", () => {
    const loop = generatePareidoliaLoop("wind", 3, 42);
    expect(loop.modulationRateHz).toBeGreaterThanOrEqual(0.5);
    expect(loop.modulationRateHz).toBeLessThanOrEqual(4);
  });
  it("Formant-Gain bleibt im Bereich 0..1", () => {
    const loop = generatePareidoliaLoop("machinery", 3, 42);
    expect(loop.formantGain).toBeGreaterThanOrEqual(0);
    expect(loop.formantGain).toBeLessThanOrEqual(1);
  });
  it("Anweisung nennt die Quelle", () => {
    expect(generatePareidoliaLoop("rain", 3, 42).instruction).toContain("Regenrauschen");
  });
  it("unbekannte Quelle fällt auf die erste zurück", () => {
    expect(generatePareidoliaLoop("xyz" as never, 3, 1).source.id).toBe("rain");
  });
});

describe("buildIllusionPlayerState", () => {
  it("ist deterministisch", () => {
    expect(buildIllusionPlayerState(12, "rain", 42).id).toBe(buildIllusionPlayerState(12, "rain", 42).id);
  });
  it("enthält die Shepard-Leiter und Pareidolie", () => {
    const s = buildIllusionPlayerState(12, "wind", 42);
    expect(s.shepardTones).toHaveLength(12);
    expect(s.pareidolia.source.id).toBe("wind");
  });
  it("Master-Gain bleibt im Bereich 0..1", () => {
    const s = buildIllusionPlayerState(6, "rain", 42);
    expect(s.masterGain).toBeGreaterThanOrEqual(0);
    expect(s.masterGain).toBeLessThanOrEqual(1);
  });
  it("Loop-Dauer wächst mit der Schrittzahl", () => {
    expect(buildIllusionPlayerState(24, "rain", 42).loopSeconds).toBeGreaterThan(
      buildIllusionPlayerState(12, "rain", 42).loopSeconds
    );
  });
});

describe("analyzeIllusion", () => {
  it("ist deterministisch", () => {
    expect(analyzeIllusion(12, "rain", 42).id).toBe(analyzeIllusion(12, "rain", 42).id);
  });
  it("zählt Schritte mit voller Oktavdeckung", () => {
    expect(analyzeIllusion(12, "rain", 42).fullCoverageSteps).toBeGreaterThan(0);
  });
  it("Pitch-Class-Abdeckung bleibt im Bereich 0..100", () => {
    const r = analyzeIllusion(12, "rain", 42);
    expect(r.pitchClassCoverage).toBeGreaterThanOrEqual(0);
    expect(r.pitchClassCoverage).toBeLessThanOrEqual(100);
  });
  it("Durchschnittsenergie ist positiv", () => {
    expect(analyzeIllusion(12, "rain", 42).averageEnergy).toBeGreaterThan(0);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleShepardTone liefert einen Ton", () => {
    expect(createSampleShepardTone().partialCount).toBeGreaterThan(0);
  });
  it("createSampleIllusionReport liefert 12 Schritte", () => {
    expect(createSampleIllusionReport().player.shepardTones).toHaveLength(12);
  });
});
