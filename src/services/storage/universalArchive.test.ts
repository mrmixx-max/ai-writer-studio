/**
 * Tests: Universal-Archive-Service (WP 35.2)
 */

import { describe, it, expect } from 'vitest';
import {
  exportToAiwopen,
  importFromAiwopen,
  exportToObsidianVault,
  type ArchiveProject,
} from './universalArchive';

describe('exportToAiwopen', () => {
  it('leeres Projekt ergibt Archiv mit Defaults', () => {
    const result = exportToAiwopen({ title: '', author: '', chapters: [], metadata: {} });
    expect(result.markdown).toContain('Unbekannt');
  });

  it('null/undefined ergibt leeres Archiv', () => {
    expect(exportToAiwopen(null as unknown as ArchiveProject).markdown).toBe('');
    expect(exportToAiwopen(undefined as unknown as ArchiveProject).markdown).toBe('');
  });

  it('exportiert Markdown mit Titel', () => {
    const result = exportToAiwopen({ title: 'Test', author: 'Autor', chapters: ['Kapitel 1'], metadata: {} });
    expect(result.markdown).toContain('# Test');
  });

  it('exportiert YAML mit Metadaten', () => {
    const result = exportToAiwopen({ title: 'Test', author: 'Autor', chapters: ['Kapitel 1'], metadata: { genre: 'Fantasy' } });
    expect(result.yaml).toContain('genre: Fantasy');
  });

  it('exportiert JSON-LD', () => {
    const result = exportToAiwopen({ title: 'Test', author: 'Autor', chapters: ['Kapitel 1'], metadata: {} });
    expect(result.jsonLd).toContain('"@type":"Book"');
  });

  it('Kapitel werden nummeriert', () => {
    const result = exportToAiwopen({ title: 'Test', author: 'Autor', chapters: ['A', 'B'], metadata: {} });
    expect(result.markdown).toContain('## Kapitel 1');
    expect(result.markdown).toContain('## Kapitel 2');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(exportToAiwopen(null as unknown as ArchiveProject).markdown).toBe('');
  });
});

describe('importFromAiwopen', () => {
  it('leeres Archiv ergibt Projekt mit Defaults', () => {
    const result = importFromAiwopen({ markdown: '', yaml: '', jsonLd: '' });
    expect(result.title).toBe('Unbekannt');
  });

  it('null/undefined ergibt leeres Projekt', () => {
    expect(importFromAiwopen(null as unknown as any).title).toBe('');
    expect(importFromAiwopen(undefined as unknown as any).title).toBe('');
  });

  it('importiert Titel', () => {
    const result = importFromAiwopen({ markdown: '# Testbuch\n\n**Autor:** Testautor\n\n## Kapitel 1\n\nInhalt', yaml: '', jsonLd: '' });
    expect(result.title).toBe('Testbuch');
  });

  it('importiert Autor', () => {
    const result = importFromAiwopen({ markdown: '# Test\n\n**Autor:** Autor\n\n## Kapitel 1\n\nInhalt', yaml: '', jsonLd: '' });
    expect(result.author).toBe('Autor');
  });

  it('importiert Kapitel', () => {
    const result = importFromAiwopen({ markdown: '# Test\n\n**Autor:** Autor\n\n## Kapitel 1\n\nInhalt 1\n\n## Kapitel 2\n\nInhalt 2', yaml: '', jsonLd: '' });
    expect(result.chapters.length).toBe(2);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(importFromAiwopen(null as unknown as any).title).toBe('');
  });
});

describe('exportToObsidianVault', () => {
  it('leeres Projekt ergibt Vault mit Index', () => {
    const result = exportToObsidianVault({ title: '', author: '', chapters: [], metadata: {} });
    expect(result.files.length).toBe(1);
    expect(result.files[0].name).toBe('Index.md');
  });

  it('null/undefined ergibt leeres Vault', () => {
    expect(exportToObsidianVault(null as unknown as ArchiveProject).files).toEqual([]);
    expect(exportToObsidianVault(undefined as unknown as ArchiveProject).files).toEqual([]);
  });

  it('erstellt Index-Datei', () => {
    const result = exportToObsidianVault({ title: 'Test', author: 'Autor', chapters: ['A', 'B'], metadata: {} });
    expect(result.files[0].name).toBe('Index.md');
  });

  it('erstellt Kapitel-Dateien', () => {
    const result = exportToObsidianVault({ title: 'Test', author: 'Autor', chapters: ['A', 'B'], metadata: {} });
    expect(result.files.length).toBe(3); // Index + 2 Kapitel
  });

  it('Wiki-Links werden erstellt', () => {
    const result = exportToObsidianVault({ title: 'Test', author: 'Autor', chapters: ['A', 'B'], metadata: {} });
    expect(result.files[0].content).toContain('[[Kapitel 1]]');
  });

  it('Kapitel-Inhalt wird übernommen', () => {
    const result = exportToObsidianVault({ title: 'Test', author: 'Autor', chapters: ['Inhalt'], metadata: {} });
    expect(result.files[1].content).toContain('Inhalt');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(exportToObsidianVault(null as unknown as ArchiveProject).files).toEqual([]);
  });
});
