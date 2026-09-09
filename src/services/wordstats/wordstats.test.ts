// Tests für die WordStats Engine (Sprint 25, Agent 6).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  analyze,
  compareStats,
  compareWordUsage,
  getNGrams,
  getProgressOverTime,
  getStats,
  getTopWords,
  getTopWordsAsync,
  getVocabularyRichness,
  getWordFrequency,
  recordProgressPoint,
  searchKWIC,
  GERMAN_STOPWORDS,
  ENGLISH_STOPWORDS,
} from "./wordstats";

describe("wordstats stopwords", () => {
  it("führt je mindestens 100 eindeutige DE- und EN-Stopwords", () => {
    expect(new Set(GERMAN_STOPWORDS).size).toBeGreaterThanOrEqual(100);
    expect(new Set(ENGLISH_STOPWORDS).size).toBeGreaterThanOrEqual(100);
  });
});

describe("analyze", () => {
  it("berechnet korrekte Statistiken für einen Beispieltext", () => {
    const r = analyze("Der Hund bellt. Der Hund rennt schnell. Die Katze schläft.");
    // Tokens: der,hund,bellt,der,hund,rennt,schnell,die,katze,schläft = 10
    expect(r.totalWords).toBe(10);
    expect(r.uniqueWords).toBe(8); // der, hund doppelt
    expect(r.typeTokenRatio).toBeCloseTo(0.8, 5);
    // Wortlängen: 3+4+5+3+4+5+7+3+5+7 = 46 → 4.6
    expect(r.averageWordLength).toBeCloseTo(4.6, 5);
    expect(r.topWords[0]).toMatchObject({ word: "hund", count: 2 });
    expect(r.topWords[0].frequency).toBeCloseTo(20, 5);
    // Stopwords (der, die) dürfen nicht in den Top-Wörtern stehen
    expect(r.topWords.map((w) => w.word)).not.toContain("der");
    // seltene Wörter: bellt, rennt, schnell, katze, schläft (je 1×)
    expect(r.rareWords.length).toBe(5);
    expect(r.rareWords.every((w) => w.count === 1)).toBe(true);
    // KWIC default: Treffer zum Top-Wort "hund"
    expect(r.kwic.length).toBe(2);
    expect(r.kwic[0].keyword.toLowerCase()).toBe("hund");
  });

  it("liefert Nullwerte für leeren Text", () => {
    const r = analyze("");
    expect(r).toMatchObject({
      totalWords: 0,
      uniqueWords: 0,
      typeTokenRatio: 0,
      averageWordLength: 0,
    });
    expect(r.topWords).toEqual([]);
    expect(r.bigrams).toEqual([]);
    expect(r.trigrams).toEqual([]);
    expect(r.kwic).toEqual([]);
  });
});

describe("getTopWords", () => {
  it("gibt eine absteigend sortierte Liste zurück", () => {
    const top = getTopWords("Apfel Birne Apfel Kirsche Birne Apfel", 10);
    expect(top.map((w) => w.word)).toEqual(["apfel", "birne", "kirsche"]);
    expect(top[0]).toMatchObject({ count: 3, frequency: 50 });
  });

  it("begrenzt auf n Einträge und respektiert n <= 0", () => {
    expect(getTopWords("Apfel Birne Kirsche", 2)).toHaveLength(2);
    expect(getTopWords("Apfel Birne", 0)).toEqual([]);
  });
});

describe("getNGrams", () => {
  it("erzeugt Bigramme mit Häufigkeiten", () => {
    const bi = getNGrams("der Hund bellt der Hund rennt", 2);
    expect(bi[0]).toEqual({ words: ["der", "hund"], count: 2 });
    expect(bi.length).toBeLessThanOrEqual(10);
  });

  it("erzeugt Trigramme und lehnt n < 1 ab", () => {
    expect(getNGrams("a b c d", 3)).toEqual([
      { words: ["a", "b", "c"], count: 1 },
      { words: ["b", "c", "d"], count: 1 },
    ]);
    expect(getNGrams("a b c", 0)).toEqual([]);
    expect(getNGrams("a", 2)).toEqual([]);
  });
});

