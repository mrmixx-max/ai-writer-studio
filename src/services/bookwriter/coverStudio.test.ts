// Tests: Cover-Studio / Spine-Calculator (WP 10.2).
//
// Reine, deterministische Logik — keine LLM-Calls, kein IO, keine Fixtures.
// Geprüft werden Formel, Fallbacks, Optionen, Beschnitt und XML-Escaping.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_BLEED,
  DEFAULT_COVER_HEIGHT,
  DEFAULT_COVER_WIDTH,
  DEFAULT_SPINE_WIDTH,
  DEFAULT_WORDS_PER_PAGE,
  PAPER_TYPES,
  calculateSpineWidth,
  estimatePageCount,
  generateCoverSvg,
} from "./coverStudio";

describe("calculateSpineWidth", () => {
  it("rechnet (Seitenzahl / 2) × Papiervolumen (standard)", () => {
    // 200 / 2 × 0.1144 = 11.44
    expect(calculateSpineWidth(200, "standard")).toBe(11.44);
  });

  it("nutzt das dickere Cream-Papier", () => {
    // 300 / 2 × 0.127 = 19.05
    expect(calculateSpineWidth(300, "cream")).toBe(19.05);
    expect(calculateSpineWidth(300, "cream")).toBeGreaterThan(
      calculateSpineWidth(300, "standard"),
    );
  });

  it("rundet auf zwei Nachkommastellen (halbe Blattzahl)", () => {
    // 201 / 2 × 0.1144 = 11.4972 → 11.5
    expect(calculateSpineWidth(201, "standard")).toBe(11.5);
  });

  it("ist case-insensitiv und trimmt die Papierart", () => {
    expect(calculateSpineWidth(200, "  CREAM  ")).toBe(calculateSpineWidth(200, "cream"));
  });

  it("fällt bei unbekannter Papierart auf standard zurück (defensiv)", () => {
    expect(calculateSpineWidth(200, "papyrus")).toBe(11.44);
    expect(calculateSpineWidth(200, "")).toBe(11.44);
  });

  it("liefert 0 bei ungültiger/negativer Seitenzahl (wirft nie)", () => {
    expect(calculateSpineWidth(0, "standard")).toBe(0);
    expect(calculateSpineWidth(-50, "standard")).toBe(0);
    expect(calculateSpineWidth(NaN, "standard")).toBe(0);
    expect(calculateSpineWidth(Infinity, "standard")).toBe(0);
  });
});

describe("estimatePageCount", () => {
  it("teilt Wortzahl durch Default-Wörter/Seite und rundet auf", () => {
    expect(estimatePageCount(50000)).toBe(Math.ceil(50000 / DEFAULT_WORDS_PER_PAGE));
  });

  it("respektiert ein eigenes wordsPerPage", () => {
    expect(estimatePageCount(50000, 300)).toBe(167); // ceil(166.67)
  });

  it("liefert mindestens 1 Seite", () => {
    expect(estimatePageCount(0)).toBe(1);
    expect(estimatePageCount(1)).toBe(1);
    expect(estimatePageCount(-10)).toBe(1);
  });

  it("fällt bei ungültigem wordsPerPage auf den Default zurück", () => {
    expect(estimatePageCount(1000, 0)).toBe(Math.ceil(1000 / DEFAULT_WORDS_PER_PAGE));
    expect(estimatePageCount(1000, -5)).toBe(Math.ceil(1000 / DEFAULT_WORDS_PER_PAGE));
  });
});

