/**
 * Tests: characterVoiceEvolution (WP 64.2)
 */

import { describe, it, expect } from "vitest";
import {
  evolveCharacterVoice,
  compareVoices,
  analyzeVoiceShift,
  TRAUMA_LABELS,
  type TraumaMark,
} from "./characterVoiceEvolution";

describe("characterVoiceEvolution", () => {
  const TRAUMAS: TraumaMark[] = [
    { chapter: 8, type: "betrayal", label: "Hinrichtung des Mentors" },
    { chapter: 16, type: "loss", label: "Verlust des linken Armes" },
    { chapter: 22, type: "battle", label: "Schlacht am Schwarzen Fluss" },
  ];

  describe("evolveCharacterVoice", () => {
    it("berechnet die Stimmen-Metamorphose", () => {
      const e = evolveCharacterVoice("Mira", TRAUMAS);
      expect(e.character).toBe("Mira");
      expect(e.traumas.length).toBe(3);
      expect(e.before.verbosity).toBeGreaterThan(e.after.verbosity);
      expect(e.after.cynicism).toBeGreaterThan(e.before.cynicism);
      expect(e.after.sarcasm).toBeGreaterThan(e.before.sarcasm);
      expect(e.after.naivety).toBeLessThan(e.before.naivety);
    });

    it("senkt die Gesprächigkeit nach Verrat", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "betrayal", label: "Verrat" },
      ]);
      expect(e.after.verbosity).toBeLessThan(e.before.verbosity);
    });

    it("erhöht den Zynismus nach Verrat", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "betrayal", label: "Verrat" },
      ]);
      expect(e.after.cynicism).toBeGreaterThan(e.before.cynicism);
    });

    it("erhöht den Sarkasmus nach Demütigung", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "humiliation", label: "Demütigung" },
      ]);
      expect(e.after.sarcasm).toBeGreaterThan(e.before.sarcasm);
    });

    it("senkt die Naivität nach Enthüllung", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "revelation", label: "Enthüllung" },
      ]);
      expect(e.after.naivety).toBeLessThan(e.before.naivety);
    });

    it("erhöht die Gesprächigkeit nach Wachstum", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "growth", label: "Wachstum" },
      ]);
      expect(e.after.verbosity).toBeGreaterThan(e.before.verbosity);
    });

    it("senkt die Satzlänge nach Schlacht", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "battle", label: "Schlacht" },
      ]);
      expect(e.after.avgSentenceLength).toBeLessThan(e.before.avgSentenceLength);
    });

    it("senkt die Floskelnrate nach Verlust", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "loss", label: "Verlust" },
      ]);
      expect(e.after.fillerRate).toBeLessThan(e.before.fillerRate);
    });

    it("begrenzt die Werte auf [0, 1]", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 1, type: "betrayal", label: "Verrat" },
        { chapter: 2, type: "betrayal", label: "Verrat" },
        { chapter: 3, type: "betrayal", label: "Verrat" },
        { chapter: 4, type: "betrayal", label: "Verrat" },
        { chapter: 5, type: "betrayal", label: "Verrat" },
      ]);
      expect(e.after.verbosity).toBeGreaterThanOrEqual(0);
      expect(e.after.verbosity).toBeLessThanOrEqual(1);
      expect(e.after.cynicism).toBeGreaterThanOrEqual(0);
      expect(e.after.cynicism).toBeLessThanOrEqual(1);
    });

    it("erzeugt einen formatierten Vergleich", () => {
      const e = evolveCharacterVoice("Mira", TRAUMAS);
      expect(e.comparison).toContain("VORHER");
      expect(e.comparison).toContain("NACHHER");
      expect(e.comparison).toContain("WANDEL");
    });

    it("ist deterministisch", () => {
      const a = evolveCharacterVoice("Mira", TRAUMAS);
      const b = evolveCharacterVoice("Mira", TRAUMAS);
      expect(a.after.verbosity).toBe(b.after.verbosity);
      expect(a.after.cynicism).toBe(b.after.cynicism);
      expect(a.comparison).toBe(b.comparison);
    });

    it("kommt mit leeren Zäsuren zurecht", () => {
      const e = evolveCharacterVoice("Mira", []);
      expect(e.after.verbosity).toBe(e.before.verbosity);
      expect(e.shiftMagnitude).toBe(0);
    });

    it("kommt mit null zurecht", () => {
      const e = evolveCharacterVoice("Mira", null);
      expect(e.traumas).toEqual([]);
    });

    it("nutzt eine Standardstimme ohne Angaben", () => {
      const e = evolveCharacterVoice("Mira", [
        { chapter: 5, type: "betrayal", label: "Verrat" },
      ]);
      expect(e.before.verbosity).toBeGreaterThan(0);
      expect(e.before.naivety).toBeGreaterThan(0);
    });
  });

  describe("compareVoices", () => {
    it("formatiert den Vergleich", () => {
      const e = evolveCharacterVoice("Mira", TRAUMAS);
      expect(compareVoices(e)).toBe(e.comparison);
    });

    it("kommt mit null zurecht", () => {
      expect(compareVoices(null)).toBe("");
    });
  });

  describe("analyzeVoiceShift", () => {
    it("bewertet den Wandel", () => {
      const e = evolveCharacterVoice("Mira", TRAUMAS);
      const a = analyzeVoiceShift(e);
      expect(a.verbosityDelta).toBeLessThan(0);
      expect(a.cynicismDelta).toBeGreaterThan(0);
      expect(a.sarcasmDelta).toBeGreaterThan(0);
      expect(a.naivetyDelta).toBeLessThan(0);
      expect(a.totalShift).toBeGreaterThan(0);
      expect(a.significantlyChanged).toBe(true);
    });

    it("erkennt keinen Wandel ohne Zäsuren", () => {
      const e = evolveCharacterVoice("Mira", []);
      const a = analyzeVoiceShift(e);
      expect(a.totalShift).toBe(0);
      expect(a.significantlyChanged).toBe(false);
    });

    it("kommt mit null zurecht", () => {
      const a = analyzeVoiceShift(null);
      expect(a.totalShift).toBe(0);
      expect(a.significantlyChanged).toBe(false);
    });
  });

  describe("TRAUMA_LABELS", () => {
    it("enthält alle Trauma-Typen", () => {
      expect(Object.keys(TRAUMA_LABELS).length).toBe(6);
    });
  });
});
