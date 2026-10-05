/**
 * Tests: literaryToneShifter (WP 55.2 — Stil-Transmuter & Tonfall-Shifter)
 */

import { describe, it, expect } from "vitest";
import {
  transmuteStyle,
  verifyContentPreserved,
  measureStyle,
  compareStyles,
  STYLE_PRESETS,
  type StylePreset,
} from "./literaryToneShifter";

const SAMPLE =
  "Miller ging durch den Regen zum Hafen. Er sah den Sheriff und sagte kein Wort. Es war dunkel und sehr kalt.";

describe("literaryToneShifter — transmuteStyle", () => {
  it("gibt Text zurück", () => {
    const r = transmuteStyle(SAMPLE, "hardboiled");
    expect(r.text.length).toBeGreaterThan(10);
    expect(r.style).toBe("hardboiled");
  });

  it("nimmt Wortersetzungen vor", () => {
    const r = transmuteStyle(SAMPLE, "hardboiled");
    expect(r.substitutions).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const a = transmuteStyle(SAMPLE, "gothic");
    const b = transmuteStyle(SAMPLE, "gothic");
    expect(a.text).toBe(b.text);
  });

  it("unterschiedliche Stile erzeugen unterschiedlichen Text", () => {
    const noir = transmuteStyle(SAMPLE, "hardboiled");
    const gothic = transmuteStyle(SAMPLE, "gothic");
    expect(noir.text).not.toBe(gothic.text);
  });

  it("unterstützt alle vier Presets", () => {
    const presets: StylePreset[] = ["hardboiled", "gothic", "epic-fantasy", "hemingway"];
    presets.forEach((p) => {
      const r = transmuteStyle(SAMPLE, p);
      expect(r.style).toBe(p);
      expect(r.text.length).toBeGreaterThan(5);
    });
  });

  it("Hemingway entfernt Füllwörter", () => {
    const r = transmuteStyle("Er war eigentlich wirklich müde.", "hemingway");
    expect(r.text.toLowerCase()).not.toContain("eigentlich");
    expect(r.text.toLowerCase()).not.toContain("wirklich");
  });

  it("behält Eigennamen bei", () => {
    const r = transmuteStyle(SAMPLE, "gothic");
    expect(r.text).toContain("Miller");
  });

  it("behält Zahlen bei", () => {
    const r = transmuteStyle("Er wartete 3 Stunden am Kai.", "hardboiled");
    expect(r.text).toContain("3");
  });

  it("erhält den Inhalt (Namen + Zahlen)", () => {
    const r = transmuteStyle(SAMPLE, "epic-fantasy");
    const check = verifyContentPreserved(SAMPLE, r.text);
    expect(check.preserved).toBe(true);
  });

  it("meldet Wortzahlen vor und nach der Wandlung", () => {
    const r = transmuteStyle(SAMPLE, "gothic");
    expect(r.originalWordCount).toBeGreaterThan(0);
    expect(r.wordCount).toBeGreaterThan(0);
  });

  it("teilt überlange Sätze für kurze Stile", () => {
    const long =
      "Er ging langsam, ohne Eile, durch die Straße, an den Häusern vorbei, und dachte über alles nach, was geschehen war.";
    const r = transmuteStyle(long, "hemingway");
    const sentences = r.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThan(1);
  });

  it("fällt bei unbekanntem Stil auf hardboiled zurück", () => {
    const r = transmuteStyle(SAMPLE, "unbekannt" as never);
    expect(r.style).toBe("hardboiled");
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = transmuteStyle("", "gothic");
    expect(r.text).toBe("");
    expect(r.substitutions).toBe(0);
    expect(transmuteStyle(null, "gothic").text).toBe("");
    expect(transmuteStyle(undefined, "gothic").wordCount).toBe(0);
  });

  it("mutiert den Eingabetext nicht", () => {
    const original = SAMPLE;
    transmuteStyle(SAMPLE, "gothic");
    expect(SAMPLE).toBe(original);
  });

  it("erzeugt keine doppelten Leerzeichen", () => {
    const r = transmuteStyle(SAMPLE, "hemingway");
    expect(r.text).not.toMatch(/\s{2,}/);
  });

  it("definiert alle vier Presets mit Metadaten", () => {
    expect(STYLE_PRESETS.length).toBe(4);
    STYLE_PRESETS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.targetSentenceLength).toBeGreaterThan(0);
    });
  });
});

describe("literaryToneShifter — verifyContentPreserved", () => {
  it("bestätigt erhaltene Namen", () => {
    const r = verifyContentPreserved("Miller ging.", "Miller schlenderte.");
    expect(r.preserved).toBe(true);
    expect(r.preservationRate).toBe(1);
  });

  it("meldet verlorene Namen", () => {
    const r = verifyContentPreserved("Miller und Schmidt gingen.", "Miller schlenderte.");
    expect(r.preserved).toBe(false);
    expect(r.missingNames).toContain("Schmidt");
  });

  it("prüft Zahlen mit", () => {
    const r = verifyContentPreserved("Es waren 42 Männer.", "Es waren viele Männer.");
    expect(r.preserved).toBe(false);
    expect(r.missingNames).toContain("42");
  });

  it("berechnet eine Erhaltungsquote", () => {
    const r = verifyContentPreserved("Miller und Schmidt.", "Miller.");
    expect(r.preservationRate).toBe(0.5);
  });

  it("kommt mit leerem Original zurecht", () => {
    const r = verifyContentPreserved("", "egal");
    expect(r.preserved).toBe(true);
    expect(r.preservationRate).toBe(1);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(verifyContentPreserved(null, null).preserved).toBe(true);
    expect(verifyContentPreserved(undefined, undefined).names).toEqual([]);
  });
});

describe("literaryToneShifter — measureStyle / compareStyles", () => {
  it("misst Sätze und Satzlänge", () => {
    const m = measureStyle("Er ging. Sie kam. Es regnete.");
    expect(m.sentenceCount).toBe(3);
    expect(m.avgSentenceLength).toBeGreaterThan(0);
  });

  it("misst lange Wörter", () => {
    const m = measureStyle("Donaudampfschifffahrtsgesellschaft.");
    expect(m.longWordRatio).toBeGreaterThan(0);
  });

  it("zählt Adjektiv-Verdachtsfälle", () => {
    const m = measureStyle("Ein freundlicher, ruhiger, friedlicher Tag.");
    expect(m.adjectiveCount).toBeGreaterThan(0);
  });

  it("liefert ein Nullprofil für leeren Text", () => {
    const m = measureStyle("");
    expect(m.sentenceCount).toBe(0);
    expect(m.avgSentenceLength).toBe(0);
    expect(m.density).toBe(0);
  });

  it("vergleicht zwei Texte", () => {
    const c = compareStyles("Kurz. Sehr kurz.", "Ein außerordentlich langer Satz mit vielen Wörtern und Details.");
    expect(c.divergence).toBeGreaterThan(0);
    expect(c.a.sentenceCount).toBeGreaterThan(0);
  });

  it("divergence ist 0 bei identischem Text", () => {
    const c = compareStyles(SAMPLE, SAMPLE);
    expect(c.divergence).toBe(0);
  });

  it("divergence ist 0 bei zwei leeren Texten", () => {
    expect(compareStyles("", "").divergence).toBe(0);
  });

  it("divergence bleibt zwischen 0 und 1", () => {
    const c = compareStyles(SAMPLE, "Kurz.");
    expect(c.divergence).toBeGreaterThanOrEqual(0);
    expect(c.divergence).toBeLessThanOrEqual(1);
  });
});
