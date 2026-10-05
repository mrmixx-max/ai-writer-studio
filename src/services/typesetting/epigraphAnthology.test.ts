/**
 * Tests: Kapitel-Epigraph- & Motto-Studio-Service (WP 52.2)
 */

import { describe, it, expect } from 'vitest';
import {
  createEpigraph,
  checkCopyrightStatus,
  formatEpigraph,
  PUBLIC_DOMAIN_DEATH_YEAR,
  FLEURON_GLYPH,
  type Epigraph,
} from './epigraphAnthology';

// ─── createEpigraph ──────────────────────────────────────────────────────────

describe('createEpigraph', () => {
  it('erzeugt ein Epigraph mit allen Pflichtfeldern', () => {
    const epi = createEpigraph('Am Anfang war das Wort.', 'Goethe, Faust I');
    expect(epi.text).toBe('Am Anfang war das Wort.');
    expect(epi.source).toBe('Goethe, Faust I');
    expect(epi.author).toBe('Goethe');
    expect(epi.kind).toBe('historical');
    expect(epi.fleuron).toBe(false);
    expect(epi.id).toMatch(/^epi-[0-9a-f]{8}$/);
  });

  it('übernimmt kind, chapter und fleuron aus den Optionen', () => {
    const epi = createEpigraph('Motto', 'Anonym, Werk', {
      kind: 'fictional',
      chapter: 7,
      fleuron: true,
    });
    expect(epi.kind).toBe('fictional');
    expect(epi.chapter).toBe(7);
    expect(epi.fleuron).toBe(true);
  });

  it('lässt chapter weg, wenn nicht gesetzt', () => {
    const epi = createEpigraph('Text', 'Quelle');
    expect(epi.chapter).toBeUndefined();
  });

  it('ist deterministisch: gleiche Eingabe → gleiche ID', () => {
    const a = createEpigraph('Text', 'Goethe, Faust', { chapter: 2 });
    const b = createEpigraph('Text', 'Goethe, Faust', { chapter: 2 });
    expect(a.id).toBe(b.id);
  });

  it('verschiedene Eingaben ergeben verschiedene IDs', () => {
    const a = createEpigraph('Text A', 'Quelle');
    const b = createEpigraph('Text B', 'Quelle');
    expect(a.id).not.toBe(b.id);
  });

  it('defensive Fallbacks: null/undefined ergeben leere Strings', () => {
    const epi = createEpigraph(
      null as unknown as string,
      undefined as unknown as string,
    );
    expect(epi.text).toBe('');
    expect(epi.source).toBe('');
    expect(epi.author).toBe('');
    expect(epi.kind).toBe('historical');
    expect(epi.fleuron).toBe(false);
  });

  it('ungültiges kind wird zu historical normalisiert', () => {
    const epi = createEpigraph('Text', 'Quelle', {
      kind: 'bogus' as unknown as 'historical',
    });
    expect(epi.kind).toBe('historical');
  });

  it('ungültige chapter-Werte werden verworfen', () => {
    expect(createEpigraph('T', 'Q', { chapter: 0 }).chapter).toBeUndefined();
    expect(createEpigraph('T', 'Q', { chapter: -3 }).chapter).toBeUndefined();
    expect(
      createEpigraph('T', 'Q', { chapter: NaN }).chapter,
    ).toBeUndefined();
  });
});

// ─── checkCopyrightStatus ────────────────────────────────────────────────────

