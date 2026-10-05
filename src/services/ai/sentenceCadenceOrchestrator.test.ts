/**
 * Tests: sentenceCadenceOrchestrator (WP 63.1 — Kadenz- & Satzrhythmus-Orchestrator)
 */

import { describe, it, expect } from "vitest";
import {
  analyzeCadence,
  polishCadence,
  scoreRhythm,
  renderWaveform,
  countCategories,
  STACCATO_MAX_WORDS,
  WAVE_MIN_WORDS,
  MONOTONY_CHAIN_LENGTH,
} from "./sentenceCadenceOrchestrator";

// Provosts klassisches Beispiel: 5-Wort-Satz, dann längere Wellen.
const VARIED =
  "Ich ging zum Fluss. Der Morgen war kalt und klar, und über dem Wasser lag ein Nebel, der die Konturen der Bäume weichzeichnete, sodass niemand die Grenze zwischen Himmel und Erde mehr finden konnte. Ich blieb stehen.";

// Monoton: alle Sätze etwa gleich lang.
const MONOTONE =
  "Der Mann ging über die Straße. Die Frau wartete an der Ecke. Ein Wagen hielt am Rand. Der Hund bellte einmal laut. Ein Kind lief nach Hause. Die Sonne stand am Himmel.";

describe("sentenceCadenceOrchestrator — analyzeCadence", () => {
  it("analysiert einen Text", () => {
    const a = analyzeCadence(VARIED);
    expect(a.sentenceCount).toBeGreaterThan(1);
    expect(a.waveform.length).toBe(a.sentenceCount);
  });

  it("berechnet die Wellenform", () => {
    const a = analyzeCadence(VARIED);
    expect(a.waveform.every((w) => w > 0)).toBe(true);
  });

  it("kategorisiert Stakkato-Sätze", () => {
    const a = analyzeCadence("Kurz. Sehr kurz. Noch kurz.");
    expect(a.sentences[0].category).toBe("staccato");
  });

  it("kategorisiert Wellensätze", () => {
    const long =
      "Der Morgen war kalt und klar und über dem Wasser lag ein Nebel der die Konturen der Bäume weichzeichnete sodass niemand die Grenze finden konnte.";
    const a = analyzeCadence(long);
    expect(a.sentences[0].category).toBe("wave");
  });

  it("berechnet den Durchschnitt", () => {
    const a = analyzeCadence("Eins zwei drei. Vier fünf sechs.");
    expect(a.averageWords).toBe(3);
  });

  it("berechnet die Standardabweichung", () => {
    const a = analyzeCadence(VARIED);
    expect(a.stdDeviation).toBeGreaterThan(0);
  });

  it("erkennt monotone Ketten", () => {
    const a = analyzeCadence(MONOTONE);
    expect(a.warnings.length).toBeGreaterThan(0);
    expect(a.warnings[0].length).toBeGreaterThan(MONOTONY_CHAIN_LENGTH);
  });

  it("warnt nicht bei abwechslungsreichem Text", () => {
    const a = analyzeCadence(VARIED);
    expect(a.warnings.length).toBe(0);
  });

  it("belohnt Abwechslung mit höherem Score", () => {
    const varied = analyzeCadence(VARIED).rhythmScore;
    const monotone = analyzeCadence(MONOTONE).rhythmScore;
    expect(varied).toBeGreaterThan(monotone);
  });

  it("Rhythmus-Score bleibt zwischen 0 und 1", () => {
    const a = analyzeCadence(VARIED);
    expect(a.rhythmScore).toBeGreaterThanOrEqual(0);
    expect(a.rhythmScore).toBeLessThanOrEqual(1);
  });

  it("nummeriert die Sätze", () => {
    const a = analyzeCadence("Eins. Zwei. Drei.");
    expect(a.sentences.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("kommt mit leerem Input zurecht", () => {
    const a = analyzeCadence("");
    expect(a.sentenceCount).toBe(0);
    expect(a.waveform).toEqual([]);
    expect(a.rhythmScore).toBe(0);
    expect(analyzeCadence(null).warnings).toEqual([]);
    expect(analyzeCadence(undefined).averageWords).toBe(0);
  });

  it("exportiert die Schwellenwerte", () => {
    expect(STACCATO_MAX_WORDS).toBe(6);
    expect(WAVE_MIN_WORDS).toBe(20);
    expect(MONOTONY_CHAIN_LENGTH).toBe(5);
  });
});

describe("sentenceCadenceOrchestrator — polishCadence", () => {
  it("poliert einen Text", () => {
    const p = polishCadence(MONOTONE);
    expect(p.text.length).toBeGreaterThan(20);
  });

  it("zerlegt Schachtelsätze", () => {
    const long =
      "Der Morgen war kalt und klar, und über dem Wasser lag ein Nebel, der die Konturen der Bäume weichzeichnete, sodass niemand die Grenze zwischen Himmel und Erde mehr finden konnte, und alles wirkte still.";
    const p = polishCadence(long);
    expect(p.splitCount).toBeGreaterThan(0);
  });

  it("verbindet Kurzsatz-Ketten", () => {
    const p = polishCadence("Er ging. Sie kam. Dann Stille.");
    expect(p.mergedCount).toBeGreaterThan(0);
  });

  it("verbesserte Texte haben einen höheren Score", () => {
    const p = polishCadence(MONOTONE);
    if (p.improved) {
      expect(p.scoreAfter).toBeGreaterThan(p.scoreBefore);
    }
    expect(p.scoreAfter).toBeGreaterThanOrEqual(0);
  });

  it("meldet die Scores vor und nach der Politur", () => {
    const p = polishCadence(MONOTONE);
    expect(typeof p.scoreBefore).toBe("number");
    expect(typeof p.scoreAfter).toBe("number");
  });

  it("ist deterministisch", () => {
    const a = polishCadence(MONOTONE);
    const b = polishCadence(MONOTONE);
    expect(a.text).toBe(b.text);
  });

  it("erhält den Inhalt (keine Wortverluste)", () => {
    const p = polishCadence("Er ging zum Fluss.");
    expect(p.text).toContain("Fluss");
  });

  it("kommt mit leerem Input zurecht", () => {
    const p = polishCadence("");
    expect(p.text).toBe("");
    expect(p.improved).toBe(false);
    expect(polishCadence(null).text).toBe("");
    expect(polishCadence(undefined).splitCount).toBe(0);
  });
});

describe("sentenceCadenceOrchestrator — scoreRhythm / renderWaveform / countCategories", () => {
  it("bewertet den Rhythmus", () => {
    expect(scoreRhythm(VARIED)).toBeGreaterThan(0);
  });

  it("gibt 0 bei leerem Text", () => {
    expect(scoreRhythm("")).toBe(0);
    expect(scoreRhythm(null)).toBe(0);
  });

  it("rendert eine Wellenform", () => {
    const art = renderWaveform(VARIED);
    expect(art).toContain("█");
    expect(art.split("\n").length).toBeGreaterThan(1);
  });

  it("Wellenform nennt die Kategorie", () => {
    const art = renderWaveform("Kurz. Sehr kurz.");
    expect(art).toContain("staccato");
  });

  it("kommt mit leerem Text zurecht", () => {
    expect(renderWaveform("")).toBe("");
    expect(renderWaveform(null)).toBe("");
  });

  it("zählt die Kategorien", () => {
    const counts = countCategories("Kurz. Sehr kurz. Ein mittellanger Satz mit sieben Wörtern hier.");
    expect(counts.staccato).toBeGreaterThan(0);
    expect(counts.medium).toBeGreaterThan(0);
  });

  it("Kategorien summieren sich auf die Satzzahl", () => {
    const counts = countCategories(VARIED);
    const total = counts.staccato + counts.medium + counts.wave;
    expect(total).toBe(analyzeCadence(VARIED).sentenceCount);
  });

  it("kommt mit leerem Text zurecht", () => {
    const counts = countCategories("");
    expect(counts.staccato).toBe(0);
    expect(counts.medium).toBe(0);
    expect(counts.wave).toBe(0);
  });
});
