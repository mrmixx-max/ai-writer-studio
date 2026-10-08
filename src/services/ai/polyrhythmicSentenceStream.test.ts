// @vitest-environment jsdom
/** Tests: PolyrhythmicSentenceStream (WP 94.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createPolyrhythmicProfile,
  formatPolyrhythmicProfile,
  createSampleProfile,
  createSampleAnalysis,
} from "./polyrhythmicSentenceStream";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    let different = false;
    for (let i = 0; i < 10; i++) if (r1() !== r2()) different = true;
    expect(different).toBe(true);
  });
});

describe("createPolyrhythmicProfile", () => {
  it("erzeugt Profil für Staccato", () => {
    const profile = createPolyrhythmicProfile("staccato", "Angst", 100, 123);
    expect(profile.id).toContain("POLY-");
    expect(profile.archetype).toBe("staccato");
    expect(profile.emotion).toBe("Angst");
    expect(profile.targetWordCount).toBe(100);
    expect(profile.sentences.length).toBeGreaterThan(0);
    expect(profile.rhythmAnalysis.dominantRhythm).toBe("staccato");
    expect(profile.seed).toBe(123);
  });

  it("erzeugt Profil für Periodisch", () => {
    const profile = createPolyrhythmicProfile("periodic", "Melancholie", 200, 456);
    expect(profile.archetype).toBe("periodic");
    expect(profile.rhythmAnalysis.dominantRhythm).toBe("periodic");
  });

  it("erzeugt Profil für Polysyndeton", () => {
    const profile = createPolyrhythmicProfile("polysyndeton", "Ekstase", 150, 789);
    expect(profile.archetype).toBe("polysyndeton");
    expect(profile.rhythmAnalysis.dominantRhythm).toBe("polysyndeton");
  });

  it("erzeugt Profil für Asyndeton", () => {
    const profile = createPolyrhythmicProfile("asyndeton", "Panik", 180, 999);
    expect(profile.archetype).toBe("asyndeton");
    expect(profile.rhythmAnalysis.dominantRhythm).toBe("asyndeton");
  });

  it("Staccato erzeugt kurze Fragmente", () => {
    const profile = createPolyrhythmicProfile("staccato", "Test", 100, 1);
    const avgWords = profile.sentences.reduce((sum, s) => sum + s.wordCount, 0) / profile.sentences.length;
    expect(avgWords).toBeLessThanOrEqual(6);
  });

  it("Periodisch erzeugt lange Sätze", () => {
    const profile = createPolyrhythmicProfile("periodic", "Test", 200, 1);
    const avgWords = profile.sentences.reduce((sum, s) => sum + s.wordCount, 0) / profile.sentences.length;
    expect(avgWords).toBeGreaterThan(10);
  });

  it("Polysyndeton nutzt Bindewörter", () => {
    const profile = createPolyrhythmicProfile("polysyndeton", "Test", 150, 1);
    const hasPolysyndeton = profile.sentences.some(s =>
      s.text.includes(" und ") || s.text.includes(" und dann ")
    );
    expect(hasPolysyndeton).toBe(true);
  });

  it("Asyndeton nutzt Kommata ohne Bindewörter", () => {
    const profile = createPolyrhythmicProfile("asyndeton", "Test", 150, 1);
    const hasAsyndeton = profile.sentences.some(s =>
      s.text.includes(", ") && !s.text.includes(" und ")
    );
    expect(hasAsyndeton).toBe(true);
  });

  it("ist deterministisch", () => {
    const p1 = createPolyrhythmicProfile("staccato", "Test", 100, 42);
    const p2 = createPolyrhythmicProfile("staccato", "Test", 100, 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createPolyrhythmicProfile("staccato", "Test", 100, 1);
    const p2 = createPolyrhythmicProfile("staccato", "Test", 100, 2);
    expect(p1.id).not.toBe(p2.id);
  });

  it("Rhythmus-Analyse hat alle Felder", () => {
    const profile = createPolyrhythmicProfile("staccato", "Test", 100, 1);
    const a = profile.rhythmAnalysis;
    expect(a.avgWordsPerSentence).toBeGreaterThan(0);
    expect(a.sentenceCount).toBeGreaterThan(0);
    expect(a.fragmentRatio).toBeGreaterThanOrEqual(0);
    expect(a.subordinationDepth).toBeGreaterThanOrEqual(0);
    expect(a.polysyndetonCount).toBeGreaterThanOrEqual(0);
    expect(a.asyndetonRuns).toBeGreaterThanOrEqual(0);
  });
});

describe("formatPolyrhythmicProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createSampleProfile();
    const text = formatPolyrhythmicProfile(profile);
    expect(text).toContain("POLYRHYTHMISCHER SATZMELODIE-SYNTHESIZER");
    expect(text).toContain("STACCATO-HAMMER");
    expect(text).toContain("RHYTHMUS-ANALYSE:");
    expect(text).toContain("GENERIERTE SÄTZE:");
    expect(text).toContain("VOLLTEXT:");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.archetype).toBe("staccato");
    expect(profile.emotion).toBe("Todesangst");
    expect(profile.id).toContain("POLY-");
  });
});

describe("createSampleAnalysis", () => {
  it("erzeugt Beispiel-Analyse", () => {
    const analysis = createSampleAnalysis();
    expect(analysis.dominantRhythm).toBe("staccato");
    expect(analysis.sentenceCount).toBe(12);
  });
});