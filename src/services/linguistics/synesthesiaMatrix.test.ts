/**
 * Tests: Synästhesie-Matrix-Service (WP 36.1)
 */

import { describe, it, expect } from 'vitest';
import {
  classifySenseChannels,
  checkSensoryBalance,
  generateSynesthesia,
} from './synesthesiaMatrix';

describe('classifySenseChannels', () => {
  it('leerer String ergibt Null-Klassifikation', () => {
    const result = classifySenseChannels('');
    expect(result).toEqual({ visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 });
  });

  it('null/undefined ergibt Null-Klassifikation', () => {
    expect(classifySenseChannels(null as unknown as string)).toEqual({ visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 });
    expect(classifySenseChannels(undefined as unknown as string)).toEqual({ visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 });
  });

  it('erkennt visuelle Wörter', () => {
    const result = classifySenseChannels('Die Sonne leuchtet am blauen Himmel');
    expect(result.visual).toBeGreaterThan(0);
  });

  it('erkennt auditive Wörter', () => {
    const result = classifySenseChannels('Die Glocke läutet laut');
    expect(result.auditory).toBeGreaterThan(0);
  });

  it('erkennt olfaktorische Wörter', () => {
    const result = classifySenseChannels('Die Rose duftet süß');
    expect(result.olfactory).toBeGreaterThan(0);
  });

  it('erkennt gustatorische Wörter', () => {
    const result = classifySenseChannels('Der Apfel schmeckt süß und sauer');
    expect(result.gustatory).toBeGreaterThan(0);
  });

  it('erkennt taktile Wörter', () => {
    const result = classifySenseChannels('Die Haut fühlt sich warm und weich an');
    expect(result.tactile).toBeGreaterThan(0);
  });

  it('zählt mehrere Treffer korrekt', () => {
    const result = classifySenseChannels('rot blau grün gelb');
    expect(result.visual).toBeGreaterThanOrEqual(4);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(classifySenseChannels(123 as unknown as string)).toEqual({ visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 });
  });
});

describe('checkSensoryBalance', () => {
  it('leeres Array ergibt leeres Ergebnis', () => {
    const result = checkSensoryBalance([]);
    expect(result.chapters).toEqual([]);
    expect(result.overallBalance).toEqual({ visual: 0, auditory: 0, olfactory: 0, gustatory: 0, tactile: 0 });
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(checkSensoryBalance(null as unknown as string[]).chapters).toEqual([]);
    expect(checkSensoryBalance(undefined as unknown as string[]).chapters).toEqual([]);
  });

  it('erkennt sensorisch verarmte Kapitel', () => {
    const chapters = [
      'Die Sonne leuchtet am blauen Himmel',
      'Es war einmal',
      'Die Rose duftet süß',
    ];
    const result = checkSensoryBalance(chapters);
    expect(result.chapters.length).toBe(3);
    expect(result.chapters[1].warning).toBeDefined();
  });

  it('berechnet Gesamtbilanz korrekt', () => {
    const chapters = [
      'Die Sonne leuchtet am blauen Himmel',
      'Die Glocke läutet laut',
    ];
    const result = checkSensoryBalance(chapters);
    expect(result.overallBalance.visual).toBeGreaterThan(0);
    expect(result.overallBalance.auditory).toBeGreaterThan(0);
  });

  it('Index wird korrekt gesetzt', () => {
    const chapters = ['Text eins', 'Text zwei'];
    const result = checkSensoryBalance(chapters);
    expect(result.chapters[0].index).toBe(0);
    expect(result.chapters[1].index).toBe(1);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(checkSensoryBalance(null as unknown as string[]).chapters).toEqual([]);
  });
});

describe('generateSynesthesia', () => {
  it('leeres Konzept ergibt leeres Ergebnis', () => {
    const result = generateSynesthesia('');
    expect(result.concept).toBe('');
    expect(result.suggestions).toEqual([]);
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(generateSynesthesia(null as unknown as string).suggestions).toEqual([]);
    expect(generateSynesthesia(undefined as unknown as string).suggestions).toEqual([]);
  });

  it('generiert Vorschläge für "musik"', () => {
    const result = generateSynesthesia('musik');
    expect(result.concept).toBe('musik');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('generiert Vorschläge für "liebe"', () => {
    const result = generateSynesthesia('liebe');
    expect(result.concept).toBe('liebe');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('generiert Vorschläge für "farbe"', () => {
    const result = generateSynesthesia('farbe');
    expect(result.concept).toBe('farbe');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('generiert Fallback-Vorschläge für unbekannte Konzepte', () => {
    const result = generateSynesthesia('xyz');
    expect(result.concept).toBe('xyz');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateSynesthesia(123 as unknown as string).suggestions).toEqual([]);
  });
});
