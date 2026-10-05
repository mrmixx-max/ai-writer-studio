/**
 * Tests: aiFilmAudioPromptGenerator (WP 67.1)
 */

import { describe, it, expect } from "vitest";
import {
  generateDialogue,
  generateFoley,
  generateScore,
  generateAudioPrompts,
  formatAudioPrompts,
  AUDIO_ENGINE_LABELS,
} from "./aiFilmAudioPromptGenerator";

describe("aiFilmAudioPromptGenerator", () => {
  describe("generateDialogue", () => {
    it("generiert Dialogzeilen mit SSML", () => {
      const lines = generateDialogue(["Hello", "World"], "elevenlabs");
      expect(lines.length).toBe(2);
      expect(lines[0].ssml).toContain("<speak>");
      expect(lines[0].ssml).toContain("</speak>");
    });

    it("generiert Stimmfärbungs-Cues", () => {
      const lines = generateDialogue(["Test"], "elevenlabs");
      expect(lines[0].voiceCue.length).toBeGreaterThan(5);
    });

    it("vergibt Timecodes", () => {
      const lines = generateDialogue(["A", "B", "C"], "elevenlabs");
      expect(lines[0].timecode).toBe(0);
      expect(lines[1].timecode).toBe(5);
      expect(lines[2].timecode).toBe(10);
    });

    it("verwendet Standarddialoge ohne Angaben", () => {
      const lines = generateDialogue(null, "elevenlabs");
      expect(lines.length).toBeGreaterThan(0);
    });

    it("ist deterministisch", () => {
      const a = generateDialogue(["Test"], "elevenlabs");
      const b = generateDialogue(["Test"], "elevenlabs");
      expect(a[0].ssml).toBe(b[0].ssml);
    });
  });

  describe("generateFoley", () => {
    it("generiert Foley-Ereignisse", () => {
      const events = generateFoley(["Door creaks", "Glass breaks"], "elevenlabs");
      expect(events.length).toBe(2);
      expect(events[0].description).toBe("Door creaks");
    });

    it("vergibt Timecodes und Dauer", () => {
      const events = generateFoley(["A", "B"], "elevenlabs");
      expect(events[0].timecode).toBe(0);
      expect(events[1].timecode).toBe(7);
      expect(events[0].duration).toBeGreaterThan(0);
    });

    it("generiert Prompts mit Timecode", () => {
      const events = generateFoley(["Test"], "elevenlabs");
      expect(events[0].prompt).toContain("00:");
    });

    it("verwendet Standard-Foley ohne Angaben", () => {
      const events = generateFoley(null, "elevenlabs");
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("generateScore", () => {
    it("generiert Musik-Sektionen", () => {
      const sections = generateScore(["Tense strings", "Epic brass"], "suno");
      expect(sections.length).toBe(2);
      expect(sections[0].tag).toContain("[");
    });

    it("generiert Struktur-Tags", () => {
      const sections = generateScore(["Test"], "suno");
      expect(sections[0].tag).toMatch(/^\[.*\]$/);
    });

    it("vergibt Timecodes", () => {
      const sections = generateScore(["A", "B"], "suno");
      expect(sections[0].timecode).toBe(0);
      expect(sections[1].timecode).toBe(10);
    });

    it("verwendet Standard-Sektionen ohne Angaben", () => {
      const sections = generateScore(null, "suno");
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe("generateAudioPrompts", () => {
    it("generiert alle drei Spuren", () => {
      const r = generateAudioPrompts("elevenlabs");
      expect(r.dialogue.length).toBeGreaterThan(0);
      expect(r.foley.length).toBeGreaterThan(0);
      expect(r.score.length).toBeGreaterThan(0);
    });

    it("verwendet die Engine", () => {
      const r = generateAudioPrompts("suno");
      expect(r.engine).toBe("suno");
      expect(r.engineLabel).toBe(AUDIO_ENGINE_LABELS.suno);
    });

    it("generiert formatierte Ausgabe", () => {
      const r = generateAudioPrompts("elevenlabs");
      expect(r.formatted).toContain("SPUR 1");
      expect(r.formatted).toContain("SPUR 2");
      expect(r.formatted).toContain("SPUR 3");
    });

    it("ist deterministisch", () => {
      const a = generateAudioPrompts("elevenlabs");
      const b = generateAudioPrompts("elevenlabs");
      expect(a.formatted).toBe(b.formatted);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const r = generateAudioPrompts("elevenlabs");
      expect(r.dialogue.length).toBeGreaterThan(0);
    });
  });

  describe("formatAudioPrompts", () => {
    it("formatiert das Ergebnis", () => {
      const r = generateAudioPrompts("elevenlabs");
      expect(formatAudioPrompts(r)).toBe(r.formatted);
    });

    it("kommt mit null zurecht", () => {
      expect(formatAudioPrompts(null)).toBe("");
    });
  });

  describe("AUDIO_ENGINE_LABELS", () => {
    it("enthält alle Engines", () => {
      expect(Object.keys(AUDIO_ENGINE_LABELS).length).toBe(3);
    });
  });
});
