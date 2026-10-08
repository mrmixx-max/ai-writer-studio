// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createAlliterativeKenningProfile,
  formatAlliterativeKenningProfile,
  createSampleProfile,
} from "./alliterativeKenningWeaver";

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

describe("createAlliterativeKenningProfile", () => {
  it("erzeugt Profil mit allen Feldern", () => {
    const profile = createAlliterativeKenningProfile("war", 123);
    expect(profile.id).toContain("KENN-");
    expect(profile.theme).toBe("war");
    expect(profile.kennings.length).toBeGreaterThanOrEqual(5);
    expect(profile.alliterativeVerses.length).toBeGreaterThanOrEqual(4);
    expect(profile.speeches.length).toBeGreaterThanOrEqual(1);
    expect(profile.seed).toBe(123);
  });

  it("alle sieben Themen verfügbar", () => {
    const themes = ["war", "kingship", "ships", "death", "love", "nature", "fate"] as const;
    for (const theme of themes) {
      const profile = createAlliterativeKenningProfile(theme, 1);
      expect(profile.theme).toBe(theme);
    }
  });

  it("Kennings haben korrekte Struktur", () => {
    const profile = createAlliterativeKenningProfile("war", 1);
    for (const kenning of profile.kennings) {
      expect(kenning.baseConcept).toBeTruthy();
      expect(kenning.kenning).toBeTruthy();
      expect(kenning.components.length).toBeGreaterThanOrEqual(2);
      expect(kenning.alliteration).toBeTruthy();
    }
  });

  it("Stabreim-Versen haben Zäsur", () => {
    const profile = createAlliterativeKenningProfile("kingship", 2);
    for (const verse of profile.alliterativeVerses) {
      expect(verse.line).toBeTruthy();
      expect(verse.firstHalf).toBeTruthy();
      expect(verse.secondHalf).toBeTruthy();
      expect(verse.alliteration).toBeTruthy();
      expect(["AA|A", "A|AA", "AX|A"]).toContain(verse.stressPattern);
    }
  });

  it("Reden haben alle erforderlichen Felder", () => {
    const profile = createAlliterativeKenningProfile("ships", 3);
    for (const speech of profile.speeches) {
      expect(["graveSpeech", "warriorOath", "prophecy", "praisePoem"]).toContain(speech.type);
      expect(speech.title).toBeTruthy();
      expect(speech.lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("ist deterministisch", () => {
    const p1 = createAlliterativeKenningProfile("war", 42);
    const p2 = createAlliterativeKenningProfile("war", 42);
    expect(p1.id).toBe(p2.id);
    expect(p1.kennings.length).toBe(p2.kennings.length);
  });

  it("verschiedene Seeds erzeugen verschiedene Profile", () => {
    const p1 = createAlliterativeKenningProfile("war", 1);
    const p2 = createAlliterativeKenningProfile("war", 2);
    expect(p1.id).not.toBe(p2.id);
  });
});

describe("formatAlliterativeKenningProfile", () => {
  it("formatiert als lesbaren Text", () => {
    const profile = createAlliterativeKenningProfile("war", 1);
    const formatted = formatAlliterativeKenningProfile(profile);
    expect(formatted).toContain("STABREIM & KENNING-WEBER");
    expect(formatted).toContain(profile.id);
    expect(formatted).toContain("KENNINGAR");
    expect(formatted).toContain("STABREIM-VERSE");
    expect(formatted).toContain("REDEN & SCHWÜRE");
  });
});

describe("createSampleProfile", () => {
  it("erzeugt Beispielprofil", () => {
    const profile = createSampleProfile();
    expect(profile.theme).toBe("war");
    expect(profile.kennings.length).toBeGreaterThan(0);
  });
});