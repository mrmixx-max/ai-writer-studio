// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  FOLEY_LAYERS,
  syncSceneToAtmosphere,
  buildMixerPatch,
  createSampleScene,
  createSampleMixerPatch,
} from './cinematicFoleyAtmosComposer';

describe('hashString', () => {
  it('ist deterministisch für gleichen Input', () => {
    const a = hashString('Test');
    const b = hashString('Test');
    expect(a).toBe(b);
  });

  it('liefert unterschiedliche Hashes für unterschiedliche Strings', () => {
    const hashes = new Set<string>();
    hashes.add(String(hashString('Alpha')));
    hashes.add(String(hashString('Beta')));
    hashes.add(String(hashString('Gamma')));
    expect(hashes.size).toBe(3);
  });

  it('liefert einen unsigned 32-Bit-Wert', () => {
    const h = hashString('Beispieltext');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('behandelt leeren String gleich', () => {
    expect(hashString('')).toBe(hashString(''));
  });
});

describe('createSeededRandom', () => {
  it('ist deterministisch für gleichen Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('liefert unterschiedliche Sequenzen für unterschiedliche Seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];
    expect(seq1).not.toEqual(seq2);
  });
});

describe('FOLEY_LAYERS', () => {
  it('enthält genau 6 Schichten', () => {
    expect(FOLEY_LAYERS).toHaveLength(6);
  });

  it('jede Schicht hat die erforderlichen Felder', () => {
    for (const layer of FOLEY_LAYERS) {
      expect(layer.id).toBeTruthy();
      expect(layer.name).toBeTruthy();
      expect(layer.description).toBeTruthy();
      expect(typeof layer.baseFrequency).toBe('number');
      expect(typeof layer.modulationRate).toBe('number');
      expect(typeof layer.gain).toBe('number');
      expect(layer.gain).toBeGreaterThanOrEqual(0);
      expect(layer.gain).toBeLessThanOrEqual(1);
    }
  });
});

describe('syncSceneToAtmosphere', () => {
  it('findet passende Schichten für Signalwörter', () => {
    const result = syncSceneToAtmosphere('Schnee und Wind', 42);
    expect(result.matchedLayers).toContain('foley-footsteps');
    expect(result.matchedLayers).toContain('foley-weather');
  });

  it('erzeugt Cues mit Trigger und Intensität', () => {
    const result = syncSceneToAtmosphere('Wind', 42);
    expect(result.cues.length).toBeGreaterThan(0);
    for (const cue of result.cues) {
      expect(cue.trigger).toBeTruthy();
      expect(cue.intensity).toBeGreaterThanOrEqual(0);
      expect(cue.intensity).toBeLessThanOrEqual(1);
    }
  });

  it('berechnet eine positive Dauer in Sekunden', () => {
    const result = syncSceneToAtmosphere('Ein langer Text mit vielen Wörtern', 42);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });

  it('ist deterministisch für gleichen Text und Seed', () => {
    const r1 = syncSceneToAtmosphere('Kathedrale und Fackel', 42);
    const r2 = syncSceneToAtmosphere('Kathedrale und Fackel', 42);
    expect(r1).toEqual(r2);
  });
});

describe('buildMixerPatch', () => {
  it('erzeugt Oszillator-Einträge für jede Schicht', () => {
    const patch = buildMixerPatch(
      [{ id: 'foley-weather', gain: 0.5 }],
      20,
    );
    expect(patch.oscillators).toHaveLength(1);
    expect(patch.oscillators[0].frequency).toBeGreaterThan(0);
    expect(patch.oscillators[0].gain).toBeGreaterThanOrEqual(0);
  });

  it('besitzt einen Master-Gain zwischen 0 und 1', () => {
    const patch = buildMixerPatch(
      [{ id: 'foley-ambience', gain: 0.3 }],
      15,
    );
    expect(patch.masterGain).toBeGreaterThanOrEqual(0);
    expect(patch.masterGain).toBeLessThanOrEqual(1);
  });

  it('enthält eine deutsche Instruktion', () => {
    const patch = buildMixerPatch(
      [{ id: 'foley-mechanical', gain: 0.4 }],
      25,
    );
    expect(patch.instruction).toBeTruthy();
    expect(typeof patch.instruction).toBe('string');
  });

  it('ist deterministisch für gleiche Eingabe', () => {
    const p1 = buildMixerPatch([{ id: 'foley-effects', gain: 0.5 }], 30);
    const p2 = buildMixerPatch([{ id: 'foley-effects', gain: 0.5 }], 30);
    expect(p1).toEqual(p2);
  });
});

describe('createSampleScene', () => {
  it('liefert eine gültige Szenen-Atmosphäre', () => {
    const scene = createSampleScene();
    expect(scene.matchedLayers.length).toBeGreaterThan(0);
    expect(scene.cues.length).toBeGreaterThan(0);
    expect(scene.durationSeconds).toBeGreaterThan(0);
  });
});

describe('createSampleMixerPatch', () => {
  it('liefert einen gültigen Mixer-Patch über alle Schichten', () => {
    const patch = createSampleMixerPatch();
    expect(patch.oscillators).toHaveLength(6);
    expect(patch.masterGain).toBeGreaterThanOrEqual(0);
    expect(patch.masterGain).toBeLessThanOrEqual(1);
    expect(patch.instruction).toBeTruthy();
  });
});
