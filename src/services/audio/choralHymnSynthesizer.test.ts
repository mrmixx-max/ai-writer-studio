// @vitest-environment jsdom
/** Tests: ChoralHymnSynthesizer (WP 92.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createHymnProfile,
  generateAudioPreview,
  formatHymnProfile,
  createSampleProfile as _createSampleProfile,
  createSampleAntiphonal as _createSampleAntiphonal,
  type HymnProfile as _HymnProfile,
  type HymnType,
} from "./choralHymnSynthesizer";

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

describe("createHymnProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createHymnProfile("Test", "battle", 123);
    expect(profile.id).toContain("HYMN-");
    expect(profile.name).toBe("Test");
    expect(profile.type).toBe("battle");
    expect(profile.mode).toBeDefined();
    expect(profile.bpm).toBeGreaterThan(0);
    expect(profile.lines.length).toBeGreaterThanOrEqual(4);
  });

  it("hat alle Hymnentypen", () => {
    const types: HymnType[] = ["battle", "march", "funeral", "victory", "antiphonal", "liturgical"];
    for (const type of types) {
      const profile = createHymnProfile("Test", type, 1);
      expect(profile.type).toBe(type);
    }
  });

  it("verschiedene Typen haben unterschiedliche BPM-Bereiche", () => {
    const march = createHymnProfile("Test", "march", 1);
    const funeral = createHymnProfile("Test", "funeral", 1);
    const battle = createHymnProfile("Test", "battle", 1);
    
    expect(march.bpm).toBeGreaterThanOrEqual(110);
    expect(funeral.bpm).toBeLessThanOrEqual(70);
    expect(battle.bpm).toBeGreaterThanOrEqual(100);
  });

  it("hat korrekte Zeitangaben", () => {
    const march = createHymnProfile("Test", "march", 1);
    expect(march.timeSignature).toBe("2/4");
    
    const funeral = createHymnProfile("Test", "funeral", 1);
    expect(funeral.timeSignature).toBe("3/4");
  });

  it("ist deterministisch", () => {
    const p1 = createHymnProfile("Test", "battle", 42);
    const p2 = createHymnProfile("Test", "battle", 42);
    expect(p1).toEqual(p2);
  });
});

describe("generateAudioPreview", () => {
  it("erzeugt Audio-Vorschau mit Frequenzen", () => {
    const profile = _createSampleProfile();
    const preview = generateAudioPreview(profile);
    expect(preview.soloistFreq.length).toBe(profile.lines.length);
    expect(preview.choirFreq.length).toBe(profile.lines.length);
    expect(preview.duration).toBeGreaterThan(0);
    expect(preview.soloistFreq.every(f => f > 0)).toBe(true);
    expect(preview.choirFreq.every(f => f > 0)).toBe(true);
  });
});

describe("formatHymnProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = _createSampleProfile();
    const text = formatHymnProfile(profile);
    expect(text).toContain("CHORAL-HYMNEN PROFIL");
    expect(text).toContain("Marschlied");
    expect(text).toContain("Takt");
    expect(text).toContain("AUDIO-VORSCHAU");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = _createSampleProfile();
    expect(profile.name).toBe("Eiserner Marsch");
    expect(profile.type).toBe("march");
  });
});

describe("createSampleAntiphonal", () => {
  it("erzeugt antiphonales Beispiel", () => {
    const profile = _createSampleAntiphonal();
    expect(profile.name).toBe("Wache der Ewigkeit");
    expect(profile.type).toBe("antiphonal");
  });
});