/**
 * Tests: Artefakt-Typesetter-Service (WP 34.2)
 */

import { describe, it, expect } from 'vitest';
import {
  typesetArtifact,
  exportToPrint,
  exportToEpub,
  type Artifact,
} from './artifactTypesetter';

describe('typesetArtifact', () => {
  it('leeres Artefakt ergibt HTML mit leerem Inhalt', () => {
    const result = typesetArtifact({ type: 'letter', content: '' });
    expect(result.html).toContain('artifact-letter');
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(typesetArtifact(null as unknown as Artifact).html).toBe('');
    expect(typesetArtifact(undefined as unknown as Artifact).html).toBe('');
  });

  it('rendert Brief', () => {
    const result = typesetArtifact({ type: 'letter', content: 'Hallo' });
    expect(result.html).toContain('artifact-letter');
  });

  it('rendert Zeitung', () => {
    const result = typesetArtifact({ type: 'newspaper', content: 'Nachricht', metadata: { title: 'Zeitung' } });
    expect(result.html).toContain('artifact-newspaper');
  });

  it('rendert Chat', () => {
    const result = typesetArtifact({ type: 'chat', content: 'Nachricht' });
    expect(result.html).toContain('artifact-chat');
  });

  it('rendert Polizeibericht', () => {
    const result = typesetArtifact({ type: 'police', content: 'Bericht' });
    expect(result.html).toContain('artifact-police');
  });

  it('HTML-Escaping wird angewendet', () => {
    const result = typesetArtifact({ type: 'letter', content: '<script>alert("xss")</script>' });
    expect(result.html).not.toContain('<script>');
  });

  it('Metadaten werden übernommen', () => {
    const result = typesetArtifact({ type: 'letter', content: 'Test', metadata: { key: 'value' } });
    expect(result.metadata.key).toBe('value');
  });

  it('unbekannter Typ wird zu letter', () => {
    const result = typesetArtifact({ type: 'unbekannt' as Artifact['type'], content: 'Test' });
    expect(result.html).toContain('artifact-letter');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(typesetArtifact(null as unknown as Artifact).html).toBe('');
  });
});

describe('exportToPrint', () => {
  it('leeres Ergebnis ergibt HTML mit leerem Inhalt', () => {
    const result = exportToPrint({ html: '', css: '', metadata: {} });
    expect(result).toContain('class="print"');
  });

  it('null/undefined ergibt leeren String', () => {
    expect(exportToPrint(null as unknown as any)).toBe('');
    expect(exportToPrint(undefined as unknown as any)).toBe('');
  });

  it('exportiert HTML mit Print-Klasse', () => {
    const result = exportToPrint({ html: '<p>Test</p>', css: 'p { color: black; }', metadata: {} });
    expect(result).toContain('class="print"');
  });

  it('CSS wird eingebettet', () => {
    const result = exportToPrint({ html: '<p>Test</p>', css: 'p { color: black; }', metadata: {} });
    expect(result).toContain('<style>');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(exportToPrint(null as unknown as any)).toBe('');
  });
});

describe('exportToEpub', () => {
  it('leeres Ergebnis ergibt HTML mit leerem Inhalt', () => {
    const result = exportToEpub({ html: '', css: '', metadata: {} });
    expect(result).toContain('class="epub"');
  });

  it('null/undefined ergibt leeren String', () => {
    expect(exportToEpub(null as unknown as any)).toBe('');
    expect(exportToEpub(undefined as unknown as any)).toBe('');
  });

  it('exportiert HTML mit Epub-Klasse', () => {
    const result = exportToEpub({ html: '<p>Test</p>', css: 'p { color: black; }', metadata: {} });
    expect(result).toContain('class="epub"');
  });

  it('CSS wird eingebettet', () => {
    const result = exportToEpub({ html: '<p>Test</p>', css: 'p { color: black; }', metadata: {} });
    expect(result).toContain('<style>');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(exportToEpub(null as unknown as any)).toBe('');
  });
});
