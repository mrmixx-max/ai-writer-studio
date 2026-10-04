/**
 * Tests: Multi-Book-Serien-Matrix (WP 44.2)
 *
 * Deterministische Unit-Tests für Serien-Verknüpfung, Figuren-Audit,
 * Universums-Diff und Widerspruchserkennung (Tod, Verletzung, Rang, Bündnis).
 */

import { describe, it, expect } from 'vitest';
import {
  createSeriesUniverse,
  auditCharacterAcrossBooks,
  diffUniverse,
  detectContradictions,
  type SeriesBook,
  type BookCharacter,
  type SeriesUniverse,
} from './multiBookSeriesMatrix';

// ─── Fixture-Helfer ─────────────────────────────────────────────────────────

function char(
  name: string,
  opts: Partial<BookCharacter> = {},
): BookCharacter {
  return {
    name,
    alive: opts.alive ?? true,
    injuries: opts.injuries ?? [],
    alliances: opts.alliances ?? [],
    ...(opts.rank !== undefined ? { rank: opts.rank } : {}),
  };
}

function book(
  bookNumber: number,
  characters: BookCharacter[],
  opts: Partial<SeriesBook> = {},
): SeriesBook {
  return {
    id: opts.id ?? `b${bookNumber}`,
    title: opts.title ?? `Band ${bookNumber}`,
    bookNumber,
    yearsAfterPrevious: opts.yearsAfterPrevious ?? 0,
    characters,
    factions: opts.factions ?? [],
  };
}

/** Sauberes Universum ohne Widersprüche. */
function cleanUniverse(): SeriesUniverse {
  return createSeriesUniverse([
    book(1, [char('Aldric', { injuries: [], alliances: ['Orden'], rank: 'Ritter' })], {
      factions: ['Orden'],
    }),
    book(2, [char('Aldric', { injuries: ['Narbe'], alliances: ['Orden'], rank: 'Ritter' })], {
      factions: ['Orden'],
    }),
    book(3, [char('Aldric', { injuries: ['Narbe'], alliances: ['Orden'], rank: 'Kommandant' })], {
      factions: ['Orden'],
    }),
  ]);
}

// ─── createSeriesUniverse ───────────────────────────────────────────────────

describe('createSeriesUniverse', () => {
  it('verknüpft mehrere Bände und sortiert nach Bandnummer', () => {
    const u = createSeriesUniverse([
      book(3, [char('C')]),
      book(1, [char('A')]),
      book(2, [char('B')]),
    ]);
    expect(u.books.map((b) => b.bookNumber)).toEqual([1, 2, 3]);
    expect(u.books.map((b) => b.characters[0].name)).toEqual(['A', 'B', 'C']);
  });

  it('leere/ungültige Eingabe ergibt ein leeres, wohldefiniertes Universum', () => {
    const u = createSeriesUniverse(null as unknown as SeriesBook[]);
    expect(u.books).toEqual([]);
    expect(u.id).toBe('universe:empty');
    expect(typeof u.title).toBe('string');
  });

  it('defensive Fallbacks: fehlende Felder werden normalisiert', () => {
    const u = createSeriesUniverse([
      {
        id: '',
        title: '',
        bookNumber: -5,
        yearsAfterPrevious: -10,
        characters: [
          { name: '  Held  ' } as unknown as BookCharacter,
          { name: '' } as unknown as BookCharacter,
          null as unknown as BookCharacter,
        ],
        factions: ['X', 'X', '', 42 as unknown as string],
      },
    ]);
    expect(u.books).toHaveLength(1);
    const b = u.books[0];
    expect(b.bookNumber).toBe(1); // negative → 1
    expect(b.yearsAfterPrevious).toBe(0);
    expect(b.characters).toHaveLength(1); // leerer/ungültiger Name verworfen
    expect(b.characters[0].name).toBe('Held');
    expect(b.characters[0].alive).toBe(true); // Default lebendig
    expect(b.factions).toEqual(['X']); // dedupliziert, leere/ungültige raus
  });

  it('dedupliziert Verletzungen und Bündnisse pro Figur', () => {
    const u = createSeriesUniverse([
      book(1, [char('A', { injuries: ['Wunde', 'Wunde'], alliances: ['Gilde', 'Gilde'] })]),
    ]);
    expect(u.books[0].characters[0].injuries).toEqual(['Wunde']);
    expect(u.books[0].characters[0].alliances).toEqual(['Gilde']);
  });

  it('ist deterministisch: gleiche Eingabe → gleiches Ergebnis', () => {
    const input = [
      book(2, [char('B', { rank: 'Hauptmann' })]),
      book(1, [char('A')]),
    ];
    const a = createSeriesUniverse(input);
    const b = createSeriesUniverse(input);
    expect(a).toEqual(b);
  });

  it('leitet einen Titel ab, wenn keiner übergeben wird', () => {
    const u = createSeriesUniverse([book(1, [char('A')], { title: 'Der Anfang' })]);
    expect(u.title).toContain('Der Anfang');
    const named = createSeriesUniverse([book(1, [char('A')])], 'Die Saga');
    expect(named.title).toBe('Die Saga');
  });
});

