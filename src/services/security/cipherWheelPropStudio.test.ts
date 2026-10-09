// @vitest-environment jsdom
// Tests: Chiffrier-Drehscheibe & Cardan-Gitter — Requisiten-Studio (WP 129.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  DEFAULT_ALPHABET,
  buildCipherWheel,
  buildCardanGrille,
  buildAssemblyInstructions,
  createSampleCipherWheel,
  createSampleCardanGrille,
} from "./cipherWheelPropStudio";

// ---------------------------------------------------------------------------
// Gemeinsame Testdaten & Hilfsfunktionen
// ---------------------------------------------------------------------------

const COVER = "DIE ALTE KARTE LIEGT VERBORGEN UNTER DEM LOSEN BRETT";
const SECRET = "KARTE";

/** Prüft die wiederkehrenden SVG-Grundregeln (keine Hex-Farben, kein rgba()). */
function expectPlainSvg(svg: string): void {
  expect(typeof svg).toBe("string");
  expect(svg).toContain("<svg");
  expect(svg).toContain("</svg>");
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg.endsWith("</svg>")).toBe(true);
  expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  expect(svg).not.toMatch(/rgba\(/);
}

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("ist deterministisch bei gleicher Eingabe", () => {
    const a = hashString("Geheime Botschaft");
    const b = hashString("Geheime Botschaft");
    expect(a).toBe(b);
  });

  it("liefert unterschiedliche Werte für unterschiedliche Eingaben", () => {
    const a = hashString("Alpha");
    const b = hashString("Beta");
    expect(a).not.toBe(b);
  });

  it("liefert einen unsigned 32-bit Integer", () => {
    const h = hashString("Test");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it("handhabt leeren String ohne Fehler", () => {
    const h = hashString("");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("KARTE")).not.toBe(hashString("karte"));
  });

  it("liefert für sehr lange Eingaben einen gültigen unsigned Integer", () => {
    const h = hashString("ÄÖÜ".repeat(5000));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it("ist deterministisch über viele Wiederholungen", () => {
    const first = hashString("Drehscheibe");
    for (let i = 0; i < 50; i++) {
      expect(hashString("Drehscheibe")).toBe(first);
    }
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("ist deterministisch bei gleichem Seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("liefert bei unterschiedlichen Seeds unterschiedliche Sequenzen", () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it("liefert 500 Ziehungen im Intervall [0, 1)", () => {
    const rng = createSeededRandom(1292);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("akzeptiert Seed 0 ohne Fehler", () => {
    const rng = createSeededRandom(0);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("behandelt negative Seeds deterministisch", () => {
    const a = createSeededRandom(-7);
    const b = createSeededRandom(-7);
    for (let i = 0; i < 25; i++) {
      expect(a()).toBe(b());
    }
  });

  it("liefert über viele Seeds stets Werte im Intervall [0, 1)", () => {
    for (let s = 1; s <= 10; s++) {
      const rng = createSeededRandom(s);
      for (let i = 0; i < 30; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("erzeugt fortlaufend unterschiedliche Werte", () => {
    const rng = createSeededRandom(2024);
    const values = Array.from({ length: 20 }, () => rng());
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_ALPHABET
// ---------------------------------------------------------------------------

describe("DEFAULT_ALPHABET", () => {
  it("ist ein nicht-leerer String", () => {
    expect(typeof DEFAULT_ALPHABET).toBe("string");
    expect(DEFAULT_ALPHABET.length).toBeGreaterThan(0);
  });

  it("enthält nur Großbuchstaben", () => {
    expect(DEFAULT_ALPHABET).toMatch(/^[A-ZÄÖÜ]+$/);
  });

  it("enthält keine Kleinbuchstaben", () => {
    expect(DEFAULT_ALPHABET).not.toMatch(/[a-z]/);
  });

  it("enthält keine Ziffern oder Leerzeichen", () => {
    expect(DEFAULT_ALPHABET).not.toMatch(/[0-9\s]/);
  });

  it("hat 29 eindeutige Zeichen (26 + ÄÖÜ)", () => {
    expect(DEFAULT_ALPHABET.length).toBe(29);
    expect(new Set(DEFAULT_ALPHABET.split("")).size).toBe(DEFAULT_ALPHABET.length);
  });

  it("beginnt mit A und enthält die deutschen Umlaute", () => {
    expect(DEFAULT_ALPHABET.startsWith("A")).toBe(true);
    expect(DEFAULT_ALPHABET).toContain("Ä");
    expect(DEFAULT_ALPHABET).toContain("Ö");
    expect(DEFAULT_ALPHABET).toContain("Ü");
  });
});

// ---------------------------------------------------------------------------
// buildCipherWheel
// ---------------------------------------------------------------------------

describe("buildCipherWheel", () => {
  it("liefert rings, ringCount, centerHoleRadius und svg", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel).toHaveProperty("rings");
    expect(wheel).toHaveProperty("ringCount");
    expect(wheel).toHaveProperty("centerHoleRadius");
    expect(wheel).toHaveProperty("svg");
  });

  it("hat standardmäßig 2–3 Ringe", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.ringCount).toBeGreaterThanOrEqual(2);
    expect(wheel.ringCount).toBeLessThanOrEqual(3);
    expect(wheel.rings.length).toBe(wheel.ringCount);
  });

  it("enthält ein svg-Feld mit '<svg'", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.svg).toContain("<svg");
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildCipherWheel({}, 1292);
    const b = buildCipherWheel({}, 1292);
    expect(a).toEqual(b);
  });

  it("ist bei unterschiedlichen Seeds unterschiedlich", () => {
    const a = buildCipherWheel({}, 1);
    const b = buildCipherWheel({}, 2);
    expect(a.svg).not.toBe(b.svg);
  });

  it("respektiert eine explizite ringCount-Angabe", () => {
    const wheel = buildCipherWheel({ ringCount: 4 }, 1292);
    expect(wheel.ringCount).toBe(4);
    expect(wheel.rings.length).toBe(4);
  });

  it("respektiert ringCount = 2", () => {
    const wheel = buildCipherWheel({ ringCount: 2 }, 1292);
    expect(wheel.ringCount).toBe(2);
    expect(wheel.rings.length).toBe(2);
  });

  it("respektiert ringCount = 3", () => {
    const wheel = buildCipherWheel({ ringCount: 3 }, 1292);
    expect(wheel.ringCount).toBe(3);
    expect(wheel.rings.length).toBe(3);
  });

  it("respektiert ringCount = 4 exakt", () => {
    const wheel = buildCipherWheel({ ringCount: 4 }, 7);
    expect(wheel.ringCount).toBe(4);
    expect(wheel.rings.length).toBe(4);
  });

  it("hat Ringe mit numerischem Index", () => {
    const wheel = buildCipherWheel({ ringCount: 4 }, 1292);
    for (const ring of wheel.rings) {
      expect(typeof ring.index).toBe("number");
      expect(Number.isInteger(ring.index)).toBe(true);
    }
  });

  it("nummeriert die Ringe fortlaufend ab 0", () => {
    const wheel = buildCipherWheel({ ringCount: 4 }, 1292);
    expect(wheel.rings.map((r) => r.index)).toEqual([0, 1, 2, 3]);
  });

  it("hat Ringe mit nicht-leerem Alphabet", () => {
    const wheel = buildCipherWheel({ ringCount: 3 }, 1292);
    for (const ring of wheel.rings) {
      expect(typeof ring.alphabet).toBe("string");
      expect(ring.alphabet.length).toBeGreaterThan(0);
    }
  });

  it("hat Ringe mit numerischer Rotation", () => {
    const wheel = buildCipherWheel({ ringCount: 3 }, 1292);
    for (const ring of wheel.rings) {
      expect(typeof ring.rotation).toBe("number");
      expect(Number.isFinite(ring.rotation)).toBe(true);
    }
  });

  it("hat einen positiven centerHoleRadius", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.centerHoleRadius).toBeGreaterThan(0);
  });

  it("hält centerHoleRadius im Bereich [12, 16]", () => {
    for (let s = 1; s <= 10; s++) {
      const wheel = buildCipherWheel({}, s);
      expect(wheel.centerHoleRadius).toBeGreaterThanOrEqual(12);
      expect(wheel.centerHoleRadius).toBeLessThanOrEqual(16);
    }
  });

  it("liefert ein svg, das mit '<svg' beginnt", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.svg.startsWith("<svg")).toBe(true);
  });

  it("liefert ein svg, das mit '</svg>' endet", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.svg.endsWith("</svg>")).toBe(true);
  });

  it("respektiert ein benutzerdefiniertes Alphabet (Länge)", () => {
    const wheel = buildCipherWheel({ alphabet: "ABCDEF", ringCount: 3 }, 1292);
    for (const ring of wheel.rings) {
      expect(ring.alphabet.length).toBe(6);
    }
  });

  it("leitet die Ringalphabete aus dem benutzerdefinierten Alphabet ab", () => {
    const alphabet = "ABCDEF";
    const wheel = buildCipherWheel({ alphabet, ringCount: 3 }, 1292);
    for (const ring of wheel.rings) {
      expect(ring.alphabet.split("").sort().join("")).toBe(alphabet.split("").sort().join(""));
    }
  });

  it("verändert die Rotation des äußeren Rings über offset", () => {
    const a = buildCipherWheel({ ringCount: 2, offset: 0 }, 7);
    const b = buildCipherWheel({ ringCount: 2, offset: 3 }, 7);
    expect(a.rings[0].rotation).not.toBe(b.rings[0].rotation);
  });

  it("setzt die Rotation des äußeren Rings exakt auf offset * Winkel", () => {
    const angleStep = 360 / DEFAULT_ALPHABET.length;
    const wheel = buildCipherWheel({ ringCount: 2, offset: 3 }, 7);
    expect(wheel.rings[0].rotation).toBeCloseTo(3 * angleStep);
  });

  it("setzt bei offset 0 die Rotation des äußeren Rings auf 0", () => {
    const wheel = buildCipherWheel({ ringCount: 3, offset: 0 }, 7);
    expect(wheel.rings[0].rotation).toBe(0);
  });

  it("begrenzt einen zu großen offset auf das Alphabet", () => {
    const angleStep = 360 / DEFAULT_ALPHABET.length;
    const wheel = buildCipherWheel({ ringCount: 2, offset: 9999 }, 7);
    expect(wheel.rings[0].rotation).toBeCloseTo((DEFAULT_ALPHABET.length - 1) * angleStep);
  });

  it("fällt bei leerem Alphabet auf DEFAULT_ALPHABET zurück", () => {
    const wheel = buildCipherWheel({ alphabet: "", ringCount: 3 }, 1);
    for (const ring of wheel.rings) {
      expect(ring.alphabet.length).toBe(DEFAULT_ALPHABET.length);
    }
  });

  it("fällt bei zu kurzem Alphabet (Länge 1) auf DEFAULT_ALPHABET zurück", () => {
    const wheel = buildCipherWheel({ alphabet: "A", ringCount: 3 }, 1);
    for (const ring of wheel.rings) {
      expect(ring.alphabet.length).toBe(DEFAULT_ALPHABET.length);
    }
  });

  it("klemmt ringCount = 0 auf mindestens 2", () => {
    const wheel = buildCipherWheel({ ringCount: 0 }, 1);
    expect(wheel.ringCount).toBe(2);
    expect(wheel.rings.length).toBe(2);
  });

  it("klemmt einen negativen ringCount auf mindestens 2", () => {
    const wheel = buildCipherWheel({ ringCount: -5 }, 1);
    expect(wheel.ringCount).toBe(2);
    expect(wheel.rings.length).toBe(2);
  });

  it("klemmt ringCount = 1 auf mindestens 2", () => {
    const wheel = buildCipherWheel({ ringCount: 1 }, 1);
    expect(wheel.ringCount).toBe(2);
  });

  it("klemmt einen riesigen ringCount auf höchstens 6", () => {
    const wheel = buildCipherWheel({ ringCount: 100 }, 1);
    expect(wheel.ringCount).toBe(6);
    expect(wheel.rings.length).toBe(6);
  });

  it("fällt bei nicht-numerischem ringCount auf 2–3 zurück", () => {
    const wheel = buildCipherWheel({ ringCount: "3" as unknown as number }, 1);
    expect(wheel.ringCount).toBeGreaterThanOrEqual(2);
    expect(wheel.ringCount).toBeLessThanOrEqual(3);
  });

  it("fällt bei NaN als ringCount auf 2–3 zurück", () => {
    const wheel = buildCipherWheel({ ringCount: NaN }, 1);
    expect(wheel.ringCount).toBeGreaterThanOrEqual(2);
    expect(wheel.ringCount).toBeLessThanOrEqual(3);
  });

  it("fällt bei Infinity als ringCount auf 2–3 zurück", () => {
    const wheel = buildCipherWheel({ ringCount: Infinity }, 1);
    expect(wheel.ringCount).toBeGreaterThanOrEqual(2);
    expect(wheel.ringCount).toBeLessThanOrEqual(3);
  });

  it("liefert ein svg mit circle-Elementen", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.svg).toContain("<circle");
  });

  it("liefert ein svg mit einer Polygon-Markierung", () => {
    const wheel = buildCipherWheel({}, 1292);
    expect(wheel.svg).toContain("<polygon");
  });

  it("liefert ein svg ohne Hex-Farben und ohne rgba()", () => {
    expectPlainSvg(buildCipherWheel({}, 1292).svg);
  });

  it("liefert für benutzerdefiniertes Alphabet ein gültiges svg", () => {
    expectPlainSvg(buildCipherWheel({ alphabet: "ABCDEFGHIJ", ringCount: 4 }, 5).svg);
  });
});

