/**
 * Tests: Phonetik-Lexikon-Service (WP 32.2)
 */

import { describe, it, expect } from 'vitest';
import {
  generateIPA,
  mapSyllableStress,
  exportSpeakerGlossary,
} from './phoneticLexicon';

describe('generateIPA', () => {
  it('leeres Wort ergibt leeres Ergebnis', () => {
    const result = generateIPA('');
    expect(result.ipa).toBe('');
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(generateIPA(null as unknown as string).ipa).toBe('');
    expect(generateIPA(undefined as unknown as string).ipa).toBe('');
  });

  it('generiert IPA für einfaches Wort', () => {
    const result = generateIPA('hallo');
    expect(result.ipa).toContain('/');
    expect(result.simplified).toBeDefined();
  });

  it('generiert IPA für "sch"', () => {
    const result = generateIPA('schule');
    expect(result.ipa).toContain('ʃ');
  });

  it('generiert IPA für "ch"', () => {
    const result = generateIPA('buch');
    expect(result.ipa).toContain('x');
  });

  it('generiert IPA für "ei"', () => {
    const result = generateIPA('ein');
    expect(result.ipa).toContain('aɪ');
  });

  it('generiert IPA für "au"', () => {
    const result = generateIPA('haus');
    expect(result.ipa).toContain('aʊ');
  });

  it('generiert IPA für Umlaute', () => {
    const result = generateIPA('über');
    expect(result.ipa).toContain('y');
  });

  it('Wort wird zurückgegeben', () => {
    const result = generateIPA('test');
    expect(result.word).toBe('test');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateIPA(123 as unknown as string).ipa).toBe('');
  });
});

describe('mapSyllableStress', () => {
  it('leeres Wort ergibt leeres Ergebnis', () => {
    const result = mapSyllableStress('');
    expect(result.syllables).toEqual([]);
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(mapSyllableStress(null as unknown as string).syllables).toEqual([]);
    expect(mapSyllableStress(undefined as unknown as string).syllables).toEqual([]);
  });

  it('zerlegt Wort in Silben', () => {
    const result = mapSyllableStress('hallo');
    expect(result.syllables.length).toBeGreaterThan(0);
  });

  it('primäre Betonung wird gesetzt', () => {
    const result = mapSyllableStress('hallo');
    expect(result.primaryStress).toBe(0);
  });

  it('sekundäre Betonung bei langen Wörtern', () => {
    const result = mapSyllableStress('universität');
    expect(result.secondaryStress).toBeDefined();
  });

  it('Wort wird zurückgegeben', () => {
    const result = mapSyllableStress('test');
    expect(result.word).toBe('test');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(mapSyllableStress(123 as unknown as string).syllables).toEqual([]);
  });
});

describe('exportSpeakerGlossary', () => {
  it('leere Liste ergibt leeren String', () => {
    expect(exportSpeakerGlossary([])).toBe('');
  });

  it('null/undefined ergibt leeren String', () => {
    expect(exportSpeakerGlossary(null as unknown as string[])).toBe('');
    expect(exportSpeakerGlossary(undefined as unknown as string[])).toBe('');
  });

  it('generiert Glossar mit IPA', () => {
    const result = exportSpeakerGlossary(['hallo']);
    expect(result).toContain('AUSSPACHE-GLOSSAR');
    expect(result).toContain('hallo');
  });

  it('generiert Glossar mit Silben', () => {
    const result = exportSpeakerGlossary(['hallo']);
    expect(result).toContain('Silben');
  });

  it('generiert Glossar mit Betonung', () => {
    const result = exportSpeakerGlossary(['hallo']);
    expect(result).toContain('Betonung');
  });

  it('mehrere Wörter werden exportiert', () => {
    const result = exportSpeakerGlossary(['hallo', 'welt']);
    expect(result).toContain('hallo');
    expect(result).toContain('welt');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(exportSpeakerGlossary(null as unknown as string[])).toBe('');
  });
});