// ─── auditCharacterAcrossBooks ──────────────────────────────────────────────

describe('auditCharacterAcrossBooks', () => {
  it('sammelt Erscheinungen sortiert nach Bandnummer', () => {
    const u = cleanUniverse();
    const audit = auditCharacterAcrossBooks('Aldric', u);
    expect(audit.character).toBe('Aldric');
    expect(audit.appearances.map((a) => a.bookNumber)).toEqual([1, 2, 3]);
    expect(audit.appearances[2].rank).toBe('Kommandant');
    expect(audit.contradictions).toEqual([]);
  });

  it('unbekannte Figur ergibt leeres Audit', () => {
    const audit = auditCharacterAcrossBooks('Niemand', cleanUniverse());
    expect(audit.appearances).toEqual([]);
    expect(audit.contradictions).toEqual([]);
  });

  it('leerer Name / ungültiges Universum ergibt leeres Audit (defensiv)', () => {
    expect(auditCharacterAcrossBooks('', cleanUniverse()).appearances).toEqual([]);
    expect(
      auditCharacterAcrossBooks('A', null as unknown as SeriesUniverse).appearances,
    ).toEqual([]);
  });

  it('meldet Tod-zu-lebendig als Widerspruch', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { alive: true })]),
      book(2, [char('Aldric', { alive: false })]),
      book(3, [char('Aldric', { alive: true })]),
    ]);
    const audit = auditCharacterAcrossBooks('Aldric', u);
    expect(audit.contradictions.length).toBeGreaterThan(0);
    expect(audit.contradictions[0]).toContain('gestorben');
    expect(audit.contradictions[0]).toContain('wieder lebendig');
  });

  it('lässt gültigen Lebenslauf widerspruchsfrei', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { alive: true })]),
      book(2, [char('Aldric', { alive: true, injuries: ['Narbe'] })]),
      book(3, [char('Aldric', { alive: false, injuries: ['Narbe'] })]), // endgültiger Tod, Narbe bleibt
    ]);
    expect(auditCharacterAcrossBooks('Aldric', u).contradictions).toEqual([]);
  });

  it('zählt eine Figur pro Band nur einmal (erste Nennung gewinnt)', () => {
    const u = createSeriesUniverse([
      book(1, [char('A', { rank: 'Ritter' }), char('A', { rank: 'Bauer' })]),
    ]);
    const audit = auditCharacterAcrossBooks('A', u);
    expect(audit.appearances).toHaveLength(1);
    expect(audit.appearances[0].rank).toBe('Ritter');
  });
});

// ─── diffUniverse ───────────────────────────────────────────────────────────

describe('diffUniverse', () => {
  it('berechnet yearsElapsed über das Intervall (from, to]', () => {
    const u = createSeriesUniverse([
      book(1, [char('A')], { yearsAfterPrevious: 0 }),
      book(2, [char('A')], { yearsAfterPrevious: 5 }),
      book(3, [char('A')], { yearsAfterPrevious: 3 }),
    ]);
    const d = diffUniverse(u, 1, 3);
    expect(d.yearsElapsed).toBe(8); // 5 + 3
    expect(d.fromBook).toBe(1);
    expect(d.toBook).toBe(3);
  });

  it('erkennt Todes-, Verletzungs-, Rang- und Bündnisänderungen', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { alive: true, injuries: [], alliances: ['Orden'], rank: 'Ritter' })]),
      book(2, [
        char('Aldric', {
          alive: false,
          injuries: ['Arm verloren'],
          alliances: ['Rebellen'],
          rank: 'General',
        }),
      ]),
    ]);
    const d = diffUniverse(u, 1, 2);
    const joined = d.characterChanges.join(' | ');
    expect(joined).toContain('lebendig → tot');
    expect(joined).toContain('neue Verletzung');
    expect(joined).toContain('Rang');
    expect(joined).toContain('neue Bündnisse');
    expect(joined).toContain('beendete Bündnisse');
  });

  it('erkennt Fraktionsänderungen', () => {
    const u = createSeriesUniverse([
      book(1, [char('A')], { factions: ['Orden', 'Gilde'] }),
      book(2, [char('A')], { factions: ['Gilde', 'Rebellen'] }),
    ]);
    const d = diffUniverse(u, 1, 2);
    expect(d.factionChanges).toContain('Neue Fraktion: "Rebellen".');
    expect(d.factionChanges).toContain('Fraktion entfernt: "Orden".');
  });

  it('erkennt neu auftretende und verschwindende Figuren', () => {
    const u = createSeriesUniverse([
      book(1, [char('A'), char('B')]),
      book(2, [char('A'), char('C')]),
    ]);
    const d = diffUniverse(u, 1, 2);
    const joined = d.characterChanges.join(' | ');
    expect(joined).toContain('"C" tritt neu');
    expect(joined).toContain('"B" tritt');
    expect(joined).toContain('nicht mehr auf');
  });

  it('to <= from bzw. ungültige Eingabe ergibt leeren Diff', () => {
    const u = cleanUniverse();
    expect(diffUniverse(u, 3, 3).characterChanges).toEqual([]);
    expect(diffUniverse(u, 3, 1).yearsElapsed).toBe(0);
    expect(diffUniverse(null as unknown as SeriesUniverse, 1, 2).characterChanges).toEqual([]);
  });
});

