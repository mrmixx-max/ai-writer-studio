// Stil-Analyse: Tests für Füllwörter, Adverbien, Passiv, Wiederholungen, Flesch.
import { describe, it, expect } from "vitest";
import { analyzeStyle } from "@/services/stylecheck/analyzer";

describe("stylecheck analyzer", () => {
  it("erkennt Füllwörter", () => {
    const result = analyzeStyle("Er war eigentlich irgendwie sehr müde.");
    expect(result.fillerCount).toBeGreaterThanOrEqual(2);
    const fillers = result.issues.filter((i) => i.type === "filler");
    expect(fillers.some((f) => f.text === "eigentlich")).toBe(true);
    expect(fillers.some((f) => f.text === "irgendwie")).toBe(true);
  });

  it("erkennt Adverbien auf -weise und -lich", () => {
    const result = analyzeStyle("Er sprach langsam und vorsichtig. Sie war glücklich.");
    expect(result.adverbCount).toBeGreaterThanOrEqual(1);
    const adverbs = result.issues.filter((i) => i.type === "adverb");
    expect(adverbs.some((a) => a.text.includes("lich"))).toBe(true);
  });

  it("erkennt Passiv-Konstruktionen", () => {
    const result = analyzeStyle("Das Buch wurde gelesen. Die Tür wurde geöffnet.");
    expect(result.passiveCount).toBeGreaterThanOrEqual(1);
    const passives = result.issues.filter((i) => i.type === "passive");
    expect(passives.length).toBeGreaterThanOrEqual(1);
  });

  it("erkennt Wortwiederholungen im Umkreis", () => {
    const text = "Der Hund lief durch den Wald. ".repeat(20) + "Der Hund bellte.";
    const result = analyzeStyle(text);
    expect(result.repetitionCount).toBeGreaterThan(0);
  });

  it("berechnet Flesch-Score im Bereich 0-100", () => {
    const result = analyzeStyle("Der Hund läuft. Die Katze schläft. Das Kind spielt.");
    expect(result.readabilityScore).toBeGreaterThanOrEqual(0);
    expect(result.readabilityScore).toBeLessThanOrEqual(100);
  });

  it("zählt Wörter korrekt", () => {
    const result = analyzeStyle("Eins zwei drei vier fünf.");
    expect(result.wordCount).toBe(5);
  });

  it("leerer Text gibt Score 0", () => {
    const result = analyzeStyle("");
    expect(result.readabilityScore).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.issues).toHaveLength(0);
  });
});