describe("searchKWIC", () => {
  it("findet das Keyword mit linkem und rechtem Kontext", () => {
    const hits = searchKWIC("Der kleine Hund bellt laut im Garten", "Hund", 2);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      before: "Der kleine",
      keyword: "Hund",
      after: "bellt laut",
      position: 2,
    });
  });

  it("ist case-insensitiv und meldet nichts bei leerem Keyword", () => {
    expect(searchKWIC("Hund und HUND", "hund", 1)).toHaveLength(2);
    expect(searchKWIC("Hund bellt", "", 2)).toEqual([]);
    expect(searchKWIC("Hund bellt", "katze", 2)).toEqual([]);
  });
});

describe("compareWordUsage / getVocabularyRichness", () => {
  it("analysiert zwei Texte getrennt", () => {
    const { text1, text2 } = compareWordUsage("Hund Hund Hund", "Katze Maus Vogel Fisch");
    expect(text1.totalWords).toBe(3);
    expect(text1.typeTokenRatio).toBeCloseTo(1 / 3, 5);
    expect(text2.uniqueWords).toBe(4);
    expect(text2.typeTokenRatio).toBe(1);
  });

  it("berechnet die Type-Token-Ratio robust", () => {
    expect(getVocabularyRichness(8, 10)).toBeCloseTo(0.8, 5);
    expect(getVocabularyRichness(0, 0)).toBe(0);
    expect(getVocabularyRichness(5, 0)).toBe(0);
    expect(getVocabularyRichness(12, 10)).toBe(1); // geclippt
  });
});

describe("Auftrags-API (Sprint 25, Agent 6): getStats / getTopWords / Frequenz / Vergleich / Fortschritt", () => {
  const SAMPLE = "Der Hund bellt. Der Hund rennt schnell.";

  beforeEach(() => {
    localStorage.clear();
  });

  it("getStats() gibt Statistiken zurück", async () => {
    const s = await getStats(SAMPLE);
    expect(s.totalWords).toBe(7);
    expect(s.uniqueWords).toBe(5);
    expect(s.averageWordLength).toBeGreaterThan(0);
    expect(s.averageSentenceLength).toBeGreaterThan(0);
    expect(s.readabilityScore).toBeGreaterThanOrEqual(0);
    expect(s.readabilityScore).toBeLessThanOrEqual(100);
    expect(s.topWords[0]).toMatchObject({ word: "hund", count: 2 });
    expect(s.wordFrequency["hund"]).toBe(2);
    expect(Object.keys(s.characterFrequency).length).toBeGreaterThan(0);
    expect(s.dialoguePercentage + s.descriptionPercentage).toBeCloseTo(100, 5);
  });

  it("getStats() bei leerem Text: Nullwerte", async () => {
    const s = await getStats("   ");
    expect(s).toMatchObject({ totalWords: 0, uniqueWords: 0, dialoguePercentage: 0 });
  });

  it("getTopWordsAsync() gibt limitierte Liste zurück", async () => {
    const top = await getTopWordsAsync("Apfel Birne Apfel Kirsche Birne Apfel", 2);
    expect(top).toEqual([
      { word: "apfel", count: 3 },
      { word: "birne", count: 2 },
    ]);
  });

  it("getWordFrequency() zählt alle Tokens inkl. Stopwords", async () => {
    const freq = await getWordFrequency("Der Hund und der Hund");
    expect(freq["der"]).toBe(2);
    expect(freq["hund"]).toBe(2);
    expect(freq["und"]).toBe(1);
  });

  it("compareStats() gibt Vergleich mit Deltas zurück", async () => {
    const cmp = await compareStats("Hund Hund", "Hund Katze Maus Vogel");
    expect(cmp.before.totalWords).toBe(2);
    expect(cmp.after.totalWords).toBe(4);
    const total = cmp.changes.find((c) => c.metric === "totalWords");
    expect(total).toMatchObject({ before: 2, after: 4, change: 2 });
    expect(cmp.changes.length).toBeGreaterThanOrEqual(7);
  });

  it("getProgressOverTime() rundet localStorage robust ab", async () => {
    expect(await getProgressOverTime("unbekanntes-projekt-xyz")).toEqual([]);
    recordProgressPoint("test-projekt-xyz", 42);
    const points = await getProgressOverTime("test-projekt-xyz");
    expect(points.length).toBeGreaterThanOrEqual(1);
    expect(points[points.length - 1].wordCount).toBe(42);
    localStorage.removeItem("wordstats-progress-test-projekt-xyz");
  });
});
