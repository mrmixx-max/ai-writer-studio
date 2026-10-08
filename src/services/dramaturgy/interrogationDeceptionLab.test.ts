// @vitest-environment jsdom
// Tests: Deception-Lab & Verhördramaturgie (Meilenstein 55.0 / v6.7.0).
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  INTERROGATION_STRATEGIES,
  analyzeDeceptionIndicators,
  generateInterrogationDialog,
  calculateDeceptionProbability,
  createSampleInterrogationDialog,
  createSampleDeceptionAnalysis,
} from './interrogationDeceptionLab';

describe('hashString', () => {
  it('ist deterministisch', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });
  it('unterschiedliche Strings erzeugen unterschiedliche Hashes', () => {
    expect(hashString('cognitive')).not.toBe(hashString('evidenceTrap'));
  });
  it('liefert unsigned 32-bit Werte', () => {
    expect(hashString('test')).toBeGreaterThanOrEqual(0);
    expect(hashString('test')).toBeLessThan(2 ** 32);
  });
});

describe('createSeededRandom', () => {
  it('ist deterministisch für gleichen Seed', () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it('liefert Werte im Bereich [0,1)', () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
  it('unterscheidet sich bei unterschiedlichen Seeds', () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });
});

describe('INTERROGATION_STRATEGIES', () => {
  it('enthält 4 Strategien', () => {
    expect(INTERROGATION_STRATEGIES).toHaveLength(4);
  });
  it('jede Strategie hat alle Felder', () => {
    for (const s of INTERROGATION_STRATEGIES) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(typeof s.approach).toBe('string');
      expect(typeof s.legalBasis).toBe('string');
      expect(s.successRate).toBeGreaterThanOrEqual(0);
      expect(s.successRate).toBeLessThanOrEqual(1);
    }
  });
  it('enthält alle 4 Strategie-IDs', () => {
    const ids = INTERROGATION_STRATEGIES.map((s) => s.id);
    expect(ids).toContain('cognitive');
    expect(ids).toContain('evidenceTrap');
    expect(ids).toContain('minimization');
    expect(ids).toContain('maximization');
  });
});

describe('analyzeDeceptionIndicators', () => {
  it('ist deterministisch', () => {
    const input = { blinkRate: 60, swallowRate: 40, pronounDistance: 70, pauseCount: 50, fidgetScore: 30 };
    expect(analyzeDeceptionIndicators(input).deceptionScore).toBe(
      analyzeDeceptionIndicators(input).deceptionScore
    );
  });
  it('deceptionScore ist im Bereich 0-100', () => {
    const result = analyzeDeceptionIndicators({ blinkRate: 60, swallowRate: 40, pronounDistance: 70, pauseCount: 50, fidgetScore: 30 });
    expect(result.deceptionScore).toBeGreaterThanOrEqual(0);
    expect(result.deceptionScore).toBeLessThanOrEqual(100);
  });
  it('confidence ist low/medium/high', () => {
    const result = analyzeDeceptionIndicators({ blinkRate: 60, swallowRate: 40, pronounDistance: 70, pauseCount: 50, fidgetScore: 30 });
    expect(['low', 'medium', 'high']).toContain(result.confidence);
  });
  it('redFlags ist ein Array', () => {
    const result = analyzeDeceptionIndicators({ blinkRate: 90, swallowRate: 80, pronounDistance: 90, pauseCount: 70, fidgetScore: 60 });
    expect(Array.isArray(result.redFlags)).toBe(true);
  });
  it('analysis ist ein String', () => {
    const result = analyzeDeceptionIndicators({ blinkRate: 60, swallowRate: 40, pronounDistance: 70, pauseCount: 50, fidgetScore: 30 });
    expect(typeof result.analysis).toBe('string');
    expect(result.analysis.length).toBeGreaterThan(0);
  });
});

