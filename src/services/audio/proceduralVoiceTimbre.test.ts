/**
 * Tests: proceduralVoiceTimbre (WP 70.1)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeVoiceTimbre,
  applyAccent,
  buildVoiceTestPhrase,
  voiceDistance,
  hashString,
  createSeededRandom,
  ACCENT_LABELS,
  ACCENT_RULES,
  DEFAULT_TEST_PHRASE,
  type AccentProfile,
} from "./proceduralVoiceTimbre";

describe("proceduralVoiceTimbre", () => {
  describe("hashString / createSeededRandom", () => {
    it("sind deterministisch", () => {
      expect(hashString("abc")).toBe(hashString("abc"));
      const a = createSeededRandom(42);
      const b = createSeededRandom(42);
      expect(a()).toBe(b());
    });

    it("liefern Werte in [0, 1)", () => {
      const rand = createSeededRandom(7);
      for (let i = 0; i < 20; i++) {
        const v = rand();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("synthesizeVoiceTimbre", () => {
    it("erzeugt eine Standardstimme ohne Profil", () => {
      const t = synthesizeVoiceTimbre();
      expect(t.pitchHz).toBeGreaterThan(60);
      expect(t.pitchHz).toBeLessThan(400);
      expect(t.character.length).toBeGreaterThan(10);
    });

    it("gibt Männern einen tieferen Pitch als Frauen", () => {
      const m = synthesizeVoiceTimbre({ gender: "male", name: "A" });
      const f = synthesizeVoiceTimbre({ gender: "female", name: "A" });
      expect(m.pitchHz).toBeLessThan(f.pitchHz);
    });

    it("senkt den Pitch bei schwerer Statur", () => {
      const heavy = synthesizeVoiceTimbre({ build: "heavy", name: "A" });
      const slight = synthesizeVoiceTimbre({ build: "slight", name: "A" });
      expect(heavy.pitchHz).toBeLessThan(slight.pitchHz);
    });

    it("hebt den Pitch bei Kindern", () => {
      const child = synthesizeVoiceTimbre({ age: 8, name: "A" });
      const adult = synthesizeVoiceTimbre({ age: 35, name: "A" });
      expect(child.pitchHz).toBeGreaterThan(adult.pitchHz);
    });

    it("senkt den Pitch bei Senioren", () => {
      const old = synthesizeVoiceTimbre({ age: 75, name: "A" });
      const adult = synthesizeVoiceTimbre({ age: 35, name: "A" });
      expect(old.pitchHz).toBeLessThan(adult.pitchHz);
    });

    it("erhöht den Tremor mit dem Alter", () => {
      const old = synthesizeVoiceTimbre({ age: 80, name: "A" });
      const young = synthesizeVoiceTimbre({ age: 30, name: "A" });
      expect(old.tremorHz).toBeGreaterThan(young.tremorHz);
    });

    it("erhöht Tremor und Sprechrate bei Angst", () => {
      const anxious = synthesizeVoiceTimbre({ mood: "anxious", age: 30, name: "A" });
      const calm = synthesizeVoiceTimbre({ mood: "calm", age: 30, name: "A" });
      expect(anxious.tremorHz).toBeGreaterThan(calm.tremorHz);
      expect(anxious.speechRate).toBeGreaterThan(calm.speechRate);
    });

    it("senkt den Formanten bei autoritärer Stimmung (Bruststimme)", () => {
      const auth = synthesizeVoiceTimbre({ mood: "authoritative", name: "A" });
      const warm = synthesizeVoiceTimbre({ mood: "warm", name: "A" });
      expect(auth.formantShift).toBeLessThan(warm.formantShift);
    });

    it("erhöht die Breathiness bei Wärme", () => {
      const warm = synthesizeVoiceTimbre({ mood: "warm", name: "A" });
      const cold = synthesizeVoiceTimbre({ mood: "cold", name: "A" });
      expect(warm.breathiness).toBeGreaterThan(cold.breathiness);
    });

    it("unterscheidet zwei gleich alte Figuren über den Namen", () => {
      const a = synthesizeVoiceTimbre({ age: 40, gender: "male", name: "Mira" });
      const b = synthesizeVoiceTimbre({ age: 40, gender: "male", name: "Halden" });
      expect(voiceDistance(a, b)).toBeGreaterThan(0);
    });

    it("ist deterministisch", () => {
      const a = synthesizeVoiceTimbre({ age: 44, name: "Mira", mood: "warm" });
      const b = synthesizeVoiceTimbre({ age: 44, name: "Mira", mood: "warm" });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("begrenzt alle Werte in plausible Bereiche", () => {
      for (const age of [1, 8, 20, 40, 70, 120]) {
        for (const mood of ["calm", "anxious", "authoritative", "warm", "cold"] as const) {
          const t = synthesizeVoiceTimbre({ age, mood, name: `F${age}${mood}` });
          expect(t.pitchHz).toBeGreaterThanOrEqual(60);
          expect(t.pitchHz).toBeLessThanOrEqual(400);
          expect(t.formantShift).toBeGreaterThanOrEqual(-30);
          expect(t.formantShift).toBeLessThanOrEqual(30);
          expect(t.vocalFry).toBeGreaterThanOrEqual(0);
          expect(t.vocalFry).toBeLessThanOrEqual(60);
          expect(t.breathiness).toBeGreaterThanOrEqual(0);
          expect(t.breathiness).toBeLessThanOrEqual(70);
          expect(t.tremorHz).toBeGreaterThanOrEqual(0);
          expect(t.tremorHz).toBeLessThanOrEqual(12);
          expect(t.speechRate).toBeGreaterThanOrEqual(2);
          expect(t.speechRate).toBeLessThanOrEqual(8);
        }
      }
    });

    it("kommt mit null zurecht", () => {
      const t = synthesizeVoiceTimbre(null);
      expect(t.pitchHz).toBeGreaterThan(0);
    });

    it("kommt mit ungültigem Alter zurecht", () => {
      const t = synthesizeVoiceTimbre({ age: Number.NaN, name: "A" });
      expect(Number.isFinite(t.pitchHz)).toBe(true);
    });
  });

  describe("applyAccent", () => {
    it("transformiert schottisch", () => {
      const r = applyAccent("I can not believe you", "scottish");
      expect(r.accent).toBe("scottish");
      expect(r.text).toContain("cannae");
    });

    it("transformiert bayerisch", () => {
      const r = applyAccent("ich bin nicht da", "bavarian");
      expect(r.text).toContain("ned");
    });

    it("transformiert französisch", () => {
      const r = applyAccent("this and that", "french");
      expect(r.text).toContain("zis");
    });

    it("transformiert berlinerisch", () => {
      const r = applyAccent("ich weiss das nicht", "berlin");
      expect(r.text).toContain("ick");
      expect(r.text).toContain("det");
    });

    it("transformiert viktorianisch", () => {
      const r = applyAccent("hello you", "victorian");
      expect(r.text).toContain("good day");
    });

    it("lässt neutral unverändert", () => {
      const r = applyAccent("Der Text bleibt gleich.", "neutral");
      expect(r.text).toBe("Der Text bleibt gleich.");
      expect(r.appliedRules).toBe(0);
    });

    it("erhält die Großschreibung", () => {
      const r = applyAccent("Hello there", "victorian");
      expect(r.text.charAt(0)).toBe("G");
    });

    it("ist deterministisch", () => {
      const a = applyAccent("ich bin nicht da", "bavarian");
      const b = applyAccent("ich bin nicht da", "bavarian");
      expect(a.text).toBe(b.text);
    });

    it("kommt mit leerem Text zurecht", () => {
      const r = applyAccent("", "scottish");
      expect(r.text).toBe("");
    });

    it("kommt mit null zurecht", () => {
      const r = applyAccent(null as unknown as string, "scottish");
      expect(r.text).toBe("");
    });

    it("fällt bei unbekanntem Akzent auf neutral zurück", () => {
      const r = applyAccent("Text", "klingonisch");
      expect(r.accent).toBe("neutral");
      expect(r.text).toBe("Text");
    });

    it("protokolliert die angewendeten Regeln", () => {
      const r = applyAccent("ich bin nicht da", "bavarian");
      expect(r.appliedRules).toBeGreaterThan(0);
      expect(r.matchedRules.length).toBeGreaterThan(0);
    });
  });

  describe("buildVoiceTestPhrase", () => {
    it("nutzt die Standard-Phrase ohne Text", () => {
      const r = buildVoiceTestPhrase();
      expect(r.text.length).toBeGreaterThan(10);
    });

    it("transformiert die Standard-Phrase", () => {
      const r = buildVoiceTestPhrase(null, "bavarian");
      expect(r.accent).toBe("bavarian");
    });

    it("nutzt übergebenen Text", () => {
      const r = buildVoiceTestPhrase("ich bin da", "berlin");
      expect(r.text).toContain("ick");
    });

    it("kommt mit leerem Text zurecht", () => {
      const r = buildVoiceTestPhrase("", "scottish");
      expect(r.text.length).toBeGreaterThan(0);
    });

    it("ist deterministisch", () => {
      expect(buildVoiceTestPhrase(null, "french").text).toBe(buildVoiceTestPhrase(null, "french").text);
    });
  });

  describe("voiceDistance", () => {
    it("ist 0 für identische Stimmen", () => {
      const t = synthesizeVoiceTimbre({ name: "A" });
      expect(voiceDistance(t, t)).toBe(0);
    });

    it("ist größer für verschiedene Stimmen", () => {
      const a = synthesizeVoiceTimbre({ gender: "male", age: 25, name: "A" });
      const b = synthesizeVoiceTimbre({ gender: "female", age: 80, name: "B" });
      expect(voiceDistance(a, b)).toBeGreaterThan(0.2);
    });

    it("liegt zwischen 0 und 1", () => {
      const a = synthesizeVoiceTimbre({ gender: "male", age: 20, name: "A" });
      const b = synthesizeVoiceTimbre({ gender: "female", age: 90, name: "B" });
      const d = voiceDistance(a, b);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    });

    it("kommt mit null zurecht", () => {
      expect(voiceDistance(null, null)).toBe(0);
    });
  });

  describe("ACCENT_LABELS / ACCENT_RULES", () => {
    it("enthält alle Akzente", () => {
      expect(Object.keys(ACCENT_LABELS).length).toBe(6);
    });

    it("hat für jeden Akzent eine Regel-Liste", () => {
      const all: AccentProfile[] = ["scottish", "bavarian", "french", "berlin", "victorian", "neutral"];
      for (const a of all) {
        expect(Array.isArray(ACCENT_RULES[a])).toBe(true);
      }
    });

    it("hat fünf Regeln je nicht-neutralem Akzent", () => {
      expect(ACCENT_RULES.scottish.length).toBe(5);
      expect(ACCENT_RULES.neutral.length).toBe(0);
    });
  });

  describe("DEFAULT_TEST_PHRASE", () => {
    it("ist nicht leer", () => {
      expect(DEFAULT_TEST_PHRASE.length).toBeGreaterThan(20);
    });
  });
});