describe('checkCopyrightStatus', () => {
  it('Autor vor 1955 gestorben → public-domain', () => {
    const status = checkCopyrightStatus('Goethe', 1832);
    expect(status.status).toBe('public-domain');
    expect(status.message).toContain('1832');
  });

  it('Grenzfall genau 1955 → copyrighted (nicht vor 1955)', () => {
    expect(checkCopyrightStatus('Autor', PUBLIC_DOMAIN_DEATH_YEAR).status).toBe(
      'copyrighted',
    );
    expect(checkCopyrightStatus('Autor', 1954).status).toBe('public-domain');
  });

  it('Autor nach 1955 gestorben → copyrighted', () => {
    const status = checkCopyrightStatus('Camus', 1960);
    expect(status.status).toBe('copyrighted');
    expect(status.message).toContain('1960');
  });

  it('Autor vor 1955 lebend (kein Todesjahr) → copyrighted', () => {
    const status = checkCopyrightStatus('Max Mustermann');
    expect(status.status).toBe('copyrighted');
  });

  it('unbekannter Autor → unknown', () => {
    expect(checkCopyrightStatus('').status).toBe('unknown');
    expect(checkCopyrightStatus('Unbekannt').status).toBe('unknown');
    expect(checkCopyrightStatus('N/A').status).toBe('unknown');
  });

  it('ausdrückliche Fair-Use-Kennzeichnung → fair-use', () => {
    expect(checkCopyrightStatus('Fair Use — Moderner Autor').status).toBe(
      'fair-use',
    );
  });

  it('liefert stets eine nicht-leere message', () => {
    const cases = [
      checkCopyrightStatus('Goethe', 1832),
      checkCopyrightStatus('Camus', 1960),
      checkCopyrightStatus(''),
      checkCopyrightStatus('Moderner Autor'),
    ];
    for (const c of cases) {
      expect(typeof c.message).toBe('string');
      expect(c.message.length).toBeGreaterThan(0);
    }
  });

  it('defensive Fallbacks: null/undefined → unknown', () => {
    expect(
      checkCopyrightStatus(null as unknown as string).status,
    ).toBe('unknown');
    expect(
      checkCopyrightStatus(undefined as unknown as string).status,
    ).toBe('unknown');
  });

  it('ungültiges Todesjahr (NaN) wird wie "lebend" behandelt', () => {
    expect(checkCopyrightStatus('Autor', NaN).status).toBe('copyrighted');
  });
});

// ─── formatEpigraph ──────────────────────────────────────────────────────────

describe('formatEpigraph', () => {
  const base = createEpigraph('Am Anfang war das Wort.', 'Goethe, Faust I', {
    chapter: 1,
  });

  it('rendert eine figure mit epigraph-Klassen', () => {
    const html = formatEpigraph(base);
    expect(html).toContain('<figure');
    expect(html).toContain('class="epigraph epigraph--historical epigraph--chapter-1"');
    expect(html).toContain('epigraph__text');
  });

  it('Attribution enthält Autor und Quelle', () => {
    const html = formatEpigraph(base);
    expect(html).toContain('epigraph__attribution');
    expect(html).toContain('Goethe');
    expect(html).toContain('Goethe, Faust I');
  });

  it('Vignette nur bei fleuron=true', () => {
    const withFleuron = createEpigraph('T', 'Q', { fleuron: true });
    const withoutFleuron = createEpigraph('T', 'Q', { fleuron: false });
    expect(formatEpigraph(withFleuron)).toContain(FLEURON_GLYPH);
    expect(formatEpigraph(withoutFleuron)).not.toContain(FLEURON_GLYPH);
  });

  it('fictional-Kind erhält passende Modifier-Klasse', () => {
    const epi = createEpigraph('T', 'Q', { kind: 'fictional' });
    expect(formatEpigraph(epi)).toContain('epigraph--fictional');
  });

  it('HTML-Escaping verhindert Injection', () => {
    const epi = createEpigraph(
      '<script>alert("xss")</script>',
      '<b>Quelle</b>',
    );
    const html = formatEpigraph(epi);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('defensive Fallbacks: null/undefined → leerer String', () => {
    expect(formatEpigraph(null as unknown as Epigraph)).toBe('');
    expect(formatEpigraph(undefined as unknown as Epigraph)).toBe('');
  });

  it('Epigraph ohne Quelle rendert ohne Attribution-caption', () => {
    const epi = createEpigraph('Nur Text', '');
    const html = formatEpigraph(epi);
    expect(html).toContain('epigraph__text');
    expect(html).not.toContain('epigraph__attribution');
  });
});
