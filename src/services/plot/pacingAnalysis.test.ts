// Tests für den Pacing- & Spannungskurven-Visualisierer (WP 5.2).
//
// Kernaussage: Die Pacing-Analyse ist lokal, deterministisch und defensiv.
// Sie funktioniert auch bei leeren Kapiteln oder fehlenden Daten.

import { describe, it, expect } from "vitest";
import {
  analyzePacing,
  generatePacingSvgPath,
  generatePacingDots,
  type PacingPoint,
} from "./pacingAnalysis";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

function makeChapter(over: Partial<BookChapterInput> = {}): BookChapterInput {
  return {
    number: 1,
    title: "Kapitel 1",
    content: "Ein Text.",
    ...over,
  };
}

describe("analyzePacing", () => {
  it("analysiert ein Buch mit mehreren Kapiteln", () => {
    const chapters = [
      makeChapter({ number: 1, title: "Anfang", content: "Es war einmal. Die Sonne schien." }),
      makeChapter({ number: 2, title: "Mitte", content: "Er rannte! Sie rief! Es gab einen Schlag!" }),
      makeChapter({ number: 3, title: "Ende", content: "Und sie lebten glücklich bis an ihr Ende." }),
    ];
    const result = analyzePacing(chapters);
    expect(result.points).toHaveLength(3);
    expect(result.averagePacing).toBeGreaterThan(0);
    expect(result.climaxChapter).toBe(2); // Mitte hat Action
    expect(result.lowestChapter).toBe(1); // Anfang ist ruhig
  });

  it("gibt leeres Ergebnis für leeres Buch zurück", () => {
    const result = analyzePacing([]);
    expect(result.points).toEqual([]);
    expect(result.averagePacing).toBe(0);
    expect(result.climaxChapter).toBeNull();
    expect(result.lowestChapter).toBeNull();
  });

  it("verarbeitet Kapitel ohne Inhalt defensiv", () => {
    const chapters = [makeChapter({ content: "" })];
    const result = analyzePacing(chapters);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].pacingScore).toBe(0);
    expect(result.points[0].wordCount).toBe(0);
  });

  it("berechnet Aktions-Dichte korrekt", () => {
    const actionText = "Er rannte! Sie sprang! Er griff! Es gab einen Schlag!";
    const calmText = "Die Sonne schien. Der Wind wehte leise.";
    const actionResult = analyzePacing([makeChapter({ content: actionText })]);
    const calmResult = analyzePacing([makeChapter({ content: calmText })]);
    expect(actionResult.points[0].actionDensity).toBeGreaterThan(
      calmResult.points[0].actionDensity,
    );
  });

  it("berechnet Dialoganteil korrekt", () => {
    const dialogueText = '„Hallo", sagte er. „Wie geht es?", fragte sie.';
    const narrationText = "Er ging nach Hause. Sie blieb stehen.";
    const dialogueResult = analyzePacing([makeChapter({ content: dialogueText })]);
    const narrationResult = analyzePacing([makeChapter({ content: narrationText })]);
    expect(dialogueResult.points[0].dialogueRatio).toBeGreaterThan(
      narrationResult.points[0].dialogueRatio,
    );
  });

  it("berechnet emotionale Ladung korrekt", () => {
    const emotionalText = "Er hatte Angst. Sie war wütend. Es gab Panik und Schmerz.";
    const neutralText = "Der Hund war braun. Der Himmel war blau.";
    const emotionalResult = analyzePacing([makeChapter({ content: emotionalText })]);
    const neutralResult = analyzePacing([makeChapter({ content: neutralText })]);
    expect(emotionalResult.points[0].emotionalCharge).toBeGreaterThan(
      neutralResult.points[0].emotionalCharge,
    );
  });

  it("normalisiert Wortlängen korrekt", () => {
    const chapters = [
      makeChapter({ number: 1, content: "Kurz." }),
      makeChapter({ number: 2, content: "Ein sehr langer Text mit vielen Wörtern und Sätzen." }),
    ];
    const result = analyzePacing(chapters);
    expect(result.points[1].wordCount).toBeGreaterThan(result.points[0].wordCount);
  });
});

describe("generatePacingSvgPath", () => {
  it("generiert einen Pfad für mehrere Punkte", () => {
    const points: PacingPoint[] = [
      { chapter: 1, title: "A", charCount: 100, wordCount: 20, actionDensity: 0.5, dialogueRatio: 0.3, emotionalCharge: 0.4, pacingScore: 0.5 },
      { chapter: 2, title: "B", charCount: 200, wordCount: 40, actionDensity: 0.7, dialogueRatio: 0.5, emotionalCharge: 0.6, pacingScore: 0.7 },
    ];
    const path = generatePacingSvgPath(points, 400, 200);
    expect(path).toMatch(/^M /);
    expect(path).toContain(" C ");
  });

  it("generiert einen Pfad für einen einzelnen Punkt", () => {
    const points: PacingPoint[] = [
      { chapter: 1, title: "A", charCount: 100, wordCount: 20, actionDensity: 0.5, dialogueRatio: 0.3, emotionalCharge: 0.4, pacingScore: 0.5 },
    ];
    const path = generatePacingSvgPath(points, 400, 200);
    expect(path).toMatch(/^M /);
    expect(path).not.toContain(" C ");
  });

  it("gibt leeren String für keine Punkte zurück", () => {
    expect(generatePacingSvgPath([], 400, 200)).toBe("");
  });
});

describe("generatePacingDots", () => {
  it("generiert Datenpunkte für mehrere Kapitel", () => {
    const points: PacingPoint[] = [
      { chapter: 1, title: "A", charCount: 100, wordCount: 20, actionDensity: 0.5, dialogueRatio: 0.3, emotionalCharge: 0.4, pacingScore: 0.5 },
      { chapter: 2, title: "B", charCount: 200, wordCount: 40, actionDensity: 0.7, dialogueRatio: 0.5, emotionalCharge: 0.6, pacingScore: 0.7 },
    ];
    const dots = generatePacingDots(points, 400, 200);
    expect(dots).toHaveLength(2);
    expect(dots[0].chapter).toBe(1);
    expect(dots[1].chapter).toBe(2);
  });

  it("gibt leeres Array für keine Punkte zurück", () => {
    expect(generatePacingDots([], 400, 200)).toEqual([]);
  });
});
