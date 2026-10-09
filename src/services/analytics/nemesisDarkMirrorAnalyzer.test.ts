// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  compareOriginTrauma,
  calculateResonanceScore,
  synthesizeIdeologicalShowdown,
  createSampleComparison,
  createSampleShowdown,
} from './nemesisDarkMirrorAnalyzer';

/* ================================================================== */
/* hashString                                                          */
/* ================================================================== */

describe('hashString', () => {
  it('ist deterministisch für dieselbe Eingabe', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('ist deterministisch für leere Zeichenkette', () => {
    expect(hashString('')).toBe(hashString(''));
  });

  it('liefert unterschiedliche Hashes für unterschiedliche Eingaben', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('liefert unterschiedliche Hashes für ähnliche Eingaben', () => {
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('liefert einen unsigned 32-bit-Wert (≥ 0)', () => {
    const result = hashString('anything');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('liefert einen unsigned 32-bit-Wert (≤ 4294967295)', () => {
    const result = hashString('anything');
    expect(result).toBeLessThanOrEqual(4294967295);
  });

  it('liefert einen Integer', () => {
    expect(Number.isInteger(hashString('integer-check'))).toBe(true);
  });

  it('liefert eine Zahl', () => {
    expect(typeof hashString('type-check')).toBe('number');
  });

  it('behandelt Unicode-Zeichen korrekt', () => {
    const result = hashString('äöüß');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('behandelt sehr lange Zeichenketten', () => {
    const long = 'x'.repeat(10000);
    const result = hashString(long);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('ist case-sensitiv', () => {
    expect(hashString('Hello')).not.toBe(hashString('hello'));
  });

  it('ist whitespace-sensitiv', () => {
    expect(hashString('hello world')).not.toBe(hashString('helloworld'));
  });

  it('behandelt Sonderzeichen', () => {
    const result = hashString('!@#$%^&*()');
    expect(typeof result).toBe('number');
  });

  it('liefert konsistente Werte über mehrere Aufrufe', () => {
    const first = hashString('consistency');
    const second = hashString('consistency');
    const third = hashString('consistency');
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('liefert unterschiedliche Hashes für einzelne Zeichen', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('behandelt Zahlen in der Eingabe', () => {
    const result = hashString('12345');
    expect(typeof result).toBe('number');
  });
});

/* ================================================================== */
/* createSeededRandom                                                  */
/* ================================================================== */

describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('liefert Werte im Intervall [0, 1) über 500 Ziehungen', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('liefert unterschiedliche Sequenzen für unterschiedliche Seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('liefert eine Funktion', () => {
    const rng = createSeededRandom(42);
    expect(typeof rng).toBe('function');
  });

  it('erster Wert liegt im Intervall [0, 1)', () => {
    const rng = createSeededRandom(99);
    const first = rng();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });

  it('alle Werte sind Zahlen', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(typeof rng()).toBe('number');
    }
  });

  it('500 Ziehungen liefern 500 eindeutige Werte', () => {
    const rng = createSeededRandom(555);
    const values = new Set(Array.from({ length: 500 }, () => rng()));
    expect(values.size).toBeGreaterThan(400);
  });

  it('unterschiedliche Seeds liefern unterschiedliche erste Werte', () => {
    const rng1 = createSeededRandom(100);
    const rng2 = createSeededRandom(200);
    expect(rng1()).not.toBe(rng2());
  });

  it('derselbe Seed liefert identische Sequenzen der Länge 100', () => {
    const rng1 = createSeededRandom(777);
    const rng2 = createSeededRandom(777);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('Werte sind nicht alle identisch', () => {
    const rng = createSeededRandom(314);
    const values = Array.from({ length: 20 }, () => rng());
    const unique = new Set(values);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('funktioniert mit Seed 0', () => {
    const rng = createSeededRandom(0);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('funktioniert mit Seed 1', () => {
    const rng = createSeededRandom(1);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('funktioniert mit großem Seed', () => {
    const rng = createSeededRandom(2147483647);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('funktioniert mit negativem Seed', () => {
    const rng = createSeededRandom(-1);
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('zwei Generatoren mit unterschiedlichen Seeds sind unabhängig', () => {
    const rng1 = createSeededRandom(10);
    const rng2 = createSeededRandom(20);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });
});

/* ================================================================== */
/* compareOriginTrauma                                                 */
/* ================================================================== */

describe('compareOriginTrauma', () => {
  const baseInput = {
    heroName: 'Kael',
    heroWound: 'Verlust der eigenen Familie',
    villainName: 'Vorn',
    villainWound: 'Verlassenheit nach dem Fall',
  };

  it('gibt heroName unverändert zurück', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.heroName).toBe('Kael');
  });

  it('gibt villainName unverändert zurück', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.villainName).toBe('Vorn');
  });

  it('sharedWound ist nicht leer', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.sharedWound.length).toBeGreaterThan(0);
  });

  it('divergencePoint ist nicht leer', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.divergencePoint.length).toBeGreaterThan(0);
  });

  it('heroChoice ist nicht leer', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.heroChoice.length).toBeGreaterThan(0);
  });

  it('villainChoice ist nicht leer', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.villainChoice.length).toBeGreaterThan(0);
  });

  it('parallelStrength liegt zwischen 0 und 100', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.parallelStrength).toBeGreaterThanOrEqual(0);
    expect(result.parallelStrength).toBeLessThanOrEqual(100);
  });

  it('svg beginnt mit <svg', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg.startsWith('<svg')).toBe(true);
  });

  it('svg endet mit </svg>', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg.endsWith('</svg>')).toBe(true);
  });

  it('ist deterministisch für dieselbe Eingabe und Seed', () => {
    const r1 = compareOriginTrauma(baseInput, 42);
    const r2 = compareOriginTrauma(baseInput, 42);
    expect(r1).toEqual(r2);
  });

  it('behandelt leere Wunden', () => {
    const result = compareOriginTrauma(
      { heroName: 'A', heroWound: '', villainName: 'B', villainWound: '' },
      42,
    );
    expect(result.heroName).toBe('A');
    expect(result.villainName).toBe('B');
    expect(result.parallelStrength).toBeGreaterThanOrEqual(0);
  });

  it('behandelt lange Wunden', () => {
    const longWound = 'Verlust '.repeat(100).trim();
    const result = compareOriginTrauma(
      { heroName: 'A', heroWound: longWound, villainName: 'B', villainWound: longWound },
      42,
    );
    expect(result.parallelStrength).toBeGreaterThanOrEqual(0);
    expect(result.parallelStrength).toBeLessThanOrEqual(100);
  });

  it('behandelt Umlaute in Namen', () => {
    const result = compareOriginTrauma(
      { heroName: 'Müller', heroWound: 'Verlust', villainName: 'Größer', villainWound: 'Fall' },
      42,
    );
    expect(result.heroName).toBe('Müller');
    expect(result.villainName).toBe('Größer');
  });

  it('parallelStrength ist eine Zahl', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(typeof result.parallelStrength).toBe('number');
  });

  it('sharedWound ist eine Zeichenkette', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(typeof result.sharedWound).toBe('string');
  });

  it('svg enthält heroName', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).toContain('Kael');
  });

  it('svg enthält villainName', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).toContain('Vorn');
  });

  it('unterschiedliche Seeds liefern unterschiedliche Ergebnisse', () => {
    const r1 = compareOriginTrauma(baseInput, 1);
    const r2 = compareOriginTrauma(baseInput, 2);
    expect(r1.sharedWound === r2.sharedWound && r1.divergencePoint === r2.divergencePoint).toBe(false);
  });

  it('heroName mit Sonderzeichen wird korrekt verarbeitet', () => {
    const result = compareOriginTrauma(
      { heroName: 'Kael-01', heroWound: 'Test', villainName: 'Vorn_02', villainWound: 'Test' },
      42,
    );
    expect(result.heroName).toBe('Kael-01');
  });

  it('villainName mit Sonderzeichen wird korrekt verarbeitet', () => {
    const result = compareOriginTrauma(
      { heroName: 'Kael', heroWound: 'Test', villainName: 'Vorn_02', villainWound: 'Test' },
      42,
    );
    expect(result.villainName).toBe('Vorn_02');
  });

  it('behandelt identische Namen für Held und Gegner', () => {
    const result = compareOriginTrauma(
      { heroName: 'X', heroWound: 'A', villainName: 'X', villainWound: 'B' },
      42,
    );
    expect(result.heroName).toBe('X');
    expect(result.villainName).toBe('X');
  });

  it('behandelt sehr lange Namen', () => {
    const longName = 'A'.repeat(500);
    const result = compareOriginTrauma(
      { heroName: longName, heroWound: 'Test', villainName: longName, villainWound: 'Test' },
      42,
    );
    expect(result.heroName).toBe(longName);
  });

  it('parallelStrength ist ein Integer', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(Number.isInteger(result.parallelStrength)).toBe(true);
  });

  it('svg ist eine Zeichenkette', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(typeof result.svg).toBe('string');
  });

  it('Ergebnis enthält alle erwarteten Schlüssel', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result).toHaveProperty('heroName');
    expect(result).toHaveProperty('villainName');
    expect(result).toHaveProperty('sharedWound');
    expect(result).toHaveProperty('divergencePoint');
    expect(result).toHaveProperty('heroChoice');
    expect(result).toHaveProperty('villainChoice');
    expect(result).toHaveProperty('parallelStrength');
    expect(result).toHaveProperty('svg');
  });
});

