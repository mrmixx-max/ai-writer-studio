/**
 * Tests: NarrativeVoiceprintCloner (WP 81.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  extractVoiceprint,
  scoreTextAgainstProfile,
  createPseudonymProfile,
  formatVoiceprint,
  createSampleProfile,
} from "./narrativeVoiceprintCloner";

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

describe("extractVoiceprint", () => {
  it("extrahiert Stimmabdruck", () => {
    const vp = extractVoiceprint("Der Wind trägt Worte durch die Nacht.");
    expect(vp.name).toBeTruthy();
    expect(vp.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("ist deterministisch", () => {
    const v1 = extractVoiceprint("Test");
    const v2 = extractVoiceprint("Test");
    expect(v1).toEqual(v2);
  });

  it("hat alle Metriken zwischen 0 und 100", () => {
    const vp = extractVoiceprint("Test");
    expect(vp.sentenceMelody).toBeGreaterThanOrEqual(0);
    expect(vp.sentenceMelody).toBeLessThanOrEqual(100);
    expect(vp.metaphorDensity).toBeGreaterThanOrEqual(0);
    expect(vp.metaphorDensity).toBeLessThanOrEqual(100);
  });
});

describe("scoreTextAgainstProfile", () => {
  it("bewertet Text gegen Profil", () => {
    const profile = createSampleProfile();
    const score = scoreTextAgainstProfile("Test", profile.voiceprint);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("createPseudonymProfile", () => {
  it("erstellt Pseudonym-Profil", () => {
    const profile = createPseudonymProfile("Test", "Beschreibung", 42);
    expect(profile.name).toBe("Test");
    expect(profile.voiceprint).toBeTruthy();
  });

  it("ist deterministisch", () => {
    const p1 = createPseudonymProfile("Test", "Beschreibung", 42);
    const p2 = createPseudonymProfile("Test", "Beschreibung", 42);
    expect(p1).toEqual(p2);
  });
});

describe("formatVoiceprint", () => {
  it("formatiert Profil als Text", () => {
    const profile = createSampleProfile();
    const text = formatVoiceprint(profile.voiceprint);
    expect(text).toContain("STIMMABDRUCK");
  });
});

describe("createSampleProfile", () => {
  it("erstellt Beispiel-Profil", () => {
    const profile = createSampleProfile();
    expect(profile.name).toBeTruthy();
    expect(profile.voiceprint.overallScore).toBeGreaterThanOrEqual(0);
  });
});
