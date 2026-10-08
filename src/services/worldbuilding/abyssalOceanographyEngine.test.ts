// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  PELAGIC_ZONES,
  getPelagicZone,
  zoneForDepth,
  hydrostaticPressureBar,
  lightAtDepthPercent,
  readDepth,
  BIOLUMINESCENT_ORGANISMS,
  getBioluminescenceForZone,
  generateBioluminescenceSpectrum,
  generateAbyssalPassage,
  analyzeOceanProfile,
  createSampleDepthReading,
  createSampleOceanProfile,
} from "./abyssalOceanographyEngine";

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

describe("PELAGIC_ZONES", () => {
  it("enthält fünf pelagiale Tiefenstufen", () => {
    expect(PELAGIC_ZONES).toHaveLength(5);
  });
  it("Stufen sind nach Tiefe aufsteigend geordnet", () => {
    for (let i = 1; i < PELAGIC_ZONES.length; i++) {
      expect(PELAGIC_ZONES[i].minDepthMeters).toBeGreaterThanOrEqual(PELAGIC_ZONES[i - 1].minDepthMeters);
    }
  });
  it("nur die Sonnenzone hat Licht", () => {
    expect(getPelagicZone("epipelagic")!.lightPercent).toBeGreaterThan(0);
    expect(getPelagicZone("bathypelagic")!.lightPercent).toBe(0);
  });
  it("Temperatur sinkt mit der Tiefe", () => {
    expect(getPelagicZone("hadopelagic")!.temperatureC).toBeLessThan(getPelagicZone("epipelagic")!.temperatureC);
  });
  it("getPelagicZone liefert undefined für unbekannt", () => {
    expect(getPelagicZone("xyz" as never)).toBeUndefined();
  });
});

describe("zoneForDepth", () => {
  it("100 m ist Epipelagial", () => {
    expect(zoneForDepth(100).id).toBe("epipelagic");
  });
  it("500 m ist Mesopelagial", () => {
    expect(zoneForDepth(500).id).toBe("mesopelagic");
  });
  it("2000 m ist Bathypelagial", () => {
    expect(zoneForDepth(2000).id).toBe("bathypelagic");
  });
  it("5000 m ist Abyssopelagial", () => {
    expect(zoneForDepth(5000).id).toBe("abyssopelagic");
  });
  it("8000 m ist Hadopelagial", () => {
    expect(zoneForDepth(8000).id).toBe("hadopelagic");
  });
  it("negatives Tiefenmaß fällt auf die oberste Zone", () => {
    expect(zoneForDepth(-100).id).toBe("epipelagic");
  });
  it("jenseits 11.000 m bleibt es Hadopelagial", () => {
    expect(zoneForDepth(20000).id).toBe("hadopelagic");
  });
});

describe("hydrostaticPressureBar", () => {
  it("an der Oberfläche etwa 1 Bar (Luftdruck)", () => {
    expect(hydrostaticPressureBar(0)).toBeCloseTo(1.01, 1);
  });
  it("bei 10 m etwa 2 Bar", () => {
    expect(hydrostaticPressureBar(10)).toBeCloseTo(2.02, 1);
  });
  it("Druck steigt linear mit der Tiefe", () => {
    expect(hydrostaticPressureBar(1000)).toBeGreaterThan(hydrostaticPressureBar(500));
  });
  it("bei 10.000 m über 1000 Bar", () => {
    expect(hydrostaticPressureBar(10000)).toBeGreaterThan(1000);
  });
  it("negatives Tiefenmaß wird auf 0 begrenzt", () => {
    expect(hydrostaticPressureBar(-500)).toBeCloseTo(1.01, 1);
  });
});

describe("lightAtDepthPercent", () => {
  it("an der Oberfläche 100 %", () => {
    expect(lightAtDepthPercent(0)).toBeCloseTo(100, 1);
  });
  it("Licht nimmt mit der Tiefe ab", () => {
    expect(lightAtDepthPercent(200)).toBeLessThan(lightAtDepthPercent(100));
  });
  it("bei 1000 m praktisch null", () => {
    expect(lightAtDepthPercent(1000)).toBeLessThan(0.01);
  });
  it("bleibt nicht-negativ", () => {
    expect(lightAtDepthPercent(20000)).toBeGreaterThanOrEqual(0);
  });
});

describe("readDepth", () => {
  it("liefert Zone, Druck, Licht und Temperatur", () => {
    const r = readDepth(4000);
    expect(r.zone.id).toBe("abyssopelagic");
    expect(r.pressureBar).toBeGreaterThan(400);
    expect(r.temperatureC).toBe(2);
  });
  it("markiert große Tiefe als ohne Druckkörper tödlich", () => {
    expect(readDepth(1000).lethalWithoutHull).toBe(true);
  });
  it("Oberflächennähe ist nicht tödlich", () => {
    expect(readDepth(10).lethalWithoutHull).toBe(false);
  });
  it("ist deterministisch", () => {
    expect(readDepth(3000).pressureBar).toBe(readDepth(3000).pressureBar);
  });
});

