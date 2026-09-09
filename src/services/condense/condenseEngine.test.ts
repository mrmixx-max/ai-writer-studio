// Condense Engine Tests (Sprint 26, Agent 5)
import { describe, it, expect } from "vitest";
import {
  condenseText,
  condenseAll,
  CONDENSE_TECHNIQUES,
} from "./condenseEngine";

describe("Condense Engine", () => {
  it("condenseText applies remove-fillers technique", () => {
    const text = "Der Hund bellt eigentlich sehr laut.";
    const result = condenseText(text, "remove-fillers");
    expect(result.condensed).not.toContain("eigentlich");
    expect(result.removedWords).toBeGreaterThan(0);
  });

  it("condenseText applies shorten-sentences technique", () => {
    const text = "Der Hund bellt und die Katze schläft und der Vogel singt und die Maus läuft und der Fisch schwimmt und die Schlange kriecht und der Löwe brüllt und der Elefant trumpft und der Affe klettert und der Bär brummt.";
    const result = condenseText(text, "shorten-sentences");
    expect(result.condensedLength).toBeLessThan(result.originalLength);
  });

  it("condenseText applies bullet-points technique", () => {
    const text = "Erstens. Zweitens. Drittens.";
    const result = condenseText(text, "bullet-points");
    expect(result.condensed).toContain("•");
  });

  it("condenseText returns original for unknown technique", () => {
    const text = "Test text";
    const result = condenseText(text, "unknown");
    expect(result.condensed).toBe(text);
  });

  it("condenseAll returns results for all techniques", () => {
    const text = "Der Hund bellt. Die Katze schläft.";
    const results = condenseAll(text);
    expect(results.length).toBe(CONDENSE_TECHNIQUES.length);
  });
});
