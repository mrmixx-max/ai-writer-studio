/**
 * Tests: Cultural-Authenticity- & Tropen-Audit-Service (WP 49.1)
 */

import { describe, it, expect } from 'vitest';
import {
  scanForTropes,
  checkLinguisticSensitivity,
  suggestImprovements,
  generateAuditReport,
  type TropeFinding,
} from './culturalAuthenticityAudit';

// ─── scanForTropes ───────────────────────────────────────────────────────────

describe('scanForTropes', () => {
  it('leerer Text ergibt leeres Ergebnis', () => {
    expect(scanForTropes('')).toEqual([]);
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(scanForTropes(null as unknown as string)).toEqual([]);
    expect(scanForTropes(undefined as unknown as string)).toEqual([]);
  });

  it('nicht-String ergibt leeres Ergebnis', () => {
    expect(scanForTropes(123 as unknown as string)).toEqual([]);
  });

  it('unauffälliger Text ergibt leeres Ergebnis', () => {
    expect(scanForTropes('Der Hund bellt und die Katze schläft.')).toEqual([]);
  });

  it('erkennt "incurable evil race"', () => {
    const findings = scanForTropes('Die unbesiegbare Rasse fiel über das Land her.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('incurable-evil');
    expect(findings[0].severity).toBe('high');
  });

  it('erkennt "white savior"', () => {
    const findings = scanForTropes('Der weiße Held reiste nach Afrika, um zu helfen.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('white-savior');
  });

  it('erkennt "bury your gays"', () => {
    const findings = scanForTropes('Der queere Held stirbt tragisch am Ende.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('bury-your-gays');
  });

  it('erkennt "magical negro"', () => {
    const findings = scanForTropes('Der magische Schwarze wies den Weg.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('magical-negro');
  });

  it('erkennt "damsel in distress"', () => {
    const findings = scanForTropes('Die Prinzessin wartete auf ihre Rettung.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('damsel-in-distress');
    expect(findings[0].severity).toBe('medium');
  });

  it('ist case-insensitiv', () => {
    const findings = scanForTropes('DIE UNBESIEGBARE RASSE.');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('incurable-evil');
  });

  it('erkennt mehrere Tropen in einem Text', () => {
    const text =
      'Der weiße Held reiste nach Afrika. Die Prinzessin wartete auf ihre Rettung.';
    const findings = scanForTropes(text);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.category)).toContain('white-savior');
    expect(findings.map((f) => f.category)).toContain('damsel-in-distress');
  });

  it('Befund enthält alle Pflichtfelder', () => {
    const finding = scanForTropes('Die unbesiegbare Rasse.')[0];
    expect(typeof finding.id).toBe('string');
    expect(finding.id.length).toBeGreaterThan(0);
    expect(typeof finding.trope).toBe('string');
    expect(typeof finding.excerpt).toBe('string');
    expect(finding.excerpt.length).toBeGreaterThan(0);
    expect(typeof finding.suggestion).toBe('string');
    expect(finding.suggestion.length).toBeGreaterThan(0);
  });

  it('ist deterministisch', () => {
    const text = 'Der weiße Held reiste nach Afrika.';
    expect(scanForTropes(text)).toEqual(scanForTropes(text));
  });
});

// ─── checkLinguisticSensitivity ──────────────────────────────────────────────

describe('checkLinguisticSensitivity', () => {
  it('leerer Text ergibt leeres Ergebnis', () => {
    expect(checkLinguisticSensitivity('')).toEqual([]);
  });

  it('null/undefined/nicht-String ergibt leeres Ergebnis', () => {
    expect(checkLinguisticSensitivity(null as unknown as string)).toEqual([]);
    expect(checkLinguisticSensitivity(undefined as unknown as string)).toEqual([]);
    expect(checkLinguisticSensitivity(123 as unknown as string)).toEqual([]);
  });

  it('unauffälliger Text ergibt leeres Ergebnis', () => {
    expect(checkLinguisticSensitivity('Der Hund bellt.')).toEqual([]);
  });

  it('erkennt "blind vor Wut"', () => {
    const findings = checkLinguisticSensitivity('Er war blind vor Wut.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('blind vor Wut');
    expect(findings[0].category).toBe('ableist');
    expect(findings[0].suggestion).toContain('vor Wut');
  });

  it('erkennt "gelähmt vor Schreck"', () => {
    const findings = checkLinguisticSensitivity('Sie war gelähmt vor Schreck.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('gelähmt vor Schreck');
    expect(findings[0].suggestion).toContain('erstarrt');
  });

  it('erkennt "taub für Kritik"', () => {
    const findings = checkLinguisticSensitivity('Der Chef ist taub für Kritik.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('taub für Kritik');
    expect(findings[0].suggestion).toContain('unempfänglich');
  });

  it('erkennt "lähmt" im übertragenen Sinne', () => {
    const findings = checkLinguisticSensitivity('Der Zweifel lähmt ihn.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('lähmt');
    expect(findings[0].suggestion).toContain('blockiert');
  });

  it('meldet "lähmt" NICHT bei wörtlichem Körperbezug', () => {
    const findings = checkLinguisticSensitivity('Die Krankheit lähmt seine Beine.');
    expect(findings).toEqual([]);
  });

  it('"gelähmt" wird nicht zusätzlich als "lähmt" gemeldet', () => {
    const findings = checkLinguisticSensitivity('Sie war gelähmt vor Schreck.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('gelähmt vor Schreck');
  });

  it('erkennt mehrere Floskeln in einem Text', () => {
    const text = 'Er war blind vor Wut und taub für Kritik.';
    const findings = checkLinguisticSensitivity(text);
    expect(findings).toHaveLength(2);
  });

  it('ist case-insensitiv', () => {
    const findings = checkLinguisticSensitivity('Er war BLIND VOR WUT.');
    expect(findings).toHaveLength(1);
    expect(findings[0].phrase).toBe('blind vor Wut');
  });

  it('Befund enthält alle Pflichtfelder', () => {
    const finding = checkLinguisticSensitivity('Er war blind vor Wut.')[0];
    expect(typeof finding.id).toBe('string');
    expect(finding.id.length).toBeGreaterThan(0);
    expect(typeof finding.excerpt).toBe('string');
    expect(finding.excerpt.length).toBeGreaterThan(0);
    expect(typeof finding.suggestion).toBe('string');
  });

  it('ist deterministisch', () => {
    const text = 'Er war blind vor Wut.';
    expect(checkLinguisticSensitivity(text)).toEqual(checkLinguisticSensitivity(text));
  });
});

// ─── suggestImprovements ─────────────────────────────────────────────────────

describe('suggestImprovements', () => {
  it('liefert kategoriebezogenen Vorschlag für Tropen-Befund', () => {
    const finding = scanForTropes('Die unbesiegbare Rasse.')[0];
    const advice = suggestImprovements(finding);
    expect(advice).toContain('Individuen');
  });

  it('liefert kategoriebezogenen Vorschlag für Sensibilitäts-Befund', () => {
    const finding = checkLinguisticSensitivity('Er war blind vor Wut.')[0];
    const advice = suggestImprovements(finding);
    expect(advice).toContain('Ersetze');
  });

  it('liefert generischen Vorschlag bei ungültigem Befund', () => {
    const advice = suggestImprovements(null as unknown as TropeFinding);
    expect(typeof advice).toBe('string');
    expect(advice).toContain('Prüfe');
  });

  it('behandelt unbekannte Kategorie defensiv', () => {
    const weird = {
      id: 'x',
      trope: 'unbekannt',
      category: 'unknown',
      severity: 'low',
      excerpt: 'y',
      suggestion: '',
    } as unknown as TropeFinding;
    expect(typeof suggestImprovements(weird)).toBe('string');
    expect(suggestImprovements(weird).length).toBeGreaterThan(0);
  });
});

// ─── generateAuditReport ─────────────────────────────────────────────────────

describe('generateAuditReport', () => {
  it('leerer Text ergibt Score 100 und leere Listen', () => {
    const report = generateAuditReport('');
    expect(report.tropes).toEqual([]);
    expect(report.sensitivities).toEqual([]);
    expect(report.overallScore).toBe(100);
    expect(report.summary).toContain('Keine');
  });

  it('nicht-String ergibt sicheren Bericht', () => {
    const report = generateAuditReport(null as unknown as string);
    expect(report.text).toBe('');
    expect(report.overallScore).toBe(100);
    expect(report.tropes).toEqual([]);
  });

  it('übernimmt den Eingabetext unverändert', () => {
    const text = 'Der Hund bellt.';
    expect(generateAuditReport(text).text).toBe(text);
  });

  it('unauffälliger Text ergibt Score 100', () => {
    const report = generateAuditReport('Der Hund bellt und die Katze schläft.');
    expect(report.overallScore).toBe(100);
  });

  it('Probleme senken den Score', () => {
    const report = generateAuditReport('Der weiße Held reiste nach Afrika.');
    expect(report.tropes.length).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThan(100);
  });

  it('Score bleibt im Bereich 0..100', () => {
    const text =
      'Die unbesiegbare Rasse. Der weiße Held in Afrika. Der queere Held stirbt. Der magische Schwarze. '.repeat(2);
    const report = generateAuditReport(text);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('Score wird bei sehr vielen Treffern auf 0 begrenzt', () => {
    const text =
      'Die unbesiegbare Rasse. Der weiße Held in Afrika. Der queere Held stirbt. ' +
      'Der magische Schwarze. Die Prinzessin wartet auf ihre Rettung. ' +
      'Er war blind vor Wut. Sie war gelähmt vor Schreck. Der Chef ist taub für Kritik. ' +
      'Der Zweifel lähmt ihn.';
    expect(generateAuditReport(text).overallScore).toBe(0);
  });

  it('Summary nennt die Anzahl der Tropen', () => {
    const report = generateAuditReport('Der weiße Held reiste nach Afrika.');
    expect(report.summary).toContain('1 Tropen');
  });

  it('kombiniert Tropen- und Sensibilitätsbefunde', () => {
    const text = 'Der weiße Held reiste nach Afrika. Er war blind vor Wut.';
    const report = generateAuditReport(text);
    expect(report.tropes.length).toBeGreaterThan(0);
    expect(report.sensitivities.length).toBeGreaterThan(0);
  });

  it('ist deterministisch', () => {
    const text = 'Der weiße Held reiste nach Afrika. Er war blind vor Wut.';
    expect(generateAuditReport(text)).toEqual(generateAuditReport(text));
  });
});
