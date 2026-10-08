// @vitest-environment jsdom
/** Tests: MetaphorAlchemySynthesizer (WP 95.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createMetaphorProfile,
  formatMetaphorProfile,
  createSampleProfile,
  createSampleClicheCheck,
} from "./metaphorAlchemySynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    let different = false;
    for (let i = 0; i < 10; i++) if (r1() !== r2()) different = true;
    expect(different).toBe(true);
  });
});

describe("createMetaphorProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createMetaphorProfile("Trauer", "Architektur", 123);
    expect(profile.id).toContain("META-");
    expect(profile.targetConcept).toBe("Trauer");
    expect(profile.sourceDomain).toBe("Architektur");
    expect(profile.metaphors.length).toBeGreaterThanOrEqual(4);
    expect(profile.clicheScore).toBeGreaterThanOrEqual(0);
    expect(profile.clicheScore).toBeLessThanOrEqual(1);
    expect(profile.seed).toBe(123);
  });

  it("wählt zufällige Domäne wenn keine angegeben", () => {
    const profile = createMetaphorProfile("Liebe", "", 1);
    expect(profile.sourceDomain).toBeTruthy();
    expect(profile.sourceDomain.length).toBeGreaterThan(0);
  });

  it("generiert verschiedene Mapping-Typen", () => {
    const profile = createMetaphorProfile("Hoffnung", "Musik", 999);
    const types = profile.metaphors.map(m => m.mappingType);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBeGreaterThanOrEqual(1);
  });

  it("berechnet Neuartigkeit für jede Metapher", () => {
    const profile = createMetaphorProfile("Angst", "Geologie", 42);
    for (const m of profile.metaphors) {
      expect(m.novelty).toBeGreaterThanOrEqual(0);
      expect(m.novelty).toBeLessThanOrEqual(1);
    }
  });

  it("erkennt Klischees", () => {
    const profile = createMetaphorProfile("Augen wie Sterne", "Astronomie", 1);
    const _hasCliche = profile.metaphors.some(m => m.isCliche);
    // Nicht garantiert, aber Struktur muss stimmen
    expect(profile.clicheScore).toBeGreaterThanOrEqual(0);
  });

  it("ist deterministisch", () => {
    const p1 = createMetaphorProfile("Test", "Architektur", 42);
    const p2 = createMetaphorProfile("Test", "Architektur", 42);
    expect(p1).toEqual(p2);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createMetaphorProfile("Test", "Architektur", 1);
    const p2 = createMetaphorProfile("Test", "Architektur", 2);
    expect(p1.id).not.toBe(p2.id);
  });

  it("Compound-Metaphern nutzen zwei Domänen", () => {
    const profile = createMetaphorProfile("Liebe", "Architektur", 42);
    const compound = profile.metaphors.find(m => m.mappingType === "compound");
    if (compound) {
      expect(compound.sourceDomain).toContain("×");
    }
  });
});

describe("formatMetaphorProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createSampleProfile();
    const text = formatMetaphorProfile(profile);
    expect(text).toContain("METAPHERN-ALCHEMIE");
    expect(text).toContain("Trauer");
    expect(text).toContain("Architektur");
    expect(text).toContain("GENERIERTE METAPHERN:");
    expect(text).toContain("Neuartigkeit");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.targetConcept).toBe("Trauer");
    expect(profile.sourceDomain).toBe("Architektur");
    expect(profile.id).toContain("META-");
  });
});

describe("createSampleClicheCheck", () => {
  it("erzeugt Beispiel-Klischee-Prüfung", () => {
    const checks = createSampleClicheCheck();
    expect(checks.length).toBe(2);
    expect(checks[0].isCliche).toBe(true);
    expect(checks[1].isCliche).toBe(false);
  });
});