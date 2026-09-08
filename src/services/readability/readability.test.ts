// Tests: Readability-Engine (Sprint 25, Agent 4).
import { describe, it, expect } from "vitest";
import {
  analyze,
  compareTexts,
  countSyllables,
  getEducationLevel,
  getScoreDescription,
  splitReadabilitySentences,
  tokenizeReadabilityWords,
} from "./readability";

const SIMPLE =
  "The cat sat on the mat. It was a hot day. The dog ran in the park. " +
  "We had fun in the sun. I like to read books.";

const COMPLEX =
  "The unprecedented characterization of electroencephalographic phenomena " +
  "necessitates comprehensive reconceptualization of neurophysiological paradigms. " +
  "Notwithstanding considerable methodological heterogeneity, investigators " +
  "unambiguously demonstrated statistically significant intercorrelations.";

describe("analyze()", () => {
  it("berechnet korrekte Metriken (Zaehlung + Formeln)", () => {
    const r = analyze("The cat sat. The dog ran.");
    expect(r.words).toBe(6);
    expect(r.sentences).toBe(2);
    expect(r.syllables).toBe(6);
    expect(r.complexWords).toBe(0);
    // W/S = 3, Syl/W = 1 -> FK = 0.39*3 + 11.8*1 - 15.59 = -2.62 -> clamp 0
    expect(r.score.fleschKincaid).toBe(0);
    // FRE = 206.835 - 1.015*3 - 84.6 = 119.19 -> clamp 100
    expect(r.score.fleschReadingEase).toBe(100);
    // Fog = 0.4 * (3 + 0) = 1.2
    expect(r.score.gunningFog).toBeCloseTo(1.2, 1);
    expect(r.score.educationLevel).toBe("Leseanfänger");
  });

  it("einfacher Text ist leichter lesbar als komplexer", () => {
    const simple = analyze(SIMPLE);
    const complex = analyze(COMPLEX);
    expect(simple.score.fleschReadingEase).toBeGreaterThan(complex.score.fleschReadingEase);
    expect(simple.score.fleschKincaid).toBeLessThan(complex.score.fleschKincaid);
    expect(simple.score.gunningFog).toBeLessThan(complex.score.gunningFog);
    expect(complex.complexWords).toBeGreaterThan(0);
    expect(complex.score.averageAge).toBeGreaterThan(simple.score.averageAge);
  });

  it("leerer Text ergibt Null-Ergebnis ohne NaN", () => {
    const r = analyze("   ");
    expect(r.words).toBe(0);
    expect(r.sentences).toBe(0);
    for (const v of [
      r.score.fleschKincaid,
      r.score.fleschReadingEase,
      r.score.gunningFog,
      r.score.colemanLiau,
      r.score.ari,
      r.score.smog,
    ]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(r.score.educationLevel).toBe("Unbekannt");
  });

  it("Coleman-Liau nutzt Buchstaben-Dichte (Formel-Gegenprobe)", () => {
    const r = analyze("The cat sat. The dog ran.");
    // Buchstaben: thecatsatthedogran = 18, W = 6 -> L = 300, S = 33.33
    // CL = 0.0588*300 - 0.296*33.33 - 15.8 = 17.64 - 9.867 - 15.8 = -8.03 -> clamp 0
    expect(r.score.colemanLiau).toBe(0);
    // ARI = 4.71*3 + 0.5*3 - 21.43 = 14.13 + 1.5 - 21.43 = -5.8 -> clamp 0
    expect(r.score.ari).toBe(0);
  });
});

describe("getScoreDescription()", () => {
  it("gibt stimmige Bewertungen je FRE-Bereich", () => {
    expect(getScoreDescription(95)).toBe("Sehr leicht lesbar");
    expect(getScoreDescription(85)).toBe("Leicht lesbar");
    expect(getScoreDescription(65)).toContain("Standard");
    expect(getScoreDescription(40)).toBe("Schwer lesbar");
    expect(getScoreDescription(10)).toContain("Sehr schwer");
    expect(getScoreDescription(NaN)).toBe("Keine Bewertung möglich");
  });
});

describe("getEducationLevel()", () => {
  it("mappt Grade-Level auf Bildungs-Stufen", () => {
    expect(getEducationLevel(0)).toBe("Leseanfänger");
    expect(getEducationLevel(4)).toContain("Grundschule");
    expect(getEducationLevel(8)).toBe("Mittelstufe");
    expect(getEducationLevel(11)).toBe("Oberstufe");
    expect(getEducationLevel(13)).toContain("Bachelor");
    expect(getEducationLevel(20)).toContain("Promotion");
  });
});

describe("compareTexts()", () => {
  it("erzeugt einen Vergleich zweier Texte", () => {
    const c = compareTexts(SIMPLE, COMPLEX);
    expect(c.text1.words).toBeGreaterThan(0);
    expect(c.text2.words).toBeGreaterThan(0);
    expect(c.text1.score.fleschReadingEase).toBeGreaterThan(
      c.text2.score.fleschReadingEase,
    );
  });
});

describe("Tokenizer-Helfer", () => {
  it("tokenisiert Woerter und Saetze robust", () => {
    expect(tokenizeReadabilityWords("Hello, world! 123")).toEqual(["hello", "world", "123"]);
    expect(splitReadabilitySentences("Eins. Zwei! Drei?")).toHaveLength(3);
    expect(splitReadabilitySentences("   ")).toHaveLength(0);
  });

  it("zaehlt Silben plausibel", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("reading")).toBe(2);
    expect(countSyllables("unprecedented")).toBeGreaterThanOrEqual(3);
    expect(countSyllables("")).toBe(0);
  });
});
