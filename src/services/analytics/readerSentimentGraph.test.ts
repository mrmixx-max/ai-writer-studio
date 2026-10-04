/**
 * Tests: Reader-Sentiment-Graph-Service (WP 47.1)
 * Leser-Empathie- & Sympathiekurven-Analyse
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEmpathyMetrics,
  compareProtagonistAntagonist,
  calculateBetrayalShockIndex,
  generateSympathyCurve,
  type ChapterEmpathyData,
  type EmpathyMetrics,
} from './readerSentimentGraph';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeMetrics(
  chapter: number,
  vulnerability: number,
  agency: number,
  warmth: number,
): EmpathyMetrics {
  return calculateEmpathyMetrics({ chapter, vulnerability, agency, warmth });
}

// ─── calculateEmpathyMetrics ─────────────────────────────────────────────────

describe('calculateEmpathyMetrics', () => {
  it('berechnet overall als Mittelwert der drei Dimensionen', () => {
    const result = calculateEmpathyMetrics({
      chapter: 1,
      vulnerability: 30,
      agency: 60,
      warmth: 90,
    });
    expect(result.overall).toBe(60);
  });

  it('übernimmt Kapitelnummer und Dimensionen unverändert', () => {
    const result = calculateEmpathyMetrics({
      chapter: 7,
      vulnerability: 20,
      agency: 40,
      warmth: 60,
    });
    expect(result.chapter).toBe(7);
    expect(result.vulnerability).toBe(20);
    expect(result.agency).toBe(40);
    expect(result.warmth).toBe(60);
  });

  it('rundet overall deterministisch auf 2 Dezimalstellen', () => {
    const result = calculateEmpathyMetrics({
      chapter: 1,
      vulnerability: 10,
      agency: 10,
      warmth: 11,
    });
    expect(result.overall).toBe(10.33);
  });

  it('begrenzt Werte über 100 defensiv auf 100', () => {
    const result = calculateEmpathyMetrics({
      chapter: 1,
      vulnerability: 150,
      agency: 200,
      warmth: 300,
    });
    expect(result.vulnerability).toBe(100);
    expect(result.agency).toBe(100);
    expect(result.warmth).toBe(100);
    expect(result.overall).toBe(100);
  });

  it('begrenzt negative Werte defensiv auf 0', () => {
    const result = calculateEmpathyMetrics({
      chapter: 1,
      vulnerability: -50,
      agency: -1,
      warmth: 30,
    });
    expect(result.vulnerability).toBe(0);
    expect(result.agency).toBe(0);
    expect(result.warmth).toBe(30);
  });

  it('behandelt null/undefined defensiv mit Nullwerten', () => {
    const result = calculateEmpathyMetrics(null as unknown as ChapterEmpathyData);
    expect(result).toEqual({
      chapter: 0,
      vulnerability: 0,
      agency: 0,
      warmth: 0,
      overall: 0,
    });
  });

  it('behandelt nicht-finite Dimensionen als 0', () => {
    const result = calculateEmpathyMetrics({
      chapter: 3,
      vulnerability: NaN,
      agency: Infinity,
      warmth: 30,
    });
    expect(result.vulnerability).toBe(0);
    expect(result.agency).toBe(0);
    expect(result.warmth).toBe(30);
  });

  it('normalisiert ungültige Kapitelnummer auf 0', () => {
    const result = calculateEmpathyMetrics({
      chapter: NaN,
      vulnerability: 10,
      agency: 10,
      warmth: 10,
    });
    expect(result.chapter).toBe(0);
  });
});

// ─── compareProtagonistAntagonist ────────────────────────────────────────────

describe('compareProtagonistAntagonist', () => {
  it('liefert Divergenz pro Kapitel als Betragsdifferenz', () => {
    const protagonist = [makeMetrics(1, 60, 60, 60), makeMetrics(2, 90, 90, 90)];
    const antagonist = [makeMetrics(1, 30, 30, 30), makeMetrics(2, 90, 90, 90)];
    const result = compareProtagonistAntagonist(protagonist, antagonist);
    expect(result.divergence).toEqual([30, 0]);
  });

  it('ermittelt maximale Divergenz und deren Kapitel', () => {
    const protagonist = [makeMetrics(1, 20, 20, 20), makeMetrics(2, 80, 80, 80)];
    const antagonist = [makeMetrics(1, 70, 70, 70), makeMetrics(2, 10, 10, 10)];
    const result = compareProtagonistAntagonist(protagonist, antagonist);
    expect(result.maxDivergence).toBe(70);
    expect(result.maxDivergenceChapter).toBe(2);
  });

  it('führt Kapitel beider Reihen zu einer sortierten Vereinigung zusammen', () => {
    const protagonist = [makeMetrics(1, 50, 50, 50)];
    const antagonist = [makeMetrics(3, 50, 50, 50)];
    const result = compareProtagonistAntagonist(protagonist, antagonist);
    expect(result.divergence.length).toBe(2);
    expect(result.protagonist[0].chapter).toBe(1);
    expect(result.antagonist[0].chapter).toBe(3);
  });

  it('behandelt fehlende Kapitel als 0', () => {
    const protagonist = [makeMetrics(1, 60, 60, 60)];
    const antagonist: EmpathyMetrics[] = [];
    const result = compareProtagonistAntagonist(protagonist, antagonist);
    expect(result.divergence).toEqual([60]);
  });

  it('gibt leeres Ergebnis bei leeren Eingaben', () => {
    const result = compareProtagonistAntagonist([], []);
    expect(result.divergence).toEqual([]);
    expect(result.maxDivergence).toBe(0);
    expect(result.maxDivergenceChapter).toBe(0);
  });

  it('behandelt null-Eingaben defensiv', () => {
    const result = compareProtagonistAntagonist(
      null as unknown as EmpathyMetrics[],
      undefined as unknown as EmpathyMetrics[],
    );
    expect(result.divergence).toEqual([]);
    expect(result.maxDivergence).toBe(0);
  });

  it('divergiert nie negativ', () => {
    const protagonist = [makeMetrics(1, 10, 10, 10)];
    const antagonist = [makeMetrics(1, 90, 90, 90)];
    const result = compareProtagonistAntagonist(protagonist, antagonist);
    expect(result.divergence[0]).toBeGreaterThanOrEqual(0);
    expect(result.divergence[0]).toBe(80);
  });
});

// ─── calculateBetrayalShockIndex ─────────────────────────────────────────────

describe('calculateBetrayalShockIndex', () => {
  it('berechnet den Index nach der Formel', () => {
    // (80 / 100) * (8 / 10) * 100 = 64
    expect(calculateBetrayalShockIndex(80, 8, 10)).toBe(64);
  });

  it('höhere vorherige Empathie erhöht den Schock', () => {
    const low = calculateBetrayalShockIndex(20, 8, 10);
    const high = calculateBetrayalShockIndex(90, 8, 10);
    expect(high).toBeGreaterThan(low);
  });

  it('späterer Verrat erhöht den Schock', () => {
    const early = calculateBetrayalShockIndex(80, 2, 10);
    const late = calculateBetrayalShockIndex(80, 9, 10);
    expect(late).toBeGreaterThan(early);
  });

  it('Index bleibt im Bereich 0-100', () => {
    const result = calculateBetrayalShockIndex(100, 10, 10);
    expect(result).toBe(100);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('gibt 0 bei totalChapters = 0 zurück', () => {
    expect(calculateBetrayalShockIndex(80, 5, 0)).toBe(0);
  });

  it('begrenzt Verratskapitel auf totalChapters', () => {
    // betrayalChapter 20 wird auf 10 gekappt -> (100/100)*(10/10)*100 = 100
    expect(calculateBetrayalShockIndex(100, 20, 10)).toBe(100);
  });

  it('gibt 0 bei Empathie 0 zurück', () => {
    expect(calculateBetrayalShockIndex(0, 8, 10)).toBe(0);
  });

  it('behandelt nicht-finite Eingaben defensiv', () => {
    expect(calculateBetrayalShockIndex(NaN, 5, 10)).toBe(0);
    expect(calculateBetrayalShockIndex(80, NaN, 10)).toBe(0);
    expect(calculateBetrayalShockIndex(80, 5, NaN)).toBe(0);
  });
});

// ─── generateSympathyCurve ───────────────────────────────────────────────────

describe('generateSympathyCurve', () => {
  it('erzeugt sortierte Punkte mit Kapitel und Wert', () => {
    const metrics = [makeMetrics(2, 40, 40, 40), makeMetrics(1, 20, 20, 20)];
    const curve = generateSympathyCurve(metrics);
    expect(curve.points).toEqual([
      { chapter: 1, value: 20 },
      { chapter: 2, value: 40 },
    ]);
  });

  it('erkennt steigenden Trend', () => {
    const metrics = [makeMetrics(1, 10, 10, 10), makeMetrics(2, 50, 50, 50), makeMetrics(3, 90, 90, 90)];
    expect(generateSympathyCurve(metrics).trend).toBe('rising');
  });

  it('erkennt fallenden Trend', () => {
    const metrics = [makeMetrics(1, 90, 90, 90), makeMetrics(2, 50, 50, 50), makeMetrics(3, 10, 10, 10)];
    expect(generateSympathyCurve(metrics).trend).toBe('falling');
  });

  it('erkennt stabilen Trend', () => {
    const metrics = [makeMetrics(1, 50, 50, 50), makeMetrics(2, 50, 50, 50), makeMetrics(3, 50, 50, 50)];
    expect(generateSympathyCurve(metrics).trend).toBe('stable');
  });

  it('ermittelt Peak und Valley korrekt', () => {
    const metrics = [makeMetrics(1, 30, 30, 30), makeMetrics(2, 80, 80, 80), makeMetrics(3, 20, 20, 20)];
    const curve = generateSympathyCurve(metrics);
    expect(curve.peak).toBe(80);
    expect(curve.valley).toBe(20);
  });

  it('gibt leere Kurve bei leerer Eingabe', () => {
    const curve = generateSympathyCurve([]);
    expect(curve.points).toEqual([]);
    expect(curve.trend).toBe('stable');
    expect(curve.peak).toBe(0);
    expect(curve.valley).toBe(0);
  });

  it('behandelt null-Eingaben defensiv', () => {
    const curve = generateSympathyCurve(null as unknown as EmpathyMetrics[]);
    expect(curve.points).toEqual([]);
    expect(curve.trend).toBe('stable');
  });

  it('einzelner Punkt ergibt stabilen Trend', () => {
    const curve = generateSympathyCurve([makeMetrics(1, 70, 70, 70)]);
    expect(curve.points.length).toBe(1);
    expect(curve.trend).toBe('stable');
    expect(curve.peak).toBe(70);
    expect(curve.valley).toBe(70);
  });
});