describe('generateInterrogationDialog', () => {
  it('ist deterministisch', () => {
    const scenario = { suspectName: 'Max', crime: 'Mord', strategy: 'cognitive' as const, evidenceCount: 3 };
    expect(generateInterrogationDialog(scenario, 42).dialog.length).toBe(
      generateInterrogationDialog(scenario, 42).dialog.length
    );
  });
  it('enthält 8-12 Dialogzeilen', () => {
    const scenario = { suspectName: 'Max', crime: 'Mord', strategy: 'cognitive' as const, evidenceCount: 3 };
    const result = generateInterrogationDialog(scenario, 42);
    expect(result.dialog.length).toBeGreaterThanOrEqual(8);
    expect(result.dialog.length).toBeLessThanOrEqual(12);
  });
  it('jede Zeile hat speaker und text', () => {
    const scenario = { suspectName: 'Max', crime: 'Mord', strategy: 'cognitive' as const, evidenceCount: 3 };
    for (const line of generateInterrogationDialog(scenario, 42).dialog) {
      expect(['detective', 'suspect', 'lawyer']).toContain(line.speaker);
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
    }
  });
  it('legalWarning ist gesetzt', () => {
    const scenario = { suspectName: 'Max', crime: 'Mord', strategy: 'cognitive' as const, evidenceCount: 3 };
    expect(typeof generateInterrogationDialog(scenario, 42).legalWarning).toBe('string');
    expect(generateInterrogationDialog(scenario, 42).legalWarning.length).toBeGreaterThan(0);
  });
  it('notes ist ein Array', () => {
    const scenario = { suspectName: 'Max', crime: 'Mord', strategy: 'cognitive' as const, evidenceCount: 3 };
    expect(Array.isArray(generateInterrogationDialog(scenario, 42).notes)).toBe(true);
  });
});

describe('calculateDeceptionProbability', () => {
  it('liefert deceptionProbability im Bereich 0-100', () => {
    const result = calculateDeceptionProbability(50, 70, 30);
    expect(result.deceptionProbability).toBeGreaterThanOrEqual(0);
    expect(result.deceptionProbability).toBeLessThanOrEqual(100);
  });
  it('liefert ein confidenceInterval-Tuple', () => {
    const result = calculateDeceptionProbability(30, 50, 50);
    expect(Array.isArray(result.confidenceInterval)).toBe(true);
    expect(result.confidenceInterval).toHaveLength(2);
    expect(result.confidenceInterval[0]).toBeLessThanOrEqual(result.confidenceInterval[1]);
  });
  it('confidenceInterval ist im Bereich 0-100', () => {
    const result = calculateDeceptionProbability(75, 80, 20);
    expect(result.confidenceInterval[0]).toBeGreaterThanOrEqual(0);
    expect(result.confidenceInterval[1]).toBeLessThanOrEqual(100);
  });
  it('liefert ein factors-Array', () => {
    const result = calculateDeceptionProbability(40, 60, 40);
    expect(Array.isArray(result.factors)).toBe(true);
    for (const factor of result.factors) {
      expect(typeof factor).toBe('string');
    }
  });
  it('liefert eine recommendation-String', () => {
    const result = calculateDeceptionProbability(60, 50, 50);
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });
  it('ist deterministisch bei gleichen Eingaben', () => {
    const r1 = calculateDeceptionProbability(55, 60, 40);
    const r2 = calculateDeceptionProbability(55, 60, 40);
    expect(r1.deceptionProbability).toBe(r2.deceptionProbability);
    expect(r1.confidenceInterval).toEqual(r2.confidenceInterval);
    expect(r1.recommendation).toBe(r2.recommendation);
  });
  it('höherer Täuschungs-Score führt zu höherer Wahrscheinlichkeit', () => {
    const low = calculateDeceptionProbability(90, 20, 80);
    const high = calculateDeceptionProbability(20, 90, 20);
    expect(high.deceptionProbability).toBeGreaterThanOrEqual(low.deceptionProbability);
  });
});

describe('createSampleInterrogationDialog', () => {
  it('liefert einen gültigen Dialog', () => {
    const dialog = createSampleInterrogationDialog();
    expect(dialog.dialog.length).toBeGreaterThan(0);
    expect(typeof dialog.legalWarning).toBe('string');
  });
});

describe('createSampleDeceptionAnalysis', () => {
  it('liefert eine gültige Analyse', () => {
    const analysis = createSampleDeceptionAnalysis();
    expect(analysis.deceptionScore).toBeGreaterThanOrEqual(0);
    expect(analysis.deceptionScore).toBeLessThanOrEqual(100);
    expect(typeof analysis.analysis).toBe('string');
  });
});
