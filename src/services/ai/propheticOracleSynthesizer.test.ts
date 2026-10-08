// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ORACLE_ARCHETYPES,
  getOracleArchetype,
  buildHermeneuticMatrix,
  estimateSyllables,
  classifyFeet,
  generateHexameter,
  forgeProphecy,
  analyzeOracle,
  createSampleProphecy,
  createSampleOracleReport,
} from "./propheticOracleSynthesizer";

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
    const r = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("ORACLE_ARCHETYPES", () => {
  it("enthält vier Orakel-Archetypen", () => {
    expect(ORACLE_ARCHETYPES).toHaveLength(4);
  });
  it("jeder Archetyp hat Methode, Erfüllung und Vorbilder", () => {
    for (const a of ORACLE_ARCHETYPES) {
      expect(a.method.length).toBeGreaterThan(0);
      expect(a.fulfilment.length).toBeGreaterThan(0);
      expect(a.exemplars.length).toBeGreaterThan(0);
    }
  });
  it("getOracleArchetype findet das Eiserne Dekret", () => {
    expect(getOracleArchetype("ironDecree")?.name).toContain("Eiserne Dekret");
  });
  it("getOracleArchetype liefert undefined für unbekannt", () => {
    expect(getOracleArchetype("xyz" as never)).toBeUndefined();
  });
});

describe("buildHermeneuticMatrix", () => {
  it("ist deterministisch", () => {
    expect(buildHermeneuticMatrix("paradox", 42).pivot).toBe(buildHermeneuticMatrix("paradox", 42).pivot);
  });
  it("unterscheidet Oberflächen-Glaube von wahrer Erfüllung", () => {
    const m = buildHermeneuticMatrix("ironDecree", 42);
    expect(m.surfaceBelief).not.toBe(m.trueFulfilment);
    expect(m.pivot.length).toBeGreaterThan(0);
  });
  it("trägt den Archetyp", () => {
    expect(buildHermeneuticMatrix("pythianTrance", 1).archetype).toBe("pythianTrance");
  });
  it("unbekannter Archetyp fällt auf den ersten zurück", () => {
    expect(buildHermeneuticMatrix("xyz" as never, 1).archetype).toBe("pythianTrance");
  });
});

describe("estimateSyllables", () => {
  it("zählt Vokalgruppen", () => {
    expect(estimateSyllables("Hallo")).toBe(2);
  });
  it("leerer String ergibt 0", () => {
    expect(estimateSyllables("")).toBe(0);
  });
  it("zählt Umlaute mit", () => {
    expect(estimateSyllables("über")).toBe(2);
  });
});

describe("classifyFeet", () => {
  it("klassifiziert kurze Wörter als Spondeus", () => {
    expect(classifyFeet("und der")).toEqual(["Spondeus", "Spondeus"]);
  });
  it("klassifiziert lange Wörter als Daktylus", () => {
    expect(classifyFeet("Seherin")).toEqual(["Daktylus"]);
  });
  it("leerer String liefert leeres Array", () => {
    expect(classifyFeet("")).toHaveLength(0);
  });
});

describe("generateHexameter", () => {
  it("ist deterministisch", () => {
    expect(generateHexameter("ironDecree", 42).text).toBe(generateHexameter("ironDecree", 42).text);
  });
  it("verschiedene Seeds erzeugen verschiedene Verse", () => {
    expect(generateHexameter("ironDecree", 1).text).not.toBe(generateHexameter("ironDecree", 2).text);
  });
  it("liefert Silben, Füße und Zäsur", () => {
    const v = generateHexameter("pythianTrance", 5);
    expect(v.syllables).toBeGreaterThan(0);
    expect(v.feet.length).toBeGreaterThan(0);
    expect(v.caesuraAfterFoot).toBeGreaterThanOrEqual(1);
  });
  it("deckt alle vier Archetypen ab", () => {
    for (const a of ORACLE_ARCHETYPES) {
      expect(generateHexameter(a.id, 3).text.length).toBeGreaterThan(10);
    }
  });
});

describe("forgeProphecy", () => {
  it("ist deterministisch", () => {
    expect(forgeProphecy("ominousWarning", 42).id).toBe(forgeProphecy("ominousWarning", 42).id);
  });
  it("enthält Archetyp, Vers und Matrix", () => {
    const p = forgeProphecy("paradox", 3);
    expect(p.archetype.id).toBe("paradox");
    expect(p.verse.text.length).toBeGreaterThan(0);
    expect(p.matrix.pivot.length).toBeGreaterThan(0);
  });
  it("Fehldeutungs-Wahrscheinlichkeit bleibt im Bereich 0..1", () => {
    for (const a of ORACLE_ARCHETYPES) {
      const p = forgeProphecy(a.id, 42);
      expect(p.misreadingProbability).toBeGreaterThanOrEqual(0);
      expect(p.misreadingProbability).toBeLessThanOrEqual(1);
    }
  });
  it("Dekrete werden häufiger fehlgedeutet als Paradoxa", () => {
    expect(forgeProphecy("ironDecree", 42).misreadingProbability).toBeGreaterThan(
      forgeProphecy("paradox", 42).misreadingProbability
    );
  });
});

describe("analyzeOracle", () => {
  it("ist deterministisch", () => {
    expect(analyzeOracle(["paradox"], 42).id).toBe(analyzeOracle(["paradox"], 42).id);
  });
  it("erzeugt eine Prophezeiung je Archetyp", () => {
    expect(analyzeOracle(["pythianTrance", "paradox"], 42).prophecies).toHaveLength(2);
  });
  it("leere Liste fällt auf alle vier zurück", () => {
    expect(analyzeOracle([], 42).prophecies).toHaveLength(4);
  });
  it("benennt den dominanten Archetyp", () => {
    const r = analyzeOracle(["pythianTrance", "ironDecree", "paradox"], 42);
    expect(r.dominantArchetype).not.toBeNull();
    expect(r.prophecies.some((p) => p.archetype.id === r.dominantArchetype)).toBe(true);
  });
  it("Durchschnitts-Fehldeutung bleibt im Bereich 0..1", () => {
    const r = analyzeOracle([], 42);
    expect(r.averageMisreading).toBeGreaterThanOrEqual(0);
    expect(r.averageMisreading).toBeLessThanOrEqual(1);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleProphecy liefert ein Eisernes Dekret", () => {
    expect(createSampleProphecy().archetype.id).toBe("ironDecree");
  });
  it("createSampleOracleReport liefert vier Prophezeiungen", () => {
    expect(createSampleOracleReport().prophecies).toHaveLength(4);
  });
});
