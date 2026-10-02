/**
 * Tests für den Spatiotemporal Service (WP 16.1)
 */

import { describe, it, expect } from 'vitest';
import {
  getDistance,
  calculateTravelTime,
  checkTravelFeasibility,
  type Coord,

} from './mapService';

describe('getDistance', () => {
  it('berechnet euklidische Distanz korrekt', () => {
    const a: Coord = { x: 0, y: 0 };
    const b: Coord = { x: 3, y: 4 };
    expect(getDistance(a, b)).toBe(5);
  });

  it('berechnet Manhattan-Distanz korrekt', () => {
    const a: Coord = { x: 0, y: 0 };
    const b: Coord = { x: 3, y: 4 };
    expect(getDistance(a, b, 'manhattan')).toBe(7);
  });

  it('gibt 0 für identische Punkte zurück', () => {
    const a: Coord = { x: 10, y: 20 };
    expect(getDistance(a, a)).toBe(0);
  });

  it('handhabt fehlende Koordinaten defensiv', () => {
    const a: Coord = { x: 0, y: 0 };
    expect(getDistance(a, null as unknown as Coord)).toBe(0);
    expect(getDistance(null as unknown as Coord, a)).toBe(0);
  });
});

describe('calculateTravelTime', () => {
  const from: Coord = { x: 0, y: 0 };
  const to: Coord = { x: 30, y: 0 }; // 30 km

  it('berechnet Reisezeit für Fußgänger', () => {
    const result = calculateTravelTime(from, to, 'foot');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(0);
  });

  it('berechnet Reisezeit für Pferd', () => {
    const result = calculateTravelTime(from, to, 'horse');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBeCloseTo(14.4, 1);
  });

  it('berechnet Reisezeit für Kutsche', () => {
    const result = calculateTravelTime(from, to, 'carriage');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBeCloseTo(10.29, 1);
  });

  it('berechnet Reisezeit für Schiff', () => {
    const result = calculateTravelTime(from, to, 'ship');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBeCloseTo(7.2, 1);
  });

  it('berechnet Reisezeit für modernen Verkehr', () => {
    const result = calculateTravelTime(from, to, 'modern');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBeCloseTo(1.44, 1);
  });

  it('berücksichtigt Gelände-Multiplikatoren', () => {
    const roadResult = calculateTravelTime(from, to, 'foot', 'road');
    const mountainResult = calculateTravelTime(from, to, 'foot', 'mountain');
    expect(mountainResult.days).toBeGreaterThan(roadResult.days);
  });

  it('handhabt fehlende Koordinaten defensiv', () => {
    const result = calculateTravelTime(null as unknown as Coord, to, 'foot');
    expect(result.feasible).toBe(false);
  });

  it('gibt 0 Tage für identische Punkte zurück', () => {
    const result = calculateTravelTime(from, from, 'foot');
    expect(result.feasible).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
  });
});

describe('checkTravelFeasibility', () => {
  const from: Coord = { x: 0, y: 0 };
  const to: Coord = { x: 30, y: 0 }; // 30 km
  const chapterDate = new Date('2024-01-01');

  it('prüft Machbarkeit für kurze Reise', () => {
    const result = checkTravelFeasibility(chapterDate, from, to, 'foot');
    expect(result.feasible).toBe(true);
    expect(result.requiredDays).toBeLessThanOrEqual(result.availableDays);
  });

  it('prüft Nicht-Machbarkeit für lange Reise', () => {
    const farTo: Coord = { x: 3000, y: 0 }; // 3000 km
    const result = checkTravelFeasibility(chapterDate, from, farTo, 'foot');
    expect(result.feasible).toBe(false);
  });

  it('verwendet Standard-Verfügbarkeit von 30 Tagen ohne Deadline', () => {
    const result = checkTravelFeasibility(chapterDate, from, to, 'foot');
    expect(result.availableDays).toBe(30);
  });

  it('berücksichtigt benutzerdefinierte Deadline', () => {
    const deadline = new Date('2024-01-10'); // 9 Tage später
    const result = checkTravelFeasibility(chapterDate, from, to, 'foot', deadline);
    expect(result.availableDays).toBe(9);
  });

  it('handhabt ungültigen Zeitstempel defensiv', () => {
    const result = checkTravelFeasibility(
      new Date('invalid'),
      from,
      to,
      'foot',
    );
    expect(result.feasible).toBe(false);
    expect(result.message).toContain('Ungültig');
  });
});
