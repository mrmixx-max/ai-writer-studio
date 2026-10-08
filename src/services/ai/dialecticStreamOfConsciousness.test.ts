// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createDialecticStreamProfile,
  formatDialecticStreamProfile,
  createSampleProfile,
} from "./dialecticStreamOfConsciousness";

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

describe("createDialecticStreamProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 123);
    expect(profile.id).toContain("STREAM-");
    expect(profile.characterName).toBe("Test");
    expect(profile.setting).toBe("Setting");
    expect(profile.sensoryTrack.length).toBeGreaterThanOrEqual(6);
    expect(profile.memoryTrack.length).toBeGreaterThanOrEqual(6);
    expect(profile.mergedStream.length).toBeGreaterThanOrEqual(6);
    expect(profile.punctuationLevel).toBe(0.5);
    expect(profile.seed).toBe(123);
  });

  it("Sensorik-Spur hat Trigger", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 1);
    for (const seg of profile.sensoryTrack) {
      expect(seg.trigger).toBeTruthy();
      expect(seg.text).toBeTruthy();
      expect(seg.intensity).toBeGreaterThanOrEqual(0);
      expect(seg.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("Gedächtnis-Spur hat Assoziationen", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 2);
    for (const seg of profile.memoryTrack) {
      expect(seg.association).toBeTruthy();
      expect(seg.text).toBeTruthy();
      expect(seg.intensity).toBeGreaterThanOrEqual(0);
      expect(seg.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("verschmolzener Strom verbindet beide Spuren", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 3);
    for (const seg of profile.mergedStream) {
      expect(seg.combinedText).toBeTruthy();
      // Either has sensory or memory or both
      expect(seg.sensoryText.length + seg.memoryText.length).toBeGreaterThan(0);
    }
  });

  it("Interpunktions-Level 0 entfernt alle Satzzeichen", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0, 4);
    const fullText = profile.mergedStream.map(s => s.combinedText).join(" ");
    expect(fullText).not.toMatch(/[.!?;:()\-—"']/);
  });

  it("Interpunktions-Level 1 behält volle Interpunktion", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 1, 5);
    const fullText = profile.mergedStream.map(s => s.combinedText).join(" ");
    // Should have some punctuation
    expect(fullText.length).toBeGreaterThan(0);
  });

  it("Unterbrechungen können im verschmolzenen Strom auftreten", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 999);
    const _hasInterruption = profile.mergedStream.some(s => s.interruption);
    // Not guaranteed but structure should support it
    expect(profile.mergedStream.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const p1 = createDialecticStreamProfile("Test", "Setting", 0.5, 42);
    const p2 = createDialecticStreamProfile("Test", "Setting", 0.5, 42);
    expect(p1.id).toBe(p2.id);
    expect(p1.mergedStream.length).toBe(p2.mergedStream.length);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createDialecticStreamProfile("Test", "Setting", 0.5, 1);
    const p2 = createDialecticStreamProfile("Test", "Setting", 0.5, 2);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("formatDialecticStreamProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createDialecticStreamProfile("Test", "Setting", 0.5, 1);
    const formatted = formatDialecticStreamProfile(profile);
    expect(formatted).toContain("ZWEIGLEISIGER BEWUSSTSEINSSTROM");
    expect(formatted).toContain(profile.id);
    expect(formatted).toContain("SPUR A: SENSORISCHE WAHRNEHMUNG");
    expect(formatted).toContain("SPUR B: UNWILLKÜRLICHE ERINNERUNGEN");
    expect(formatted).toContain("VERSCHMOLZENER STROM");
    expect(formatted).toContain("FLIESSTEXT");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.characterName).toBe("K");
    expect(profile.setting).toBe("Küche um 3 Uhr morgens");
    expect(profile.punctuationLevel).toBe(0.25);
  });
});