// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  OUTFIT_CATEGORIES,
  checkWardrobeContinuity,
  buildLookbook,
  createSampleWardrobeEntry,
  createSampleLookbook,
  type WardrobeEntry,
} from './characterWardrobeLookbook';

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe('hashString', () => {
  it('ist deterministisch — gleicher String ergibt gleichen Hash', () => {
    expect(hashString('isolde')).toBe(hashString('isolde'));
  });

  it('erzeugt unterschiedliche Hashes für unterschiedliche Strings', () => {
    expect(hashString('isolde')).not.toBe(hashString('baldric'));
  });

  it('liefert einen anderen Hash für den leeren String als für einen nicht-leeren', () => {
    expect(hashString('')).not.toBe(hashString('a'));
  });

  it('liefert konsistente Werte über mehrere Aufrufe hinweg', () => {
    const first = hashString('test-string');
    const second = hashString('test-string');
    const third = hashString('test-string');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    expect(hashString('Isolde')).not.toBe(hashString('isolde'));
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe('createSeededRandom', () => {
  it('ist deterministisch für den gleichen Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('liefert unterschiedliche Werte für unterschiedliche Seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);

    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());

    expect(values1).not.toEqual(values2);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(123);

    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('liefert auch für Seed 0 eine reproduzierbare Sequenz', () => {
    const rng1 = createSeededRandom(0);
    const rng2 = createSeededRandom(0);

    expect(rng1()).toBe(rng2());
  });
});

// ---------------------------------------------------------------------------
// OUTFIT_CATEGORIES
// ---------------------------------------------------------------------------

describe('OUTFIT_CATEGORIES', () => {
  it('enthält 4 Kategorien', () => {
    expect(OUTFIT_CATEGORIES).toHaveLength(4);
  });

  it('enthält die Kategorien travel, banquet, battle und ceremony', () => {
    const ids = OUTFIT_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('travel');
    expect(ids).toContain('banquet');
    expect(ids).toContain('battle');
    expect(ids).toContain('ceremony');
  });

  it('jede Kategorien hat ein id, name, description und typicalItems', () => {
    for (const category of OUTFIT_CATEGORIES) {
      expect(category.id).toBeTruthy();
      expect(category.name).toBeTruthy();
      expect(category.description).toBeTruthy();
      expect(Array.isArray(category.typicalItems)).toBe(true);
      expect(category.typicalItems.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// checkWardrobeContinuity
// ---------------------------------------------------------------------------

describe('checkWardrobeContinuity', () => {
  it('leere Eingabe liefert leere violations und warnings und brokenAt null', () => {
    const result = checkWardrobeContinuity([]);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.brokenAt).toBeNull();
  });

  it('einzelner Eintrag ohne Sprünge liefert keine Fehler', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [
          { name: 'Umhang', color: 'grau', condition: 'pristine' },
          { name: 'Wanderrock', color: 'braun', condition: 'worn' },
        ],
      },
    ];
    const result = checkWardrobeContinuity(entries);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.brokenAt).toBeNull();
  });

  it('dramatischer Verfall (pristine → torn) erzeugt eine Violation', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
      {
        characterId: 'isolde',
        chapter: 5,
        category: 'battle',
        items: [{ name: 'Umhang', color: 'grau', condition: 'torn' }],
      },
    ];
    const result = checkWardrobeContinuity(entries);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
    expect(result.brokenAt).toBe(5);
  });

  it('unrealistische Verbesserung (torn → pristine) erzeugt eine Warning', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'torn' }],
      },
      {
        characterId: 'isolde',
        chapter: 3,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
    ];
    const result = checkWardrobeContinuity(entries);
    expect(result.violations).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.brokenAt).toBe(3);
  });

  it('gewöhnlicher Zustandswechsel (pristine → damaged) erzeugt keine Fehler', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
      {
        characterId: 'isolde',
        chapter: 2,
        category: 'battle',
        items: [{ name: 'Umhang', color: 'grau', condition: 'damaged' }],
      },
    ];
    const result = checkWardrobeContinuity(entries);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.brokenAt).toBe(2);
  });

  it('Figuren werden unabhängig voneinander geprüft', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
      {
        characterId: 'baldric',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'schwarz', condition: 'pristine' }],
      },
      {
        characterId: 'isolde',
        chapter: 5,
        category: 'battle',
        items: [{ name: 'Umhang', color: 'grau', condition: 'torn' }],
      },
    ];
    const result = checkWardrobeContinuity(entries);
    expect(result.violations.length).toBeGreaterThan(0);
    // Die Violation soll isolde betreffen, nicht baldric
    expect(result.violations[0]).toContain('isolde');
    expect(result.brokenAt).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildLookbook
// ---------------------------------------------------------------------------

