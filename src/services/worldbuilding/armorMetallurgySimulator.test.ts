// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  ARMOR_LAYERS,
  WEAPON_TYPES,
  simulateHit,
  generateCombatProse,
  createSampleArmorLayer,
  createSampleWeapon,
} from './armorMetallurgySimulator';

// ---------------------------------------------------------------------------
// 1. hashString
// ---------------------------------------------------------------------------
describe('hashString', () => {
  it('ist deterministisch — gleicher String ergibt gleichen Hash', () => {
    const h1 = hashString('Kettenhemd');
    const h2 = hashString('Kettenhemd');
    expect(h1).toBe(h2);
  });

  it('erzeugt für unterschiedliche Strings unterschiedliche Hashes', () => {
    const h1 = hashString('Plattenharnisch');
    const h2 = hashString('Wappenrock');
    expect(h1).not.toBe(h2);
  });

  it('liefert für den leeren String einen gültigen Hash', () => {
    const h = hashString('');
    expect(typeof h).toBe('number');
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it('gibt einen nicht-negativen 32-Bit-Wert zurück', () => {
    const h = hashString('Streitkolbenschlag');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('verarbeitet Unicode-Strings korrekt', () => {
    const h = hashString('⚔️ Rüstung');
    expect(typeof h).toBe('number');
    expect(Number.isFinite(h)).toBe(true);
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    const h1 = hashString('Lanze');
    const h2 = hashString('lanze');
    expect(h1).not.toBe(h2);
  });

  it('liefert konsistente Hashes über mehrere Aufrufe', () => {
    const results = [1, 2, 3].map(() => hashString('gambeson'));
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });
});

// ---------------------------------------------------------------------------
// 2. createSeededRandom
// ---------------------------------------------------------------------------
describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('erzeugt für unterschiedliche Seeds unterschiedliche Sequenzen', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(9999);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('arbeitet über viele Aufrufe hinweg stabil', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('akzeptiert Seed 0 korrekt', () => {
    const rng = createSeededRandom(0);
    const val = rng();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 3. ARMOR_LAYERS
// ---------------------------------------------------------------------------
describe('ARMOR_LAYERS', () => {
  it('enthält genau 4 Schichten', () => {
    expect(ARMOR_LAYERS).toHaveLength(4);
  });

  it('enthält die erwarteten Schicht-IDs', () => {
    const ids = ARMOR_LAYERS.map((a) => a.id);
    expect(ids).toEqual(['gambeson', 'mail', 'plate', 'surcoat']);
  });

  it('jede Schicht hat id, name und description als nicht-leere Strings', () => {
    for (const layer of ARMOR_LAYERS) {
      expect(typeof layer.id).toBe('string');
      expect(layer.id.length).toBeGreaterThan(0);
      expect(typeof layer.name).toBe('string');
      expect(layer.name.length).toBeGreaterThan(0);
      expect(typeof layer.description).toBe('string');
      expect(layer.description.length).toBeGreaterThan(0);
    }
  });

  it('jede Schicht hat hardness, weight und coverage als Zahlen', () => {
    for (const layer of ARMOR_LAYERS) {
      expect(typeof layer.hardness).toBe('number');
      expect(typeof layer.weight).toBe('number');
      expect(typeof layer.coverage).toBe('number');
    }
  });

  it('hardness liegt im Bereich 0-10', () => {
    for (const layer of ARMOR_LAYERS) {
      expect(layer.hardness).toBeGreaterThanOrEqual(0);
      expect(layer.hardness).toBeLessThanOrEqual(10);
    }
  });

  it('coverage liegt im Bereich 0-1', () => {
    for (const layer of ARMOR_LAYERS) {
      expect(layer.coverage).toBeGreaterThanOrEqual(0);
      expect(layer.coverage).toBeLessThanOrEqual(1);
    }
  });

  it('weight ist positiv', () => {
    for (const layer of ARMOR_LAYERS) {
      expect(layer.weight).toBeGreaterThan(0);
    }
  });

  it('hat eindeutige IDs', () => {
    const ids = ARMOR_LAYERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('die Platte ist härter als der Gambeson', () => {
    const plate = ARMOR_LAYERS.find((a) => a.id === 'plate');
    const gambeson = ARMOR_LAYERS.find((a) => a.id === 'gambeson');
    expect(plate!.hardness).toBeGreaterThan(gambeson!.hardness);
  });
});

// ---------------------------------------------------------------------------
// 4. WEAPON_TYPES
// ---------------------------------------------------------------------------
describe('WEAPON_TYPES', () => {
  it('enthält genau 4 Waffen', () => {
    expect(WEAPON_TYPES).toHaveLength(4);
  });

  it('enthält die erwarteten Waffen-IDs', () => {
    const ids = WEAPON_TYPES.map((w) => w.id);
    expect(ids).toEqual(['swordThrust', 'arrowBodkin', 'lanceCharge', 'maceBlow']);
  });

  it('jede Waffe hat id, name und description als nicht-leere Strings', () => {
    for (const weapon of WEAPON_TYPES) {
      expect(typeof weapon.id).toBe('string');
      expect(weapon.id.length).toBeGreaterThan(0);
      expect(typeof weapon.name).toBe('string');
      expect(weapon.name.length).toBeGreaterThan(0);
      expect(typeof weapon.description).toBe('string');
      expect(weapon.description.length).toBeGreaterThan(0);
    }
  });

  it('jede Waffe hat penetration, force und targetArea', () => {
    for (const weapon of WEAPON_TYPES) {
      expect(typeof weapon.penetration).toBe('number');
      expect(typeof weapon.force).toBe('number');
      expect(typeof weapon.targetArea).toBe('string');
      expect(weapon.targetArea.length).toBeGreaterThan(0);
    }
  });

  it('penetration liegt im Bereich 0-10', () => {
    for (const weapon of WEAPON_TYPES) {
      expect(weapon.penetration).toBeGreaterThanOrEqual(0);
      expect(weapon.penetration).toBeLessThanOrEqual(10);
    }
  });

  it('force liegt im Bereich 0-10', () => {
    for (const weapon of WEAPON_TYPES) {
      expect(weapon.force).toBeGreaterThanOrEqual(0);
      expect(weapon.force).toBeLessThanOrEqual(10);
    }
  });

  it('hat eindeutige IDs', () => {
    const ids = WEAPON_TYPES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('der Streitkolben hat hohe Wucht, aber geringe Durchschlagskraft', () => {
    const mace = WEAPON_TYPES.find((w) => w.id === 'maceBlow');
    expect(mace!.force).toBeGreaterThan(mace!.penetration);
  });
});

// ---------------------------------------------------------------------------
// 5. simulateHit
// ---------------------------------------------------------------------------
describe('simulateHit', () => {
  it('liefert ein Ergebnis mit allen Pflichtfeldern', () => {
    const result = simulateHit('swordThrust', 'mail', 42);
    expect(typeof result.penetrated).toBe('boolean');
    expect(typeof result.damage).toBe('number');
    expect(typeof result.description).toBe('string');
    expect(typeof result.effectiveness).toBe('number');
  });

  it('damage liegt im Bereich 0-10', () => {
    for (const weapon of WEAPON_TYPES) {
      for (const armor of ARMOR_LAYERS) {
        const result = simulateHit(weapon.id, armor.id, 7);
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(result.damage).toBeLessThanOrEqual(10);
      }
    }
  });

  it('effectiveness liegt im Bereich 0-1', () => {
    for (const weapon of WEAPON_TYPES) {
      for (const armor of ARMOR_LAYERS) {
        const result = simulateHit(weapon.id, armor.id, 7);
        expect(result.effectiveness).toBeGreaterThanOrEqual(0);
        expect(result.effectiveness).toBeLessThanOrEqual(1);
      }
    }
  });

  it('liefert eine nicht-leere Beschreibung', () => {
    const result = simulateHit('lanceCharge', 'plate', 1);
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('ist deterministisch für gleiche Eingaben', () => {
    const a = simulateHit('arrowBodkin', 'plate', 123);
    const b = simulateHit('arrowBodkin', 'plate', 123);
    expect(a).toEqual(b);
  });

  it('unterschiedliche Seeds können zu unterschiedlichen Ergebnissen führen', () => {
    const results = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(simulateHit('swordThrust', 'mail', i))
      )
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('die Beschreibung spiegelt den Durchschlagsausgang wider', () => {
    const result = simulateHit('arrowBodkin', 'surcoat', 5);
    const prefix = result.penetrated ? 'Durchschlag:' : 'Abgewehrt:';
    expect(result.description.startsWith(prefix)).toBe(true);
  });

  it('wirft einen Fehler für eine unbekannte Waffe', () => {
    expect(() => simulateHit('katana', 'mail', 1)).toThrow();
  });

  it('wirft einen Fehler für eine unbekannte Rüstung', () => {
    expect(() => simulateHit('swordThrust', 'adamantium', 1)).toThrow();
  });

  it('ein Bodkin-Pfeil durchschlägt leichten Stoff eher als schwere Platte', () => {
    const light = simulateHit('arrowBodkin', 'surcoat', 99);
    const heavy = simulateHit('arrowBodkin', 'plate', 99);
    expect(light.effectiveness).toBeGreaterThanOrEqual(heavy.effectiveness);
  });
});

// ---------------------------------------------------------------------------
// 6. generateCombatProse
// ---------------------------------------------------------------------------
describe('generateCombatProse', () => {
  it('liefert einen nicht-leeren String', () => {
    const prose = generateCombatProse('swordThrust', 'mail', 42);
    expect(typeof prose).toBe('string');
    expect(prose.length).toBeGreaterThan(0);
  });

  it('ist deterministisch für gleiche Eingaben', () => {
    const a = generateCombatProse('maceBlow', 'plate', 7);
    const b = generateCombatProse('maceBlow', 'plate', 7);
    expect(a).toBe(b);
  });

  it('erzeugt für jeden Waffen-/Rüstungsverbund nicht-leere Prosa', () => {
    for (const weapon of WEAPON_TYPES) {
      for (const armor of ARMOR_LAYERS) {
        const prose = generateCombatProse(weapon.id, armor.id, 3);
        expect(prose.length).toBeGreaterThan(0);
      }
    }
  });

  it('unterschiedliche Seeds erzeugen unterschiedliche Prosa', () => {
    const a = generateCombatProse('lanceCharge', 'mail', 1);
    const b = generateCombatProse('lanceCharge', 'mail', 2);
    expect(a).not.toBe(b);
  });

  it('enthält bei stumpfer Wucht einen Hinweis auf die Wucht', () => {
    const prose = generateCombatProse('maceBlow', 'plate', 11);
    expect(prose.toLowerCase()).toContain('wucht');
  });

  it('wirft einen Fehler für eine unbekannte Waffe', () => {
    expect(() => generateCombatProse('unknown', 'mail', 1)).toThrow();
  });

  it('wirft einen Fehler für eine unbekannte Rüstung', () => {
    expect(() => generateCombatProse('swordThrust', 'unknown', 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. createSampleArmorLayer
// ---------------------------------------------------------------------------
describe('createSampleArmorLayer', () => {
  it('liefert eine gültige Rüstungsschicht', () => {
    const layer = createSampleArmorLayer();
    expect(typeof layer.id).toBe('string');
    expect(layer.id.length).toBeGreaterThan(0);
    expect(typeof layer.name).toBe('string');
    expect(layer.name.length).toBeGreaterThan(0);
    expect(typeof layer.description).toBe('string');
    expect(layer.description.length).toBeGreaterThan(0);
    expect(typeof layer.hardness).toBe('number');
    expect(typeof layer.weight).toBe('number');
    expect(typeof layer.coverage).toBe('number');
  });

  it('entspricht einer bekannten Schicht aus ARMOR_LAYERS', () => {
    const layer = createSampleArmorLayer();
    const match = ARMOR_LAYERS.find((a) => a.id === layer.id);
    expect(match).toBeDefined();
    expect(layer).toEqual(match);
  });

  it('liefert eine Kopie, keine Referenz auf das Original', () => {
    const layer = createSampleArmorLayer();
    const original = ARMOR_LAYERS.find((a) => a.id === layer.id);
    expect(layer).not.toBe(original);
  });

  it('liefert bei mehreren Aufrufen stets gültige Werte', () => {
    for (let i = 0; i < 5; i++) {
      const layer = createSampleArmorLayer();
      expect(layer.hardness).toBeGreaterThanOrEqual(0);
      expect(layer.coverage).toBeGreaterThanOrEqual(0);
      expect(layer.coverage).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. createSampleWeapon
// ---------------------------------------------------------------------------
describe('createSampleWeapon', () => {
  it('liefert eine gültige Waffe', () => {
    const weapon = createSampleWeapon();
    expect(typeof weapon.id).toBe('string');
    expect(weapon.id.length).toBeGreaterThan(0);
    expect(typeof weapon.name).toBe('string');
    expect(weapon.name.length).toBeGreaterThan(0);
    expect(typeof weapon.description).toBe('string');
    expect(weapon.description.length).toBeGreaterThan(0);
    expect(typeof weapon.penetration).toBe('number');
    expect(typeof weapon.force).toBe('number');
    expect(typeof weapon.targetArea).toBe('string');
    expect(weapon.targetArea.length).toBeGreaterThan(0);
  });

  it('entspricht einer bekannten Waffe aus WEAPON_TYPES', () => {
    const weapon = createSampleWeapon();
    const match = WEAPON_TYPES.find((w) => w.id === weapon.id);
    expect(match).toBeDefined();
    expect(weapon).toEqual(match);
  });

  it('liefert eine Kopie, keine Referenz auf das Original', () => {
    const weapon = createSampleWeapon();
    const original = WEAPON_TYPES.find((w) => w.id === weapon.id);
    expect(weapon).not.toBe(original);
  });

  it('penetration und force liegen im Bereich 0-10', () => {
    const weapon = createSampleWeapon();
    expect(weapon.penetration).toBeGreaterThanOrEqual(0);
    expect(weapon.penetration).toBeLessThanOrEqual(10);
    expect(weapon.force).toBeGreaterThanOrEqual(0);
    expect(weapon.force).toBeLessThanOrEqual(10);
  });

  it('liefert bei mehreren Aufrufen stets gültige Werte', () => {
    for (let i = 0; i < 5; i++) {
      const weapon = createSampleWeapon();
      expect(weapon.penetration).toBeGreaterThanOrEqual(0);
      expect(weapon.force).toBeGreaterThanOrEqual(0);
    }
  });
});
