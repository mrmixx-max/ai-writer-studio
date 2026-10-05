/**
 * Tests: aiCinemaPromptGenerator (WP 66.1)
 */

import { describe, it, expect } from "vitest";
import {
  deconstructScene,
  generateConsistencyTags,
  formatShotList,
  SHOT_TYPE_LABELS,
  type VideoEngine,
} from "./aiCinemaPromptGenerator";

describe("aiCinemaPromptGenerator", () => {
  const ENGINES: VideoEngine[] = ["sora", "runway", "kling", "luma"];

  describe("deconstructScene", () => {
    it("zerlegt eine Szene in Shots", () => {
      const d = deconstructScene("A figure stands on a cliff", "sora");
      expect(d.shots.length).toBeGreaterThanOrEqual(4);
      expect(d.shots.length).toBeLessThanOrEqual(8);
      expect(d.shotCount).toBe(d.shots.length);
    });

    it("verwendet die Szenenbeschreibung", () => {
      const d = deconstructScene("A figure stands on a cliff", "sora");
      expect(d.scene).toBe("A figure stands on a cliff");
      expect(d.shots[0].description).toBe("A figure stands on a cliff");
    });

    it("generiert engine-spezifische Prompts", () => {
      for (const engine of ENGINES) {
        const d = deconstructScene("Test scene", engine);
        expect(d.shots[0].prompt.length).toBeGreaterThan(20);
      }
    });

    it("fügt Kamera-Befehle für Runway hinzu", () => {
      const d = deconstructScene("Test scene", "runway");
      expect(d.shots[0].cameraCommand).toBeDefined();
      expect(d.shots[0].cameraCommand).toContain("mm");
    });

    it("fügt Realismus-Anker für Kling hinzu", () => {
      const d = deconstructScene("Test scene", "kling");
      expect(d.shots[0].realismAnchor).toBeDefined();
      expect(d.shots[0].realismAnchor).toContain("Photorealistic");
    });

    it("fügt Realismus-Anker für Luma hinzu", () => {
      const d = deconstructScene("Test scene", "luma");
      expect(d.shots[0].realismAnchor).toBeDefined();
    });

    it("generiert Konsistenz-Tags", () => {
      const d = deconstructScene("Test scene", "sora", {
        hairColor: "blonde",
        clothing: "red dress",
      });
      expect(d.globalConsistencyTags).toContain("hair: blonde");
      expect(d.globalConsistencyTags).toContain("clothing: red dress");
    });

    it("trägt Konsistenz-Tags in jeden Shot ein", () => {
      const d = deconstructScene("Test scene", "sora", {
        hairColor: "blonde",
      });
      for (const shot of d.shots) {
        expect(shot.consistencyTags).toContain("hair: blonde");
      }
    });

    it("erzeugt formatierte Shot-Liste", () => {
      const d = deconstructScene("Test scene", "sora");
      expect(d.formatted).toContain("Shot 01");
      expect(d.formatted).toContain("Tags:");
    });

    it("ist deterministisch", () => {
      const a = deconstructScene("Test scene", "sora");
      const b = deconstructScene("Test scene", "sora");
      expect(a.formatted).toBe(b.formatted);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const d = deconstructScene("", "sora");
      expect(d.shots.length).toBeGreaterThan(0);
    });

    it("kommt mit null zurecht", () => {
      const d = deconstructScene(null as unknown as string, "sora");
      expect(d.shots.length).toBeGreaterThan(0);
    });

    it("nutzt Standard-Engine bei ungültiger Eingabe", () => {
      const d = deconstructScene("Test", "invalid" as VideoEngine);
      expect(d.shots[0].prompt).toContain("Cinematic");
    });
  });

  describe("generateConsistencyTags", () => {
    it("generiert Tags mit Standardwerten", () => {
      const tags = generateConsistencyTags();
      expect(tags.length).toBe(4);
      expect(tags[0]).toContain("hair:");
    });

    it("generiert Tags mit benutzerdefinierten Werten", () => {
      const tags = generateConsistencyTags({
        hairColor: "silver",
        clothing: "armor",
        age: "elderly",
        lighting: "moonlight",
      });
      expect(tags).toContain("hair: silver");
      expect(tags).toContain("clothing: armor");
      expect(tags).toContain("age: elderly");
      expect(tags).toContain("lighting: moonlight");
    });

    it("kommt mit null zurecht", () => {
      const tags = generateConsistencyTags(null);
      expect(tags.length).toBe(4);
    });
  });

  describe("formatShotList", () => {
    it("formatiert die Shot-Liste", () => {
      const d = deconstructScene("Test scene", "sora");
      expect(formatShotList(d)).toBe(d.formatted);
    });

    it("kommt mit null zurecht", () => {
      expect(formatShotList(null)).toBe("");
    });
  });

  describe("SHOT_TYPE_LABELS", () => {
    it("enthält alle Shot-Typen", () => {
      expect(Object.keys(SHOT_TYPE_LABELS).length).toBe(6);
    });
  });
});
