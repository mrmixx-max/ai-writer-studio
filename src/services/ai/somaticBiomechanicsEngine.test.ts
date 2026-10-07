// @vitest-environment jsdom
/** Tests: SomaticBiomechanicsEngine (WP 92.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createSomaticProfile,
  injectSomaticProse,
  formatSomaticProfile,
  createSampleProfile as _createSampleProfile,
  createSampleInjection as _createSampleInjection,
  type SomaticProfile as _SomaticProfile,
  type AutonomicState as _AutonomicState,
} from "./somaticBiomechanicsEngine";

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

describe("createSomaticProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createSomaticProfile("Test", 123);
    expect(profile.id).toContain("SOM-");
    expect(profile.trigger).toBe("Test");
    expect(profile.autonomicState).toBeDefined();
    expect(profile.cascade).toBeDefined();
    expect(profile.intensity).toBeGreaterThanOrEqual(5);
    expect(profile.intensity).toBeLessThanOrEqual(10);
    expect(profile.proseInjection).toBeTruthy();
  });

  it("hat gültigen autonomen Zustand", () => {
    const profile = createSomaticProfile("Test", 1);
    const validStates = ["sympathetic_fight", "sympathetic_flight", "parasympathetic_freeze", "cold_flow"];
    expect(validStates).toContain(profile.autonomicState);
  });

  it("Cascade hat alle drei Komponenten", () => {
    const profile = createSomaticProfile("Test", 999);
    expect(profile.cascade.vasoconstriction).toBeTruthy();
    expect(profile.cascade.sensoryNarrowing).toBeTruthy();
    expect(profile.cascade.visceralReflex).toBeTruthy();
  });

  it("ist deterministisch", () => {
    const p1 = createSomaticProfile("Test", 42);
    const p2 = createSomaticProfile("Test", 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Trigger erzeugen verschiedene Profile", () => {
    const p1 = createSomaticProfile("Trigger A", 1);
    const p2 = createSomaticProfile("Trigger B", 1);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("injectSomaticProse", () => {
  it("fügt somatische Prosa an mentale Prosa an", () => {
    const profile = _createSampleProfile();
    const mental = "Er dachte an morgen.";
    const result = injectSomaticProse(mental, profile);
    expect(result).toContain(mental);
    expect(result).toContain(profile.proseInjection);
  });
});

describe("formatSomaticProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = _createSampleProfile();
    const text = formatSomaticProfile(profile);
    expect(text).toContain("SOMATISCHES PROFIL");
    expect(text).toContain("VASOKONSTRIKTION");
    expect(text).toContain("SENSORISCHE VERENGERUNG");
    expect(text).toContain("VISCERALER REFLEX");
    expect(text).toContain("PROSA-INJEKTION");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = _createSampleProfile();
    expect(profile.trigger).toBe("Duell bei Sonnenaufgang");
    expect(profile.id).toContain("SOM-");
  });
});

describe("createSampleInjection", () => {
  it("erzeugt Beispiel-Injektion", () => {
    const injection = _createSampleInjection();
    expect(injection).toContain("Er dachte an den morgigen Tag.");
    expect(injection.length).toBeGreaterThan(50);
  });
});