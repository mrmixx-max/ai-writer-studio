/**
 * Tests: Auto-Glossar-Service (WP 29.1)
 */

import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  generatePopUpFootnotes,
  applySpoilerFilter,
  type GlossaryEntry,
} from './autoGlossary';

describe('extractEntities', () => {
  it('leerer String ergibt leeres Array', () => {
    expect(extractEntities('')).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(extractEntities(null as unknown as string)).toEqual([]);
    expect(extractEntities(undefined as unknown as string)).toEqual([]);
  });

  it('erkennt Götter', () => {
    const text = 'Zeus war der Göttervater';
    const result = extractEntities(text);
    expect(result.length).toBeGreaterThan(0);
    const deity = result.find((e) => e.type === 'deity');
    expect(deity).toBeDefined();
    expect(deity?.term.toLowerCase()).toBe('zeus');
  });

  it('erkennt Fraktionen', () => {
    const text = 'Der Orden der Ritter';
    const result = extractEntities(text);
    const faction = result.find((e) => e.type === 'faction');
    expect(faction).toBeDefined();
  });

  it('erkennt Waffen', () => {
    const text = 'Er zog sein Schwert';
    const result = extractEntities(text);
    const weapon = result.find((e) => e.type === 'weapon');
    expect(weapon).toBeDefined();
  });

  it('erkennt Orte', () => {
    const text = 'Die Burg auf dem Berg';
    const result = extractEntities(text);
    const place = result.find((e) => e.type === 'place');
    expect(place).toBeDefined();
  });

  it('erkennt Charaktere', () => {
    const text = 'Der Held Anna kämpfte';
    const result = extractEntities(text);
    const characters = result.filter((e) => e.type === 'character');
    expect(characters.length).toBeGreaterThan(0);
    expect(characters.map((c) => c.term)).toContain('Anna');
  });

  it('mehrere Entitäten werden erkannt', () => {
    const text = 'Zeus und Athena kämpften mit dem Schwert in der Burg';
    const result = extractEntities(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('Einträge werden alphabetisch sortiert', () => {
    const text = 'Zeus und Athena';
    const result = extractEntities(text);
    const terms = result.map((e) => e.term);
    expect(terms).toEqual([...terms].sort());
  });

  it('doppelte Einträge werden entfernt', () => {
    const text = 'Zeus und Zeus';
    const result = extractEntities(text);
    const terms = result.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(extractEntities(123 as unknown as string)).toEqual([]);
  });
});

describe('generatePopUpFootnotes', () => {
  it('leerer String ergibt leeren String', () => {
    expect(generatePopUpFootnotes('', [])).toBe('');
  });

  it('null/undefined ergibt leeren String', () => {
    expect(generatePopUpFootnotes(null as unknown as string, [])).toBe('');
    expect(generatePopUpFootnotes(undefined as unknown as string, [])).toBe('');
  });

  it('leere Einträge ergibt Originaltext', () => {
    const text = 'Hallo Welt';
    expect(generatePopUpFootnotes(text, [])).toBe(text);
  });

  it('erzeugt Pop-Up-Fußnoten', () => {
    const text = 'Zeus war der Göttervater';
    const entries: GlossaryEntry[] = [
      { term: 'Zeus', type: 'deity', definition: 'Göttervater', firstMentionChapter: 1 },
    ];
    const result = generatePopUpFootnotes(text, entries);
    expect(result).toContain('epub:type="noteref"');
    expect(result).toContain('href="#glossar-zeus"');
  });

  it('mehrere Einträge werden verlinkt', () => {
    const text = 'Zeus und Athena';
    const entries: GlossaryEntry[] = [
      { term: 'Zeus', type: 'deity', definition: 'Göttervater', firstMentionChapter: 1 },
      { term: 'Athena', type: 'deity', definition: 'Göttin', firstMentionChapter: 1 },
    ];
    const result = generatePopUpFootnotes(text, entries);
    expect(result).toContain('glossar-zeus');
    expect(result).toContain('glossar-athena');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generatePopUpFootnotes(null as unknown as string, [])).toBe('');
  });
});

describe('applySpoilerFilter', () => {
  it('leere Einträge ergibt leeres Array', () => {
    expect(applySpoilerFilter([], 1)).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(applySpoilerFilter(null as unknown as GlossaryEntry[], 1)).toEqual([]);
    expect(applySpoilerFilter(undefined as unknown as GlossaryEntry[], 1)).toEqual([]);
  });

  it('filtert Spoiler heraus', () => {
    const entries: GlossaryEntry[] = [
      { term: 'A', type: 'character', definition: 'A', firstMentionChapter: 1 },
      { term: 'B', type: 'character', definition: 'B', firstMentionChapter: 5 },
    ];
    const result = applySpoilerFilter(entries, 3);
    expect(result.length).toBe(1);
    expect(result[0].term).toBe('A');
  });

  it('Kapitel 0 wird zu 1', () => {
    const entries: GlossaryEntry[] = [
      { term: 'A', type: 'character', definition: 'A', firstMentionChapter: 1 },
    ];
    const result = applySpoilerFilter(entries, 0);
    expect(result.length).toBe(1);
  });

  it('alle Einträge werden gefiltert wenn Kapitel zu niedrig', () => {
    const entries: GlossaryEntry[] = [
      { term: 'A', type: 'character', definition: 'A', firstMentionChapter: 5 },
      { term: 'B', type: 'character', definition: 'B', firstMentionChapter: 10 },
    ];
    const result = applySpoilerFilter(entries, 1);
    expect(result.length).toBe(0);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(applySpoilerFilter(null as unknown as GlossaryEntry[], 1)).toEqual([]);
  });
});
