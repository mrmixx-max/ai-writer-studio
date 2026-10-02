/**
 * Tests für den Choreografie-Service (WP 26.2)
 * Räumliche Szenen-Choreografie & Sichtachsen
 */

import { describe, it, expect } from 'vitest';
import {
  placeOnGrid,
  calculateLineOfSight,
  calculateSoundPropagation,
  type GridEntity,
  type Obstacle,
} from './choreography';

// ─── Test-Helpers ────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<GridEntity> = {}): GridEntity {
  return {
    id: 'test-entity',
    type: 'character',
    x: 0,
    y: 0,
    rotation: 0,
    ...overrides,
  };
}

function makeObstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    x: 5,
    y: 5,
    width: 2,
    height: 2,
    type: 'wall',
    blocksSight: true,
    blocksSound: true,
    ...overrides,
  };
}

// ─── placeOnGrid ─────────────────────────────────────────────────────────────

describe('placeOnGrid', () => {
  it('platziert Figur korrekt mit x, y und rotation', () => {
    const entity = makeEntity({ id: 'hero', name: 'Held' });
    const placed = placeOnGrid(entity, 10, 20, 90);

    expect(placed.x).toBe(10);
    expect(placed.y).toBe(20);
    expect(placed.rotation).toBe(90);
    expect(placed.id).toBe('hero');
    expect(placed.name).toBe('Held');
  });

  it('normalisiert negative Winkel auf [0, 360)', () => {
    const entity = makeEntity();
    const placed = placeOnGrid(entity, 0, 0, -90);

    expect(placed.rotation).toBe(270);
  });

  it('normalisiert Winkel >= 360 auf [0, 360)', () => {
    const entity = makeEntity();
    const placed = placeOnGrid(entity, 0, 0, 450);

    expect(placed.rotation).toBe(90);
  });

  it('behält bestehende Rotation bei undefined', () => {
    const entity = makeEntity({ rotation: 45 });
    const placed = placeOnGrid(entity, 3, 4, undefined);

    expect(placed.rotation).toBe(45);
  });

  it('defensiv: NaN und Infinity Koordinaten → 0', () => {
    const entity = makeEntity();
    const placed = placeOnGrid(entity, NaN, Infinity, NaN);

    expect(placed.x).toBe(0);
    expect(placed.y).toBe(0);
    expect(placed.rotation).toBe(0);
  });
});

// ─── calculateLineOfSight ────────────────────────────────────────────────────

describe('calculateLineOfSight', () => {
  it('gibt freie Sicht ohne Hindernisse zurück', () => {
    const from = makeEntity({ x: 0, y: 0 });
    const to = makeEntity({ x: 10, y: 0 });

    const result = calculateLineOfSight(from, to, []);

    expect(result.visible).toBe(true);
    expect(result.blockedBy).toBeUndefined();
    expect(result.distance).toBe(10);
  });

  it('blockiert Sicht durch Wand mit blocksSight=true', () => {
    const from = makeEntity({ x: 0, y: 0 });
    const to = makeEntity({ x: 10, y: 0 });
    const wall = makeObstacle({ x: 4, y: -1, width: 2, height: 2, type: 'wall', blocksSight: true });

    const result = calculateLineOfSight(from, to, [wall]);

    expect(result.visible).toBe(false);
    expect(result.blockedBy).toBe(wall);
    expect(result.distance).toBe(10);
  });

  it('blockiert Sicht durch Tür mit blocksSight=true', () => {
    const from = makeEntity({ x: 0, y: 5 });
    const to = makeEntity({ x: 10, y: 5 });
    const door = makeObstacle({ x: 4, y: 4, width: 2, height: 2, type: 'door', blocksSight: true });

    const result = calculateLineOfSight(from, to, [door]);

    expect(result.visible).toBe(false);
    expect(result.blockedBy).toBe(door);
  });

  it('blockiert Sicht nicht wenn blocksSight=false', () => {
    const from = makeEntity({ x: 0, y: 0 });
    const to = makeEntity({ x: 10, y: 0 });
    const cover = makeObstacle({ x: 4, y: -1, width: 2, height: 2, type: 'pillar', blocksSight: false });

    const result = calculateLineOfSight(from, to, [cover]);

    expect(result.visible).toBe(true);
    expect(result.blockedBy).toBeUndefined();
  });

  it('defensiv: fehlende Entität → nicht sichtbar', () => {
    const from = makeEntity({ x: 0, y: 0 });
    const to = makeEntity({ x: 10, y: 0 });

    const result = calculateLineOfSight(null as unknown as GridEntity, to, []);
    expect(result.visible).toBe(false);
    expect(result.distance).toBe(0);

    const result2 = calculateLineOfSight(from, null as unknown as GridEntity, []);
    expect(result2.visible).toBe(false);
    expect(result2.distance).toBe(0);
  });

  it('defensiv: leere Hindernisliste → freie Sicht', () => {
    const from = makeEntity({ x: 0, y: 0 });
    const to = makeEntity({ x: 10, y: 10 });

    const result = calculateLineOfSight(from, to, []);

    expect(result.visible).toBe(true);
    expect(result.distance).toBeCloseTo(Math.sqrt(200), 5);
  });

  it('identische Position → immer sichtbar', () => {
    const from = makeEntity({ x: 5, y: 5 });
    const to = makeEntity({ x: 5, y: 5 });

    const result = calculateLineOfSight(from, to, [makeObstacle({ x: 4, y: 4, width: 2, height: 2 })]);

    expect(result.visible).toBe(true);
    expect(result.distance).toBe(0);
  });
});

