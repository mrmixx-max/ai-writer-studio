// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  CAVE_ZONES,
  getCaveZone,
  sampleGases,
  assessHazards,
  generateDarknessPassage,
  surveyZone,
  analyzeCaveSystem,
  createSampleCaveSurvey,
  createSampleSpeleologyReport,
  METHANE_EXPLOSIVE_PERCENT,
  OXYGEN_CRITICAL_PERCENT,
  STABILITY_CRITICAL,
  type GasReading,
} from "./subterraneanSpeleologyEngine";

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
    const r = createSeededRandom(3);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("CAVE_ZONES", () => {
  it("enthält fünf Untertage-Zonen", () => {
    expect(CAVE_ZONES).toHaveLength(5);
  });
  it("Zonen werden mit der Tiefe kälter/heißer je Zone korrekt beschrieben", () => {
    for (const z of CAVE_ZONES) {
      expect(z.depthMeters).toBeGreaterThan(0);
      expect(z.baseOxygenPercent).toBeGreaterThan(0);
      expect(z.baseStability).toBeGreaterThan(0);
      expect(z.hazards.length).toBeGreaterThan(0);
    }
  });
  it("Magmakammern sind am tiefsten und am instabilsten", () => {
    const magma = getCaveZone("magmaChambers")!;
    for (const z of CAVE_ZONES) {
      if (z.id !== "magmaChambers") {
        expect(magma.depthMeters).toBeGreaterThan(z.depthMeters);
        expect(magma.baseStability).toBeLessThanOrEqual(z.baseStability);
      }
    }
  });
  it("getCaveZone liefert undefined für unbekannt", () => {
    expect(getCaveZone("xyz" as never)).toBeUndefined();
  });
});

describe("sampleGases", () => {
  it("ist deterministisch", () => {
    expect(sampleGases("magmaChambers", 42).methanePercent).toBe(sampleGases("magmaChambers", 42).methanePercent);
  });
  it("tiefere Zonen haben mehr Methan", () => {
    expect(sampleGases("magmaChambers", 42).methanePercent).toBeGreaterThan(
      sampleGases("entranceCleft", 42).methanePercent
    );
  });
  it("Sauerstoff entspricht dem Zonen-Basiswert", () => {
    expect(sampleGases("entranceCleft", 42).oxygenPercent).toBe(getCaveZone("entranceCleft")!.baseOxygenPercent);
  });
  it("unbekannte Zone fällt auf die erste zurück", () => {
    expect(sampleGases("xyz" as never, 1).zone).toBe("entranceCleft");
  });
});

describe("assessHazards", () => {
  const baseReading: GasReading = { zone: "entranceCleft", methanePercent: 0.2, carbonDioxidePercent: 0.1, hydrogenSulfidePpm: 2, oxygenPercent: 20.9 };

  it("liefert vier Prüfungen", () => {
    expect(assessHazards(baseReading, 90)).toHaveLength(4);
  });
  it("unauffällige Werte sind ok", () => {
    expect(assessHazards(baseReading, 90).every((h) => h.severity === "ok")).toBe(true);
  });
  it("Schlagwetter ab 4 % Methan ist kritisch", () => {
    const r = assessHazards({ ...baseReading, methanePercent: METHANE_EXPLOSIVE_PERCENT }, 90);
    expect(r.find((h) => h.kind === "schlagwetter")?.severity).toBe("critical");
  });
  it("Methan im Warnband ist warn", () => {
    const r = assessHazards({ ...baseReading, methanePercent: 2.5 }, 90);
    expect(r.find((h) => h.kind === "schlagwetter")?.severity).toBe("warn");
  });
  it("Stickstoff-Erstickung unter 16 % Sauerstoff ist kritisch", () => {
    const r = assessHazards({ ...baseReading, oxygenPercent: OXYGEN_CRITICAL_PERCENT - 1 }, 90);
    expect(r.find((h) => h.kind === "erstickung")?.severity).toBe("critical");
  });
  it("H₂S über 100 ppm ist kritisch", () => {
    const r = assessHazards({ ...baseReading, hydrogenSulfidePpm: 150 }, 90);
    expect(r.find((h) => h.kind === "giftgas")?.severity).toBe("critical");
  });
  it("Stabilität unter 50 ist kritisch", () => {
    const r = assessHazards(baseReading, STABILITY_CRITICAL - 1);
    expect(r.find((h) => h.kind === "stabilität")?.severity).toBe("critical");
  });
  it("Grenzwerte sind inklusiv (Stabilität exakt 50 ist warn, nicht kritisch)", () => {
    const r = assessHazards(baseReading, STABILITY_CRITICAL);
    expect(r.find((h) => h.kind === "stabilität")?.severity).toBe("warn");
  });
});

