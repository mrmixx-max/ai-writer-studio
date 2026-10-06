/**
 * Tests: PlanetaryClimateEngine (WP 82.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  computeClimateZones,
  computeSeasons,
  computePolarNightDays,
  computeMonsoonMonths,
  generateClimateReport,
  formatClimateReport,
  createSampleClimateReport,
  type PlanetParams,
} from "./planetaryClimateEngine";

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

describe("computeClimateZones", () => {
  it("berechnet 5 Klimazonen", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const zones = computeClimateZones(params);
    expect(zones).toHaveLength(5);
  });
});

describe("computeSeasons", () => {
  it("berechnet 4 Jahreszeiten", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const seasons = computeSeasons(params);
    expect(seasons).toHaveLength(4);
  });
});

describe("computePolarNightDays", () => {
  it("berechnet Polarnächte", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const days = computePolarNightDays(params);
    expect(days).toBeGreaterThanOrEqual(0);
  });
});

describe("computeMonsoonMonths", () => {
  it("berechnet Monsunmonate", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const months = computeMonsoonMonths(params);
    expect(months).toBeGreaterThanOrEqual(1);
  });
});

describe("generateClimateReport", () => {
  it("erstellt vollständigen Bericht", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const report = generateClimateReport("Test", params);
    expect(report.planetName).toBe("Test");
    expect(report.zones.length).toBe(5);
    expect(report.seasons.length).toBe(4);
  });

  it("ist deterministisch", () => {
    const params: PlanetParams = { dayLengthHours: 24, yearLengthDays: 365, axialTiltDeg: 23, moonCount: 2, orbitalEccentricity: 0.1 };
    const r1 = generateClimateReport("Test", params);
    const r2 = generateClimateReport("Test", params);
    expect(r1).toEqual(r2);
  });
});

describe("formatClimateReport", () => {
  it("formatiert Bericht als Text", () => {
    const report = createSampleClimateReport();
    const text = formatClimateReport(report);
    expect(text).toContain("KLIMABERICHT");
  });
});

describe("createSampleClimateReport", () => {
  it("erstellt Beispiel-Bericht", () => {
    const report = createSampleClimateReport();
    expect(report.planetName).toBeTruthy();
    expect(report.zones.length).toBe(5);
  });
});
