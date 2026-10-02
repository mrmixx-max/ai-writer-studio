/**
 * Tests: Historischer-Register-Service (WP 28.1)
 */

import { describe, it, expect } from 'vitest';
import {
  detectAnachronisms,
  suggestHistoricalSynonyms,
  checkFormalityLevel,
  type Epoch,
} from './historicalRegister';

describe('detectAnachronisms', () => {
  it('leerer String ergibt leeres Array', () => {
    expect(detectAnachronisms('', 'antike')).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(detectAnachronisms(null as unknown as string, 'antike')).toEqual([]);
    expect(detectAnachronisms(undefined as unknown as string, 'antike')).toEqual([]);
  });

  it('erkennt Anachronismus in der Antike', () => {
    const text = 'Er blickte auf die Uhr';
    const result = detectAnachronisms(text, 'antike');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].word).toBe('uhr');
  });

  it('erkennt Telefon als Anachronismus im Mittelalter', () => {
    const text = 'Er telefonierte mit dem König';
    const result = detectAnachronisms(text, 'mittelalter');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].word).toBe('telefonierte');
  });

  it('erkennt Auto als Anachronismus in der Renaissance', () => {
    const text = 'Er fuhr mit dem Auto zum Palast';
    const result = detectAnachronisms(text, 'renaissance');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].word).toBe('auto');
  });

  it('erkennt Computer als Anachronismus im Viktorianischen', () => {
    const text = 'Sie arbeitete am Computer';
    const result = detectAnachronisms(text, 'viktorianisch');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].word).toBe('computer');
  });

  it('erkennt Psychologie als Anachronismus in den 1920ern', () => {
    const text = 'Das war psychologisch klug';
    const result = detectAnachronisms(text, '1920er');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].word).toBe('psychologisch');
  });

  it('erkennt mehrere Anachronismen', () => {
    const text = 'Er telefonierte und fuhr mit dem Auto';
    const result = detectAnachronisms(text, 'antike');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('unbekannte Epoche ergibt leeres Array', () => {
    expect(detectAnachronisms('Hallo', 'unbekannt' as Epoch)).toEqual([]);
  });

  it('Text ohne Anachronismen ergibt leeres Array', () => {
    const text = 'Der Hund bellt';
    expect(detectAnachronisms(text, 'antike')).toEqual([]);
  });

  it('Position wird korrekt gesetzt', () => {
    const text = 'Er ging zur Uhr';
    const result = detectAnachronisms(text, 'antike');
    expect(result[0].position).toBe(3);
  });

  it('Vorschlag wird gesetzt', () => {
    const text = 'Er blickte auf die Uhr';
    const result = detectAnachronisms(text, 'antike');
    expect(result[0].suggestion).toBeDefined();
  });
});

describe('suggestHistoricalSynonyms', () => {
  it('leeres Wort ergibt leeres Array', () => {
    expect(suggestHistoricalSynonyms('', 'antike')).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(suggestHistoricalSynonyms(null as unknown as string, 'antike')).toEqual([]);
    expect(suggestHistoricalSynonyms(undefined as unknown as string, 'antike')).toEqual([]);
  });

  it('findet Synonyme für "schnell"', () => {
    const result = suggestHistoricalSynonyms('schnell', 'antike');
    expect(result.length).toBeGreaterThan(0);
  });

  it('findet Synonyme für "schön"', () => {
    const result = suggestHistoricalSynonyms('schön', 'mittelalter');
    expect(result.length).toBeGreaterThan(0);
  });

  it('unbekanntes Wort ergibt leeres Array', () => {
    expect(suggestHistoricalSynonyms('xyz', 'antike')).toEqual([]);
  });

  it('unbekannte Epoche ergibt leeres Array', () => {
    expect(suggestHistoricalSynonyms('schnell', 'unbekannt' as Epoch)).toEqual([]);
  });
});

describe('checkFormalityLevel', () => {
  it('leerer Text ergibt Fehler', () => {
    const result = checkFormalityLevel('', 1, 2);
    expect(result.correct).toBe(false);
  });

  it('null/undefined ergibt Fehler', () => {
    const result = checkFormalityLevel(null as unknown as string, 1, 2);
    expect(result.correct).toBe(false);
  });

  it('höherer Rang → du', () => {
    const result = checkFormalityLevel('Du bist mein Freund', 2, 1);
    expect(result.correct).toBe(true);
    expect(result.expectedForm).toBe('du');
  });

  it('niedriger Rang → Sie', () => {
    const result = checkFormalityLevel('Sie sind mein Herr', 1, 2);
    expect(result.correct).toBe(true);
    expect(result.expectedForm).toBe('Sie');
  });

  it('gleicher Rang → du', () => {
    const result = checkFormalityLevel('Du bist mein Kollege', 1, 1);
    expect(result.correct).toBe(true);
    expect(result.expectedForm).toBe('du');
  });

  it('falsche Form wird erkannt', () => {
    const result = checkFormalityLevel('Du bist mein Herr', 1, 2);
    expect(result.correct).toBe(false);
    expect(result.expectedForm).toBe('Sie');
  });

  it('Ihr wird erkannt', () => {
    const result = checkFormalityLevel('Ihr seid meine Freunde', 2, 1);
    expect(result.actualForm).toBe('Ihr');
  });
});