// ─── calculateSoundPropagation ───────────────────────────────────────────────

describe('calculateSoundPropagation', () => {
  it('hörbar bei kurzer Distanz ohne Hindernisse', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 3, y: 0 });

    const result = calculateSoundPropagation(source, target, [], 'normal');

    expect(result.audible).toBe(true);
    expect(result.volume).toBeGreaterThan(0);
    expect(result.volume).toBeLessThanOrEqual(1);
  });

  it('nicht hörbar bei zu großer Distanz für whisper', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 10, y: 0 });

    const result = calculateSoundPropagation(source, target, [], 'whisper');

    expect(result.audible).toBe(false);
    expect(result.volume).toBe(0);
    expect(result.reason).toContain('Distanz');
  });

  it('hörbar bei gleicher Distanz für shout', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 10, y: 0 });

    const result = calculateSoundPropagation(source, target, [], 'shout');

    expect(result.audible).toBe(true);
    expect(result.volume).toBeGreaterThan(0);
  });

  it('dämpft Schall durch Wand mit blocksSound=true', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 10, y: 0 });
    const wall = makeObstacle({ x: 4, y: -1, width: 2, height: 2, type: 'wall', blocksSound: true });

    const result = calculateSoundPropagation(source, target, [wall], 'normal');

    expect(result.audible).toBe(true);
    expect(result.volume).toBeLessThan(1);
  });

  it('dämpft Schall nicht wenn blocksSound=false', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 10, y: 0 });
    const pillar = makeObstacle({ x: 4, y: -1, width: 2, height: 2, type: 'pillar', blocksSound: false });

    const result = calculateSoundPropagation(source, target, [pillar], 'normal');

    expect(result.audible).toBe(true);
    expect(result.volume).toBeGreaterThan(0);
  });

  it('defensiv: fehlende Entität → nicht hörbar', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 5, y: 0 });

    const result = calculateSoundPropagation(null as unknown as GridEntity, target, [], 'normal');
    expect(result.audible).toBe(false);
    expect(result.volume).toBe(0);

    const result2 = calculateSoundPropagation(source, null as unknown as GridEntity, [], 'normal');
    expect(result2.audible).toBe(false);
    expect(result2.volume).toBe(0);
  });

  it('defensiv: unbekannter Schalltyp → Fallback auf normal', () => {
    const source = makeEntity({ x: 0, y: 0 });
    const target = makeEntity({ x: 5, y: 0 });

    const result = calculateSoundPropagation(source, target, [], 'loud' as unknown as 'normal');

    expect(result.audible).toBe(true);
    expect(result.volume).toBeGreaterThan(0);
  });

  it('identische Position → immer hörbar mit volume=1', () => {
    const source = makeEntity({ x: 5, y: 5 });
    const target = makeEntity({ x: 5, y: 5 });

    const result = calculateSoundPropagation(source, target, [], 'whisper');

    expect(result.audible).toBe(true);
    expect(result.volume).toBe(1);
    expect(result.reason).toContain('Gleiche Position');
  });
});
