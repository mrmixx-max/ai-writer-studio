/**
 * Tests: KineticStuntChoreographer (WP 75.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  computeKineticEnergy,
  computeImpactForce,
  computeFallTime,
  computeMaxSpeedAfterFall,
  isSurvivable,
  computeStunt,
  generateStuntMontage,
  formatStuntMontage,
  createSampleMontage,
  FRICTION_COEFFS,
  type KineticParams,
  type StuntResult,
} from "./kineticStuntChoreographer";

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

describe("computeKineticEnergy", () => {
  it("berechnet Energie korrekt", () => {
    // 75 kg bei 36 km/h (10 m/s) = 0.5 * 75 * 100 = 3750 J = 3.75 kJ
    expect(computeKineticEnergy(75, 36)).toBe(3.75);
  });

  it("gibt 0 für 0 Masse", () => {
    expect(computeKineticEnergy(0, 100)).toBe(0);
  });

  it("gibt 0 für 0 Geschwindigkeit", () => {
    expect(computeKineticEnergy(75, 0)).toBe(0);
  });
});

describe("computeImpactForce", () => {
  it("berechnet Kraft korrekt", () => {
    const force = computeImpactForce(75, 36, 2);
    expect(force).toBeGreaterThan(0);
  });

  it("gibt 0 für 0 Bremsweg", () => {
    expect(computeImpactForce(75, 36, 0)).toBe(0);
  });
});

describe("computeFallTime", () => {
  it("berechnet Fallzeit korrekt", () => {
    // h = 0.5 * g * t^2 → t = sqrt(2h/g)
    // 10m: t ≈ 1.43s
    expect(computeFallTime(10)).toBeCloseTo(1.43, 1);
  });

  it("gibt 0 für 0 Höhe", () => {
    expect(computeFallTime(0)).toBe(0);
  });
});

describe("computeMaxSpeedAfterFall", () => {
  it("berechnet Maximalgeschwindigkeit", () => {
    // v = sqrt(2gh) → 10m: v ≈ 14 m/s ≈ 50.4 km/h
    expect(computeMaxSpeedAfterFall(10)).toBeGreaterThan(0);
  });

  it("gibt 0 für 0 Höhe", () => {
    expect(computeMaxSpeedAfterFall(0)).toBe(0);
  });
});

describe("isSurvivable", () => {
  it("erkennt überlebbaren Stunt", () => {
    const result: StuntResult = {
      kineticEnergyKj: 1,
      impactForceKn: 10,
      fallTimeSec: 1,
      maxSpeedKmh: 20,
      isSurvivable: true,
      description: "Test",
    };
    expect(isSurvivable(result)).toBe(true);
  });

  it("erkennt tödlichen Stunt", () => {
    const result: StuntResult = {
      kineticEnergyKj: 100,
      impactForceKn: 100,
      fallTimeSec: 10,
      maxSpeedKmh: 200,
      isSurvivable: false,
      description: "Test",
    };
    expect(isSurvivable(result)).toBe(false);
  });
});

describe("computeStunt", () => {
  it("berechnet vollständigen Stunt", () => {
    const params: KineticParams = {
      speedKmh: 50,
      fallHeightM: 5,
      massKg: 75,
      frictionCoeff: 0.5,
      recoilForceN: 100,
      brakingDistanceM: 5,
    };
    const result = computeStunt(params);
    expect(result.kineticEnergyKj).toBeGreaterThan(0);
    expect(result.impactForceKn).toBeGreaterThan(0);
    expect(result.fallTimeSec).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const params: KineticParams = {
      speedKmh: 50,
      fallHeightM: 5,
      massKg: 75,
      frictionCoeff: 0.5,
      recoilForceN: 100,
      brakingDistanceM: 5,
    };
    expect(computeStunt(params)).toEqual(computeStunt(params));
  });
});

describe("generateStuntMontage", () => {
  it("generiert Montage", () => {
    const params: KineticParams = {
      speedKmh: 100,
      fallHeightM: 10,
      massKg: 75,
      frictionCoeff: 0.5,
      recoilForceN: 100,
      brakingDistanceM: 2,
    };
    const montage = generateStuntMontage("Test", params, 50);
    expect(montage.title).toBe("Test");
    expect(montage.prose.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const params: KineticParams = {
      speedKmh: 100,
      fallHeightM: 10,
      massKg: 75,
      frictionCoeff: 0.5,
      recoilForceN: 100,
      brakingDistanceM: 2,
    };
    const m1 = generateStuntMontage("Test", params, 50);
    const m2 = generateStuntMontage("Test", params, 50);
    expect(m1).toEqual(m2);
  });
});

describe("formatStuntMontage", () => {
  it("formatiert Montage als Text", () => {
    const montage = createSampleMontage();
    const text = formatStuntMontage(montage);
    expect(text).toContain("STUNT-MONTAGE");
    expect(text).toContain("Rule of Cool");
  });
});

describe("createSampleMontage", () => {
  it("erstellt Beispiel-Montage", () => {
    const montage = createSampleMontage();
    expect(montage.title).toBeTruthy();
    expect(montage.prose.length).toBeGreaterThan(0);
  });
});

describe("FRICTION_COEFFS", () => {
  it("hat mindestens 5 Oberflächen", () => {
    expect(Object.keys(FRICTION_COEFFS).length).toBeGreaterThanOrEqual(5);
  });

  it("hat Eis mit niedrigster Reibung", () => {
    expect(FRICTION_COEFFS.ice).toBeLessThan(FRICTION_COEFFS.dry_asphalt);
  });
});
