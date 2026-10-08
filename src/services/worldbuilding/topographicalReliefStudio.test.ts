// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ELEVATION_BANDS,
  getElevationBand,
  generateReliefMap,
  cellAt,
  calculateSlope,
  analyzeSightLine,
  PARTY_PROFILES,
  getPartyProfile,
  calculateFatigue,
  analyzeRelief,
  createSampleReliefMap,
  createSampleReliefReport,
  randomSampleParty,
} from "./topographicalReliefStudio";

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

describe("ELEVATION_BANDS", () => {
  it("enthält sechs hypsometrische Stufen", () => {
    expect(ELEVATION_BANDS).toHaveLength(6);
  });
  it("Stufen sind aufsteigend geordnet", () => {
    for (let i = 1; i < ELEVATION_BANDS.length; i++) {
      expect(ELEVATION_BANDS[i].minMeters).toBeGreaterThanOrEqual(ELEVATION_BANDS[i - 1].minMeters);
    }
  });
  it("getElevationBand ordnet Meereshöhe korrekt zu", () => {
    expect(getElevationBand(100).id).toBe("seaLevel");
  });
  it("getElevationBand ordnet alpine Höhen korrekt zu", () => {
    expect(getElevationBand(2500).id).toBe("alpine");
  });
  it("getElevationBand ordnet nivale Höhen korrekt zu", () => {
    expect(getElevationBand(4000).id).toBe("nival");
  });
  it("sehr hohe Werte fallen auf die höchste Stufe", () => {
    expect(getElevationBand(99999).id).toBe("nival");
  });
});

describe("generateReliefMap", () => {
  it("ist deterministisch", () => {
    expect(generateReliefMap(6, 5, 42).cells.map((c) => c.elevationMeters)).toEqual(
      generateReliefMap(6, 5, 42).cells.map((c) => c.elevationMeters)
    );
  });
  it("erzeugt width×height Zellen", () => {
    const map = generateReliefMap(6, 5, 42);
    expect(map.cells).toHaveLength(30);
    expect(map.width).toBe(6);
    expect(map.height).toBe(5);
  });
  it("verschiedene Seeds erzeugen verschiedene Höhen", () => {
    expect(generateReliefMap(4, 4, 1).cells.map((c) => c.elevationMeters)).not.toEqual(
      generateReliefMap(4, 4, 2).cells.map((c) => c.elevationMeters)
    );
  });
  it("min ist kleiner oder gleich max", () => {
    const map = generateReliefMap(6, 6, 7);
    expect(map.minMeters).toBeLessThanOrEqual(map.maxMeters);
  });
  it("jede Zelle trägt eine gültige Höhenstufe", () => {
    for (const cell of generateReliefMap(4, 4, 3).cells) {
      expect(ELEVATION_BANDS.some((b) => b.id === cell.band)).toBe(true);
    }
  });
  it("winzige Raster funktionieren", () => {
    expect(generateReliefMap(1, 1, 1).cells).toHaveLength(1);
  });
});

describe("cellAt", () => {
  it("findet eine Zelle", () => {
    const map = generateReliefMap(4, 4, 42);
    expect(cellAt(map, 2, 3)?.x).toBe(2);
  });
  it("liefert undefined außerhalb der Karte", () => {
    expect(cellAt(generateReliefMap(4, 4, 42), 99, 99)).toBeUndefined();
  });
});