// ---------------------------------------------------------------------------
// buildCardanGrille
// ---------------------------------------------------------------------------

describe("buildCardanGrille", () => {
  const TEXT = "DIE ALTE KARTE LIEGT VERBORGEN UNTER DEM LOSEN BRETT";
  const MESSAGE = "KARTE";

  it("liefert gridSize, holes, maskSvg, revealText und coordinates", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille).toHaveProperty("gridSize");
    expect(grille).toHaveProperty("holes");
    expect(grille).toHaveProperty("maskSvg");
    expect(grille).toHaveProperty("revealText");
    expect(grille).toHaveProperty("coordinates");
  });

  it("hat Löcher mit row- und col-Eigenschaft", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.holes.length).toBeGreaterThan(0);
    for (const hole of grille.holes) {
      expect(hole).toHaveProperty("row");
      expect(hole).toHaveProperty("col");
      expect(typeof hole.row).toBe("number");
      expect(typeof hole.col).toBe("number");
    }
  });

  it("hält row und col im Bereich [1, gridSize]", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    for (const hole of grille.holes) {
      expect(Number.isInteger(hole.row)).toBe(true);
      expect(Number.isInteger(hole.col)).toBe(true);
      expect(hole.row).toBeGreaterThanOrEqual(1);
      expect(hole.col).toBeGreaterThanOrEqual(1);
      expect(hole.row).toBeLessThanOrEqual(grille.gridSize);
      expect(hole.col).toBeLessThanOrEqual(grille.gridSize);
    }
  });

  it("enthält ein maskSvg-Feld mit '<svg'", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.maskSvg).toContain("<svg");
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    const b = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(a).toEqual(b);
  });

  it("hat so viele Koordinaten wie Löcher", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.coordinates.length).toBe(grille.holes.length);
  });

  it("liefert für jede Koordinate einen nicht-leeren String", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    for (const coord of grille.coordinates) {
      expect(typeof coord).toBe("string");
      expect(coord.length).toBeGreaterThan(0);
    }
  });

  it("formatiert Koordinaten als R<row>C<col>", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    for (const coord of grille.coordinates) {
      expect(coord).toMatch(/^R\d+C\d+$/);
    }
  });

  it("spiegelt die Lochkoordinaten in den Koordinaten-Strings wider", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    grille.holes.forEach((hole, i) => {
      expect(grille.coordinates[i]).toBe(`R${hole.row}C${hole.col}`);
    });
  });

  it("liefert ein maskSvg, das mit '<svg' beginnt und mit '</svg>' endet", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.maskSvg.startsWith("<svg")).toBe(true);
    expect(grille.maskSvg.endsWith("</svg>")).toBe(true);
  });

  it("liefert ein maskSvg ohne Hex-Farben und ohne rgba()", () => {
    expectPlainSvg(buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292).maskSvg);
  });

  it("liefert ein maskSvg mit rect-Elementen", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.maskSvg).toContain("<rect");
  });

  it("liefert revealText als String", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(typeof grille.revealText).toBe("string");
  });

  it("respektiert ein explizites gridSize", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE, gridSize: 5 }, 1292);
    expect(grille.gridSize).toBe(5);
  });

  it("klemmt ein zu kleines gridSize auf mindestens 3", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE, gridSize: 1 }, 1292);
    expect(grille.gridSize).toBe(3);
  });

  it("klemmt ein zu großes gridSize auf höchstens 16", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE, gridSize: 100 }, 1292);
    expect(grille.gridSize).toBe(16);
  });

  it("klemmt gridSize 2 auf mindestens 3", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE, gridSize: 2 }, 1292);
    expect(grille.gridSize).toBe(3);
  });

  it("leitet ein Standard-gridSize aus der Textlänge ab", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.gridSize).toBeGreaterThanOrEqual(3);
    expect(grille.gridSize).toBeLessThanOrEqual(16);
  });

  it("handhabt leeren Text ohne Fehler", () => {
    const grille = buildCardanGrille({ text: "", message: MESSAGE }, 1292);
    expect(grille.gridSize).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(grille.holes)).toBe(true);
    expect(typeof grille.revealText).toBe("string");
  });

  it("handhabt eine leere Botschaft ohne Löcher", () => {
    const grille = buildCardanGrille({ text: TEXT, message: "" }, 1292);
    expect(grille.holes.length).toBe(0);
    expect(grille.coordinates.length).toBe(0);
    expect(grille.revealText).toBe("");
  });

  it("handhabt leeren Text und leere Botschaft", () => {
    const grille = buildCardanGrille({ text: "", message: "" }, 1292);
    expect(grille.holes.length).toBe(0);
    expect(grille.revealText).toBe("");
    expectPlainSvg(grille.maskSvg);
  });

  it("erzeugt so viele Löcher wie die Botschaft Zeichen hat", () => {
    const grille = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1292);
    expect(grille.holes.length).toBe(MESSAGE.length);
    expect(grille.revealText.length).toBe(MESSAGE.length);
  });

  it("bleibt auch bei sehr langer Botschaft im gültigen Rasterbereich", () => {
    const longMessage = "A".repeat(200);
    const grille = buildCardanGrille({ text: "AAAA", message: longMessage, gridSize: 3 }, 1292);
    expect(grille.holes.length).toBe(200);
    for (const hole of grille.holes) {
      expect(hole.row).toBeGreaterThanOrEqual(1);
      expect(hole.row).toBeLessThanOrEqual(grille.gridSize);
      expect(hole.col).toBeGreaterThanOrEqual(1);
      expect(hole.col).toBeLessThanOrEqual(grille.gridSize);
    }
  });

  it("ignoriert den Seed (Ergebnis ist seed-unabhängig)", () => {
    const a = buildCardanGrille({ text: TEXT, message: MESSAGE }, 1);
    const b = buildCardanGrille({ text: TEXT, message: MESSAGE }, 999999);
    expect(a).toEqual(b);
  });

  it("findet Buchstaben unabhängig von der Groß-/Kleinschreibung", () => {
    const grille = buildCardanGrille({ text: "die alte karte", message: "KARTE" }, 1292);
    expect(grille.holes.length).toBe(5);
    expect(grille.revealText.toUpperCase()).toBe("KARTE");
  });

  it("liefert ein gültiges maskSvg für kleine Raster", () => {
    expectPlainSvg(buildCardanGrille({ text: "AB", message: "A", gridSize: 3 }, 1).maskSvg);
  });

  it("liefert ein gültiges maskSvg für das maximale Raster", () => {
    expectPlainSvg(buildCardanGrille({ text: TEXT, message: MESSAGE, gridSize: 16 }, 1).maskSvg);
  });
});

