// Tests: Codex Service (CRUD, Suche, Backlinks, Zitierung).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCodexEntry,
  searchCodex,
  getBacklinks,
  formatCitation,
  getAllEntries,
  deleteCodexEntry,
  clearCodexStore,
  type CodexEntry,
} from '@/services/research/codexService';

const VALID_ENTRY: CodexEntry = {
  id: 'test-001',
  title: 'Testort',
  type: 'location',
  tags: ['test', 'ort'],
  content: 'Dies ist ein Testeintrag für den Codex.',
};

beforeEach(() => {
  clearCodexStore();
});

describe('createCodexEntry', () => {
  it('erstellt einen Codex-Eintrag mit allen Feldern', () => {
    const entry = createCodexEntry(VALID_ENTRY);
    expect(entry.id).toBe('test-001');
    expect(entry.title).toBe('Testort');
    expect(entry.type).toBe('location');
    expect(entry.tags).toEqual(['test', 'ort']);
    expect(entry.content).toContain('Testeintrag');
  });

  it('generiert eine ID falls keine vorhanden', () => {
    const entry = createCodexEntry({ ...VALID_ENTRY, id: '' });
    expect(entry.id).toBeTruthy();
    expect(entry.id).toMatch(/^codex-/);
  });

  it('wirft bei fehlendem Titel', () => {
    expect(() => createCodexEntry({ ...VALID_ENTRY, title: '' })).toThrow('Titel');
    expect(() => createCodexEntry({ ...VALID_ENTRY, title: '   ' })).toThrow('Titel');
  });

  it('wirft bei ungültigem Typ', () => {
    expect(() => createCodexEntry({ ...VALID_ENTRY, type: 'invalid' as never })).toThrow('Ungültiger Typ');
  });

  it('filtert ungültige Tags heraus', () => {
    const entry = createCodexEntry({ ...VALID_ENTRY, tags: ['gültig', 42, null, 'auch-gültig'] as never });
    expect(entry.tags).toEqual(['gültig', 'auch-gültig']);
  });

  it('verwandelt leere imageUrl in undefined', () => {
    const entry = createCodexEntry({ ...VALID_ENTRY, imageUrl: '   ' });
    expect(entry.imageUrl).toBeUndefined();
  });
});

describe('searchCodex', () => {
  it('findet Einträge nach Titel', () => {
    createCodexEntry(VALID_ENTRY);
    const results = searchCodex('Testort');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-001');
  });

  it('findet Einträge nach Inhalt', () => {
    createCodexEntry(VALID_ENTRY);
    const results = searchCodex('Testeintrag');
    expect(results).toHaveLength(1);
  });

  it('findet Einträge nach Tags', () => {
    createCodexEntry(VALID_ENTRY);
    const results = searchCodex('test');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('ist case-insensitive', () => {
    createCodexEntry(VALID_ENTRY);
    const results = searchCodex('TESTORT');
    expect(results).toHaveLength(1);
  });

  it('gibt alle Einträge zurück bei leerem Query', () => {
    createCodexEntry(VALID_ENTRY);
    createCodexEntry({ ...VALID_ENTRY, id: 'test-002', title: 'Zweiter' });
    const results = searchCodex('');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('gibt leeres Array zurück wenn nichts gefunden', () => {
    createCodexEntry(VALID_ENTRY);
    const results = searchCodex('gibts-nicht-xyz');
    expect(results).toHaveLength(0);
  });
});

describe('getBacklinks', () => {
  it('findet Einträge deren Titel im Text vorkommt', () => {
    createCodexEntry(VALID_ENTRY);
    const backlinks = getBacklinks('Testort');
    expect(backlinks).toContain('test-001');
  });

  it('gibt leeres Array zurück bei leerem Term', () => {
    createCodexEntry(VALID_ENTRY);
    expect(getBacklinks('')).toEqual([]);
  });

  it('gibt leeres Array zurück wenn kein Titel matcht', () => {
    createCodexEntry(VALID_ENTRY);
    expect(getBacklinks('unbekannt-xyz')).toEqual([]);
  });
});

describe('formatCitation', () => {
  it('formatiert eine korrekte Zitierung', () => {
    const entry = createCodexEntry(VALID_ENTRY);
    const citation = formatCitation(entry);
    expect(citation).toContain('Testort');
    expect(citation).toContain('location');
    expect(citation).toContain('test');
  });

  it('handhabt fehlende Daten defensiv', () => {
    const citation = formatCitation(null as never);
    expect(citation).toContain('Ungültiger');
  });

  it('verwendet Platzhalter bei fehlendem Titel', () => {
    const invalidEntry = { ...VALID_ENTRY, title: '' } as CodexEntry;
    const citation = formatCitation(invalidEntry);
    expect(citation).toContain('Ohne Titel');
  });
});

describe('getAllEntries', () => {
  it('gibt Seed-Daten zurück wenn Store leer ist', () => {
    const entries = getAllEntries();
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(entries.some((e) => e.type === 'location')).toBe(true);
    expect(entries.some((e) => e.type === 'technology')).toBe(true);
    expect(entries.some((e) => e.type === 'history')).toBe(true);
    expect(entries.some((e) => e.type === 'medicine')).toBe(true);
    expect(entries.some((e) => e.type === 'culture')).toBe(true);
  });
});

describe('deleteCodexEntry', () => {
  it('löscht einen Eintrag und gibt true zurück', () => {
    const entry = createCodexEntry(VALID_ENTRY);
    expect(deleteCodexEntry(entry.id)).toBe(true);
    expect(getAllEntries().find((e) => e.id === entry.id)).toBeUndefined();
  });

  it('gibt false zurück bei unbekannter ID', () => {
    expect(deleteCodexEntry('gibts-nicht')).toBe(false);
  });
});
