// Tests: Citation Engine (CRUD + 6 Formate + BibTeX Im-/Export).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addSource,
  removeSource,
  getSources,
  clearSources,
  formatCitation,
  formatInText,
  generateBibliography,
  exportBibtex,
  importBibtex,
  type Source,
} from '@/services/citation/citation';

const BOOK = {
  type: 'book' as const,
  title: 'Testbuch',
  authors: ['Max Mustermann'],
  year: 2020,
  publisher: 'Testverlag',
};

beforeEach(() => {
  clearSources();
});

describe('addSource / getSources / removeSource', () => {
  it('erzeugt eine Quelle mit ID', async () => {
    const source = await addSource(BOOK);
    expect(source.id).toBeTruthy();
    expect(source.title).toBe('Testbuch');
    expect(await getSources()).toHaveLength(1);
  });

  it('wirft bei leerem Titel, fehlenden Autoren oder ungueltigem Jahr', async () => {
    await expect(addSource({ ...BOOK, title: '  ' })).rejects.toThrow();
    await expect(addSource({ ...BOOK, authors: [] })).rejects.toThrow();
    await expect(addSource({ ...BOOK, year: 0 })).rejects.toThrow();
  });

  it('entfernt eine Quelle und wirft bei unbekannter ID', async () => {
    const source = await addSource(BOOK);
    await removeSource(source.id);
    expect(await getSources()).toHaveLength(0);
    await expect(removeSource('gibts-nicht')).rejects.toThrow();
  });
});

describe('formatCitation', () => {
  it('erzeugt korrektes APA-Format', async () => {
    const source = await addSource(BOOK);
    expect(formatCitation(source, 'apa')).toBe('Mustermann, M. (2020). Testbuch. Testverlag.');
  });

  it('erzeugt MLA-, Chicago-, Harvard- und IEEE-Formate', async () => {
    const source = await addSource(BOOK);
    expect(formatCitation(source, 'mla')).toBe('Mustermann, Max. Testbuch. Testverlag, 2020.');
    expect(formatCitation(source, 'chicago')).toBe('Mustermann, Max. Testbuch. Testverlag, 2020.');
    expect(formatCitation(source, 'harvard')).toBe('Mustermann, M. (2020) Testbuch. Testverlag.');
    expect(formatCitation(source, 'ieee')).toBe('[1] M. Mustermann, Testbuch. Testverlag, 2020.');
  });

  it('formatiert mehrere Autoren und In-Text-Zitate', async () => {
    const source = await addSource({
      ...BOOK,
      authors: ['Max Mustermann', 'Erika Musterfrau', 'John Doe'],
    });
    expect(formatCitation(source, 'apa')).toContain('Mustermann, M., Musterfrau, E., & Doe, J.');
    expect(formatInText(source)).toBe('(Mustermann et al., 2020)');
    const single = await addSource(BOOK);
    expect(formatInText(single)).toBe('(Mustermann, 2020)');
  });
});

describe('generateBibliography', () => {
  it('erzeugt eine nach Autor sortierte Liste', async () => {
    const zebra = await addSource({ ...BOOK, title: 'Z-Buch', authors: ['Zeta Zebra'] });
    const alpha = await addSource({ ...BOOK, title: 'A-Buch', authors: ['Anna Alpha'] });
    void zebra;
    const list = generateBibliography([await getSources().then((s) => s[0]), alpha], 'apa');
    const lines = list.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Alpha');
    expect(lines[1]).toContain('Zebra');
  });

  it('nummeriert IEEE-Eintraege fortlaufend', async () => {
    await addSource({ ...BOOK, authors: ['Anna Alpha'] });
    await addSource({ ...BOOK, authors: ['Zeta Zebra'] });
    const list = generateBibliography(await getSources(), 'ieee');
    expect(list).toContain('[1]');
    expect(list).toContain('[2]');
  });
});

describe('BibTeX Im-/Export', () => {
  it('exportiert Quellen als BibTeX', async () => {
    const source = await addSource({ ...BOOK, doi: '10.1000/test' });
    const bib = exportBibtex([source]);
    expect(bib).toContain('@book{');
    expect(bib).toContain('author = {Max Mustermann}');
    expect(bib).toContain('title = {Testbuch}');
    expect(bib).toContain('year = {2020}');
    expect(bib).toContain('doi = {10.1000/test}');
  });

  it('importiert BibTeX (Roundtrip)', async () => {
    const source = await addSource({
      type: 'article',
      title: 'Aufsatz',
      authors: ['Max Mustermann', 'Erika Musterfrau'],
      year: 2021,
      publisher: 'Journalverlag',
      volume: '3',
      issue: '2',
    });
    const bib = exportBibtex([source]);
    clearSources();
    const imported = await importBibtex(bib);
    expect(imported).toHaveLength(1);
    expect(imported[0].title).toBe('Aufsatz');
    expect(imported[0].type).toBe('article');
    expect(imported[0].authors).toEqual(['Max Mustermann', 'Erika Musterfrau']);
    expect(imported[0].year).toBe(2021);
    expect(imported[0].volume).toBe('3');
  });

  it('parst fremdes BibTeX mit Anfuehrungszeichen', async () => {
    const imported = await importBibtex(
      '@misc{key1,\n  author = "Jane Doe",\n  title = "Webseite",\n  year = {2022},\n  url = {https://example.com},\n}',
    );
    expect(imported).toHaveLength(1);
    expect(imported[0].type).toBe('website');
    expect(imported[0].authors).toEqual(['Jane Doe']);
    expect(imported[0].url).toBe('https://example.com');
  });

  it('gibt bei leerem BibTeX eine leere Liste zurueck', async () => {
    expect(await importBibtex('kein bibtex hier')).toEqual([]);
    expect(await getSources()).toHaveLength(0);
  });
});

describe('Zusatzfelder', () => {
  it('haengt DOI im APA-Format an', async () => {
    const source: Source = { ...(await addSource({ ...BOOK, doi: '10.1000/xyz' })) };
    expect(formatCitation(source, 'apa')).toContain('https://doi.org/10.1000/xyz');
  });
});