// ---------------------------------------------------------------------------
// buildAssemblyInstructions
// ---------------------------------------------------------------------------

describe("buildAssemblyInstructions", () => {
  it("liefert steps, cutMarks, solutionKey und svg", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr).toHaveProperty("steps");
    expect(instr).toHaveProperty("cutMarks");
    expect(instr).toHaveProperty("solutionKey");
    expect(instr).toHaveProperty("svg");
  });

  it("hat mindestens einen Schritt", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.steps.length).toBeGreaterThan(0);
  });

  it("hat Schnittmarken mit x, y und label", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.cutMarks.length).toBeGreaterThan(0);
    for (const mark of instr.cutMarks) {
      expect(mark).toHaveProperty("x");
      expect(mark).toHaveProperty("y");
      expect(mark).toHaveProperty("label");
    }
  });

  it("enthält ein svg-Feld mit '<svg'", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.svg).toContain("<svg");
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildAssemblyInstructions(1292);
    const b = buildAssemblyInstructions(1292);
    expect(a).toEqual(b);
  });

  it("ist ein nicht-leeres Array aus nicht-leeren Strings", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(Array.isArray(instr.steps)).toBe(true);
    for (const step of instr.steps) {
      expect(typeof step).toBe("string");
      expect(step.length).toBeGreaterThan(0);
    }
  });

  it("enthält zwischen 6 und 8 Schritte", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.steps.length).toBeGreaterThanOrEqual(6);
    expect(instr.steps.length).toBeLessThanOrEqual(8);
  });

  it("enthält keine doppelten Schritte", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(new Set(instr.steps).size).toBe(instr.steps.length);
  });

  it("hat Schnittmarken mit numerischem x und y", () => {
    const instr = buildAssemblyInstructions(1292);
    for (const mark of instr.cutMarks) {
      expect(typeof mark.x).toBe("number");
      expect(typeof mark.y).toBe("number");
      expect(Number.isFinite(mark.x)).toBe(true);
      expect(Number.isFinite(mark.y)).toBe(true);
    }
  });

  it("hält x im Bereich [40, 360) und y im Bereich [40, 260)", () => {
    const instr = buildAssemblyInstructions(1292);
    for (const mark of instr.cutMarks) {
      expect(mark.x).toBeGreaterThanOrEqual(40);
      expect(mark.x).toBeLessThan(360);
      expect(mark.y).toBeGreaterThanOrEqual(40);
      expect(mark.y).toBeLessThan(260);
    }
  });

  it("hat Schnittmarken mit nicht-leerem label", () => {
    const instr = buildAssemblyInstructions(1292);
    for (const mark of instr.cutMarks) {
      expect(typeof mark.label).toBe("string");
      expect(mark.label.length).toBeGreaterThan(0);
    }
  });

  it("enthält zwischen 4 und 6 Schnittmarken", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.cutMarks.length).toBeGreaterThanOrEqual(4);
    expect(instr.cutMarks.length).toBeLessThanOrEqual(6);
  });

  it("hat einen nicht-leeren Lösungsschlüssel", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(typeof instr.solutionKey).toBe("string");
    expect(instr.solutionKey.length).toBeGreaterThan(0);
  });

  it("beginnt den Lösungsschlüssel mit 'Schlüssel:'", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.solutionKey.startsWith("Schlüssel:")).toBe(true);
  });

  it("verwendet deutsche Anführungszeichen im Lösungsschlüssel", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.solutionKey).toContain("„");
    expect(instr.solutionKey).toContain("“");
  });

  it("liefert ein svg, das mit '<svg' beginnt und mit '</svg>' endet", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.svg.startsWith("<svg")).toBe(true);
    expect(instr.svg.endsWith("</svg>")).toBe(true);
  });

  it("liefert ein svg ohne Hex-Farben und ohne rgba()", () => {
    expectPlainSvg(buildAssemblyInstructions(1292).svg);
  });

  it("liefert ein svg mit line-Elementen", () => {
    const instr = buildAssemblyInstructions(1292);
    expect(instr.svg).toContain("<line");
  });

  it("ist bei unterschiedlichen Seeds unterschiedlich", () => {
    const a = buildAssemblyInstructions(1);
    const b = buildAssemblyInstructions(2);
    expect(a).not.toEqual(b);
  });

  it("liefert für viele Seeds ein gültiges svg", () => {
    for (let s = 1; s <= 10; s++) {
      expectPlainSvg(buildAssemblyInstructions(s).svg);
    }
  });
});

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

