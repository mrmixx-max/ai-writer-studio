// @vitest-environment jsdom
/**
 * Tests: Dialekt-Isoglossen- & Akzent-Weber (WP 133.1)
 * Meilenstein 64.0 / v7.6.0
 *
 * Deckt ab: hashString, createSeededRandom, DIALECT_REGIONS, ISOGLOSSES,
 * mapDialectRegion, modulateDialogue, generateRegionalMetaphor sowie die
 * beiden Sample-Fabriken.
 */

import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  DIALECT_REGIONS,
  ISOGLOSSES,
  mapDialectRegion,
  modulateDialogue,
  generateRegionalMetaphor,
  createSampleRegion,
  createSampleModulation,
  type DialectRegionId,
  type DialogueLine,
} from './dialectIsoglossWeaver';

const REGION_IDS: DialectRegionId[] = ['north', 'south', 'mountain', 'harbor'];
const FNV_OFFSET_BASIS = 0x811c9dc5; // 2166136261
const UINT32_MAX = 0xffffffff; // 4294967295

// ─────────────────────────────────────────────────────────────────────────────
// hashString
// ─────────────────────────────────────────────────────────────────────────────

describe('hashString – Determinismus', () => {
  it('liefert für die gleiche Eingabe den gleichen Wert', () => {
    expect(hashString('hallo')).toBe(hashString('hallo'));
  });

  it('bleibt über viele wiederholte Aufrufe stabil', () => {
    const first = hashString('Nordregion');
    for (let i = 0; i < 50; i++) {
      expect(hashString('Nordregion')).toBe(first);
    }
  });

  it('ist deterministisch für einen langen Text', () => {
    const text = 'Ein langer Text mit Umlauten äöü und Sonderzeichen!?';
    expect(hashString(text)).toBe(hashString(text));
  });

  it('liefert konsistente Werte bei getrennten Instanzen', () => {
    const a = hashString('seed:region:north:42');
    const b = hashString('seed:region:north:42');
    expect(a).toBe(b);
  });
});

describe('hashString – 32-Bit und Typ', () => {
  it('gibt eine Zahl zurück', () => {
    expect(typeof hashString('test')).toBe('number');
  });

  it('gibt eine Ganzzahl zurück', () => {
    expect(Number.isInteger(hashString('test'))).toBe(true);
  });

  it('liegt im 32-Bit-unsigned-Bereich', () => {
    const values = ['', 'a', 'abc', 'Die Deern schnackt lütt', 'äöü', '🎭'];
    for (const value of values) {
      const h = hashString(value);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(UINT32_MAX);
    }
  });

  it('ist niemals negativ', () => {
    for (const value of ['x', 'yy', 'zzz', 'Ω', '漢字']) {
      expect(hashString(value)).toBeGreaterThanOrEqual(0);
    }
  });

  it('überschreitet nie UINT32_MAX', () => {
    for (let i = 0; i < 200; i++) {
      expect(hashString('prefix-' + i)).toBeLessThanOrEqual(UINT32_MAX);
    }
  });
});

