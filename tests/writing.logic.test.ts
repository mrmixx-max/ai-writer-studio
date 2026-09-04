// A1-Nachtrag: Coverage-Löcher schließen — ideas.ts + wordstats.ts (bisher 0 %).
// Reine Logik-Module ohne Provider/DB; Tests dokumentieren Vertragsverhalten.
import { describe, it, expect } from "vitest";
import { generateIdeas, generateRandomPrompt } from "@/services/writing/ideas";
import { computeWordStats } from "@/services/writing/wordstats";

describe("ideas.ts (Coverage-Nachtrag, A1)", () => {
  it("generateIdeas liefert count Einträge je Kategorie mit id/category/title/description", () => {
    for (const type of ["plot", "conflict", "setting", "flaw"] as const) {
      const ideas = generateIdeas(type, 5);
      expect(ideas).toHaveLength(5);
      for (const idea of ideas) {
        expect(idea.id).toMatch(new RegExp(`^${type}-\\d+-\\d+$`));
        expect(idea.category).toBe(type);
        expect(idea.title.length).toBeGreaterThan(0);
        expect(idea.description.length).toBeGreaterThanOrEqual(idea.title.length);
      }
    }
  });

  it("generateIdeas respektiert count kleiner als Pool-Größe (Kein Duplikat im Aufruf)", () => {
    const ideas = generateIdeas("plot", 3);
    expect(ideas).toHaveLength(3);
    const descriptions = new Set(ideas.map((i) => i.description));
    expect(descriptions.size).toBe(3);
  });

  it("generateIdeas mit count > Poolgröße liefert höchstens den Pool (kein Undefined)", () => {
    const ideas = generateIdeas("flaw", 100);
    expect(ideas.length).toBeLessThanOrEqual(10);
    for (const idea of ideas) expect(idea.description).toBeTruthy();
  });

  it("generateRandomPrompt liefert einen nicht-leeren Prompt-String", () => {
    const p = generateRandomPrompt();
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(10);
    expect(p.endsWith("?")).toBe(true);
  });
});

describe("wordstats.ts (Coverage-Nachtrag, A1)", () => {
  it("computeWordStats zählt Wörter, Sätze, Absätze korrekt", () => {
    const text = "Erster Satz steht hier.\n\nZweiter Absatz folgt nun! Ein dritter Satz?";
    const s = computeWordStats(text);
    // Erster(1) Satz(2) steht(3) hier(4) | Zweiter(5) Absatz(6) folgt(7) nun(8) | Ein(9) dritter(10) Satz(11)?
    expect(s.totalWords).toBe(11);
    expect(s.totalSentences).toBe(3);
    expect(s.totalParagraphs).toBe(2);
    expect(s.totalChars).toBe(text.length);
  });

  it("Lesezeit: 400 Wörter → 2 Minuten (200 Wörter/Minute, min 1)", () => {
    const text = Array.from({ length: 400 }, (_, i) => `Wort${i}`).join(" ");
    expect(computeWordStats(text).readingTimeMin).toBe(2);
    expect(computeWordStats("kurz").readingTimeMin).toBe(1);
  });

  it("Stop-Wörter und Kurz-Wörter (< 3 Zeichen) zählen nicht zu topWords", () => {
    const text = "Der Hund bellt laut. Der Hund rennt schnell. Katze schläft gemütlich.";
    const s = computeWordStats(text);
    const words = s.topWords.map((w) => w.word);
    expect(words).toContain("hund");
    expect(words).not.toContain("der");
  });

  it("vocabularyRichness zwischen 0 und 100; leerer Text → 0 ohne Crash", () => {
    expect(computeWordStats("").totalWords).toBe(0);
    const s = computeWordStats("Eindeutige schöne Wörter");
    expect(s.vocabularyRichness).toBeGreaterThanOrEqual(0);
    expect(s.vocabularyRichness).toBeLessThanOrEqual(100);
  });

  it("längster/kürzester Satz korrekt ermittelt", () => {
    const text = "Kurz. Ein deutlich längerer Satz mit vielen Wörtern hier!";
    const s = computeWordStats(text);
    expect(s.shortestSentence).toBe("Kurz");
    expect(s.longestSentence).toContain("deutlich");
  });
});