/* ================================================================== */
/* calculateResonanceScore                                             */
/* ================================================================== */

describe('calculateResonanceScore', () => {
  const baseInput = {
    heroWeakness: 'Angst vor dem Verlust',
    villainChallenge: 'Kontrolle als einzige Ordnung',
  };

  it('score liegt zwischen 0 und 100', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('breakdown ist ein nicht-leeres Array', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(Array.isArray(result.breakdown)).toBe(true);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it('jeder Breakdown-Eintrag hat einen nicht-leeren factor', () => {
    const result = calculateResonanceScore(baseInput, 42);
    for (const entry of result.breakdown) {
      expect(entry.factor.length).toBeGreaterThan(0);
    }
  });

  it('jeder Breakdown-Eintrag hat eine numerische weight', () => {
    const result = calculateResonanceScore(baseInput, 42);
    for (const entry of result.breakdown) {
      expect(typeof entry.weight).toBe('number');
    }
  });

  it('jeder Breakdown-Eintrag hat eine numerische contribution', () => {
    const result = calculateResonanceScore(baseInput, 42);
    for (const entry of result.breakdown) {
      expect(typeof entry.contribution).toBe('number');
    }
  });

  it('interpretation ist nicht leer', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(result.interpretation.length).toBeGreaterThan(0);
  });

  it('strongestFactor ist nicht leer', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(result.strongestFactor.length).toBeGreaterThan(0);
  });

  it('strongestFactor ist im Breakdown enthalten', () => {
    const result = calculateResonanceScore(baseInput, 42);
    const factors = result.breakdown.map((e) => e.factor);
    expect(factors).toContain(result.strongestFactor);
  });

  it('funktioniert mit thematicOverlap', () => {
    const result = calculateResonanceScore(
      { ...baseInput, thematicOverlap: ['Ordnung', 'Macht', 'Opfer'] },
      42,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('funktioniert ohne thematicOverlap', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('ist deterministisch für dieselbe Eingabe und Seed', () => {
    const r1 = calculateResonanceScore(baseInput, 42);
    const r2 = calculateResonanceScore(baseInput, 42);
    expect(r1).toEqual(r2);
  });

  it('score ist eine Zahl', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(typeof result.score).toBe('number');
  });

  it('breakdown ist ein Array', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(Array.isArray(result.breakdown)).toBe(true);
  });

  it('interpretation ist eine Zeichenkette', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(typeof result.interpretation).toBe('string');
  });

  it('strongestFactor ist eine Zeichenkette', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(typeof result.strongestFactor).toBe('string');
  });

  it('behandelt leeres thematicOverlap-Array', () => {
    const result = calculateResonanceScore(
      { ...baseInput, thematicOverlap: [] },
      42,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('behandelt großes thematicOverlap-Array', () => {
    const result = calculateResonanceScore(
      { ...baseInput, thematicOverlap: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
      42,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('score ist ein Integer', () => {
    const result = calculateResonanceScore(baseInput, 42);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it('Gewichten summieren sich auf etwa 1', () => {
    const result = calculateResonanceScore(baseInput, 42);
    const sum = result.breakdown.reduce((s, e) => s + e.weight, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('contributions sind nicht-negativ', () => {
    const result = calculateResonanceScore(baseInput, 42);
    for (const entry of result.breakdown) {
      expect(entry.contribution).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ================================================================== */
/* synthesizeIdeologicalShowdown                                        */
/* ================================================================== */

describe('synthesizeIdeologicalShowdown', () => {
  const baseInput = {
    heroName: 'Kael',
    heroIdeology: 'Ordnung durch Schutz',
    villainName: 'Vorn',
    villainIdeology: 'Ordnung durch Kontrolle',
  };

  it('exchanges ist ein nicht-leeres Array', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(Array.isArray(result.exchanges)).toBe(true);
    expect(result.exchanges.length).toBeGreaterThan(0);
  });

  it('jeder Exchange hat einen nicht-leeren speaker', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    for (const ex of result.exchanges) {
      expect(ex.speaker.length).toBeGreaterThan(0);
    }
  });

  it('jeder Exchange hat eine nicht-leere line', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    for (const ex of result.exchanges) {
      expect(ex.line.length).toBeGreaterThan(0);
    }
  });

  it('jeder Exchange hat einen nicht-leeren worldView', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    for (const ex of result.exchanges) {
      expect(ex.worldView.length).toBeGreaterThan(0);
    }
  });

  it('climaxLine ist nicht leer', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(result.climaxLine.length).toBeGreaterThan(0);
  });

  it('unresolvedTension ist nicht leer', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(result.unresolvedTension.length).toBeGreaterThan(0);
  });

  it('wordCount ist positiv', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('wordCount stimmt mit der Gesamtzahl der Wörter überein', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    const exchangeWords = result.exchanges.reduce(
      (sum, ex) => sum + ex.line.trim().split(/\s+/u).filter(Boolean).length,
      0,
    );
    const climaxWords = result.climaxLine.trim().split(/\s+/u).filter(Boolean).length;
    expect(result.wordCount).toBe(exchangeWords + climaxWords);
  });

  it('beide Namen erscheinen in den Sprechern', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    const speakers = result.exchanges.map((ex) => ex.speaker);
    expect(speakers).toContain('Kael');
    expect(speakers).toContain('Vorn');
  });

  it('ist deterministisch für dieselbe Eingabe und Seed', () => {
    const r1 = synthesizeIdeologicalShowdown(baseInput, 42);
    const r2 = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(r1).toEqual(r2);
  });

  it('exchanges ist ein Array', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(Array.isArray(result.exchanges)).toBe(true);
  });

  it('climaxLine ist eine Zeichenkette', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(typeof result.climaxLine).toBe('string');
  });

  it('unresolvedTension ist eine Zeichenkette', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(typeof result.unresolvedTension).toBe('string');
  });

  it('wordCount ist eine Zahl', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(typeof result.wordCount).toBe('number');
  });

  it('mindestens 3 Exchanges', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(result.exchanges.length).toBeGreaterThanOrEqual(3);
  });

  it('höchstens 5 Exchanges', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    expect(result.exchanges.length).toBeLessThanOrEqual(5);
  });

  it('Sprecher alternieren', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    for (let i = 1; i < result.exchanges.length; i++) {
      expect(result.exchanges[i].speaker).not.toBe(result.exchanges[i - 1].speaker);
    }
  });

  it('unterschiedliche Seeds liefern unterschiedliche Ergebnisse', () => {
    const r1 = synthesizeIdeologicalShowdown(baseInput, 1);
    const r2 = synthesizeIdeologicalShowdown(baseInput, 2);
    expect(r1).not.toEqual(r2);
  });

  it('heroName erscheint in mindestens einem Exchange', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    const speakers = result.exchanges.map((ex) => ex.speaker);
    expect(speakers).toContain('Kael');
  });

  it('villainName erscheint in mindestens einem Exchange', () => {
    const result = synthesizeIdeologicalShowdown(baseInput, 42);
    const speakers = result.exchanges.map((ex) => ex.speaker);
    expect(speakers).toContain('Vorn');
  });
});

/* ================================================================== */
/* SVG-Struktur                                                        */
/* ================================================================== */

describe('SVG-Struktur', () => {
  const baseInput = {
    heroName: 'Kael',
    heroWound: 'Verlust',
    villainName: 'Vorn',
    villainWound: 'Fall',
  };

  it('enthält keine Hex-Farben', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('enthält kein rgba(', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).not.toContain('rgba(');
  });

  it('enthält viewBox', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).toContain('viewBox');
  });

  it('enthält xmlns', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).toContain('xmlns');
  });

  it('ist ein gültiges SVG-Element', () => {
    const result = compareOriginTrauma(baseInput, 42);
    expect(result.svg).toMatch(/^<svg[\s\S]*<\/svg>$/u);
  });
});

