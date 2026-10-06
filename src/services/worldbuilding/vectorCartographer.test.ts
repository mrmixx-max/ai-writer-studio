/**
 * Tests: VectorCartographer (WP 84.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  computeDistance,
  calculateTravelTime,
  formatPath,
  createSamplePath,
  createSampleMap,
  TRAVEL_SPEEDS,
} from "./vectorCartographer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("computeDistance", () => {
  it("berechnet Distanz korrekt", () => {
    expect(computeDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(50);
  });
});

describe("calculateTravelTime", () => {
  it("berechnet Reisedauer", () => {
    const path = createSamplePath();
    const result = calculateTravelTime(path);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.durationDays).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const path = createSamplePath();
    const r1 = calculateTravelTime(path);
    const r2 = calculateTravelTime(path);
    expect(r1).toEqual(r2);
  });
});

describe("formatPath", () => {
  it("formatiert Pfad als Text", () => {
    const path = createSamplePath();
    const text = formatPath(path);
    expect(text).toContain("REISEZEIT-PATHFINDER");
  });
});

describe("createSamplePath", () => {
  it("erstellt Beispiel-Pfad", () => {
    const path = createSamplePath();
    expect(path.waypoints.length).toBe(4);
    expect(path.mode).toBe("mounted");
  });
});

describe("createSampleMap", () => {
  it("erstellt Beispiel-Karte", () => {
    const map = createSampleMap();
    expect(map.length).toBeGreaterThan(0);
  });
});

describe("TRAVEL_SPEEDS", () => {
  it("hat alle Modi", () => {
    expect(Object.keys(TRAVEL_SPEEDS)).toHaveLength(4);
  });

  it("hat alle Terrain-Typen", () => {
    for (const mode of Object.keys(TRAVEL_SPEEDS)) {
      expect(Object.keys(TRAVEL_SPEEDS[mode as keyof typeof TRAVEL_SPEEDS])).toHaveLength(8);
    }
  });
});