describe("createSampleCipherWheel", () => {
  it("liefert eine gültige Drehscheibe mit 3 Ringen", () => {
    const wheel = createSampleCipherWheel();
    expect(wheel.ringCount).toBe(3);
    expect(wheel.rings.length).toBe(3);
    expect(wheel.svg).toContain("<svg");
  });

  it("ist deterministisch", () => {
    const a = createSampleCipherWheel();
    const b = createSampleCipherWheel();
    expect(a).toEqual(b);
  });

  it("verwendet das Standardalphabet", () => {
    const wheel = createSampleCipherWheel();
    for (const ring of wheel.rings) {
      expect(ring.alphabet.length).toBe(DEFAULT_ALPHABET.length);
    }
  });

  it("startet den äußeren Ring bei offset 0", () => {
    const wheel = createSampleCipherWheel();
    expect(wheel.rings[0].rotation).toBe(0);
  });

  it("liefert ein gültiges svg", () => {
    expectPlainSvg(createSampleCipherWheel().svg);
  });
});

describe("createSampleCardanGrille", () => {
  it("liefert eine gültige Lochmaske", () => {
    const grille = createSampleCardanGrille();
    expect(grille.gridSize).toBeGreaterThan(0);
    expect(grille.holes.length).toBeGreaterThan(0);
    expect(grille.maskSvg).toContain("<svg");
    expect(grille.revealText).toBe("KARTE");
  });

  it("ist deterministisch", () => {
    const a = createSampleCardanGrille();
    const b = createSampleCardanGrille();
    expect(a).toEqual(b);
  });

  it("verwendet gridSize 8", () => {
    const grille = createSampleCardanGrille();
    expect(grille.gridSize).toBe(8);
  });

  it("legt fünf Löcher für die Botschaft 'KARTE' an", () => {
    const grille = createSampleCardanGrille();
    expect(grille.holes.length).toBe(5);
    expect(grille.coordinates.length).toBe(5);
  });

  it("liefert ein gültiges maskSvg", () => {
    expectPlainSvg(createSampleCardanGrille().maskSvg);
  });
});