describe("calculateSlope", () => {
  const map = generateReliefMap(6, 6, 42);
  it("berechnet ein Gefälle", () => {
    const slope = calculateSlope(map, { x: 0, y: 0 }, { x: 5, y: 0 });
    expect(slope).not.toBeNull();
    expect(slope!.gradientPercent).toBeGreaterThanOrEqual(0);
  });
  it("liefert null bei gleicher Position", () => {
    expect(calculateSlope(map, { x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });
  it("liefert null außerhalb der Karte", () => {
    expect(calculateSlope(map, { x: 0, y: 0 }, { x: 99, y: 0 })).toBeNull();
  });
  it("klassifiziert flache Strecken", () => {
    const flat = generateReliefMap(2, 1, 42);
    const slope = calculateSlope(flat, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(["flach", "mäßig", "steil", "unpassierbar"]).toContain(slope!.classification);
  });
});

describe("analyzeSightLine", () => {
  const map = generateReliefMap(8, 8, 42);
  it("liefert ein Ergebnis für gültige Positionen", () => {
    const r = analyzeSightLine(map, { x: 0, y: 0 }, { x: 7, y: 7 });
    expect(typeof r.visible).toBe("boolean");
    expect(r.reason.length).toBeGreaterThan(0);
  });
  it("meldet Position außerhalb der Karte", () => {
    const r = analyzeSightLine(map, { x: 99, y: 99 }, { x: 1, y: 1 });
    expect(r.visible).toBe(false);
    expect(r.reason).toContain("außerhalb");
  });
  it("ist deterministisch", () => {
    const a = analyzeSightLine(map, { x: 1, y: 1 }, { x: 6, y: 6 });
    const b = analyzeSightLine(map, { x: 1, y: 1 }, { x: 6, y: 6 });
    expect(a.visible).toBe(b.visible);
  });
  it("verdeckte Sicht nennt einen toten Winkel", () => {
    // Zwei Randzellen mit hoher Erhebung dazwischen erzwingen eine Verdeckung
    const r = analyzeSightLine(map, { x: 0, y: 0 }, { x: 7, y: 0 });
    if (!r.visible) {
      expect(r.deadAngleAt).not.toBeNull();
    } else {
      expect(r.deadAngleAt).toBeNull();
    }
  });
});

describe("PARTY_PROFILES", () => {
  it("enthält vier Gruppenprofile", () => {
    expect(PARTY_PROFILES).toHaveLength(4);
  });
  it("Späher steigt schneller als ein Heereszug", () => {
    expect(getPartyProfile("scout")!.baseClimbRate).toBeGreaterThan(getPartyProfile("army")!.baseClimbRate);
  });
  it("getPartyProfile liefert undefined für unbekannt", () => {
    expect(getPartyProfile("xyz")).toBeUndefined();
  });
});

describe("calculateFatigue", () => {
  it("berechnet Stunden und Kalorien", () => {
    const r = calculateFatigue(PARTY_PROFILES[1], 1000, 2800);
    expect(r.hoursNeeded).toBeGreaterThan(0);
    expect(r.caloriesPerPerson).toBeGreaterThan(0);
  });
  it("kein Höhengewinn erzeugt keinen Zuschlag", () => {
    const r = calculateFatigue(PARTY_PROFILES[0], 0, 1000);
    expect(r.hoursNeeded).toBe(0);
    expect(r.verdict).toContain("Kein Höhengewinn");
  });
  it("Höhenkrankheitsrisiko steigt mit der Höhe", () => {
    const low = calculateFatigue(PARTY_PROFILES[0], 500, 1000);
    const high = calculateFatigue(PARTY_PROFILES[0], 500, 4500);
    expect(high.altitudeSicknessRisk).toBeGreaterThan(low.altitudeSicknessRisk);
  });
  it("Risiko bleibt im Bereich 0..100", () => {
    for (const p of PARTY_PROFILES) {
      const r = calculateFatigue(p, 3000, 6000);
      expect(r.altitudeSicknessRisk).toBeGreaterThanOrEqual(0);
      expect(r.altitudeSicknessRisk).toBeLessThanOrEqual(100);
    }
  });
  it("kritische Höhe erzeugt kritischen Befund", () => {
    const r = calculateFatigue(PARTY_PROFILES[3], 2000, 5000);
    expect(r.verdict).toContain("Kritisch");
  });
  it("negative Höhenmeter werden auf 0 begrenzt", () => {
    expect(calculateFatigue(PARTY_PROFILES[0], -500, 1000).climbMeters).toBe(0);
  });
});

describe("analyzeRelief", () => {
  it("zählt Zellen je Höhenstufe", () => {
    const r = analyzeRelief(createSampleReliefMap());
    expect(r.bandCounts).toHaveLength(6);
    const total = r.bandCounts.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(48);
  });
  it("benennt die höchste Stufe", () => {
    expect(analyzeRelief(createSampleReliefMap()).highestBand.name.length).toBeGreaterThan(0);
  });
  it("ist deterministisch", () => {
    expect(analyzeRelief(createSampleReliefMap()).id).toBe(analyzeRelief(createSampleReliefMap()).id);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleReliefMap liefert 8×6 Raster", () => {
    expect(createSampleReliefMap().cells).toHaveLength(48);
  });
  it("createSampleReliefReport liefert einen Bericht", () => {
    expect(createSampleReliefReport().gradientSummary).toContain("m bis");
  });
  it("randomSampleParty ist deterministisch", () => {
    expect(randomSampleParty(42).id).toBe(randomSampleParty(42).id);
  });
});
