// @vitest-environment jsdom
/** Tests: OnomatopoeiaStylist (WP 91.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createSFXProfile,
  translateSFX,
  formatSFXProfile,
  createSampleProfile,
  createSampleTranslation,
  type SFXProfile as _SFXProfile,
  type SFXEntry as _SFXEntry,
  type SFXCategory as _SFXCategory,
} from "./onomatopoeiaStylist";

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

describe("createSFXProfile", () => {
  it("erzeugt Profil mit 10 Kategorien", () => {
    const profile = createSFXProfile("Test", 123);
    expect(profile.id).toContain("SFXP-");
    expect(profile.name).toBe("Test");
    expect(profile.entries.length).toBe(10);
  });

  it("hat alle Kategorien genau einmal", () => {
    const profile = createSFXProfile("Test", 1);
    const cats = profile.entries.map(e => e.category).sort();
    const expected = [
      "biological", "emotional", "environment", "explosion", "impact",
      "magical", "mechanical", "movement", "ui", "weapon"
    ];
    expect(cats).toEqual(expected);
  });

  it("Einträge haben westliches + Manga SFX", () => {
    const profile = createSFXProfile("Test", 999);
    profile.entries.forEach(e => {
      expect(e.western).toBeTruthy();
      expect(e.manga).toBeTruthy();
      expect(e.intensity).toBeGreaterThanOrEqual(1);
      expect(e.intensity).toBeLessThanOrEqual(5);
      expect(e.svgPath).toBeTruthy();
    });
  });

  it("ist deterministisch", () => {
    const p1 = createSFXProfile("Comic", 42);
    const p2 = createSFXProfile("Comic", 42);
    expect(p1).toEqual(p2);
  });
});

describe("translateSFX", () => {
  it("übersetzt westliches SFX zu Manga", () => {
    const result = translateSFX("BAM", "manga");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("gibt Original zurück für western", () => {
    const result = translateSFX("BAM", "western");
    expect(result).toBe("BAM");
  });
});

describe("formatSFXProfile", () => {
  it("formatiert als Text", () => {
    const profile = createSampleProfile();
    const text = formatSFXProfile(profile);
    expect(text).toContain("ONOMATOPOESIE-PROFIL");
    expect(text).toContain("Action-Comic");
    expect(text).toContain("Westlich:");
    expect(text).toContain("Manga:");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.name).toBe("Action-Comic");
    expect(profile.id).toContain("SFXP-");
  });
});

describe("createSampleTranslation", () => {
  it("gibt Beispiel-Übersetzung", () => {
    const t = createSampleTranslation();
    expect(t.western).toBe("BAM");
    expect(t.manga).toBe("ドーン");
  });
});