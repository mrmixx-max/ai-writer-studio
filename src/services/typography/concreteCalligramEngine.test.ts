// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  SHAPE_MASKS,
  layoutTextOnPath,
  exportCalligramSVG,
  createSampleShapeMask,
  createSampleCalligram,
} from './concreteCalligramEngine';

describe('hashString', () => {
  it('ist deterministisch für denselben Input', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('liefert unterschiedliche Hashes für unterschiedliche Strings', () => {
    expect(hashString('alpha')).not.toBe(hashString('beta'));
    expect(hashString('hello')).not.toBe(hashString('world'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('liefert einen nicht-negativen Integer zurück', () => {
    const result = hashString('anything');
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('verarbeitet leeren String ohne Fehler', () => {
    expect(() => hashString('')).not.toThrow();
    expect(Number.isInteger(hashString(''))).toBe(true);
  });
});

describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('erzeugt unterschiedliche Werte bei unterschiedlichen Seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const values1 = Array.from({ length: 5 }, () => rng1());
    const values2 = Array.from({ length: 5 }, () => rng2());
    expect(values1).not.toEqual(values2);
  });
});

describe('SHAPE_MASKS', () => {
  it('enthält genau 5 Formen', () => {
    expect(SHAPE_MASKS).toHaveLength(5);
  });

  it('enthält die Formen hourglass, spiral, keyhole, prison, teardrop', () => {
    const ids = SHAPE_MASKS.map((s) => s.id);
    expect(ids).toContain('hourglass');
    expect(ids).toContain('spiral');
    expect(ids).toContain('keyhole');
    expect(ids).toContain('prison');
    expect(ids).toContain('teardrop');
  });

  it('jede Form besitzt id, name, description, pathData und viewBox', () => {
    for (const mask of SHAPE_MASKS) {
      expect(mask.id).toBeTruthy();
      expect(mask.name).toBeTruthy();
      expect(mask.description).toBeTruthy();
      expect(mask.pathData).toBeTruthy();
      expect(mask.viewBox).toBeTruthy();
    }
  });

  it('alle viewBox sind "0 0 100 100"', () => {
    for (const mask of SHAPE_MASKS) {
      expect(mask.viewBox).toBe('0 0 100 100');
    }
  });

  it('alle IDs sind eindeutig', () => {
    const ids = SHAPE_MASKS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(SHAPE_MASKS.length);
  });
});

describe('layoutTextOnPath', () => {
  const sampleText = 'Die Zeit rinnt';
  const sampleShape = 'hourglass';
  const sampleSeed = 42;

  it('liefert einen SVG-String', () => {
    const result = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(typeof result.svg).toBe('string');
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('</svg>');
  });

  it('liefert textPath mit dem eingegebenen Text', () => {
    const result = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(result.textPath).toBe(sampleText);
  });

  it('liefert den viewBox der Formenmaske', () => {
    const result = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(result.viewBox).toBe('0 0 100 100');
  });

  it('liefert die korrekte charCount', () => {
    const result = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(result.charCount).toBe(sampleText.length);
  });

  it('ist deterministisch für gleiche Parameter', () => {
    const result1 = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    const result2 = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(result1.svg).toBe(result2.svg);
    expect(result1.textPath).toBe(result2.textPath);
    expect(result1.viewBox).toBe(result2.viewBox);
    expect(result1.charCount).toBe(result2.charCount);
  });

  it('erzeugt unterschiedliche SVGs für unterschiedliche Texte', () => {
    const result1 = layoutTextOnPath('Alpha', sampleShape, sampleSeed);
    const result2 = layoutTextOnPath('Beta', sampleShape, sampleSeed);
    expect(result1.svg).not.toBe(result2.svg);
  });

  it('erzeugt unterschiedliche SVGs für unterschiedliche Seeds', () => {
    const result1 = layoutTextOnPath(sampleText, sampleShape, 1);
    const result2 = layoutTextOnPath(sampleText, sampleShape, 2);
    expect(result1.svg).not.toBe(result2.svg);
  });

  it('verarbeitet leeren Text ohne Fehler', () => {
    const result = layoutTextOnPath('', sampleShape, sampleSeed);
    expect(() => result).not.toThrow();
    expect(result.svg).toContain('<svg');
  });

  it('enthält textPath-Elemente im SVG', () => {
    const result = layoutTextOnPath(sampleText, sampleShape, sampleSeed);
    expect(result.svg).toContain('<textPath');
    expect(result.svg).toContain('</textPath>');
  });
});

describe('exportCalligramSVG', () => {
  const sampleText = 'Gedanken fließen';
  const sampleShape = 'spiral';
  const sampleSeed = 99;

  it('liefert einen SVG-String', () => {
    const result = exportCalligramSVG(sampleText, sampleShape, sampleSeed);
    expect(typeof result.svg).toBe('string');
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('</svg>');
  });

  it('liefert width und height von 1200', () => {
    const result = exportCalligramSVG(sampleText, sampleShape, sampleSeed);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(1200);
  });

  it('liefert dpi von 300', () => {
    const result = exportCalligramSVG(sampleText, sampleShape, sampleSeed);
    expect(result.dpi).toBe(300);
  });

  it('ist deterministisch für gleiche Parameter', () => {
    const result1 = exportCalligramSVG(sampleText, sampleShape, sampleSeed);
    const result2 = exportCalligramSVG(sampleText, sampleShape, sampleSeed);
    expect(result1.svg).toBe(result2.svg);
    expect(result1.width).toBe(result2.width);
    expect(result1.height).toBe(result2.height);
    expect(result1.dpi).toBe(result2.dpi);
  });

  it('erzeugt unterschiedliche SVGs für unterschiedliche Texte', () => {
    const result1 = exportCalligramSVG('Alpha', sampleShape, sampleSeed);
    const result2 = exportCalligramSVG('Beta', sampleShape, sampleSeed);
    expect(result1.svg).not.toBe(result2.svg);
  });

  it('erzeugt unterschiedliche SVGs für unterschiedliche Seeds', () => {
    const result1 = exportCalligramSVG(sampleText, sampleShape, 1);
    const result2 = exportCalligramSVG(sampleText, sampleShape, 2);
    expect(result1.svg).not.toBe(result2.svg);
  });
});

describe('createSampleShapeMask', () => {
  it('liefert eine gültige Formenmaske zurück', () => {
    const mask = createSampleShapeMask();
    expect(mask).toBeDefined();
    expect(typeof mask.id).toBe('string');
    expect(typeof mask.name).toBe('string');
    expect(typeof mask.description).toBe('string');
    expect(typeof mask.pathData).toBe('string');
    expect(typeof mask.viewBox).toBe('string');
  });

  it('entspricht der hourglass-Form', () => {
    const mask = createSampleShapeMask();
    expect(mask.id).toBe('hourglass');
  });

  it('ist identisch mit SHAPE_MASKS-Eintrag für hourglass', () => {
    const mask = createSampleShapeMask();
    const reference = SHAPE_MASKS.find((s) => s.id === 'hourglass');
    expect(mask).toEqual(reference);
  });
});

describe('createSampleCalligram', () => {
  it('liefert ein gültiges PathLayoutResult zurück', () => {
    const result = createSampleCalligram();
    expect(result).toBeDefined();
    expect(typeof result.svg).toBe('string');
    expect(typeof result.textPath).toBe('string');
    expect(typeof result.viewBox).toBe('string');
    expect(typeof result.charCount).toBe('number');
  });

  it('enthält ein gültiges SVG-Markup', () => {
    const result = createSampleCalligram();
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('</svg>');
  });

  it('verwendet die hourglass-Form', () => {
    const result = createSampleCalligram();
    expect(result.viewBox).toBe('0 0 100 100');
    // Die hourglass-pathData muss im SVG enthalten sein
    const hourglassMask = SHAPE_MASKS.find((s) => s.id === 'hourglass');
    expect(result.svg).toContain(hourglassMask!.pathData);
  });

  it('ist deterministisch', () => {
    const result1 = createSampleCalligram();
    const result2 = createSampleCalligram();
    expect(result1.svg).toBe(result2.svg);
    expect(result1.textPath).toBe(result2.textPath);
    expect(result1.charCount).toBe(result2.charCount);
  });
});
