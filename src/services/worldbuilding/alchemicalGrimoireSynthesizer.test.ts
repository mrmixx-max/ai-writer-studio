// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  MAGIC_AXIOMS,
  REAGENTS,
  getReagent,
  checkReagentCompatibility,
  analyzeReagentGrid,
  generateIncantation,
  generateSpellCircle,
  createGrimoirePage,
  createSampleGrimoirePage,
} from "./alchemicalGrimoireSynthesizer";

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
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("MAGIC_AXIOMS", () => {
  it("enthält vier Axiome", () => {
    expect(MAGIC_AXIOMS).toHaveLength(4);
  });
  it("jedes Axiom hat Kosten und Risiko", () => {
    for (const a of MAGIC_AXIOMS) {
      expect(a.cost.length).toBeGreaterThan(0);
      expect(a.risk.length).toBeGreaterThan(0);
    }
  });
});

describe("REAGENTS", () => {
  it("enthält mindestens zehn Reagenzien", () => {
    expect(REAGENTS.length).toBeGreaterThanOrEqual(10);
  });
  it("getReagent findet Drachenblut", () => {
    expect(getReagent("Drachenblut")?.potency).toBe(9);
  });
  it("getReagent ist case-insensitive", () => {
    expect(getReagent("drachenblut")?.name).toBe("Drachenblut");
  });
  it("getReagent liefert undefined für Unbekanntes", () => {
    expect(getReagent("Nichts")).toBeUndefined();
  });
});

describe("checkReagentCompatibility", () => {
  it("gegenläufige Essenzen sind inkompatibel", () => {
    // Drachenblut (feurig) + Mondwasser (wässrig)
    const res = checkReagentCompatibility("Drachenblut", "Mondwasser");
    expect(res.compatible).toBe(false);
    expect(res.explosionRisk).toBeGreaterThan(50);
  });
  it("gleiche Essenz verstärkt", () => {
    const res = checkReagentCompatibility("Drachenblut", "Salamanderasche");
    expect(res.compatible).toBe(true);
    expect(res.reaction).toContain("Verstärkung");
  });
  it("unbekannte Reagenzien liefern Risiko 0", () => {
    const res = checkReagentCompatibility("Foo", "Bar");
    expect(res.explosionRisk).toBe(0);
    expect(res.compatible).toBe(false);
  });
  it("Risiken bleiben im Bereich 0-100", () => {
    const res = checkReagentCompatibility("Sternenmetall", "Quecksilber");
    expect(res.explosionRisk).toBeLessThanOrEqual(100);
    expect(res.backlashRisk).toBeLessThanOrEqual(100);
  });
});

describe("analyzeReagentGrid", () => {
  it("leeres Gitter ist stabil", () => {
    const res = analyzeReagentGrid([]);
    expect(res.stable).toBe(true);
    expect(res.pairs).toHaveLength(0);
  });
  it("bildet alle Paare", () => {
    const res = analyzeReagentGrid(["Drachenblut", "Mondwasser", "Sternenmetall"]);
    expect(res.pairs).toHaveLength(3);
  });
  it("unbekannte Namen werden gefiltert", () => {
    const res = analyzeReagentGrid(["Drachenblut", "Unbekannt"]);
    expect(res.pairs).toHaveLength(0);
  });
  it("stabile Mischung aus gleichen, nicht-flüchtigen Essenzen", () => {
    const res = analyzeReagentGrid(["Mondwasser", "Tau der Morgenröte"]);
    expect(res.stable).toBe(true);
  });
});

describe("generateIncantation", () => {
  it("ist deterministisch", () => {
    expect(generateIncantation("runic", 42).formula).toBe(generateIncantation("runic", 42).formula);
  });
  it("verschiedene Seeds erzeugen verschiedene Formeln", () => {
    expect(generateIncantation("runic", 1).formula).not.toBe(generateIncantation("runic", 2).formula);
  });
  it("liefert Metrum und Phonetik", () => {
    const inc = generateIncantation("elder", 5);
    expect(inc.meter).toContain("Silben");
    expect(inc.phonetic.length).toBeGreaterThan(0);
  });
  it("deckt alle vier Axiome ab", () => {
    for (const a of MAGIC_AXIOMS) {
      expect(generateIncantation(a.id, 3).formula.length).toBeGreaterThan(10);
    }
  });
});

describe("generateSpellCircle", () => {
  it("liefert SVG mit Token-Farben", () => {
    const c = generateSpellCircle("elemental", 42);
    expect(c.svg).toContain("<svg");
    expect(c.svg).toContain("var(--accent)");
  });
  it("enthält keine Hex-Farben", () => {
    const c = generateSpellCircle("runic", 42);
    expect(c.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("ist deterministisch", () => {
    expect(generateSpellCircle("elder", 9).svg).toBe(generateSpellCircle("elder", 9).svg);
  });
  it("hat Ringe und Runen", () => {
    const c = generateSpellCircle("sympathetic", 1);
    expect(c.ringCount).toBeGreaterThanOrEqual(2);
    expect(c.runes.length).toBeGreaterThanOrEqual(6);
  });
});

describe("createGrimoirePage", () => {
  it("ist deterministisch", () => {
    const p1 = createGrimoirePage("runic", ["Mondwasser"], 42);
    const p2 = createGrimoirePage("runic", ["Mondwasser"], 42);
    expect(p1.id).toBe(p2.id);
  });
  it("verschiedene Seeds erzeugen verschiedene IDs", () => {
    expect(createGrimoirePage("runic", ["Mondwasser"], 1).id).not.toBe(
      createGrimoirePage("runic", ["Mondwasser"], 2).id
    );
  });
  it("enthält Axiom, Inkantation und Kreis", () => {
    const p = createGrimoirePage("elder", ["Drachenblut", "Sternenmetall"], 3);
    expect(p.axiom.id).toBe("elder");
    expect(p.incantation.formula.length).toBeGreaterThan(0);
    expect(p.circle.svg).toContain("<svg");
  });
});

describe("createSampleGrimoirePage", () => {
  it("erzeugt eine Beispielseite", () => {
    const p = createSampleGrimoirePage();
    expect(p.axiom.id).toBe("elemental");
    expect(p.reagents.length).toBe(3);
  });
});
