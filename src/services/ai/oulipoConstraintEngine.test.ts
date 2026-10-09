// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  CONSTRAINT_METHODS,
  checkConstraint,
  generateConstrainedText,
  createSampleConstraint,
  createSampleConstrainedText,
} from './oulipoConstraintEngine';

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe('hashString', () => {
  it('ist deterministisch für denselben Input', () => {
    const a = hashString('Wind');
    const b = hashString('Wind');
    expect(a).toBe(b);
  });

  it('liefert unterschiedliche Hashes für unterschiedliche Strings', () => {
    const a = hashString('Wind');
    const b = hashString('Sturm');
    expect(a).not.toBe(b);
  });

  it('liefert einen positiven 32-Bit-Integer', () => {
    const h = hashString('Test');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('handhabt leeren String', () => {
    const h = hashString('');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it('handhabt Sonderzeichen und Umlaute', () => {
    const h = hashString('äöüßÄÖÜ!@#');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it('ist case-sensitiv', () => {
    const a = hashString('Wind');
    const b = hashString('wind');
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('liefert unterschiedliche Sequenzen für unterschiedliche Seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('liefert Werte im Bereich [0, 1) für Seed 0', () => {
    const rng = createSeededRandom(0);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('liefert Werte im Bereich [0, 1) für großen Seed', () => {
    const rng = createSeededRandom(0xffffffff);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// CONSTRAINT_METHODS
// ---------------------------------------------------------------------------

describe('CONSTRAINT_METHODS', () => {
  it('enthält genau 5 Methoden', () => {
    expect(CONSTRAINT_METHODS).toHaveLength(5);
  });

  it('enthält die erwarteten IDs', () => {
    const ids = CONSTRAINT_METHODS.map((m) => m.id);
    expect(ids).toContain('lipogram');
    expect(ids).toContain('nPlus7');
    expect(ids).toContain('snowball');
    expect(ids).toContain('univocalism');
    expect(ids).toContain('tautogram');
  });

  it('jede Methode hat id, name, description, example und difficulty', () => {
    for (const m of CONSTRAINT_METHODS) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('description');
      expect(m).toHaveProperty('example');
      expect(m).toHaveProperty('difficulty');
    }
  });

  it('jede Methode hat einen nicht-leeren Namen', () => {
    for (const m of CONSTRAINT_METHODS) {
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it('jede Methode hat eine nicht-leere Beschreibung', () => {
    for (const m of CONSTRAINT_METHODS) {
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it('jede Methode hat ein nicht-leeres Beispiel', () => {
    for (const m of CONSTRAINT_METHODS) {
      expect(m.example.length).toBeGreaterThan(0);
    }
  });

  it('jede Methode hat eine Schwierigkeit zwischen 1 und 10', () => {
    for (const m of CONSTRAINT_METHODS) {
      expect(m.difficulty).toBeGreaterThanOrEqual(1);
      expect(m.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('hat eindeutige IDs', () => {
    const ids = CONSTRAINT_METHODS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// checkConstraint
// ---------------------------------------------------------------------------

describe('checkConstraint', () => {
  describe('lipogram', () => {
    it('erkennt gültigen Text ohne "e"', () => {
      const result = checkConstraint('Wind Sturm Nacht', 'lipogram', { excludedChar: 'e' });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.score).toBe(100);
      expect(result.description).toContain('Lipogramm');
    });

    it('erkennt Verstoß gegen Lipogramm', () => {
      const result = checkConstraint('Der Wind weht', 'lipogram', { excludedChar: 'e' });
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('handhabt leeren Text', () => {
      const result = checkConstraint('', 'lipogram', { excludedChar: 'e' });
      expect(result.valid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ist deterministisch', () => {
      const r1 = checkConstraint('Wind Sturm', 'lipogram', { excludedChar: 'e' });
      const r2 = checkConstraint('Wind Sturm', 'lipogram', { excludedChar: 'e' });
      expect(r1).toEqual(r2);
    });
  });

  describe('nPlus7', () => {
    it('akzeptiert Text mit zwei oder mehr Wörtern ohne Ziffern', () => {
      const result = checkConstraint('Der Wind weht stark', 'nPlus7');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('lehnt Text mit Ziffern ab', () => {
      const result = checkConstraint('Der Wind 7 weht', 'nPlus7');
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('lehnt Text mit weniger als zwei Wörtern ab', () => {
      const result = checkConstraint('Wind', 'nPlus7');
      expect(result.valid).toBe(false);
    });

    it('handhabt leeren Text', () => {
      const result = checkConstraint('', 'nPlus7');
      expect(result.valid).toBe(false);
    });

    it('ist deterministisch', () => {
      const r1 = checkConstraint('Der Wind weht', 'nPlus7');
      const r2 = checkConstraint('Der Wind weht', 'nPlus7');
      expect(r1).toEqual(r2);
    });
  });

  describe('snowball', () => {
    it('erkennt gültigen Schneeball-Satz', () => {
      const result = checkConstraint('Am Tag wird jeder länger', 'snowball');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('erkennt Verstoß gegen Schneeball-Satz', () => {
      const result = checkConstraint('Am Tag wird länger', 'snowball');
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('handhabt leeren Text', () => {
      const result = checkConstraint('', 'snowball');
      expect(result.valid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ist deterministisch', () => {
      const r1 = checkConstraint('Am Tag wird', 'snowball');
      const r2 = checkConstraint('Am Tag wird', 'snowball');
      expect(r1).toEqual(r2);
    });
  });

  describe('univocalism', () => {
    it('erkennt gültigen Univokalismus mit Vokal "o"', () => {
      const result = checkConstraint('Oft kommt Not', 'univocalism', { vowel: 'o' });
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('erkennt Verstoß gegen Univokalismus', () => {
      const result = checkConstraint('Wind weht', 'univocalism', { vowel: 'o' });
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('handhabt leeren Text', () => {
      const result = checkConstraint('', 'univocalism', { vowel: 'e' });
      expect(result.valid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('ist deterministisch', () => {
      const r1 = checkConstraint('Oft kommt Not', 'univocalism', { vowel: 'o' });
      const r2 = checkConstraint('Oft kommt Not', 'univocalism', { vowel: 'o' });
      expect(r1).toEqual(r2);
    });
  });

  describe('tautogram', () => {
    it('erkennt gültiges Tautogramm', () => {
      const result = checkConstraint('Wind weht weiche Wellen', 'tautogram');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('erkennt Verstoß gegen Tautogramm', () => {
      const result = checkConstraint('Wind weht Sturm', 'tautogram');
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('lehnt Text mit weniger als zwei Wörtern ab', () => {
      const result = checkConstraint('Wind', 'tautogram');
      expect(result.valid).toBe(false);
    });

    it('ist deterministisch', () => {
      const r1 = checkConstraint('Wind weht weiche Wellen', 'tautogram');
      const r2 = checkConstraint('Wind weht weiche Wellen', 'tautogram');
      expect(r1).toEqual(r2);
    });
  });

  describe('unbekannte Methode', () => {
    it('liefert valid=false für unbekannte Methode', () => {
      const result = checkConstraint('Test', 'unbekannt');
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.score).toBe(0);
    });
  });

  describe('allgemeine Eigenschaften', () => {
    it('liefert score im Bereich 0-100', () => {
      const texts = ['Wind', 'Der Wind weht stark', 'Am Tag wird jeder länger', 'Oft kommt Not'];
      const methods = ['lipogram', 'nPlus7', 'snowball', 'univocalism', 'tautogram'];
      for (const text of texts) {
        for (const method of methods) {
          const result = checkConstraint(text, method);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        }
      }
    });

    it('liefert immer ein violations-Array', () => {
      const result = checkConstraint('Test', 'lipogram');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('liefert immer eine Beschreibung', () => {
      const result = checkConstraint('Test', 'lipogram');
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// generateConstrainedText
// ---------------------------------------------------------------------------

describe('generateConstrainedText', () => {
  it('liefert ein Ergebnis mit text, method, valid und description', () => {
    const result = generateConstrainedText('lipogram', 42, 8);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('method');
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('description');
  });

  it('ist deterministisch für gleichen Seed', () => {
    const r1 = generateConstrainedText('lipogram', 42, 8);
    const r2 = generateConstrainedText('lipogram', 42, 8);
    expect(r1).toEqual(r2);
  });

  it('liefert unterschiedliche Texte für unterschiedliche Seeds', () => {
    const r1 = generateConstrainedText('lipogram', 1, 8);
    const r2 = generateConstrainedText('lipogram', 2, 8);
    expect(r1.text).not.toBe(r2.text);
  });

  it('generiert gültigen Lipogramm-Text', () => {
    const result = generateConstrainedText('lipogram', 42, 8);
    expect(result.method).toBe('lipogram');
    expect(result.valid).toBe(true);
  });

  it('generiert gültigen Tautogramm-Text', () => {
    const result = generateConstrainedText('tautogram', 42, 8);
    expect(result.method).toBe('tautogram');
    expect(result.valid).toBe(true);
  });

  it('generiert gültigen Univokalismus-Text', () => {
    const result = generateConstrainedText('univocalism', 42, 8);
    expect(result.method).toBe('univocalism');
    expect(result.valid).toBe(true);
  });

  it('generiert gültigen Schneeball-Text', () => {
    const result = generateConstrainedText('snowball', 42, 8);
    expect(result.method).toBe('snowball');
    expect(result.valid).toBe(true);
  });

  it('generiert gültigen N+7-Text', () => {
    const result = generateConstrainedText('nPlus7', 42, 8);
    expect(result.method).toBe('nPlus7');
    expect(result.valid).toBe(true);
  });

  it('handhabt unbekannte Methode', () => {
    const result = generateConstrainedText('unbekannt', 42, 8);
    expect(result.valid).toBe(false);
    expect(result.text).toBe('');
  });

  it('respektiert die Längenangabe', () => {
    const result = generateConstrainedText('lipogram', 42, 5);
    const words = result.text.split(' ');
    expect(words.length).toBe(5);
  });

  it('verwendet Standardlänge 8 wenn keine angegeben', () => {
    const result = generateConstrainedText('lipogram', 42);
    const words = result.text.split(' ');
    expect(words.length).toBe(8);
  });

  it('handhabt Länge 0 oder negativ', () => {
    const result = generateConstrainedText('lipogram', 42, 0);
    expect(result.text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createSampleConstraint
// ---------------------------------------------------------------------------

describe('createSampleConstraint', () => {
  it('liefert eine gültige ConstraintMethod', () => {
    const sample = createSampleConstraint();
    expect(sample).toHaveProperty('id');
    expect(sample).toHaveProperty('name');
    expect(sample).toHaveProperty('description');
    expect(sample).toHaveProperty('example');
    expect(sample).toHaveProperty('difficulty');
  });

  it('ist eine Kopie und keine Referenz auf CONSTRAINT_METHODS', () => {
    const sample = createSampleConstraint();
    sample.name = 'Geändert';
    expect(CONSTRAINT_METHODS[0].name).not.toBe('Geändert');
  });

  it('ist deterministisch', () => {
    const s1 = createSampleConstraint();
    const s2 = createSampleConstraint();
    expect(s1).toEqual(s2);
  });
});

// ---------------------------------------------------------------------------
// createSampleConstrainedText
// ---------------------------------------------------------------------------

describe('createSampleConstrainedText', () => {
  it('liefert ein gültiges ConstrainedTextResult', () => {
    const sample = createSampleConstrainedText();
    expect(sample).toHaveProperty('text');
    expect(sample).toHaveProperty('method');
    expect(sample).toHaveProperty('valid');
    expect(sample).toHaveProperty('description');
  });

  it('ist deterministisch', () => {
    const s1 = createSampleConstrainedText();
    const s2 = createSampleConstrainedText();
    expect(s1).toEqual(s2);
  });

  it('liefert einen gültigen Text', () => {
    const sample = createSampleConstrainedText();
    expect(sample.valid).toBe(true);
    expect(sample.text.length).toBeGreaterThan(0);
  });

  it('verwendet die snowball-Methode', () => {
    const sample = createSampleConstrainedText();
    expect(sample.method).toBe('snowball');
  });
});