describe("generateCoverSvg", () => {
  it("erzeugt ein gültiges SVG mit Default-Maßen und Beschnitt", () => {
    const svg = generateCoverSvg("Mein Buch", "Anna Autor", 12);
    // Gesamtbreite = 2 × 152.4 + 12 + 2 × 3 = 322.8; Höhe = 228.6 + 6 = 234.6
    const totalWidth = 2 * DEFAULT_COVER_WIDTH + 12 + 2 * DEFAULT_BLEED;
    const totalHeight = DEFAULT_COVER_HEIGHT + 2 * DEFAULT_BLEED;
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`width="${totalWidth}mm"`);
    expect(svg).toContain(`height="${totalHeight}mm"`);
    expect(svg).toContain(`viewBox="0 0 ${totalWidth} ${totalHeight}"`);
  });

  it("enthält Vorderseite, Rücken und Rückseite (drei Flächen)", () => {
    const svg = generateCoverSvg("Titel", "Autor", 10);
    // Drei Flächen-Rechtecke + Grundfläche + Trim-Markierung.
    const rects = svg.match(/<rect /g) ?? [];
    expect(rects.length).toBeGreaterThanOrEqual(4);
    // Rückseiten-Füllung und Rücken-Füllung sind unterscheidbar vorhanden.
    expect(svg).toContain('fill="#f4f1ea"');
    expect(svg).toContain('fill="#d9cfbf"');
  });

  it("übernimmt benutzerdefinierte Maße und Bleed korrekt", () => {
    const svg = generateCoverSvg("T", "A", 10, { width: 148, height: 210, bleed: 3, spineWidth: 10 });
    // 2 × 148 + 10 + 6 = 312; Höhe 210 + 6 = 216
    expect(svg).toContain('width="312mm"');
    expect(svg).toContain('height="216mm"');
  });

  it("optionale spineWidth überschreibt den Positionsparameter", () => {
    const svg = generateCoverSvg("T", "A", 5, { spineWidth: 20, width: 100, height: 200, bleed: 0 });
    // 2 × 100 + 20 = 220
    expect(svg).toContain('width="220mm"');
  });

  it("fällt bei ungültigen Optionen auf Defaults zurück (defensiv)", () => {
    const svg = generateCoverSvg("T", "A", NaN, {
      width: -5,
      height: 0,
      bleed: -1,
      spineWidth: NaN,
    });
    const totalWidth = 2 * DEFAULT_COVER_WIDTH + DEFAULT_SPINE_WIDTH + 2 * DEFAULT_BLEED;
    const totalHeight = DEFAULT_COVER_HEIGHT + 2 * DEFAULT_BLEED;
    expect(svg).toContain(`width="${totalWidth}mm"`);
    expect(svg).toContain(`height="${totalHeight}mm"`);
  });

  it("setzt Fallbacks für leeren Titel/Autor ein", () => {
    const svg = generateCoverSvg("", "   ", 8);
    expect(svg).toContain("Ohne Titel");
    expect(svg).toContain("Unbekannter Autor");
  });

  it("escaped XML-Sonderzeichen in Titel und Autor", () => {
    const svg = generateCoverSvg('<b>A & B</b>', 'O"Hara', 8);
    expect(svg).not.toContain("<b>A & B</b>");
    expect(svg).toContain("&lt;b&gt;A &amp; B&lt;/b&gt;");
    expect(svg).toContain("O&quot;Hara");
  });

  it("ist deterministisch (identische Eingabe → identische Ausgabe)", () => {
    const a = generateCoverSvg("Titel", "Autor", 12, { width: 150, height: 220 });
    const b = generateCoverSvg("Titel", "Autor", 12, { width: 150, height: 220 });
    expect(a).toBe(b);
  });
});

describe("Konstanten", () => {
  it("kodiert Papiervolumen und Defaults nachvollziehbar", () => {
    expect(PAPER_TYPES.standard).toBeCloseTo(0.1144, 4);
    expect(PAPER_TYPES.cream).toBeCloseTo(0.127, 4);
    expect(DEFAULT_BLEED).toBe(3);
    expect(DEFAULT_WORDS_PER_PAGE).toBeGreaterThan(0);
    expect(DEFAULT_SPINE_WIDTH).toBeGreaterThan(0);
  });
});
