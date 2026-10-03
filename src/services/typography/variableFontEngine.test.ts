/**
 * Tests: Variable-Font-Engine-Service (WP 34.1)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOpticalSizing,
  generateDropCap,
  harmonizeLineHeight,
  type DropCapStyle,
} from './variableFontEngine';

describe('calculateOpticalSizing', () => {
  it('berechnet optische Achsen für 12pt', () => {
    const result = calculateOpticalSizing(12);
    expect(result.opsz).toBe(12);
    expect(result.wght).toBe(400);
  });

  it('kleine Schrift bekommt mehr Gewicht', () => {
    const small = calculateOpticalSizing(8);
    const large = calculateOpticalSizing(32);
    expect(small.wght).toBeGreaterThan(large.wght);
  });

  it('null/undefined ergibt Defaults', () => {
    const result = calculateOpticalSizing(0);
    expect(result.opsz).toBe(12);
  });

  it('negative Werte werden zu Minimum', () => {
    const result = calculateOpticalSizing(-10);
    expect(result.opsz).toBe(6);
  });

  it('wdth wird berechnet', () => {
    const result = calculateOpticalSizing(16);
    expect(result.wdth).toBe(100);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(calculateOpticalSizing(NaN).opsz).toBe(12);
  });
});

describe('generateDropCap', () => {
  it('leeres Text ergibt leeres Ergebnis', () => {
    const result = generateDropCap('', 'modern');
    expect(result.letter).toBe('');
  });

  it('null/undefined ergibt leeres Ergebnis', () => {
    expect(generateDropCap(null as unknown as string, 'modern').letter).toBe('');
    expect(generateDropCap(undefined as unknown as string, 'modern').letter).toBe('');
  });

  it('ersten Buchstaben wird großgeschrieben', () => {
    const result = generateDropCap('hallo', 'modern');
    expect(result.letter).toBe('H');
  });

  it('gothic hat 4 Zeilen', () => {
    const result = generateDropCap('test', 'gothic');
    expect(result.lines).toBe(4);
  });

  it('renaissance hat 3 Zeilen', () => {
    const result = generateDropCap('test', 'renaissance');
    expect(result.lines).toBe(3);
  });

  it('jugendstil hat 3 Zeilen', () => {
    const result = generateDropCap('test', 'jugendstil');
    expect(result.lines).toBe(3);
  });

  it('modern hat 2 Zeilen', () => {
    const result = generateDropCap('test', 'modern');
    expect(result.lines).toBe(2);
  });

  it('runaroundMargin wird berechnet', () => {
    const result = generateDropCap('test', 'gothic');
    expect(result.runaroundMargin).toBeGreaterThan(0);
  });

  it('unbekanster Stil wird zu modern', () => {
    const result = generateDropCap('test', 'unbekannt' as DropCapStyle);
    expect(result.style).toBe('modern');
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateDropCap(null as unknown as string, 'modern').letter).toBe('');
  });
});

describe('harmonizeLineHeight', () => {
  it('harmonisiert Zeilenabstand', () => {
    const result = harmonizeLineHeight(12, 1.2);
    expect(result).toBeGreaterThanOrEqual(1.2);
  });

  it('kleine Schrift bekommt mehr Zeilenabstand', () => {
    const small = harmonizeLineHeight(8, 1.0);
    const large = harmonizeLineHeight(32, 1.0);
    expect(small).toBeGreaterThan(large);
  });

  it('null/undefined ergibt Defaults', () => {
    expect(harmonizeLineHeight(0, 0)).toBeGreaterThan(0);
  });

  it('negative Werte werden zu Minimum', () => {
    expect(harmonizeLineHeight(-10, -1)).toBeGreaterThan(0);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(harmonizeLineHeight(NaN, NaN)).toBeGreaterThan(0);
  });
});