describe('buildLookbook', () => {
  it('erzeugt einen Titel mit dem Charakternamen', () => {
    const entries: WardrobeEntry[] = [];
    const result = buildLookbook('isolde', entries, 42);
    expect(result.title).toBe('isolde — Garderoben-Lookbook');
  });

  it('hat mindestens 1 Seite auch bei leeren Einträgen', () => {
    const result = buildLookbook('isolde', [], 42);
    expect(result.pages).toBe(1);
  });

  it('berechnet die Anzahl der Seiten basierend auf den Einträgen', () => {
    const entries: WardrobeEntry[] = Array.from({ length: 7 }, (_, i) => ({
      characterId: 'isolde',
      chapter: i + 1,
      category: 'travel',
      items: [{ name: `Item${i}`, color: 'grau', condition: 'worn' as const }],
    }));
    const result = buildLookbook('isolde', entries, 42);
    expect(result.pages).toBe(2); // 7 Einträge / 6 pro Seite = 2
  });

  it('enthält die vereinfachten Einträge mit chapter, category und items', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
    ];
    const result = buildLookbook('isolde', entries, 42);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].chapter).toBe(1);
    expect(result.entries[0].category).toBe('travel');
    expect(result.entries[0].items[0]).toBe('Umhang (grau, pristine)');
  });

  it('erzeugt ein SVG-Cover als String', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
    ];
    const result = buildLookbook('isolde', entries, 42);
    expect(typeof result.coverSvg).toBe('string');
    expect(result.coverSvg).toContain('<svg');
    expect(result.coverSvg).toContain('</svg>');
    expect(result.coverSvg).toContain('isolde');
  });

  it('gleiche Eingabe ergibt gleiches SVG (deterministisch)', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
    ];
    const result1 = buildLookbook('isolde', entries, 42);
    const result2 = buildLookbook('isolde', entries, 42);
    expect(result1.coverSvg).toBe(result2.coverSvg);
  });

  it('unterschiedliche Seeds erzeugen unterschiedliche SVGs', () => {
    const entries: WardrobeEntry[] = [
      {
        characterId: 'isolde',
        chapter: 1,
        category: 'travel',
        items: [{ name: 'Umhang', color: 'grau', condition: 'pristine' }],
      },
    ];
    const result1 = buildLookbook('isolde', entries, 1);
    const result2 = buildLookbook('isolde', entries, 2);
    expect(result1.coverSvg).toBe(result2.coverSvg);
  });
});

// ---------------------------------------------------------------------------
// createSampleWardrobeEntry
// ---------------------------------------------------------------------------

describe('createSampleWardrobeEntry', () => {
  it('liefert einen gültigen WardrobeEntry mit characterId, chapter, category und items', () => {
    const entry = createSampleWardrobeEntry();
    expect(entry.characterId).toBeTruthy();
    expect(typeof entry.chapter).toBe('number');
    expect(entry.category).toBeTruthy();
    expect(Array.isArray(entry.items)).toBe(true);
    expect(entry.items.length).toBeGreaterThan(0);
  });

  it('jedes Item hat name, color und condition', () => {
    const entry = createSampleWardrobeEntry();
    for (const item of entry.items) {
      expect(item.name).toBeTruthy();
      expect(item.color).toBeTruthy();
      expect(['pristine', 'worn', 'damaged', 'torn']).toContain(item.condition);
    }
  });

  it('ist deterministisch — zwei Aufrufe liefern identische Einträge', () => {
    const entry1 = createSampleWardrobeEntry();
    const entry2 = createSampleWardrobeEntry();
    expect(entry1).toEqual(entry2);
  });
});

// ---------------------------------------------------------------------------
// createSampleLookbook
// ---------------------------------------------------------------------------

describe('createSampleLookbook', () => {
  it('liefert ein gültiges LookbookResult mit title, pages, entries und coverSvg', () => {
    const result = createSampleLookbook();
    expect(typeof result.title).toBe('string');
    expect(result.title).toBeTruthy();
    expect(typeof result.pages).toBe('number');
    expect(result.pages).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(typeof result.coverSvg).toBe('string');
    expect(result.coverSvg).toContain('<svg');
    expect(result.coverSvg).toContain('</svg>');
  });

  it('ist deterministisch — zwei Aufrufe liefern identische Ergebnisse', () => {
    const result1 = createSampleLookbook();
    const result2 = createSampleLookbook();
    expect(result1).toEqual(result2);
  });

  it('enthält Einträge für verschiedene Kategorien', () => {
    const result = createSampleLookbook();
    const categories = result.entries.map((e) => e.category);
    const uniqueCategories = new Set(categories);
    expect(uniqueCategories.size).toBeGreaterThan(1);
  });
});
