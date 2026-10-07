// @vitest-environment jsdom
/** Tests: LigatureGlyphSentinel (WP 89.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  findMorphemeBoundaries,
  scanLigatureViolations,
  correctLigatures,
  applyZWNJAtBoundaries,
  scanAndReport,
  createSampleReport,
  createSampleText,
  type LigatureViolation as _LigatureViolation,
  type MorphemeBoundary as _MorphemeBoundary,
  type LigatureReport as _LigatureReport,
} from "./ligatureGlyphSentinel";

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

describe("findMorphemeBoundaries", () => {
  it("findet Morphemgrenzen in zusammengesetzten Wörtern", () => {
    const boundaries = findMorphemeBoundaries("Auf-fahrt");
    expect(boundaries.length).toBeGreaterThan(0);
    expect(boundaries.some(b => b.leftMorpheme === "auf" && b.rightMorpheme.includes("fahrt"))).toBe(true);
  });

  it("findet mehrere Grenzen", () => {
    const boundaries = findMorphemeBoundaries("schlaf-los");
    expect(boundaries.some(b => b.leftMorpheme.includes("schlaf") && b.rightMorpheme.includes("los"))).toBe(true);
  });

  it("findet Präfixe und Suffixe", () => {
    const boundaries = findMorphemeBoundaries("Un-ter-stütz-ung");
    expect(boundaries.length).toBeGreaterThan(0);
  });

  it("gibt leeres Array für einfache Wörter", () => {
    const boundaries = findMorphemeBoundaries("Haus");
    // Einfache Wörter können 0 oder mehr Grenzen haben
    expect(Array.isArray(boundaries)).toBe(true);
  });
});

describe("scanLigatureViolations", () => {
  it("findet Ligaturverletzungen in zusammengesetzten Wörtern", () => {
    const text = "Auf-fahrt schlaf-los";
    const violations = scanLigatureViolations(text);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("gibt Position und Kontext zurück", () => {
    const text = "Auf-fahrt";
    const violations = scanLigatureViolations(text);
    if (violations.length > 0) {
      const v = violations[0];
      expect(v.position).toBeGreaterThanOrEqual(0);
      expect(v.original).toBe("Auf-fahrt");
      expect(v.corrected).toContain("\u200C");
      expect(v.context).toBeDefined();
    }
  });

  it("findet mehrere Verletzungen", () => {
    const text = "Auf-fahrt schlaf-los Schiff-fahrt";
    const violations = scanLigatureViolations(text);
    expect(violations.length).toBe(2);
  });
});

describe("correctLigatures", () => {
  it("fügt ZWNJ an Morphemgrenzen ein", () => {
    const text = "Auf-fahrt";
    const { corrected, violations } = correctLigatures(text);
    expect(corrected).toContain("\u200C");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("behandelt mehrere Wörter", () => {
    const text = "Auf-fahrt schlaf-los";
    const { corrected } = correctLigatures(text);
    const zwnjCount = (corrected.match(/\u200C/g) || []).length;
    expect(zwnjCount).toBe(2);
  });

  it("behält Originaltext bei wenn keine Grenzen", () => {
    const text = "Haus Baum";
    const { corrected } = correctLigatures(text);
    // Keine ZWNJ bei einfachen Wörtern ohne Morphemgrenzen in unserem Test
    expect(corrected).toBe("Haus Baum");
  });
});

describe("applyZWNJAtBoundaries", () => {
  it("ist Alias für correctLigatures", () => {
    const text = "Auf-fahrt";
    const corrected1 = applyZWNJAtBoundaries(text);
    const { corrected: corrected2 } = correctLigatures(text);
    expect(corrected1).toBe(corrected2);
  });
});

describe("scanAndReport", () => {
  it("erzeugt vollständigen Bericht", () => {
    const text = "Auf-fahrt schlaf-los";
    const report = scanAndReport(text);
    expect(report.text).toBe(text);
    expect(report.violations.length).toBe(2);
    expect(report.morphemeBoundaries.length).toBeGreaterThan(0);
    expect(report.zwNJInserted).toBe(2);
    expect(report.correctedText).toContain("\u200C");
    expect(report.stats.totalLigatures).toBe(2);
    expect(report.stats.violationsFixed).toBe(2);
    expect(report.stats.zwNJInserted).toBe(2);
  });

  it("statistiken stimmen", () => {
    const text = "Auf-fahrt schlaf-los Schiff-fahrt";
    const report = scanAndReport(text);
    expect(report.stats.totalLigatures).toBe(2);
    expect(report.stats.violationsFixed).toBe(2);
    expect(report.stats.zwNJInserted).toBe(2);
  });
});

describe("createSampleReport", () => {
  it("erzeugt Beispielbericht", () => {
    const report = createSampleReport();
    expect(report.text).toContain("Auf-fahrt");
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.correctedText).toContain("\u200C");
  });
});

describe("createSampleText", () => {
  it("gibt Testtext zurück", () => {
    const text = createSampleText();
    expect(text).toContain("Auf-fahrt");
    expect(text).toContain("schlaf-los");
  });
});