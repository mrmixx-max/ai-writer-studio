// @vitest-environment jsdom
/** Tests: HeraldicBlazonStudio (WP 88.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createCoatOfArms,
  validateTinctureRule,
  getTinctureType,
  checkTinctureRule,
  createSampleCoatOfArms,
  createSampleBlazoning,
  type CoatOfArms as _CoatOfArms,
  type TinctureType as _TinctureType,
} from "./heraldicBlazonStudio";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("getTinctureType", () => {
  it("erkennt Metalle", () => {
    expect(getTinctureType("Gold")).toBe("metal");
    expect(getTinctureType("Or")).toBe("metal");
    expect(getTinctureType("Silber")).toBe("metal");
    expect(getTinctureType("Argent")).toBe("metal");
  });

  it("erkennt Farben", () => {
    expect(getTinctureType("Rot")).toBe("color");
    expect(getTinctureType("Gules")).toBe("color");
    expect(getTinctureType("Blau")).toBe("color");
    expect(getTinctureType("Azure")).toBe("color");
    expect(getTinctureType("Grün")).toBe("color");
    expect(getTinctureType("Vert")).toBe("color");
    expect(getTinctureType("Schwarz")).toBe("color");
    expect(getTinctureType("Sable")).toBe("color");
  });

  it("erkennt Felle", () => {
    expect(getTinctureType("Hermelin")).toBe("fur");
    expect(getTinctureType("Ermine")).toBe("fur");
    expect(getTinctureType("Feh")).toBe("fur");
    expect(getTinctureType("Vair")).toBe("fur");
  });
});

describe("checkTinctureRule", () => {
  it("erlaubt Metall auf Farbe", () => {
    expect(checkTinctureRule("Gold", "Rot")).toBe(true);
    expect(checkTinctureRule("Argent", "Azure")).toBe(true);
  });

  it("erlaubt Farbe auf Metall", () => {
    expect(checkTinctureRule("Rot", "Gold")).toBe(true);
    expect(checkTinctureRule("Gules", "Argent")).toBe(true);
  });

  it("erlaubt Felle auf alles", () => {
    expect(checkTinctureRule("Hermelin", "Rot")).toBe(true);
    expect(checkTinctureRule("Hermelin", "Gold")).toBe(true);
    expect(checkTinctureRule("Feh", "Azure")).toBe(true);
  });

  it("verbietet Metall auf Metall", () => {
    expect(checkTinctureRule("Gold", "Silber")).toBe(false);
    expect(checkTinctureRule("Or", "Argent")).toBe(false);
  });

  it("verbietet Farbe auf Farbe", () => {
    expect(checkTinctureRule("Rot", "Blau")).toBe(false);
    expect(checkTinctureRule("Gules", "Azure")).toBe(false);
    expect(checkTinctureRule("Rot", "Grün")).toBe(false);
  });
});

describe("validateTinctureRule", () => {
  it("gibt valid: true für erlaubte Kombinationen", () => {
    expect(validateTinctureRule("Gold", "Rot").valid).toBe(true);
    expect(validateTinctureRule("Rot", "Gold").valid).toBe(true);
  });

  it("gibt valid: false und Grund für Metall auf Metall", () => {
    const result = validateTinctureRule("Gold", "Silber");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Metall auf Metall");
  });

  it("gibt valid: false und Grund für Farbe auf Farbe", () => {
    const result = validateTinctureRule("Rot", "Blau");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Farbe auf Farbe");
  });
});

describe("createCoatOfArms", () => {
  it("erzeugt Wappen mit allen Feldern", () => {
    const coa = createCoatOfArms("Testhaus", 123);
    expect(coa.id).toContain("COA-");
    expect(coa.name).toBe("Testhaus");
    expect(coa.fieldTincture).toBeDefined();
    expect(coa.charges.length).toBeGreaterThan(0);
    expect(coa.motto).toBeDefined();
    expect(coa.blazoningDe).toContain("In");
    expect(coa.blazoningFr).toContain("D'");
  });

  it("ist deterministisch", () => {
    const c1 = createCoatOfArms("Haus Test", 42);
    const c2 = createCoatOfArms("Haus Test", 42);
    expect(c1).toEqual(c2);
  });

  it("beachtet Tincture-Regel bei Charges", () => {
    const coa = createCoatOfArms("Test", 999);
    // Alle Charges müssen Tincture-Regel zum Feld einhalten
    for (const charge of coa.charges) {
      const valid = checkTinctureRule(coa.fieldTincture, charge.tincture);
      // Felle sind neutral, also erlaubt
      const chargeType = charge.tincture === "Hermelin" || charge.tincture === "Feh" ? "fur" : undefined;
      if (chargeType !== "fur") {
        expect(valid).toBe(true);
      }
    }
  });

  it("generiert deutschen und französischen Blasentext", () => {
    const coa = createCoatOfArms("Test", 1);
    expect(coa.blazoningDe).toContain("In");
    expect(coa.blazoningFr).toContain("D'");
  });
});

describe("createSampleCoatOfArms", () => {
  it("erzeugt Beispielwappen", () => {
    const coa = createSampleCoatOfArms();
    expect(coa.name).toBe("Haus Falkenstein");
    expect(coa.id).toContain("COA-");
  });
});

describe("createSampleBlazoning", () => {
  it("erzeugt Beispiel-Blasentext", () => {
    const b = createSampleBlazoning();
    expect(b.de).toContain("In");
    expect(b.fr).toContain("D'");
  });
});