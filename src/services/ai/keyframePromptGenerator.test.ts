/**
 * Tests: keyframePromptGenerator (WP 66.2)
 */

import { describe, it, expect } from "vitest";
import {
  generateKeyframePair,
  generateKeyframePairs,
  formatKeyframePair,
  ENGINE_LABELS,
  type AspectRatio,
  type CameraProfile,
} from "./keyframePromptGenerator";

describe("keyframePromptGenerator", () => {
  const ASPECT_RATIOS: AspectRatio[] = ["16:9", "2.39:1", "1:1", "4:3", "9:16"];
  const CAMERA_PROFILES: CameraProfile[] = [
    "arri-alexa-65",
    "imax-70mm",
    "panavision-70mm",
    "red-monstro",
    "sony-venice",
  ];

  describe("generateKeyframePair", () => {
    it("generiert ein Start- & Endframe-Paar", () => {
      const p = generateKeyframePair("Gate closed", "Gate explodes", "midjourney", "16:9", "arri-alexa-65");
      expect(p.startPrompt).toContain("Gate closed");
      expect(p.endPrompt).toContain("Gate explodes");
    });

    it("hängt Midjourney-Parameter an", () => {
      const p = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      expect(p.midjourneyParams).toContain("--style raw");
      expect(p.midjourneyParams).toContain("--v 6.1");
      expect(p.midjourneyParams).toContain("--stylize 250");
    });

    it("hängt Seitenverhältnis-Parameter an", () => {
      for (const ar of ASPECT_RATIOS) {
        const p = generateKeyframePair("A", "B", "midjourney", ar, "arri-alexa-65");
        expect(p.midjourneyParams).toContain(`--ar ${ar}`);
      }
    });

    it("hängt Kamera-Profil an", () => {
      for (const cam of CAMERA_PROFILES) {
        const p = generateKeyframePair("A", "B", "midjourney", "16:9", cam);
        expect(p.cameraProfile).toBe(cam);
      }
    });

    it("enthält Character-Reference-Platzhalter", () => {
      const p = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      expect(p.cref).toContain("CHARACTER_REF");
      expect(p.startPrompt).toContain("CHARACTER_REF");
    });

    it("generiert formatierte Ausgabe", () => {
      const p = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      expect(p.formatted).toContain("START FRAME");
      expect(p.formatted).toContain("END FRAME");
    });

    it("ist deterministisch", () => {
      const a = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      const b = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      expect(a.startPrompt).toBe(b.startPrompt);
      expect(a.formatted).toBe(b.formatted);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const p = generateKeyframePair("", "", "midjourney", "16:9", "arri-alexa-65");
      expect(p.startPrompt.length).toBeGreaterThan(10);
    });

    it("kommt mit null zurecht", () => {
      const p = generateKeyframePair(null as unknown as string, null as unknown as string, "midjourney", "16:9", "arri-alexa-65");
      expect(p.startPrompt.length).toBeGreaterThan(10);
    });
  });

  describe("generateKeyframePairs", () => {
    it("generiert ein Paar mit Standardwerten", () => {
      const r = generateKeyframePairs("Scene", "midjourney", "16:9", "arri-alexa-65");
      expect(r.pairs.length).toBe(1);
      expect(r.pairCount).toBe(1);
    });

    it("generiert mehrere Paare", () => {
      const r = generateKeyframePairs("Scene", "midjourney", "16:9", "arri-alexa-65", 4);
      expect(r.pairs.length).toBe(4);
    });

    it("begrenzt die Anzahl auf 8", () => {
      const r = generateKeyframePairs("Scene", "midjourney", "16:9", "arri-alexa-65", 99);
      expect(r.pairs.length).toBe(8);
    });

    it("verwendet die Engine", () => {
      const r = generateKeyframePairs("Scene", "leonardo", "16:9", "arri-alexa-65");
      expect(r.engine).toBe("leonardo");
      expect(r.engineLabel).toBe(ENGINE_LABELS.leonardo);
    });

    it("ist deterministisch", () => {
      const a = generateKeyframePairs("Scene", "midjourney", "16:9", "arri-alexa-65", 3);
      const b = generateKeyframePairs("Scene", "midjourney", "16:9", "arri-alexa-65", 3);
      expect(a.pairs[0].startPrompt).toBe(b.pairs[0].startPrompt);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const r = generateKeyframePairs("", "midjourney", "16:9", "arri-alexa-65");
      expect(r.pairs.length).toBeGreaterThan(0);
    });
  });

  describe("formatKeyframePair", () => {
    it("formatiert das Paar", () => {
      const p = generateKeyframePair("A", "B", "midjourney", "16:9", "arri-alexa-65");
      expect(formatKeyframePair(p)).toBe(p.formatted);
    });

    it("kommt mit null zurecht", () => {
      expect(formatKeyframePair(null)).toBe("");
    });
  });

  describe("ENGINE_LABELS", () => {
    it("enthält alle Engines", () => {
      expect(Object.keys(ENGINE_LABELS).length).toBe(2);
    });
  });
});