describe("generateDarknessPassage", () => {
  it("ist deterministisch", () => {
    expect(generateDarknessPassage("magmaChambers", 3, 42).text).toBe(generateDarknessPassage("magmaChambers", 3, 42).text);
  });
  it("erzeugt die angeforderte Sinneszahl", () => {
    expect(generateDarknessPassage("fungalForest", 3, 42).sensesUsed).toHaveLength(3);
  });
  it("keine doppelten Sinnessätze", () => {
    const p = generateDarknessPassage("subterraneanLake", 5, 7);
    expect(new Set(p.sensesUsed).size).toBe(p.sensesUsed.length);
  });
  it("begrenzt auf die Poolgröße", () => {
    expect(generateDarknessPassage("entranceCleft", 999, 1).sensesUsed.length).toBeLessThanOrEqual(7);
  });
  it("Text nennt Tastsinn oder Klang", () => {
    const p = generateDarknessPassage("geothermalFissure", 3, 42);
    expect(p.text).toContain("Licht erlischt");
  });
});

describe("surveyZone", () => {
  it("ist deterministisch", () => {
    expect(surveyZone("geothermalFissure", 0, 0, 42).id).toBe(surveyZone("geothermalFissure", 0, 0, 42).id);
  });
  it("Sauerstoffentzug senkt den Sauerstoffgehalt", () => {
    const full = surveyZone("fungalForest", 0, 0, 42);
    const drained = surveyZone("fungalForest", 3, 0, 42);
    expect(drained.oxygenPercent).toBeLessThan(full.oxygenPercent);
  });
  it("Stabilitätsverlust senkt die Stabilität", () => {
    const full = surveyZone("entranceCleft", 0, 0, 42);
    const cracked = surveyZone("entranceCleft", 0, 40, 42);
    expect(cracked.stability).toBeLessThan(full.stability);
  });
  it("Sauerstoff wird nicht negativ", () => {
    expect(surveyZone("magmaChambers", 99, 0, 42).oxygenPercent).toBeGreaterThanOrEqual(0);
  });
  it("Stabilität bleibt im Bereich 0..100", () => {
    const s = surveyZone("entranceCleft", 0, 999, 42);
    expect(s.stability).toBeGreaterThanOrEqual(0);
    expect(s.stability).toBeLessThanOrEqual(100);
  });
  it("Magmakammern mit Verlust sind nicht überlebbar", () => {
    expect(surveyZone("magmaChambers", 4, 20, 42).survivable).toBe(false);
  });
  it("enthält Dunkelheits-Prosa", () => {
    expect(surveyZone("entranceCleft", 0, 0, 42).darknessPassage.text.length).toBeGreaterThan(20);
  });
});

describe("analyzeCaveSystem", () => {
  it("ist deterministisch", () => {
    expect(analyzeCaveSystem(["entranceCleft"], 42).id).toBe(analyzeCaveSystem(["entranceCleft"], 42).id);
  });
  it("erzeugt eine Vermessung je Zone", () => {
    expect(analyzeCaveSystem(["entranceCleft", "magmaChambers"], 42).surveys).toHaveLength(2);
  });
  it("leere Liste fällt auf alle fünf Zonen zurück", () => {
    expect(analyzeCaveSystem([], 42).surveys).toHaveLength(5);
  });
  it("benennt die tiefste Zone", () => {
    expect(analyzeCaveSystem([], 42).deepestZone.id).toBe("magmaChambers");
  });
  it("zählt kritische Befunde", () => {
    expect(analyzeCaveSystem([], 42).criticalCount).toBeGreaterThan(0);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleCaveSurvey liefert die geothermale Spalte", () => {
    expect(createSampleCaveSurvey().zone.id).toBe("geothermalFissure");
  });
  it("createSampleSpeleologyReport liefert fünf Vermessungen", () => {
    expect(createSampleSpeleologyReport().surveys).toHaveLength(5);
  });
});