describe('hashString – Sonderfälle und Unikat', () => {
  it('leerer String ergibt die FNV-Offset-Basis', () => {
    expect(hashString('')).toBe(FNV_OFFSET_BASIS);
  });

  it('verschiedene Eingaben ergeben verschiedene Werte', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('north')).not.toBe(hashString('south'));
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    expect(hashString('Moin')).not.toBe(hashString('moin'));
  });

  it('verarbeitet Umlaute', () => {
    expect(hashString('ä')).toBe(hashString('ä'));
    expect(hashString('ä')).not.toBe(hashString('a'));
  });

  it('verarbeitet ß anders als ss', () => {
    expect(hashString('Straße')).not.toBe(hashString('Strasse'));
  });

  it('verarbeitet Unicode außerhalb der BMP', () => {
    expect(hashString('🎭')).toBe(hashString('🎭'));
    expect(hashString('🎭')).not.toBe(hashString('🎬'));
  });

  it('ein einzelnes Zeichen unterscheidet sich vom leeren String', () => {
    expect(hashString('a')).not.toBe(hashString(''));
  });

  it('Anhängen eines Zeichens ändert den Hash', () => {
    expect(hashString('abc')).not.toBe(hashString('abcd'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSeededRandom
// ─────────────────────────────────────────────────────────────────────────────

describe('createSeededRandom – Funktion und Determinismus', () => {
  it('gibt eine Funktion zurück', () => {
    expect(typeof createSeededRandom(1)).toBe('function');
  });

  it('gleicher Seed erzeugt den gleichen ersten Wert', () => {
    expect(createSeededRandom(123)()).toBe(createSeededRandom(123)());
  });

  it('gleicher Seed erzeugt über 50 Ziehungen die gleiche Sequenz', () => {
    const a = createSeededRandom(999);
    const b = createSeededRandom(999);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('gleicher Seed erzeugt über 500 Ziehungen die gleiche Sequenz', () => {
    const a = createSeededRandom(4242);
    const b = createSeededRandom(4242);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 500; i++) {
      seqA.push(a());
      seqB.push(b());
    }
    expect(seqA).toEqual(seqB);
  });

  it('unterschiedliche Seeds erzeugen unterschiedliche Sequenzen', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('Seed 0 funktioniert und ist deterministisch', () => {
    expect(createSeededRandom(0)()).toBe(createSeededRandom(0)());
  });

  it('negative Seeds werden deterministisch behandelt', () => {
    expect(createSeededRandom(-5)()).toBe(createSeededRandom(-5)());
  });

  it('große Seeds werden deterministisch behandelt', () => {
    expect(createSeededRandom(UINT32_MAX)()).toBe(createSeededRandom(UINT32_MAX)());
  });
});

describe('createSeededRandom – Wertebereich [0,1)', () => {
  it('alle 500 Ziehungen liegen in [0,1)', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('kein Wert ist kleiner als 0', () => {
    const rng = createSeededRandom(31);
    for (let i = 0; i < 500; i++) {
      expect(rng()).toBeGreaterThanOrEqual(0);
    }
  });

  it('kein Wert erreicht oder überschreitet 1', () => {
    const rng = createSeededRandom(77);
    for (let i = 0; i < 500; i++) {
      expect(rng()).toBeLessThan(1);
    }
  });

  it('erzeugt keine NaN-Werte', () => {
    const rng = createSeededRandom(11);
    for (let i = 0; i < 500; i++) {
      expect(Number.isNaN(rng())).toBe(false);
    }
  });

  it('erzeugt keine Infinity-Werte', () => {
    const rng = createSeededRandom(13);
    for (let i = 0; i < 500; i++) {
      expect(Number.isFinite(rng())).toBe(true);
    }
  });

  it('die Sequenz ist nicht konstant', () => {
    const rng = createSeededRandom(5);
    const first = rng();
    let varied = false;
    for (let i = 0; i < 20; i++) {
      if (rng() !== first) {
        varied = true;
        break;
      }
    }
    expect(varied).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DIALECT_REGIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('DIALECT_REGIONS – Struktur', () => {
  it('enthält genau 4 Einträge', () => {
    expect(DIALECT_REGIONS).toHaveLength(4);
  });

  it('enthält die erwarteten IDs in Reihenfolge', () => {
    expect(DIALECT_REGIONS.map((r) => r.id)).toEqual(['north', 'south', 'mountain', 'harbor']);
  });

  it('alle IDs sind eindeutig', () => {
    const ids = DIALECT_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede ID gehört zu den vier kanonischen IDs', () => {
    for (const region of DIALECT_REGIONS) {
      expect(REGION_IDS).toContain(region.id);
    }
  });
});

describe('DIALECT_REGIONS – Name und Beschreibung', () => {
  it('jede Region hat einen nicht-leeren Namen', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('jede Region hat eine nicht-leere Beschreibung', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('Nordregion heißt „Nordregion“', () => {
    expect(DIALECT_REGIONS[0].name).toBe('Nordregion');
  });

  it('Südregion heißt „Südregion“', () => {
    expect(DIALECT_REGIONS[1].name).toBe('Südregion');
  });

  it('Bergregion heißt „Bergregion“', () => {
    expect(DIALECT_REGIONS[2].name).toBe('Bergregion');
  });

  it('Hafenregion heißt „Hafenregion“', () => {
    expect(DIALECT_REGIONS[3].name).toBe('Hafenregion');
  });
});

describe('DIALECT_REGIONS – Vokabular', () => {
  it('jede Region hat ein nicht-leeres Vokabular', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.vocabulary.length).toBeGreaterThan(0);
    }
  });

  it('jedes Vokabelpaar hat ein nicht-leeres „standard“', () => {
    for (const region of DIALECT_REGIONS) {
      for (const pair of region.vocabulary) {
        expect(pair.standard.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('jedes Vokabelpaar hat ein nicht-leeres „local“', () => {
    for (const region of DIALECT_REGIONS) {
      for (const pair of region.vocabulary) {
        expect(pair.local.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('jedes Vokabelpaar unterscheidet standard und local', () => {
    for (const region of DIALECT_REGIONS) {
      for (const pair of region.vocabulary) {
        expect(pair.standard).not.toBe(pair.local);
      }
    }
  });

  it('jede Region kennt eine Entsprechung für „sprechen“', () => {
    for (const region of DIALECT_REGIONS) {
      const has = region.vocabulary.some((p) => p.standard === 'sprechen');
      expect(has).toBe(true);
    }
  });

  it('Nordregion kennt „schnacken“', () => {
    const pair = DIALECT_REGIONS[0].vocabulary.find((p) => p.standard === 'sprechen');
    expect(pair?.local).toBe('schnacken');
  });

  it('Hafenregion kennt „Maloche“ für Arbeit', () => {
    const pair = DIALECT_REGIONS[3].vocabulary.find((p) => p.standard === 'Arbeit');
    expect(pair?.local).toBe('Maloche');
  });
});

describe('DIALECT_REGIONS – Satzmuster und Metaphern', () => {
  it('jede Region hat nicht-leere Satzmuster', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.sentencePatterns.length).toBeGreaterThan(0);
    }
  });

  it('jedes Satzmuster ist ein nicht-leerer String', () => {
    for (const region of DIALECT_REGIONS) {
      for (const pattern of region.sentencePatterns) {
        expect(typeof pattern).toBe('string');
        expect(pattern.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('jede Region hat nicht-leere Metaphern', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.metaphors.length).toBeGreaterThan(0);
    }
  });

  it('jede Region hat mindestens 3 Metaphern', () => {
    for (const region of DIALECT_REGIONS) {
      expect(region.metaphors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('jede Metapher ist ein nicht-leerer String', () => {
    for (const region of DIALECT_REGIONS) {
      for (const metaphor of region.metaphors) {
        expect(typeof metaphor).toBe('string');
        expect(metaphor.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISOGLOSSES
// ─────────────────────────────────────────────────────────────────────────────

describe('ISOGLOSSES – Struktur', () => {
  it('enthält mindestens 4 Einträge', () => {
    expect(ISOGLOSSES.length).toBeGreaterThanOrEqual(4);
  });

  it('jede Isoglosse hat eine nicht-leere ID', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.id.trim().length).toBeGreaterThan(0);
    }
  });

  it('jede Isoglosse hat einen nicht-leeren Namen', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('jede Isoglosse hat eine nicht-leere Beschreibung', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('jede Isoglosse hat ein nicht-leeres regions-Array', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.regions.length).toBeGreaterThan(0);
    }
  });

  it('jede Isoglosse hat einen nicht-leeren Marker', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.marker.trim().length).toBeGreaterThan(0);
    }
  });

  it('alle Isoglossen-IDs sind eindeutig', () => {
    const ids = ISOGLOSSES.map((iso) => iso.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede Isoglosse berührt mindestens 2 Regionen', () => {
    for (const iso of ISOGLOSSES) {
      expect(iso.regions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('alle referenzierten Regionen sind gültige IDs', () => {
    for (const iso of ISOGLOSSES) {
      for (const region of iso.regions) {
        expect(REGION_IDS).toContain(region as DialectRegionId);
      }
    }
  });

  it('enthält die Brötchen-Semmel-Linie', () => {
    const iso = ISOGLOSSES.find((i) => i.id === 'iso-broetchen-semmel');
    expect(iso).toBeDefined();
    expect(iso?.name).toBe('Brötchen-Semmel-Linie');
  });

  it('der Marker der ersten Isoglosse enthält das Trennzeichen ↔', () => {
    expect(ISOGLOSSES[0].marker).toContain('↔');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mapDialectRegion – je Region
// ─────────────────────────────────────────────────────────────────────────────

describe('mapDialectRegion – Echo je Region', () => {
  for (const id of REGION_IDS) {
    it(`gibt die Region „${id}“ unverändert zurück`, () => {
      expect(mapDialectRegion(id, 1).region).toBe(id);
    });
  }
});

describe('mapDialectRegion – nicht-leere Felder je Region', () => {
  for (const id of REGION_IDS) {
    it(`Vokabular für „${id}“ ist nicht leer`, () => {
      expect(mapDialectRegion(id, 7).vocabulary.length).toBeGreaterThan(0);
    });

    it(`Satzmuster für „${id}“ sind nicht leer`, () => {
      expect(mapDialectRegion(id, 7).patterns.length).toBeGreaterThan(0);
    });

    it(`Metaphern für „${id}“ sind nicht leer`, () => {
      expect(mapDialectRegion(id, 7).metaphors.length).toBeGreaterThan(0);
    });

    it(`Beschreibung für „${id}“ ist nicht leer`, () => {
      expect(mapDialectRegion(id, 7).description.trim().length).toBeGreaterThan(0);
    });
  }
});

describe('mapDialectRegion – Feldinhalt je Region', () => {
  for (const id of REGION_IDS) {
    const region = DIALECT_REGIONS.find((r) => r.id === id)!;

    it(`gibt die Satzmuster von „${id}“ vollständig zurück`, () => {
      expect(mapDialectRegion(id, 3).patterns).toEqual([...region.sentencePatterns]);
    });

    it(`gibt die Metaphern von „${id}“ vollständig zurück`, () => {
      expect(mapDialectRegion(id, 3).metaphors).toEqual([...region.metaphors]);
    });

    it(`gibt das Vokabular von „${id}“ vollständig zurück`, () => {
      const map = mapDialectRegion(id, 3);
      expect(map.vocabulary.length).toBe(region.vocabulary.length);
      expect(map.vocabulary[0]).toEqual({
        standard: region.vocabulary[0].standard,
        local: region.vocabulary[0].local,
      });
    });

    it(`die Beschreibung von „${id}“ enthält Leitmuster und Leitbild`, () => {
      const description = mapDialectRegion(id, 3).description;
      expect(description).toContain('Leitmuster');
      expect(description).toContain('Leitbild');
    });
  }
});

describe('mapDialectRegion – Fallback', () => {
  it('unbekannte Region fällt auf die Nordregion zurück', () => {
    expect(mapDialectRegion('unknown', 1).region).toBe('north');
  });

  it('leerer String fällt auf die Nordregion zurück', () => {
    expect(mapDialectRegion('', 1).region).toBe('north');
  });

  it('Großschreibung „NORTH“ fällt auf die Nordregion zurück', () => {
    expect(mapDialectRegion('NORTH', 1).region).toBe('north');
  });

  it('Fallback liefert nicht-leeres Vokabular', () => {
    expect(mapDialectRegion('nirgendwo', 1).vocabulary.length).toBeGreaterThan(0);
  });

  it('Fallback liefert nicht-leere Beschreibung', () => {
    expect(mapDialectRegion('nirgendwo', 1).description.trim().length).toBeGreaterThan(0);
  });
});

describe('mapDialectRegion – Determinismus und Kapselung', () => {
  it('gleicher Seed erzeugt das gleiche Ergebnis', () => {
    expect(mapDialectRegion('south', 42)).toEqual(mapDialectRegion('south', 42));
  });

  it('gleicher Seed erzeugt die gleiche Beschreibung', () => {
    expect(mapDialectRegion('harbor', 5).description).toBe(
      mapDialectRegion('harbor', 5).description,
    );
  });

  it('unterschiedliche Seeds sind für sich deterministisch', () => {
    const a1 = mapDialectRegion('mountain', 10).description;
    const a2 = mapDialectRegion('mountain', 10).description;
    const b1 = mapDialectRegion('mountain', 11).description;
    const b2 = mapDialectRegion('mountain', 11).description;
    expect(a1).toBe(a2);
    expect(b1).toBe(b2);
  });

  it('das zurückgegebene Vokabular ist eine Kopie (kein Alias)', () => {
    const before = DIALECT_REGIONS[0].vocabulary[0].standard;
    const map = mapDialectRegion('north', 1);
    map.vocabulary[0].standard = 'VERÄNDERT';
    const after = DIALECT_REGIONS[0].vocabulary[0].standard;
    expect(after).toBe(before);
  });

  it('das zurückgegebene patterns-Array ist eine Kopie', () => {
    const map = mapDialectRegion('south', 1);
    map.patterns.push('neu');
    expect(mapDialectRegion('south', 1).patterns).not.toContain('neu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// modulateDialogue
// ─────────────────────────────────────────────────────────────────────────────

const sampleLines: DialogueLine[] = [
  { speaker: 'Elara', text: 'Wir sprechen später über den Wind.', regionId: 'north' },
  { speaker: 'Thorne', text: 'Ich brauche Geld und die Arbeit ist schnell.', regionId: 'harbor' },
];

describe('modulateDialogue – Zeilenanzahl und Felder', () => {
  it('die Anzahl der Zeilen entspricht der Eingabe', () => {
    expect(modulateDialogue(sampleLines, 1).lines).toHaveLength(sampleLines.length);
  });

  it('jede Zeile hat einen speaker', () => {
    for (const line of modulateDialogue(sampleLines, 1).lines) {
      expect(typeof line.speaker).toBe('string');
      expect(line.speaker.length).toBeGreaterThan(0);
    }
  });

  it('jede Zeile hat ein original', () => {
    for (const line of modulateDialogue(sampleLines, 1).lines) {
      expect(typeof line.original).toBe('string');
    }
  });

  it('jede Zeile hat ein modulated', () => {
    for (const line of modulateDialogue(sampleLines, 1).lines) {
      expect(typeof line.modulated).toBe('string');
    }
  });

  it('jede Zeile hat eine region', () => {
    for (const line of modulateDialogue(sampleLines, 1).lines) {
      expect(REGION_IDS).toContain(line.region as DialectRegionId);
    }
  });

  it('jede Zeile hat ein changes-Array', () => {
    for (const line of modulateDialogue(sampleLines, 1).lines) {
      expect(Array.isArray(line.changes)).toBe(true);
    }
  });

  it('der speaker wird unverändert übernommen', () => {
    const result = modulateDialogue(sampleLines, 1);
    expect(result.lines[0].speaker).toBe('Elara');
    expect(result.lines[1].speaker).toBe('Thorne');
  });

  it('das original wird unverändert übernommen', () => {
    const result = modulateDialogue(sampleLines, 1);
    expect(result.lines[0].original).toBe(sampleLines[0].text);
    expect(result.lines[1].original).toBe(sampleLines[1].text);
  });

  it('die region wird je Zeile gespiegelt', () => {
    const result = modulateDialogue(sampleLines, 1);
    expect(result.lines[0].region).toBe('north');
    expect(result.lines[1].region).toBe('harbor');
  });
});

describe('modulateDialogue – Lesbarkeit und Beschreibung', () => {
  it('readabilityScore liegt zwischen 0 und 100', () => {
    const score = modulateDialogue(sampleLines, 1).readabilityScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('readabilityScore ist eine Ganzzahl', () => {
    expect(Number.isInteger(modulateDialogue(sampleLines, 1).readabilityScore)).toBe(true);
  });

  it('die Beschreibung ist nicht leer', () => {
    expect(modulateDialogue(sampleLines, 1).description.trim().length).toBeGreaterThan(0);
  });

  it('die Beschreibung nennt die Zeilenanzahl', () => {
    expect(modulateDialogue(sampleLines, 1).description).toContain('Zeile(n)');
  });

  it('die Beschreibung nennt die Lesbarkeit', () => {
    expect(modulateDialogue(sampleLines, 1).description).toContain('Lesbarkeit');
  });

  it('der Score bleibt für viele Seeds im gültigen Bereich', () => {
    for (let seed = 0; seed < 30; seed++) {
      const score = modulateDialogue(sampleLines, seed).readabilityScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe('modulateDialogue – Sonderfälle', () => {
  it('leeres Array ergibt leere lines', () => {
    expect(modulateDialogue([], 1).lines).toEqual([]);
  });

  it('leeres Array ergibt Lesbarkeit 100', () => {
    expect(modulateDialogue([], 1).readabilityScore).toBe(100);
  });

  it('leeres Array liefert trotzdem eine Beschreibung', () => {
    expect(modulateDialogue([], 1).description.trim().length).toBeGreaterThan(0);
  });

  it('leerer Text bleibt unverändert', () => {
    const result = modulateDialogue([{ speaker: 'A', text: '', regionId: 'north' }], 1);
    expect(result.lines[0].modulated).toBe('');
    expect(result.lines[0].original).toBe('');
  });

  it('leerer Text erzeugt keine Änderungen', () => {
    const result = modulateDialogue([{ speaker: 'A', text: '', regionId: 'north' }], 1);
    expect(result.lines[0].changes).toEqual([]);
  });

  it('nur Leerzeichen wird wie leerer Text behandelt', () => {
    const result = modulateDialogue([{ speaker: 'A', text: '   ', regionId: 'south' }], 1);
    expect(result.lines[0].modulated).toBe('   ');
    expect(result.lines[0].changes).toEqual([]);
  });

  it('unbekannte Region fällt auf die Nordregion zurück', () => {
    const result = modulateDialogue([{ speaker: 'A', text: 'Hallo.', regionId: 'xyz' }], 1);
    expect(result.lines[0].region).toBe('north');
  });

  it('nicht-Array-Eingabe wird als leer behandelt', () => {
    const result = modulateDialogue(null as unknown as DialogueLine[], 1);
    expect(result.lines).toEqual([]);
  });
});

describe('modulateDialogue – Vokabelaustausch', () => {
  it('ersetzt „sprechen“ durch „schnacken“ im Norden', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Wir sprechen jetzt.', regionId: 'north' }],
      1,
    );
    expect(result.lines[0].modulated).toContain('schnacken');
  });

  it('protokolliert den Vokabeltausch als Änderung', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Wir sprechen jetzt.', regionId: 'north' }],
      1,
    );
    expect(result.lines[0].changes.some((c) => c.includes('Vokabel'))).toBe(true);
  });

  it('ersetzt „Geld“ durch „Kies“ im Hafen', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Ich brauche Geld.', regionId: 'harbor' }],
      1,
    );
    expect(result.lines[0].modulated).toContain('Kies');
  });

  it('ersetzt „Arbeit“ durch „Maloche“ im Hafen', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Die Arbeit wartet.', regionId: 'harbor' }],
      1,
    );
    expect(result.lines[0].modulated).toContain('Maloche');
  });

  it('großgeschriebenes „Sprechen“ wird zu „schnacken“ (Schreibweise je nach Auftakt)', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Sprechen wir darüber.', regionId: 'north' }],
      1,
    );
    expect(result.lines[0].modulated.toLowerCase()).toContain('schnacken');
  });

  it('Vokabel mitten im Satz bleibt kleingeschrieben', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Wir sprechen darüber.', regionId: 'north' }],
      1,
    );
    expect(result.lines[0].modulated).toContain('schnacken');
  });

  it('nicht modulierte Zeile bleibt inhaltlich erhalten (Auftakt/Partikel)', () => {
    const result = modulateDialogue(
      [{ speaker: 'A', text: 'Der Wind steht gut.', regionId: 'south' }],
      1,
    );
    expect(result.lines[0].modulated.length).toBeGreaterThan(0);
    expect(result.lines[0].changes.length).toBeGreaterThan(0);
  });
});

describe('modulateDialogue – Determinismus', () => {
  it('gleicher Seed erzeugt das gleiche Ergebnis', () => {
    expect(modulateDialogue(sampleLines, 42)).toEqual(modulateDialogue(sampleLines, 42));
  });

  it('gleicher Seed erzeugt die gleiche Lesbarkeit', () => {
    expect(modulateDialogue(sampleLines, 3).readabilityScore).toBe(
      modulateDialogue(sampleLines, 3).readabilityScore,
    );
  });

  it('gleicher Seed erzeugt die gleiche Beschreibung', () => {
    expect(modulateDialogue(sampleLines, 8).description).toBe(
      modulateDialogue(sampleLines, 8).description,
    );
  });

  it('über 20 Seeds bleibt jede Modulation für sich stabil', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(modulateDialogue(sampleLines, seed)).toEqual(modulateDialogue(sampleLines, seed));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateRegionalMetaphor – je Region
// ─────────────────────────────────────────────────────────────────────────────

describe('generateRegionalMetaphor – Echo je Region', () => {
  for (const id of REGION_IDS) {
    it(`gibt die Region „${id}“ zurück`, () => {
      expect(generateRegionalMetaphor(id, 'die Liebe', 1).region).toBe(id);
    });

    it(`gibt das Konzept für „${id}“ zurück`, () => {
      expect(generateRegionalMetaphor(id, 'die Liebe', 1).concept).toBe('die Liebe');
    });
  }
});

describe('generateRegionalMetaphor – nicht-leere Felder je Region', () => {
  for (const id of REGION_IDS) {
    it(`Metapher für „${id}“ ist nicht leer`, () => {
      expect(generateRegionalMetaphor(id, 'der Sturm', 1).metaphor.trim().length).toBeGreaterThan(0);
    });

    it(`Erläuterung für „${id}“ ist nicht leer`, () => {
      expect(
        generateRegionalMetaphor(id, 'der Sturm', 1).explanation.trim().length,
      ).toBeGreaterThan(0);
    });

    it(`die Metapher von „${id}“ enthält das Konzept`, () => {
      expect(generateRegionalMetaphor(id, 'der Sturm', 1).metaphor).toContain('der Sturm');
    });

    it(`die Erläuterung von „${id}“ nennt den Regionsnamen`, () => {
      const region = DIALECT_REGIONS.find((r) => r.id === id)!;
      expect(generateRegionalMetaphor(id, 'der Sturm', 1).explanation).toContain(region.name);
    });
  }
});

describe('generateRegionalMetaphor – Sonderfälle', () => {
  it('leeres Konzept fällt auf „der Augenblick“ zurück', () => {
    expect(generateRegionalMetaphor('north', '', 1).concept).toBe('der Augenblick');
  });

  it('nur-Leerzeichen-Konzept fällt auf „der Augenblick“ zurück', () => {
    expect(generateRegionalMetaphor('north', '   ', 1).concept).toBe('der Augenblick');
  });

  it('nicht-string-Konzept fällt auf „der Augenblick“ zurück', () => {
    expect(
      generateRegionalMetaphor('north', null as unknown as string, 1).concept,
    ).toBe('der Augenblick');
  });

  it('unbekannte Region fällt auf „north“ zurück', () => {
    expect(generateRegionalMetaphor('nirgendwo', 'das Glück', 1).region).toBe('north');
  });

  it('Umlaute im Konzept werden erhalten', () => {
    expect(generateRegionalMetaphor('south', 'die Mühsal', 1).concept).toBe('die Mühsal');
  });

  it('Umlaut-Konzept taucht in der Metapher auf', () => {
    expect(generateRegionalMetaphor('south', 'die Mühsal', 1).metaphor).toContain('die Mühsal');
  });

  it('Konzept wird getrimmt', () => {
    expect(generateRegionalMetaphor('north', '  das Glück  ', 1).concept).toBe('das Glück');
  });
});

describe('generateRegionalMetaphor – Determinismus', () => {
  it('gleicher Seed erzeugt das gleiche Ergebnis', () => {
    expect(generateRegionalMetaphor('mountain', 'die Angst', 9)).toEqual(
      generateRegionalMetaphor('mountain', 'die Angst', 9),
    );
  });

  it('gleicher Seed erzeugt die gleiche Metapher', () => {
    expect(generateRegionalMetaphor('harbor', 'die Ruhe', 4).metaphor).toBe(
      generateRegionalMetaphor('harbor', 'die Ruhe', 4).metaphor,
    );
  });

  it('unterschiedliche Konzepte erzeugen unterschiedliche Metaphern', () => {
    expect(generateRegionalMetaphor('north', 'die Liebe', 1).metaphor).not.toBe(
      generateRegionalMetaphor('north', 'der Tod', 1).metaphor,
    );
  });

  it('über 20 Seeds bleibt jede Metapher stabil', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(generateRegionalMetaphor('south', 'das Heimweh', seed)).toEqual(
        generateRegionalMetaphor('south', 'das Heimweh', seed),
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSampleRegion
// ─────────────────────────────────────────────────────────────────────────────

describe('createSampleRegion', () => {
  it('liefert die ID „north“', () => {
    expect(createSampleRegion().id).toBe('north');
  });

  it('hat einen nicht-leeren Namen', () => {
    expect(createSampleRegion().name.trim().length).toBeGreaterThan(0);
  });

  it('hat eine nicht-leere Beschreibung', () => {
    expect(createSampleRegion().description.trim().length).toBeGreaterThan(0);
  });

  it('hat ein nicht-leeres Vokabular', () => {
    expect(createSampleRegion().vocabulary.length).toBeGreaterThan(0);
  });

  it('hat nicht-leere Satzmuster', () => {
    expect(createSampleRegion().sentencePatterns.length).toBeGreaterThan(0);
  });

  it('hat nicht-leere Metaphern', () => {
    expect(createSampleRegion().metaphors.length).toBeGreaterThan(0);
  });

  it('entspricht der Nordregion aus DIALECT_REGIONS', () => {
    const sample = createSampleRegion();
    const north = DIALECT_REGIONS[0];
    expect(sample.name).toBe(north.name);
    expect(sample.description).toBe(north.description);
    expect(sample.vocabulary.length).toBe(north.vocabulary.length);
  });

  it('das Vokabular ist eine Kopie (kein Alias)', () => {
    const sample = createSampleRegion();
    sample.vocabulary[0].local = 'VERÄNDERT';
    expect(createSampleRegion().vocabulary[0].local).not.toBe('VERÄNDERT');
  });

  it('ist deterministisch', () => {
    expect(createSampleRegion()).toEqual(createSampleRegion());
  });

  it('alle Vokabelpaare haben standard und local', () => {
    for (const pair of createSampleRegion().vocabulary) {
      expect(pair.standard.length).toBeGreaterThan(0);
      expect(pair.local.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSampleModulation
// ─────────────────────────────────────────────────────────────────────────────

describe('createSampleModulation', () => {
  it('enthält genau 2 Zeilen', () => {
    expect(createSampleModulation().lines).toHaveLength(2);
  });

  it('die erste Zeile gehört zur Nordregion', () => {
    expect(createSampleModulation().lines[0].region).toBe('north');
  });

  it('die zweite Zeile gehört zur Hafenregion', () => {
    expect(createSampleModulation().lines[1].region).toBe('harbor');
  });

  it('die Sprecher sind Elara und Thorne', () => {
    const result = createSampleModulation();
    expect(result.lines[0].speaker).toBe('Elara');
    expect(result.lines[1].speaker).toBe('Thorne');
  });

  it('readabilityScore liegt zwischen 0 und 100', () => {
    const score = createSampleModulation().readabilityScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('die Beschreibung ist nicht leer', () => {
    expect(createSampleModulation().description.trim().length).toBeGreaterThan(0);
  });

  it('jede Zeile hat original und modulated', () => {
    for (const line of createSampleModulation().lines) {
      expect(typeof line.original).toBe('string');
      expect(typeof line.modulated).toBe('string');
    }
  });

  it('jede Zeile hat ein changes-Array', () => {
    for (const line of createSampleModulation().lines) {
      expect(Array.isArray(line.changes)).toBe(true);
    }
  });

  it('ist deterministisch', () => {
    expect(createSampleModulation()).toEqual(createSampleModulation());
  });

  it('moduliert die Hafen-Vokabel „Geld“ zu „Kies“', () => {
    const harborLine = createSampleModulation().lines[1];
    expect(harborLine.modulated).toContain('Kies');
  });

  it('moduliert die Nord-Vokabel „sprechen“ zu „schnacken“', () => {
    const northLine = createSampleModulation().lines[0];
    expect(northLine.modulated).toContain('schnacken');
  });

  it('entspricht modulateDialogue der Beispieldaten mit Seed 42', () => {
    const lines: DialogueLine[] = [
      { speaker: 'Elara', text: 'Der Wind steht gut. Wir sprechen später.', regionId: 'north' },
      {
        speaker: 'Thorne',
        text: 'Ich brauche Geld, und die Arbeit wird schnell gehen.',
        regionId: 'harbor',
      },
    ];
    expect(createSampleModulation()).toEqual(modulateDialogue(lines, 42));
  });
});
