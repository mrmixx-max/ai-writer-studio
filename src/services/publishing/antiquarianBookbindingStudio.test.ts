// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  MARBLE_PATTERNS,
  getMarblePattern,
  generateMarbledPaper,
  generateSpineMockup,
  buildPrintExport,
  createSampleMarbledPaper,
  createSampleSpineMockup,
} from "./antiquarianBookbindingStudio";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("marble:peacock:300x400:42")).toBe(
      hashString("marble:peacock:300x400:42"),
    );
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("peacock")).not.toBe(hashString("snail"));
    expect(hashString("stone")).not.toBe(hashString("peacock"));
  });
  it("leerer String liefert einen gültigen Hash", () => {
    expect(typeof hashString("")).toBe("number");
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("unterschiedliche Seeds erfolgen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    for (let i = 0; i < 5; i++) expect(r1()).not.toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
  it("Seed 0 liefert gültige Werte", () => {
    const r = createSeededRandom(0);
    for (let i = 0; i < 20; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("MARBLE_PATTERNS", () => {
  it("enthält drei Muster", () => {
    expect(MARBLE_PATTERNS).toHaveLength(3);
  });
  it("enthält peacock, snail und stone", () => {
    expect(MARBLE_PATTERNS.map((p) => p.id)).toContain("peacock");
    expect(MARBLE_PATTERNS.map((p) => p.id)).toContain("snail");
    expect(MARBLE_PATTERNS.map((p) => p.id)).toContain("stone");
  });
  it("jedes Muster hat id, name und description", () => {
    for (const p of MARBLE_PATTERNS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
  it("jedes Muster hat mindestens zwei Design-Tokens", () => {
    for (const p of MARBLE_PATTERNS) {
      expect(p.tokens.length).toBeGreaterThanOrEqual(2);
      for (const token of p.tokens) {
        expect(token).toMatch(/^var\(--/);
      }
    }
  });
  it("Muster nutzen keine Hex-Farben", () => {
    for (const p of MARBLE_PATTERNS) {
      for (const token of p.tokens) {
        expect(token.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
      }
    }
  });
});

describe("getMarblePattern", () => {
  it("findet peacock per ID", () => {
    expect(getMarblePattern("peacock")?.name).toBe("Pfauenfeder");
  });
  it("findet snail per ID", () => {
    expect(getMarblePattern("snail")?.name).toBe("Schneckenmarmor");
  });
  it("findet stone per ID", () => {
    expect(getMarblePattern("stone")?.name).toBe("Getöteter Stein");
  });
  it("liefert undefined für unbekannte ID", () => {
    expect(getMarblePattern("xyz")).toBeUndefined();
    expect(getMarblePattern("")).toBeUndefined();
  });
});

describe("generateMarbledPaper", () => {
  it("erzeugt SVG mit svg, pattern, width, height, dpi und description", () => {
    const result = generateMarbledPaper("peacock", 300, 400, 42);
    expect(result.svg).toContain("<svg");
    expect(result.pattern).toBe("peacock");
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
    expect(result.dpi).toBe(300);
    expect(result.description.length).toBeGreaterThan(0);
  });
  it("SVG enthält width und height Attribute", () => {
    const result = generateMarbledPaper("snail", 500, 600, 1);
    expect(result.svg).toContain('width="500"');
    expect(result.svg).toContain('height="600"');
  });
  it("SVG enthält viewBox", () => {
    const result = generateMarbledPaper("stone", 400, 500, 7);
    expect(result.svg).toContain("viewBox");
  });
  it("ist deterministisch für gleiche Parameter", () => {
    const r1 = generateMarbledPaper("peacock", 300, 400, 42);
    const r2 = generateMarbledPaper("peacock", 300, 400, 42);
    expect(r1.svg).toBe(r2.svg);
  });
  it("unterschiedliche Seeds erzeugen unterschiedliche SVGs", () => {
    const r1 = generateMarbledPaper("peacock", 300, 400, 42);
    const r2 = generateMarbledPaper("peacock", 300, 400, 43);
    expect(r1.svg).not.toBe(r2.svg);
  });
  it("unterschiedliche Muster erzeugen unterschiedliche SVGs", () => {
    const r1 = generateMarbledPaper("peacock", 300, 400, 42);
    const r2 = generateMarbledPaper("snail", 300, 400, 42);
    expect(r1.svg).not.toBe(r2.svg);
  });
  it("nutzt keine Hex-Farben im SVG", () => {
    const result = generateMarbledPaper("peacock", 300, 400, 42);
    expect(result.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("nutzt ausschließlich var(--...) Design-Tokens", () => {
    const result = generateMarbledPaper("stone", 400, 500, 7);
    expect(result.svg).toContain("var(--");
  });
  it("kleinbreite wird auf 40 begrenzt", () => {
    const result = generateMarbledPaper("peacock", 10, 10, 42);
    expect(result.width).toBe(40);
    expect(result.height).toBe(40);
  });
  it("fractionale Werte werden gerundet", () => {
    const result = generateMarbledPaper("peacock", 299.7, 400.3, 42);
    expect(result.width).toBe(299);
    expect(result.height).toBe(400);
  });
  it("bekanntes unbekanntes Muster auf peacock zurück", () => {
    const result = generateMarbledPaper("unknown" as never, 300, 400, 42);
    expect(result.pattern).toBe("peacock");
  });
});

describe("generateSpineMockup", () => {
  it("erzeugt SVG mit svg, title, author, bands und description", () => {
    const result = generateSpineMockup("Testbuch", "Autor", 5);
    expect(result.svg).toContain("<svg");
    expect(result.title).toBe("Testbuch");
    expect(result.author).toBe("Autor");
    expect(result.bands).toBe(5);
    expect(result.description.length).toBeGreaterThan(0);
  });
  it("SVG enthält Titel und Autor", () => {
    const result = generateSpineMockup("Mein Buch", "Mein Autor", 5);
    expect(result.svg).toContain("Mein Buch");
    expect(result.svg).toContain("Mein Autor");
  });
  it("SVG enthält width und height", () => {
    const result = generateSpineMockup("T", "A", 5);
    expect(result.svg).toContain('width="140"');
    expect(result.svg).toContain('height="520"');
  });
  it("Default bands ist 5", () => {
    const result = generateSpineMockup("T", "A");
    expect(result.bands).toBe(5);
  });
  it("bands wird auf 1-9 begrenzt", () => {
    expect(generateSpineMockup("T", "A", 0).bands).toBe(1);
    expect(generateSpineMockup("T", "A", 100).bands).toBe(9);
  });
  it("ist deterministisch für gleiche Parameter", () => {
    const r1 = generateSpineMockup("T", "A", 5);
    const r2 = generateSpineMockup("T", "A", 5);
    expect(r1.svg).toBe(r2.svg);
  });
  it("unterschiedliche Titel erzeugen unterschiedliche SVGs", () => {
    const r1 = generateSpineMockup("Buch A", "Autor", 5);
    const r2 = generateSpineMockup("Buch B", "Autor", 5);
    expect(r1.svg).not.toBe(r2.svg);
  });
  it("nutzt keine Hex-Farben im SVG", () => {
    const result = generateSpineMockup("Testbuch", "Autor", 5);
    expect(result.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("SVG enthält var(--...) Design-Tokens", () => {
    const result = generateSpineMockup("Testbuch", "Autor", 5);
    expect(result.svg).toContain("var(--");
  });
  it("title und author werden XML-escaped", () => {
    const result = generateSpineMockup("A & B", "C < D", 5);
    expect(result.svg).toContain("A &amp; B");
    expect(result.svg).toContain("C &lt; D");
  });
  it("description enthält Titel, Autor und Band-Anzahl", () => {
    const result = generateSpineMockup("Mein Buch", "Mein Autor", 5);
    expect(result.description).toContain("Mein Buch");
    expect(result.description).toContain("Mein Autor");
    expect(result.description).toContain("5");
  });
});

describe("buildPrintExport", () => {
  it("erzeugt format svg mit width, height, dpi und notes", () => {
    const mp = generateMarbledPaper("peacock", 300, 400, 42);
    const spine = generateSpineMockup("T", "A", 5);
    const result = buildPrintExport(mp, spine);
    expect(result.format).toBe("svg");
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
    expect(result.dpi).toBe(300);
    expect(result.notes.length).toBeGreaterThan(0);
  });
  it("notes ist ein Array von Strings", () => {
    const mp = generateMarbledPaper("snail", 500, 600, 1);
    const spine = generateSpineMockup("Buch", "Autor", 3);
    const result = buildPrintExport(mp, spine);
    expect(Array.isArray(result.notes)).toBe(true);
    for (const note of result.notes) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });
  it("width wird aus marbledPaper übernommen", () => {
    const mp = generateMarbledPaper("stone", 400, 500, 7);
    const spine = generateSpineMockup("X", "Y", 5);
    const result = buildPrintExport(mp, spine);
    expect(result.width).toBe(400);
    expect(result.height).toBe(500);
  });
  it("spine.title erscheint in den notes", () => {
    const mp = generateMarbledPaper("peacock", 300, 400, 42);
    const spine = generateSpineMockup("Einzigartiger Titel", "Autor", 5);
    const result = buildPrintExport(mp, spine);
    expect(result.notes.some((n) => n.includes("Einzigartiger Titel"))).toBe(true);
  });
  it("dpi ist immer 300", () => {
    const mp = generateMarbledPaper("peacock", 300, 400, 42);
    const spine = generateSpineMockup("T", "A", 5);
    const result = buildPrintExport(mp, spine);
    expect(result.dpi).toBe(300);
  });
});

describe("createSampleMarbledPaper", () => {
  it("liefert ein gültiges MarbledPaper", () => {
    const result = createSampleMarbledPaper();
    expect(result.svg).toContain("<svg");
    expect(result.pattern).toBe("peacock");
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
    expect(result.dpi).toBe(300);
    expect(result.description.length).toBeGreaterThan(0);
  });
  it("nutzt keine Hex-Farben", () => {
    const result = createSampleMarbledPaper();
    expect(result.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("ist deterministisch", () => {
    expect(createSampleMarbledPaper().svg).toBe(createSampleMarbledPaper().svg);
  });
});

describe("createSampleSpineMockup", () => {
  it("liefert ein gültiges SpineMockup", () => {
    const result = createSampleSpineMockup();
    expect(result.svg).toContain("<svg");
    expect(result.title).toBe("Der Schatten über Innsmouth");
    expect(result.author).toBe("H. P. Lovecraft");
    expect(result.bands).toBe(5);
    expect(result.description.length).toBeGreaterThan(0);
  });
  it("nutzt keine Hex-Farben", () => {
    const result = createSampleSpineMockup();
    expect(result.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("ist deterministisch", () => {
    expect(createSampleSpineMockup().svg).toBe(createSampleSpineMockup().svg);
  });
});
