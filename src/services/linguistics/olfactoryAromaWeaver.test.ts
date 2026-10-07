// @vitest-environment jsdom
/** Tests: OlfactoryAromaWeaver (WP 90.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createAromaProfile,
  formatAromaProfile,
  createSampleProfile,
  createSampleMemory,
  type AromaProfile as _AromaProfile,
  type AromaOctave as _AromaOctave,
  type OlfactoryMemory as _OlfactoryMemory,
} from "./olfactoryAromaWeaver";

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

describe("createAromaProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createAromaProfile("Testort", 123);
    expect(profile.id).toContain("AROMA-");
    expect(profile.location).toBe("Testort");
    expect(profile.topNote).toBeDefined();
    expect(profile.heartNote).toBeDefined();
    expect(profile.baseNote).toBeDefined();
    expect(profile.seed).toBe(123);
  });

  it("hat drei verschiedene Oktaven", () => {
    const profile = createAromaProfile("Test", 1);
    const octaves = [profile.topNote.octave, profile.heartNote.octave, profile.baseNote.octave];
    const unique = new Set(octaves);
    expect(unique.size).toBe(3);
  });

  it("ist deterministisch", () => {
    const p1 = createAromaProfile("Ort", 42);
    const p2 = createAromaProfile("Ort", 42);
    expect(p1).toEqual(p2);
  });

  it("Intensitäten im gültigen Bereich", () => {
    const profile = createAromaProfile("Test", 999);
    [profile.topNote, profile.heartNote, profile.baseNote].forEach(note => {
      expect(note.intensity).toBeGreaterThanOrEqual(0);
      expect(note.intensity).toBeLessThanOrEqual(100);
    });
  });

  it("generiert manchmal Erinnerungs-Anker", () => {
    let hasAnchor = false;
    for (let i = 0; i < 20; i++) {
      const p = createAromaProfile("Test", i);
      if (p.memoryAnchor) hasAnchor = true;
    }
    expect(hasAnchor).toBe(true);
  });
});

describe("formatAromaProfile", () => {
  it("formatiert als Text mit allen Noten", () => {
    const profile = createSampleProfile();
    const text = formatAromaProfile(profile);
    expect(text).toContain("AROMA-PROFIL");
    expect(text).toContain("KOPFNOTE");
    expect(text).toContain("HERZNOTE");
    expect(text).toContain("BASISNOTE");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.location).toBe("mittelalterliche Apotheke");
    expect(profile.id).toContain("AROMA-");
  });
});

describe("createSampleMemory", () => {
  it("erzeugt Beispiel-Erinnerung", () => {
    const mem = createSampleMemory();
    expect(mem.character).toBe("Elara");
    expect(mem.aroma).toContain("Petrichor");
    expect(mem.emotion).toBe("Geborgenheit");
  });
});