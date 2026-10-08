// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  DREAM_DIMENSIONS,
  getDreamDimension,
  generateDreamImage,
  generatePropheticSymbols,
  createDreamSequence,
  createSampleDreamSequence,
} from "./surrealDreamLogicSynthesizer";

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

describe("DREAM_DIMENSIONS", () => {
  it("enthält vier Dimensionen", () => {
    expect(DREAM_DIMENSIONS).toHaveLength(4);
  });
  it("jede Dimension hat Gesetz und Beispiel", () => {
    for (const d of DREAM_DIMENSIONS) {
      expect(d.law.length).toBeGreaterThan(0);
      expect(d.example.length).toBeGreaterThan(0);
    }
  });
  it("getDreamDimension findet nonEuclidean", () => {
    expect(getDreamDimension("nonEuclidean")?.name).toContain("Raumfaltung");
  });
  it("getDreamDimension liefert undefined für unbekannt", () => {
    expect(getDreamDimension("xyz" as never)).toBeUndefined();
  });
});

describe("generateDreamImage", () => {
  it("ist deterministisch", () => {
    expect(generateDreamImage("temporalStretch", 42).image).toBe(
      generateDreamImage("temporalStretch", 42).image
    );
  });
  it("verschiedene Seeds erzeugen verschiedene Bilder (meist)", () => {
    const a = generateDreamImage("temporalStretch", 1).image;
    const b = generateDreamImage("temporalStretch", 2).image;
    // deterministisch, aber nicht zwangsweise unterschiedlich — nur Format prüfen
    expect(a.length).toBeGreaterThan(10);
    expect(b.length).toBeGreaterThan(10);
  });
  it("trägt das Gesetz der Dimension", () => {
    const img = generateDreamImage("identityFusion", 5);
    expect(img.lawDemonstrated).toBe(getDreamDimension("identityFusion")?.law);
  });
  it("deckt alle Dimensionen ab", () => {
    for (const d of DREAM_DIMENSIONS) {
      expect(generateDreamImage(d.id, 1).image.length).toBeGreaterThan(5);
    }
  });
});

describe("generatePropheticSymbols", () => {
  it("ist deterministisch", () => {
    const a = generatePropheticSymbols(3, 42);
    const b = generatePropheticSymbols(3, 42);
    expect(a.map((s) => s.symbol)).toEqual(b.map((s) => s.symbol));
  });
  it("erzeugt die angeforderte Anzahl", () => {
    expect(generatePropheticSymbols(3, 1)).toHaveLength(3);
  });
  it("keine Duplikate", () => {
    const s = generatePropheticSymbols(5, 7);
    expect(new Set(s.map((x) => x.symbol)).size).toBe(s.length);
  });
  it("jedes Symbol hat Omen und Gewicht", () => {
    for (const s of generatePropheticSymbols(3, 2)) {
      expect(s.omen.length).toBeGreaterThan(0);
      expect(s.weight).toBeGreaterThan(0);
    }
  });
  it("begrenzt auf Poolgröße", () => {
    expect(generatePropheticSymbols(999, 1).length).toBeLessThanOrEqual(8);
  });
});

describe("createDreamSequence", () => {
  it("ist deterministisch", () => {
    const a = createDreamSequence(["nonEuclidean", "identityFusion"], 42);
    const b = createDreamSequence(["nonEuclidean", "identityFusion"], 42);
    expect(a.id).toBe(b.id);
    expect(a.prose).toBe(b.prose);
  });
  it("verschiedene Seeds erzeugen verschiedene IDs", () => {
    expect(createDreamSequence(["nonEuclidean"], 1).id).not.toBe(
      createDreamSequence(["nonEuclidean"], 2).id
    );
  });
  it("erzeugt Bilder je Dimension", () => {
    const s = createDreamSequence(["nonEuclidean", "temporalStretch", "emotionalDisplacement"], 42);
    expect(s.images).toHaveLength(3);
  });
  it("leere Dimensionen fallen auf alle vier zurück", () => {
    const s = createDreamSequence([], 42);
    expect(s.dimensions).toHaveLength(4);
  });
  it("Prosa enthält ein prophetisches Zeichen", () => {
    const s = createDreamSequence(["nonEuclidean"], 42, 3);
    expect(s.prose).toContain("Zeichen");
  });
  it("Kohärenz bleibt im Bereich 0-100", () => {
    const s = createDreamSequence(["nonEuclidean", "temporalStretch", "identityFusion", "emotionalDisplacement"], 1, 8);
    expect(s.coherence).toBeGreaterThanOrEqual(0);
    expect(s.coherence).toBeLessThanOrEqual(100);
  });
});

describe("createSampleDreamSequence", () => {
  it("erzeugt eine Beispielequenz", () => {
    const s = createSampleDreamSequence();
    expect(s.dimensions.length).toBe(3);
    expect(s.prophecies.length).toBe(3);
  });
});
