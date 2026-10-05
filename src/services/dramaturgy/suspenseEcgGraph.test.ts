// Tests: Szenen-Spannungs-EKG (WP 50.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  analyzeSceneTension,
  detectFlatline,
  calculateCliffhangerScore,
} from "./suspenseEcgGraph";
import type { EcgReading } from "./suspenseEcgGraph";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Einen Reading mit festen Werten bauen (für Flatline-Tests). */
function makeReading(index: number, pulse: number): EcgReading {
  return {
    sentence: `Satz ${index}`,
    index,
    pulse,
    verbDensity: 0,
    signalWords: 0,
    sensoryWords: 0,
  };
}

// ---------------------------------------------------------------------------
// 1) analyzeSceneTension
// ---------------------------------------------------------------------------

describe("analyzeSceneTension", () => {
  it("liefert leeres Array für leeren String", () => {
    expect(analyzeSceneTension("")).toEqual([]);
  });

  it("liefert leeres Array für Whitespace-only", () => {
    expect(analyzeSceneTension("   \n\t  ")).toEqual([]);
  });

  it("liefert leeres Array für undefiniert", () => {
    expect(analyzeSceneTension(undefined as unknown as string)).toEqual([]);
  });

  it("analysiert einen einzelnen Satz", () => {
    const readings = analyzeSceneTension("Plötzlich!");
    expect(readings).toHaveLength(1);
    expect(readings[0].sentence).toBe("Plötzlich!");
    expect(readings[0].index).toBe(0);
  });

  it("analysiert mehrere Sätze mit korrekten Indizes", () => {
    const readings = analyzeSceneTension("Er kam. Sie sah ihn. Er lächelte.");
    expect(readings).toHaveLength(3);
    expect(readings[0].index).toBe(0);
    expect(readings[1].index).toBe(1);
    expect(readings[2].index).toBe(2);
  });

  it("pulse ist im Bereich 0–100", () => {
    const readings = analyzeSceneTension("Plötzlich! Er rannte. Der Himmel war grau.");
    for (const r of readings) {
      expect(r.pulse).toBeGreaterThanOrEqual(0);
      expect(r.pulse).toBeLessThanOrEqual(100);
    }
  });

  it("verbDensity ist im Bereich 0–100", () => {
    const readings = analyzeSceneTension("Er rannte. Der Himmel war grau.");
    for (const r of readings) {
      expect(r.verbDensity).toBeGreaterThanOrEqual(0);
      expect(r.verbDensity).toBeLessThanOrEqual(100);
    }
  });

  it("kurze Sätze haben höheren Puls als lange", () => {
    const short = analyzeSceneTension("Plötzlich!")[0];
    const long = analyzeSceneTension(
      "Der Himmel war grau und der Wind wehte kalt durch die kahlen Bäume.",
    )[0];
    expect(short.pulse).toBeGreaterThan(long.pulse);
  });

  it("Signalwörter erhöhen den Puls", () => {
    const withSignal = analyzeSceneTension("Plötzlich!")[0];
    const withoutSignal = analyzeSceneTension("Es war.")[0];
    expect(withSignal.pulse).toBeGreaterThan(withoutSignal.pulse);
  });

  it("signalWords und sensoryWords sind nicht-negativ", () => {
    const readings = analyzeSceneTension("Er sah den Blitz und hörte den Donner.");
    for (const r of readings) {
      expect(r.signalWords).toBeGreaterThanOrEqual(0);
      expect(r.sensoryWords).toBeGreaterThanOrEqual(0);
    }
  });

  it("erkennt Signalwörter korrekt", () => {
    const readings = analyzeSceneTension("Plötzlich und sofort!");
    expect(readings[0].signalWords).toBeGreaterThanOrEqual(2);
  });

  it("erkennt Sinnesimpulse korrekt", () => {
    const readings = analyzeSceneTension("Er sah den roten Blitz.");
    expect(readings[0].sensoryWords).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 2) detectFlatline
// ---------------------------------------------------------------------------

describe("detectFlatline", () => {
  it("liefert null für leeres Array", () => {
    expect(detectFlatline([])).toBeNull();
  });

  it("liefert null wenn kein Flatline vorliegt", () => {
    const readings = [
      makeReading(0, 80),
      makeReading(1, 70),
      makeReading(2, 90),
    ];
    expect(detectFlatline(readings)).toBeNull();
  });

  it("liefert null bei genau 5 Sätzen mit pulse < 20 (Grenze)", () => {
    const readings = Array.from({ length: 5 }, (_, i) => makeReading(i, 10));
    expect(detectFlatline(readings)).toBeNull();
  });

  it("erkennt Flatline bei 6 Sätzen mit pulse < 20", () => {
    const readings = Array.from({ length: 6 }, (_, i) => makeReading(i, 10));
    const warning = detectFlatline(readings);
    expect(warning).not.toBeNull();
    expect(warning!.startIndex).toBe(0);
    expect(warning!.endIndex).toBe(5);
  });

  it("erkennt Flatline am Ende des Arrays", () => {
    const readings = [
      makeReading(0, 80),
      makeReading(1, 70),
      ...Array.from({ length: 6 }, (_, i) => makeReading(i + 2, 5)),
    ];
    const warning = detectFlatline(readings);
    expect(warning).not.toBeNull();
    expect(warning!.startIndex).toBe(2);
    expect(warning!.endIndex).toBe(7);
  });

  it("erkennt Flatline in der Mitte des Arrays", () => {
    const readings = [
      makeReading(0, 80),
      ...Array.from({ length: 6 }, (_, i) => makeReading(i + 1, 5)),
      makeReading(7, 90),
    ];
    const warning = detectFlatline(readings);
    expect(warning).not.toBeNull();
    expect(warning!.startIndex).toBe(1);
    expect(warning!.endIndex).toBe(6);
  });

  it("reason enthält die Anzahl der Sätze", () => {
    const readings = Array.from({ length: 7 }, (_, i) => makeReading(i, 10));
    const warning = detectFlatline(readings);
    expect(warning).not.toBeNull();
    expect(warning!.reason).toContain("7");
  });
});

// ---------------------------------------------------------------------------
// 3) calculateCliffhangerScore
// ---------------------------------------------------------------------------

describe("calculateCliffhangerScore", () => {
  it("liefert 0 für leeren String", () => {
    expect(calculateCliffhangerScore("")).toBe(0);
  });

  it("liefert 0 für Whitespace-only", () => {
    expect(calculateCliffhangerScore("   \n\t  ")).toBe(0);
  });

  it("liefert 0 ohne Cliffhanger-Elemente", () => {
    expect(calculateCliffhangerScore("Der Himmel war grau. Die Sonne schien.")).toBe(0);
  });

  it("erkennt offene Frage (?)", () => {
    const score = calculateCliffhangerScore("Wer war das?");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("erkennt unvollendete Handlung (aber)", () => {
    const score = calculateCliffhangerScore("Er kam, aber er blieb nicht.");
    expect(score).toBeGreaterThan(0);
  });

  it("erkennt unvollendete Handlung (doch)", () => {
    const score = calculateCliffhangerScore("Sie wusste es doch.");
    expect(score).toBeGreaterThan(0);
  });

  it("erkennt Schock-Enthüllung (!)", () => {
    const score = calculateCliffhangerScore("Das war nicht möglich!");
    expect(score).toBeGreaterThan(0);
  });

  it("kombinierte Cliffhanger-Elemente erhöhen den Score", () => {
    const single = calculateCliffhangerScore("Wer war das?");
    const combined = calculateCliffhangerScore("Wer war das? Er kam, aber er blieb nicht!");
    expect(combined).toBeGreaterThan(single);
  });

  it("berücksichtigt nur die letzten 3 Sätze", () => {
    const withLate = calculateCliffhangerScore(
      "Der Himmel war grau. Die Sonne schien. Der Wind wehte. Wer war das?",
    );
    const withoutLate = calculateCliffhangerScore(
      "Der Himmel war grau. Die Sonne schien. Der Wind wehte.",
    );
    expect(withLate).toBeGreaterThan(withoutLate);
  });

  it("Score ist im Bereich 0–100", () => {
    const score = calculateCliffhangerScore(
      "Plötzlich! Wer war das? Er kam, aber er blieb nicht!",
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("sättigt bei 100 bei vielen Cliffhanger-Elementen", () => {
    const score = calculateCliffhangerScore(
      "Plötzlich! Wer war das? Er kam, aber er blieb nicht! Das war nicht möglich!",
    );
    expect(score).toBe(100);
  });
});
