// Tests: StyleAnalyzer-Engine (Sprint 22, Agent 6).
import { describe, it, expect } from "vitest";
import {
  analyzeStyle,
  compareToAuthor,
  compareToManyAuthors,
  compareToAllAuthors,
  getAvailableAuthors,
  AUTHOR_PROFILES,
} from "./styleAnalyzer";

const SAMPLE =
  "Er ging durch die dunkle Nacht. Plötzlich hörte er einen Schrei. " +
  "„Hilfe!“, rief eine Stimme aus dem Nebel. Er rannte los, so schnell er konnte. " +
  "Die Tür des alten Hauses stand offen, und dahinter wartete das Unbekannte.";

describe("analyzeStyle", () => {
  it("berechnet korrekte Metriken", () => {
    const p = analyzeStyle(SAMPLE);
    expect(p.author).toBe("Eigener Text");
    expect(p.avgSentenceLength).toBeGreaterThan(0);
    expect(p.avgSentenceLength).toBeGreaterThan(4);
    expect(p.avgSentenceLength).toBeLessThan(15);
    expect(p.vocabularyRichness).toBeGreaterThan(0);
    expect(p.vocabularyRichness).toBeLessThanOrEqual(1);
    expect(p.dialogueRatio).toBeGreaterThan(0);
    expect(p.descriptionRatio).toBeGreaterThanOrEqual(0);
    expect(p.descriptionRatio).toBeLessThanOrEqual(1);
    expect(["slow", "medium", "fast"]).toContain(p.pacing);
    expect(p.commonWords.length).toBeGreaterThan(0);
  });

  it("leerer Text ergibt ein neutrales Null-Profil", () => {
    const p = analyzeStyle("   ");
    expect(p.avgSentenceLength).toBe(0);
    expect(p.vocabularyRichness).toBe(0);
    expect(p.dialogueRatio).toBe(0);
    expect(p.commonWords).toEqual([]);
  });

  it("kurze Sätze ergeben schnelles Tempo, lange Sätze langsames", () => {
    const fast = analyzeStyle("Los. Lauf. Jetzt. Schnell. Weg.");
    expect(fast.pacing).toBe("fast");
    const slow = analyzeStyle(
      "In jener fernen, längst vergangenen Zeit, als die Welt noch eine andere war und die Menschen in stiller Eintracht mit den dunklen Mächten des Waldes lebten, geschah es eines Abends, dass sich das Schicksal auf eine Weise wandte, die niemand hatte vorhersehen können.",
    );
    expect(slow.pacing).toBe("slow");
  });
});

describe("getAvailableAuthors", () => {
  it("gibt 10+ Autoren zurück", () => {
    const authors = getAvailableAuthors();
    expect(authors.length).toBeGreaterThanOrEqual(10);
    expect(AUTHOR_PROFILES.length).toBeGreaterThanOrEqual(10);
  });

  it("enthält die Pflicht-Autoren", () => {
    const authors = getAvailableAuthors();
    for (const name of [
      "Ernest Hemingway",
      "Virginia Woolf",
      "Franz Kafka",
      "Thomas Mann",
      "Edgar Wallace",
      "Stefan Zweig",
      "Bertolt Brecht",
      "Ingeborg Bachmann",
      "Max Frisch",
      "Friedrich Dürrenmatt",
    ]) {
      expect(authors).toContain(name);
    }
  });
});

describe("compareToAuthor", () => {
  it("erzeugt einen Vergleich mit Ähnlichkeit 0..100", () => {
    const c = compareToAuthor(SAMPLE, "Edgar Wallace");
    expect(c.textProfile.author).toBe("Eigener Text");
    expect(c.comparisons).toHaveLength(1);
    expect(c.comparisons[0].author).toBe("Edgar Wallace");
    expect(c.comparisons[0].similarity).toBeGreaterThanOrEqual(0);
    expect(c.comparisons[0].similarity).toBeLessThanOrEqual(100);
    expect(c.verdict).toContain("Edgar Wallace");
  });

  it("wirft bei unbekanntem Autor", () => {
    expect(() => compareToAuthor(SAMPLE, "Unbekannt Autor")).toThrow();
  });
});

describe("compareToManyAuthors / compareToAllAuthors", () => {
  it("vergleicht mit mehreren Autoren", () => {
    const list = compareToManyAuthors(SAMPLE, ["Ernest Hemingway", "Thomas Mann"]);
    expect(list).toHaveLength(2);
    expect(list[0].comparisons[0].author).toBe("Ernest Hemingway");
    expect(list[1].comparisons[0].author).toBe("Thomas Mann");
  });

  it("compareToAllAuthors sortiert absteigend nach Ähnlichkeit", () => {
    const c = compareToAllAuthors(SAMPLE);
    expect(c.comparisons.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < c.comparisons.length; i++) {
      expect(c.comparisons[i - 1].similarity).toBeGreaterThanOrEqual(
        c.comparisons[i].similarity,
      );
    }
    expect(c.verdict).toContain(c.comparisons[0].author);
  });
});
