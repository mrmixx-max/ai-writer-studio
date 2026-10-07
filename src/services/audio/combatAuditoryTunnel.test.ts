// @vitest-environment jsdom
/** Tests: CombatAuditoryTunnel (WP 87.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createShockProfile,
  simulateAuditoryState,
  generateShockProse,
  createSampleProfile,
  createSampleProse,
  createSampleState,
  type ShockProfile as _ShockProfile,
  type AuditoryState as _AuditoryState,
  type ShockProse as _ShockProse,
  type ShockSource,
} from "./combatAuditoryTunnel";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("createShockProfile", () => {
  it("erzeugt Profil für alle Quellen", () => {
    const sources: ShockSource[] = ["explosion", "naher_schuss", "schwert_auf_helm", "kanonendonner", "magischer_knall", "donner", "granate", "schallwand"];
    for (const src of sources) {
      const profile = createShockProfile(src, 123);
      expect(profile.source).toBe(src);
      expect(profile.peakDb).toBeGreaterThan(130);
      expect(profile.peakDb).toBeLessThan(200);
      expect(profile.durationMs).toBeGreaterThan(0);
      expect(profile.tinnitusFreqHz).toBeGreaterThan(2000);
      expect(profile.tinnitusFreqHz).toBeLessThan(10000);
      expect(profile.recoveryTimeS).toBeGreaterThan(0);
      expect(profile.heartRateBpm).toBeGreaterThan(60);
    }
  });

  it("ist deterministisch", () => {
    const p1 = createShockProfile("explosion", 42);
    const p2 = createShockProfile("explosion", 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Quellen → unterschiedliche Profile", () => {
    const p1 = createShockProfile("explosion", 1);
    const p2 = createShockProfile("naher_schuss", 1);
    expect(p1.peakDb).not.toBe(p2.peakDb);
  });
});

describe("simulateAuditoryState", () => {
  const profile = createSampleProfile();

  it("Schock-Phase: gedämpft, Tinnitus aktiv, hoher Puls", () => {
    const state = simulateAuditoryState(profile, 50);
    expect(state.timeMs).toBe(50);
    expect(state.muffledFactor).toBeGreaterThan(0);
    expect(state.ringing).toBe(true);
    expect(state.heartRateBpm).toBeGreaterThan(100);
    expect(state.lowPassFreq).toBeLessThan(20000);
  });

  it("Erholungs-Phase: Werte normalisieren sich", () => {
    const state = simulateAuditoryState(profile, profile.durationMs + 1000);
    expect(state.muffledFactor).toBeLessThan(1);
    expect(state.ambientDb).toBeGreaterThan(20);
  });

  it("Nach Erholung: Normalzustand", () => {
    const state = simulateAuditoryState(profile, profile.recoveryTimeS * 1000 + 1000);
    expect(state.muffledFactor).toBe(0);
    expect(state.ringing).toBe(false);
    expect(state.ambientDb).toBe(60);
    expect(state.heartRateBpm).toBe(70);
    expect(state.lowPassFreq).toBe(20000);
  });

  it("Zeit 0 = Schock-Beginn", () => {
    const state = simulateAuditoryState(profile, 0);
    expect(state.timeMs).toBe(0);
    expect(state.ringing).toBe(true);
  });

  it("ist deterministisch", () => {
    const s1 = simulateAuditoryState(profile, 5000);
    const s2 = simulateAuditoryState(profile, 5000);
    expect(s1).toEqual(s2);
  });
});

describe("generateShockProse", () => {
  it("erzeugt Prosa in allen 4 Sprachen", () => {
    const prose = generateShockProse(createSampleProfile(), "de");
    expect(prose.german).toBeDefined();
    expect(prose.english).toBeDefined();
    expect(prose.spanish).toBeDefined();
    expect(prose.french).toBeDefined();
    expect(prose.intensity).toMatch(/leicht|mittel|schwer|extrem/);
    expect(prose.sensoryDetails.length).toBeGreaterThan(0);
  });

  it("Intensität skaliert mit Peak-dB", () => {
    const low = generateShockProse({ ...createSampleProfile(), peakDb: 140 }, "de");
    const high = generateShockProse({ ...createSampleProfile(), peakDb: 180 }, "de");
    const order = ["leicht", "mittel", "schwer", "extrem"];
    expect(order.indexOf(high.intensity)).toBeGreaterThanOrEqual(order.indexOf(low.intensity));
  });

  it("ist deterministisch", () => {
    const p1 = generateShockProse(createSampleProfile(), "de");
    const p2 = generateShockProse(createSampleProfile(), "de");
    expect(p1).toEqual(p2);
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispiel-Profil", () => {
    const p = createSampleProfile();
    expect(p.source).toBe("explosion");
    expect(p.peakDb).toBeGreaterThan(160);
  });
});

describe("createSampleProse", () => {
  it("erzeugt Beispiel-Prosa", () => {
    const prose = createSampleProse();
    expect(prose.german).toContain("Öl");
    expect(prose.intensity).toBe("schwer");
  });
});

describe("createSampleState", () => {
  it("erzeugt Beispiel-Zustand", () => {
    const state = createSampleState();
    expect(state.timeMs).toBe(5000);
    expect(state.muffledFactor).toBeGreaterThan(0);
  });
});