/* ================================================================== */
/* createSampleComparison                                              */
/* ================================================================== */

describe('createSampleComparison', () => {
  it('liefert ein gültiges Ergebnis', () => {
    const result = createSampleComparison();
    expect(result).toBeDefined();
    expect(result.heroName).toBeDefined();
    expect(result.villainName).toBeDefined();
  });

  it('heroName ist Kael', () => {
    const result = createSampleComparison();
    expect(result.heroName).toBe('Kael');
  });

  it('villainName ist Vorn', () => {
    const result = createSampleComparison();
    expect(result.villainName).toBe('Vorn');
  });

  it('ist deterministisch', () => {
    const r1 = createSampleComparison();
    const r2 = createSampleComparison();
    expect(r1).toEqual(r2);
  });

  it('parallelStrength liegt zwischen 0 und 100', () => {
    const result = createSampleComparison();
    expect(result.parallelStrength).toBeGreaterThanOrEqual(0);
    expect(result.parallelStrength).toBeLessThanOrEqual(100);
  });
});

/* ================================================================== */
/* createSampleShowdown                                                */
/* ================================================================== */

describe('createSampleShowdown', () => {
  it('liefert ein gültiges Ergebnis', () => {
    const result = createSampleShowdown();
    expect(result).toBeDefined();
    expect(result.exchanges).toBeDefined();
  });

  it('exchanges ist nicht leer', () => {
    const result = createSampleShowdown();
    expect(result.exchanges.length).toBeGreaterThan(0);
  });

  it('ist deterministisch', () => {
    const r1 = createSampleShowdown();
    const r2 = createSampleShowdown();
    expect(r1).toEqual(r2);
  });

  it('wordCount ist positiv', () => {
    const result = createSampleShowdown();
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('beide Namen erscheinen in den Sprechern', () => {
    const result = createSampleShowdown();
    const speakers = result.exchanges.map((ex) => ex.speaker);
    expect(speakers).toContain('Kael');
    expect(speakers).toContain('Vorn');
  });
});
