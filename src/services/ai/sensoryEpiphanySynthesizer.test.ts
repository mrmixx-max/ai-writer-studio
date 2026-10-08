// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createSensoryEpiphanyProfile,
  formatSensoryEpiphanyProfile,
  createSampleProfile,
} from "./sensoryEpiphanySynthesizer";

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
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });
  it("unterschiedliche Seeds erzeugen unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });
});

describe("createSensoryEpiphanyProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createSensoryEpiphanyProfile("visual", "Test", 123);
    expect(profile.id).toContain("EPIPH-");
    expect(profile.triggerSense).toBe("visual");
    expect(profile.characterName).toBe("Test");
    expect(profile.triggerDetail).toBeTruthy();
    expect(profile.phase1_stillness).toBeTruthy();
    expect(profile.phase2_collapse).toBeTruthy();
    expect(profile.phase3_catharsis).toBeTruthy();
    expect(profile.fullEpiphanyText).toContain(profile.phase1_stillness);
    expect(profile.seed).toBe(123);
  });

  it("alle fünf Sinne verfügbar", () => {
    const senses = ["visual", "auditory", "olfactory", "tactile", "gustatory"] as const;
    for (const sense of senses) {
      const profile = createSensoryEpiphanyProfile(sense, "Test", 1);
      expect(profile.triggerSense).toBe(sense);
    }
  });

  it("Phase 1 enthält Stillstand-Motive", () => {
    const profile = createSensoryEpiphanyProfile("visual", "Elara", 1);
    // Template 1 doesn't include {character}, so check for the trigger detail instead
    expect(profile.phase1_stillness).toContain("Staubtanzen");
    expect(profile.phase1_stillness.length).toBeGreaterThan(20);
  });

  it("Phase 2 enthält Zusammenbruch-Motive", () => {
    const profile = createSensoryEpiphanyProfile("auditory", "K", 2);
    expect(profile.phase2_collapse).toContain("K");
    expect(profile.phase2_collapse.length).toBeGreaterThan(20);
  });

  it("Phase 3 enthält Katharsis-Motive", () => {
    const profile = createSensoryEpiphanyProfile("olfactory", "Maria", 3);
    expect(profile.phase3_catharsis).toContain("Maria");
    expect(profile.phase3_catharsis.length).toBeGreaterThan(20);
  });

  it("vollständiger Text vereint alle Phasen", () => {
    const profile = createSensoryEpiphanyProfile("tactile", "Test", 4);
    expect(profile.fullEpiphanyText).toContain(profile.phase1_stillness);
    expect(profile.fullEpiphanyText).toContain(profile.phase2_collapse);
    expect(profile.fullEpiphanyText).toContain(profile.phase3_catharsis);
  });

  it("ist deterministisch", () => {
    const p1 = createSensoryEpiphanyProfile("visual", "Test", 42);
    const p2 = createSensoryEpiphanyProfile("visual", "Test", 42);
    expect(p1.id).toBe(p2.id);
    expect(p1.fullEpiphanyText).toBe(p2.fullEpiphanyText);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createSensoryEpiphanyProfile("visual", "Test", 1);
    const p2 = createSensoryEpiphanyProfile("visual", "Test", 2);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("formatSensoryEpiphanyProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createSensoryEpiphanyProfile("visual", "Test", 1);
    const formatted = formatSensoryEpiphanyProfile(profile);
    expect(formatted).toContain("TRANZENDENTALE EPIPHANIE");
    expect(formatted).toContain(profile.id);
    expect(formatted).toContain("PHASE 1: STILLSTAND");
    expect(formatted).toContain("PHASE 2: EINSTURZ");
    expect(formatted).toContain("PHASE 3: TIEFER FRIEDE");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.triggerSense).toBe("auditory");
    expect(profile.characterName).toBe("Elara");
  });
});