// ---------------------------------------------------------------------------
// Mehrere Seeds (1–10) — Robustheit über alle Funktionen
// ---------------------------------------------------------------------------

describe("Mehrere Seeds (1–10)", () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("buildCipherWheel liefert für jeden Seed ein gültiges Ergebnis", () => {
    for (const seed of seeds) {
      const wheel = buildCipherWheel({}, seed);
      expect(wheel.rings.length).toBe(wheel.ringCount);
      expect(wheel.rings.length).toBeGreaterThanOrEqual(2);
      expect(wheel.rings.length).toBeLessThanOrEqual(3);
      expect(wheel.centerHoleRadius).toBeGreaterThan(0);
      expectPlainSvg(wheel.svg);
    }
  });

  it("buildCardanGrille liefert für jeden Seed ein gültiges Ergebnis", () => {
    for (const seed of seeds) {
      const grille = buildCardanGrille({ text: COVER, message: SECRET }, seed);
      expect(grille.holes.length).toBe(SECRET.length);
      expect(grille.coordinates.length).toBe(grille.holes.length);
      expectPlainSvg(grille.maskSvg);
    }
  });

  it("buildAssemblyInstructions liefert für jeden Seed ein gültiges Ergebnis", () => {
    for (const seed of seeds) {
      const instr = buildAssemblyInstructions(seed);
      expect(instr.steps.length).toBeGreaterThan(0);
      expect(instr.cutMarks.length).toBeGreaterThan(0);
      expect(instr.solutionKey.length).toBeGreaterThan(0);
      expectPlainSvg(instr.svg);
    }
  });
});