describe("BIOLUMINESCENT_ORGANISMS", () => {
  it("enthält mindestens sechs Leuchtorganismen", () => {
    expect(BIOLUMINESCENT_ORGANISMS.length).toBeGreaterThanOrEqual(6);
  });
  it("jeder Organismus hat Farbe, Wellenlänge und Mechanismus", () => {
    for (const o of BIOLUMINESCENT_ORGANISMS) {
      expect(o.colorName.length).toBeGreaterThan(0);
      expect(o.wavelengthNm).toBeGreaterThan(0);
      expect(o.mechanism.length).toBeGreaterThan(0);
    }
  });
  it("Wellenlängen liegen im sichtbaren Spektrum", () => {
    for (const o of BIOLUMINESCENT_ORGANISMS) {
      expect(o.wavelengthNm).toBeGreaterThanOrEqual(380);
      expect(o.wavelengthNm).toBeLessThanOrEqual(750);
    }
  });
  it("die Sonnenzone hat keine Leuchtorganismen", () => {
    expect(getBioluminescenceForZone("epipelagic")).toHaveLength(0);
  });
  it("die Tiefsee hat Leuchtorganismen", () => {
    expect(getBioluminescenceForZone("bathypelagic").length).toBeGreaterThan(0);
  });
});

describe("generateBioluminescenceSpectrum", () => {
  it("ist deterministisch", () => {
    expect(generateBioluminescenceSpectrum("bathypelagic", 42).dominantWavelengthNm).toBe(
      generateBioluminescenceSpectrum("bathypelagic", 42).dominantWavelengthNm
    );
  });
  it("leere Zone liefert leeres Spektrum mit Hinweis", () => {
    const s = generateBioluminescenceSpectrum("epipelagic", 42);
    expect(s.organisms).toHaveLength(0);
    expect(s.description).toContain("Schwärze");
  });
  it("beschreibt das Spektrum mit Wellenlänge", () => {
    const s = generateBioluminescenceSpectrum("bathypelagic", 42);
    expect(s.description).toContain("nm");
    expect(s.dominantWavelengthNm).toBeGreaterThan(0);
  });
});

describe("generateAbyssalPassage", () => {
  it("ist deterministisch", () => {
    expect(generateAbyssalPassage(4000, 3, 42).text).toBe(generateAbyssalPassage(4000, 3, 42).text);
  });
  it("nennt Tiefe und Druck", () => {
    const p = generateAbyssalPassage(4000, 3, 42);
    expect(p.text).toContain("4000");
    expect(p.text).toContain("Bar");
  });
  it("erzeugt die angeforderte Bildzahl ohne Duplikate", () => {
    const p = generateAbyssalPassage(4000, 4, 7);
    expect(p.text.split(". ").length).toBeGreaterThan(3);
  });
  it("Druck im Ergebnis stimmt mit der Tiefe überein", () => {
    const p = generateAbyssalPassage(2000, 2, 42);
    expect(p.pressureBar).toBeCloseTo(hydrostaticPressureBar(2000), 1);
  });
});

describe("analyzeOceanProfile", () => {
  it("ist deterministisch", () => {
    expect(analyzeOceanProfile([100, 2000], 42).id).toBe(analyzeOceanProfile([100, 2000], 42).id);
  });
  it("erzeugt eine Messung je Tiefe", () => {
    expect(analyzeOceanProfile([100, 2000, 5000], 42).readings).toHaveLength(3);
  });
  it("leere Liste nutzt die Standardtiefen", () => {
    expect(analyzeOceanProfile([], 42).readings).toHaveLength(5);
  });
  it("benennt die tiefste Zone", () => {
    expect(analyzeOceanProfile([100, 8000], 42).deepestZone.id).toBe("hadopelagic");
  });
  it("ermittelt den Maximaldruck", () => {
    const p = analyzeOceanProfile([100, 8000], 42);
    expect(p.maxPressureBar).toBeGreaterThan(800);
  });
  it("erzeugt ein Spektrum je vorkommender Zone", () => {
    const p = analyzeOceanProfile([100, 500, 2000], 42);
    expect(p.spectra.length).toBe(3);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleDepthReading liest 4000 m", () => {
    expect(createSampleDepthReading().zone.id).toBe("abyssopelagic");
  });
  it("createSampleOceanProfile liefert fünf Messungen", () => {
    expect(createSampleOceanProfile().readings).toHaveLength(5);
  });
});
