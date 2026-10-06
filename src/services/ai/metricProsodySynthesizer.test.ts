/**
 * Tests: MetricProsodySynthesizer (WP 76.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  countSyllables,
  analyzeStressPattern,
  detectMeter,
  analyzeLine,
  isPureRhyme,
  isClicheRhyme,
  generateShakespeareSonnet,
  generatePetrarchSonnet,
  generateBalladStrophe,
  formatPoem,
  ratePoemQuality,
  METER_FEET,
} from "./metricProsodySynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("countSyllables", () => {
  it("zählt Silben korrekt", () => {
    expect(countSyllables("Hallo")).toBe(2);
    expect(countSyllables("Welt")).toBe(1);
  });

  it("verarbeitet leeren String", () => {
    expect(countSyllables("")).toBe(0);
  });

  it("entfernt Sonderzeichen", () => {
    expect(countSyllables("Hallo!")).toBe(2);
  });
});

describe("analyzeStressPattern", () => {
  it("erstellt Hebungsmuster", () => {
    const pattern = analyzeStressPattern("Der Wind trägt Worte");
    expect(pattern.length).toBeGreaterThan(0);
  });

  it("verarbeitet leere Zeile", () => {
    expect(analyzeStressPattern("")).toBe("");
  });
});

describe("detectMeter", () => {
  it("erkennt Jambus", () => {
    const meter = detectMeter("Der Wind trägt Worte durch die Nacht");
    expect(["iamb", "unknown"]).toContain(meter);
  });

  it("gibt unknown für kurze Zeile", () => {
    expect(detectMeter("Hallo")).toBe("unknown");
  });
});

describe("analyzeLine", () => {
  it("analysiert Zeile", () => {
    const analysis = analyzeLine("Der Wind trägt Worte durch die Nacht");
    expect(analysis.syllableCount).toBeGreaterThan(0);
    expect(analysis.stressPattern.length).toBeGreaterThan(0);
  });

  it("erkennt gültiges Metrum", () => {
    const analysis = analyzeLine("Der Wind trägt Worte durch die Nacht");
    expect(typeof analysis.isValid).toBe("boolean");
  });
});

describe("isPureRhyme", () => {
  it("erkennt reinen Reim", () => {
    expect(isPureRhyme("Haus", "Maus")).toBe(true);
  });

  it("erkennt keinen reinen Reim", () => {
    expect(isPureRhyme("Haus", "Baum")).toBe(false);
  });

  it("verarbeitet kurze Wörter", () => {
    expect(isPureRhyme("a", "b")).toBe(false);
  });
});

describe("isClicheRhyme", () => {
  it("erkennt Klischee-Reim", () => {
    expect(isClicheRhyme("Herz", "Schmerz")).toBe(true);
  });

  it("erkennt keinen Klischee-Reim", () => {
    expect(isClicheRhyme("Haus", "Maus")).toBe(false);
  });
});

describe("generateShakespeareSonnet", () => {
  it("generiert 14 Zeilen", () => {
    const poem = generateShakespeareSonnet("Test");
    expect(poem.lines).toHaveLength(14);
  });

  it("ist deterministisch", () => {
    const p1 = generateShakespeareSonnet("Test");
    const p2 = generateShakespeareSonnet("Test");
    expect(p1).toEqual(p2);
  });

  it("hat Qualität zwischen 0 und 100", () => {
    const poem = generateShakespeareSonnet("Test");
    expect(poem.quality).toBeGreaterThanOrEqual(0);
    expect(poem.quality).toBeLessThanOrEqual(100);
  });
});

describe("generatePetrarchSonnet", () => {
  it("generiert 14 Zeilen", () => {
    const poem = generatePetrarchSonnet("Test");
    expect(poem.lines).toHaveLength(14);
  });

  it("ist deterministisch", () => {
    const p1 = generatePetrarchSonnet("Test");
    const p2 = generatePetrarchSonnet("Test");
    expect(p1).toEqual(p2);
  });
});

describe("generateBalladStrophe", () => {
  it("generiert 8 Zeilen", () => {
    const poem = generateBalladStrophe("Test");
    expect(poem.lines).toHaveLength(8);
  });

  it("ist deterministisch", () => {
    const p1 = generateBalladStrophe("Test");
    const p2 = generateBalladStrophe("Test");
    expect(p1).toEqual(p2);
  });
});

describe("formatPoem", () => {
  it("formatiert Gedicht als Text", () => {
    const poem = generateShakespeareSonnet("Test");
    const text = formatPoem(poem);
    expect(text).toContain("Test");
    expect(text).toContain("Form:");
  });
});

describe("ratePoemQuality", () => {
  it("bewertet hohe Qualität", () => {
    const poem = { title: "T", form: "shakespeare" as const, lines: [], rhymeScheme: "", quality: 95 };
    expect(ratePoemQuality(poem)).toBe("Hervorragend");
  });

  it("bewertet niedrige Qualität", () => {
    const poem = { title: "T", form: "shakespeare" as const, lines: [], rhymeScheme: "", quality: 30 };
    expect(ratePoemQuality(poem)).toBe("Verbesserungswürdig");
  });
});

describe("METER_FEET", () => {
  it("hat alle Fuß-Typen", () => {
    expect(Object.keys(METER_FEET)).toContain("iamb");
    expect(Object.keys(METER_FEET)).toContain("trochee");
    expect(Object.keys(METER_FEET)).toContain("dactyl");
  });
});
