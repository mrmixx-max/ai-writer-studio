// Tests: Lesbarkeits-Metriken (WP 13.2)
import { describe, it, expect } from "vitest";
import {
  calculateFleschReadingEase,
  calculateWienerSachtextformel,
  calculateGunningFog,
  analyzeSentenceLength,
} from "./readabilityMetrics";

// ---------------------------------------------------------------------------
// Test-Texte
// ---------------------------------------------------------------------------

const SIMPLE_TEXT =
  "Die Katze sitzt auf dem Tisch. Es ist ein warmer Tag. Der Hund läuft im Park.";

const COMPLEX_TEXT =
  "Die umfassende Charakterisierung elektroenzephalographischer Phänomene erfordert eine grundlegende Neukonzeptualisierung neurophysiologischer Paradigmen. Trotz erheblicher methodologischer Heterogenität haben Forscher eindeutig statistisch signifikante Interkorrelationen nachgewiesen.";

const EMPTY_TEXT = "";

const WHITESPACE_TEXT = "   \n\t  ";

const SINGLE_WORD = "Hallo";

const LONG_SENTENCE =
  "Dies ist ein sehr langer Satz der mehr als dreißig Wörter enthält und daher als Warnung markiert werden sollte weil er die Lesbarkeit des Textes deutlich verringern kann und für viele Leser schwer verständlich ist und schwer zu lesen.";

const MIXED_SENTENCES =
  "Kurzer Satz. " +
  "Dies ist ein sehr langer Satz der mehr als dreißig Wörter enthält und daher als Warnung markiert werden sollte weil er die Lesbarkeit des Textes deutlich verringern kann und für viele Leser schwer verständlich ist und schwer zu lesen. " +
  "Noch ein kurzer Satz.";

// ---------------------------------------------------------------------------
// calculateFleschReadingEase
// ---------------------------------------------------------------------------

describe("calculateFleschReadingEase", () => {
  it("einfacher Text ergibt höheren Wert als komplexer Text", () => {
    const simple = calculateFleschReadingEase(SIMPLE_TEXT);
    const complex = calculateFleschReadingEase(COMPLEX_TEXT);
    expect(simple).toBeGreaterThan(complex);
  });

  it("leerer Text ergibt 0", () => {
    expect(calculateFleschReadingEase(EMPTY_TEXT)).toBe(0);
  });

  it("Whitespace-only Text ergibt 0", () => {
    expect(calculateFleschReadingEase(WHITESPACE_TEXT)).toBe(0);
  });

  it("einzelnes Wort ergibt gültigen Wert (1 Satz)", () => {
    const score = calculateFleschReadingEase(SINGLE_WORD);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("Wert liegt im Bereich 0-100", () => {
    const score = calculateFleschReadingEase(SIMPLE_TEXT);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calculateWienerSachtextformel
// ---------------------------------------------------------------------------

describe("calculateWienerSachtextformel", () => {
  it("einfacher Text ergibt niedrigeren Wert als komplexer Text", () => {
    const simple = calculateWienerSachtextformel(SIMPLE_TEXT);
    const complex = calculateWienerSachtextformel(COMPLEX_TEXT);
    expect(simple).toBeLessThan(complex);
  });

  it("leerer Text ergibt 0", () => {
    expect(calculateWienerSachtextformel(EMPTY_TEXT)).toBe(0);
  });

  it("Whitespace-only Text ergibt 0", () => {
    expect(calculateWienerSachtextformel(WHITESPACE_TEXT)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateGunningFog
// ---------------------------------------------------------------------------

describe("calculateGunningFog", () => {
  it("einfacher Text ergibt niedrigeren Wert als komplexer Text", () => {
    const simple = calculateGunningFog(SIMPLE_TEXT);
    const complex = calculateGunningFog(COMPLEX_TEXT);
    expect(simple).toBeLessThan(complex);
  });

  it("leerer Text ergibt 0", () => {
    expect(calculateGunningFog(EMPTY_TEXT)).toBe(0);
  });

  it("Wert ist nicht-negativ", () => {
    const score = calculateGunningFog(SIMPLE_TEXT);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeSentenceLength
// ---------------------------------------------------------------------------

describe("analyzeSentenceLength", () => {
  it("langer Satz wird markiert", () => {
    const warnings = analyzeSentenceLength(LONG_SENTENCE);
    expect(warnings.length).toBe(1);
    expect(warnings[0].wordCount).toBeGreaterThan(35);
    expect(warnings[0].position).toBe(0);
  });

  it("kurze Sätze werden nicht markiert", () => {
    const warnings = analyzeSentenceLength(SIMPLE_TEXT);
    expect(warnings.length).toBe(0);
  });

  it("leerer Text ergibt leeres Array", () => {
    expect(analyzeSentenceLength(EMPTY_TEXT)).toEqual([]);
  });

  it("Whitespace-only Text ergibt leeres Array", () => {
    expect(analyzeSentenceLength(WHITESPACE_TEXT)).toEqual([]);
  });

  it("gemischte Sätze: nur langer Satz wird markiert", () => {
    const warnings = analyzeSentenceLength(MIXED_SENTENCES);
    expect(warnings.length).toBe(1);
    expect(warnings[0].position).toBe(1);
    expect(warnings[0].wordCount).toBeGreaterThan(35);
  });

  it("Warnung enthält Satztext und Wortzahl", () => {
    const warnings = analyzeSentenceLength(LONG_SENTENCE);
    expect(warnings[0].sentence).toContain("Dies ist ein sehr langer Satz");
    expect(typeof warnings[0].wordCount).toBe("number");
  });
});