// ─── detectContradictions ───────────────────────────────────────────────────

describe('detectContradictions', () => {
  it('sauberes Universum liefert keine Widersprüche', () => {
    expect(detectContradictions(cleanUniverse())).toEqual([]);
  });

  it('erkennt Tod-Wiederbelebung über Buchgrenzen', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { alive: true })]),
      book(2, [char('Aldric', { alive: false })]),
      book(3, [char('Aldric', { alive: true })]),
    ]);
    const found = detectContradictions(u);
    const death = found.filter((c) => c.kind === 'death');
    expect(death).toHaveLength(1);
    expect(death[0].character).toBe('Aldric');
    expect(death[0].fromBook).toBe(2);
    expect(death[0].toBook).toBe(3);
  });

  it('erkennt zurückkehrende verlorene Gliedmaßen', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { injuries: [] })]),
      book(2, [char('Aldric', { injuries: ['linke Hand verloren'] })]),
      book(3, [char('Aldric', { injuries: [] })]), // Hand ist wieder da → Fehler
    ]);
    const injury = detectContradictions(u).filter((c) => c.kind === 'injury');
    expect(injury).toHaveLength(1);
    expect(injury[0].message).toContain('linke Hand verloren');
    expect(injury[0].fromBook).toBe(2);
    expect(injury[0].toBook).toBe(3);
  });

  it('dauerhafte Verletzung über mehrere Bände ist kein Widerspruch', () => {
    const u = createSeriesUniverse([
      book(1, [char('Aldric', { injuries: ['Narbe'] })]),
      book(2, [char('Aldric', { injuries: ['Narbe'] })]),
      book(3, [char('Aldric', { injuries: ['Narbe'] })]),
    ]);
    expect(detectContradictions(u)).toEqual([]);
  });

  it('erkennt Rang-Oszillation (Rang kehrt nach Wechsel zurück)', () => {
    const u = createSeriesUniverse([
      book(1, [char('Mira', { rank: 'Kapitän' })]),
      book(2, [char('Mira', { rank: 'Piratin' })]),
      book(3, [char('Mira', { rank: 'Kapitän' })]),
    ]);
    const rank = detectContradictions(u).filter((c) => c.kind === 'rank');
    expect(rank).toHaveLength(1);
    expect(rank[0].character).toBe('Mira');
    expect(rank[0].message).toContain('Kapitän');
  });

  it('monotoner Rangaufstieg ist kein Widerspruch', () => {
    const u = createSeriesUniverse([
      book(1, [char('Mira', { rank: 'Rekrut' })]),
      book(2, [char('Mira', { rank: 'Leutnant' })]),
      book(3, [char('Mira', { rank: 'Kapitän' })]),
    ]);
    expect(detectContradictions(u).filter((c) => c.kind === 'rank')).toEqual([]);
  });

  it('erkennt Bündnis-Oszillation (Bündnis kehrt nach Bruch zurück)', () => {
    const u = createSeriesUniverse([
      book(1, [char('Bran', { alliances: ['Nordbund'] })]),
      book(2, [char('Bran', { alliances: [] })]), // Bruch
      book(3, [char('Bran', { alliances: ['Nordbund'] })]), // kehrt zurück → Fehler
    ]);
    const alliance = detectContradictions(u).filter((c) => c.kind === 'alliance');
    expect(alliance).toHaveLength(1);
    expect(alliance[0].message).toContain('Nordbund');
  });

  it('dauerhaftes Bündnis ist kein Widerspruch', () => {
    const u = createSeriesUniverse([
      book(1, [char('Bran', { alliances: ['Nordbund'] })]),
      book(2, [char('Bran', { alliances: ['Nordbund'] })]),
    ]);
    expect(detectContradictions(u)).toEqual([]);
  });

  it('erkennt mehrere unabhängige Widersprüche deterministisch (alphabetisch)', () => {
    const u = createSeriesUniverse([
      book(1, [char('Zed', { alive: true }), char('Ana', { alive: true })]),
      book(2, [char('Zed', { alive: false }), char('Ana', { alive: false })]),
      book(3, [char('Zed', { alive: true }), char('Ana', { alive: true })]),
    ]);
    const found = detectContradictions(u);
    expect(found).toHaveLength(2);
    expect(found[0].character).toBe('Ana'); // alphabetisch
    expect(found[1].character).toBe('Zed');
    expect(detectContradictions(u)).toEqual(found); // deterministisch
  });

  it('defensive Fallbacks: null/leeres Universum ergibt keine Widersprüche', () => {
    expect(detectContradictions(null as unknown as SeriesUniverse)).toEqual([]);
    expect(detectContradictions(createSeriesUniverse([]))).toEqual([]);
  });
});
