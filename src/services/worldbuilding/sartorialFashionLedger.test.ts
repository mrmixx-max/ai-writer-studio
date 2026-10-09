// @vitest-environment jsdom
/** Tests: SartorialFashionLedger (WP 122.2 / Meilenstein 59.0, v7.1.0) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  TEXTILES,
  DYES,
  checkSumptuaryLaw,
  generateTextileProse,
  createSampleTextile,
  createSampleDye,
} from "./sartorialFashionLedger";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("Brokat:purpur:42")).toBe(hashString("Brokat:purpur:42"));
  });

  it("liefert unterschiedliche Hashes für unterschiedliche Strings", () => {
    expect(hashString("seide")).not.toBe(hashString("samit"));
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("")).not.toBe(hashString("x"));
  });

  it("liefert eine nicht-negative 32-Bit-Ganzzahl", () => {
    const h = hashString("loden");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("liefert Werte im Bereich [0, 1)", () => {
    const rng = createSeededRandom(1234);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("liefert unterschiedliche Folgen für unterschiedliche Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).not.toEqual(seq2);
  });
});

describe("TEXTILES", () => {
  it("enthält 6 Textilien", () => {
    expect(TEXTILES).toHaveLength(6);
  });

  it("liefert für jedes Textil gültige Werte", () => {
    for (const textile of TEXTILES) {
      expect(typeof textile.id).toBe("string");
      expect(textile.id.length).toBeGreaterThan(0);
      expect(typeof textile.name).toBe("string");
      expect(textile.name.length).toBeGreaterThan(0);
      expect(typeof textile.description).toBe("string");
      expect(textile.description.length).toBeGreaterThan(0);
      expect(textile.weight).toBeGreaterThanOrEqual(0);
      expect(textile.weight).toBeLessThanOrEqual(10);
      expect(textile.cost).toBeGreaterThanOrEqual(0);
      expect(textile.cost).toBeLessThanOrEqual(10);
    }
  });

  it("hat eindeutige Ids", () => {
    const ids = TEXTILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DYES", () => {
  it("enthält 6 Farbstoffe", () => {
    expect(DYES).toHaveLength(6);
  });

  it("liefert für jeden Farbstoff gültige Werte", () => {
    for (const dye of DYES) {
      expect(typeof dye.id).toBe("string");
      expect(dye.id.length).toBeGreaterThan(0);
      expect(typeof dye.name).toBe("string");
      expect(dye.name.length).toBeGreaterThan(0);
      expect(typeof dye.description).toBe("string");
      expect(dye.description.length).toBeGreaterThan(0);
      expect(dye.rarity).toBeGreaterThanOrEqual(0);
      expect(dye.rarity).toBeLessThanOrEqual(10);
      expect(dye.cost).toBeGreaterThanOrEqual(0);
      expect(dye.cost).toBeLessThanOrEqual(10);
    }
  });

  it("hat eindeutige Ids", () => {
    const ids = DYES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("checkSumptuaryLaw", () => {
  it("markiert Purpur für Nicht-Königliche als Verstoß", () => {
    const result = checkSumptuaryLaw({ socialClass: "burgher" }, "tuch", "purpur", "1550");
    expect(result.violated).toBe(true);
    expect(typeof result.law).toBe("string");
    expect(result.law.length).toBeGreaterThan(0);
    expect(typeof result.penalty).toBe("string");
    expect(result.penalty.length).toBeGreaterThan(0);
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("erlaubt Purpur dem Königshaus", () => {
    const result = checkSumptuaryLaw({ socialClass: "royal" }, "seide", "purpur", "1550");
    expect(result.violated).toBe(false);
    expect(result.penalty).toBe("Keine.");
  });

  it("verbietet Bauern Pelz und Seide", () => {
    const silk = checkSumptuaryLaw({ socialClass: "peasant" }, "seide", "waid", "1300");
    expect(silk.violated).toBe(true);
    const fur = checkSumptuaryLaw({ socialClass: "peasant" }, "pelz", "ockra", "1300");
    expect(fur.violated).toBe(true);
  });

  it("verbietet Bürgern Purpur und Hermelin", () => {
    const purple = checkSumptuaryLaw({ socialClass: "burgher" }, "tuch", "purpur", "1400");
    expect(purple.violated).toBe(true);
    const ermine = checkSumptuaryLaw({ socialClass: "burgher" }, "tuch", "hermelin", "1400");
    expect(ermine.violated).toBe(true);
  });

  it("verbietet dem niederen Adel Goldstoff (Brokat)", () => {
    const result = checkSumptuaryLaw({ socialClass: "noble" }, "brokat", "indigo", "1500");
    expect(result.violated).toBe(true);
  });

  it("erlaubt eine standesgemäße Kombination", () => {
    const result = checkSumptuaryLaw({ socialClass: "peasant" }, "tuch", "waid", "1300");
    expect(result.violated).toBe(false);
    expect(result.law).toBe("Kleiderordnung gewahrt.");
    expect(result.penalty).toBe("Keine.");
  });

  it("ist deterministisch", () => {
    const a = checkSumptuaryLaw({ socialClass: "noble" }, "brokat", "purpur", "1600");
    const b = checkSumptuaryLaw({ socialClass: "noble" }, "brokat", "purpur", "1600");
    expect(a).toEqual(b);
  });
});

describe("generateTextileProse", () => {
  it("liefert einen nicht-leeren String", () => {
    const prose = generateTextileProse("brokat", "purpur", 42);
    expect(typeof prose).toBe("string");
    expect(prose.length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleichen Seed", () => {
    expect(generateTextileProse("seide", "indigo", 7)).toBe(
      generateTextileProse("seide", "indigo", 7)
    );
  });

  it("enthält die Textil- und Farbstoffnamen", () => {
    const prose = generateTextileProse("loden", "ockra", 3);
    expect(prose).toContain("Grobe Lodenwolle");
    expect(prose).toContain("Ocker");
  });

  it("liefert auch für unbekannte Ids einen nicht-leeren String", () => {
    const prose = generateTextileProse("unbekannt", "unbekannt", 1);
    expect(prose.length).toBeGreaterThan(0);
    expect(prose).toContain("unbekannt");
  });
});

describe("createSampleTextile", () => {
  it("liefert ein gültiges Textil", () => {
    const textile = createSampleTextile();
    expect(textile).toBeDefined();
    expect(typeof textile.id).toBe("string");
    expect(textile.id.length).toBeGreaterThan(0);
    expect(typeof textile.name).toBe("string");
    expect(textile.name.length).toBeGreaterThan(0);
    expect(TEXTILES).toContainEqual(textile);
  });

  it("ist deterministisch", () => {
    expect(createSampleTextile()).toEqual(createSampleTextile());
  });
});

describe("createSampleDye", () => {
  it("liefert einen gültigen Farbstoff", () => {
    const dye = createSampleDye();
    expect(dye).toBeDefined();
    expect(typeof dye.id).toBe("string");
    expect(dye.id.length).toBeGreaterThan(0);
    expect(typeof dye.name).toBe("string");
    expect(dye.name.length).toBeGreaterThan(0);
    expect(DYES).toContainEqual(dye);
  });

  it("ist deterministisch", () => {
    expect(createSampleDye()).toEqual(createSampleDye());
  });
});
