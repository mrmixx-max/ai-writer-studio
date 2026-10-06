/**
 * Tests: sceneCameraBlocking (WP 70.2)
 */

import { describe, it, expect } from "vitest";
import {
  checkAxisCrossing,
  computeFrustum,
  analyzeBlocking,
  buildDefaultStage,
  distance,
  angleBetween,
  angleDifference,
  type StageElement,
} from "./sceneCameraBlocking";

/** Zwei Figuren auf einer waagerechten Achse bei y=3. */
const STAGE: StageElement[] = [
  { id: "a", label: "Mira", kind: "character", x: 2, y: 3, rotation: 0 },
  { id: "b", label: "Halden", kind: "character", x: 8, y: 3, rotation: 180 },
  // Kamera unterhalb der Achse (y=7 > 3) und oberhalb (y=-1).
  { id: "cam-unten", label: "Kamera unten", kind: "camera", x: 5, y: 7, rotation: 270 },
  { id: "cam-oben", label: "Kamera oben", kind: "camera", x: 5, y: -1, rotation: 90 },
  { id: "cam-auf-achse", label: "Kamera auf Achse", kind: "camera", x: 5, y: 3, rotation: 0 },
];

describe("sceneCameraBlocking", () => {
  describe("Geometrie-Helfer", () => {
    it("berechnet den Abstand", () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it("berechnet den Richtungswinkel", () => {
      expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
      expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
      expect(angleBetween({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(180);
    });

    it("berechnet die kleinste Winkeldifferenz", () => {
      expect(angleDifference(10, 20)).toBe(10);
      expect(angleDifference(350, 10)).toBe(20);
      expect(angleDifference(0, 180)).toBe(180);
    });

    it("normalisiert negative Winkel", () => {
      expect(angleDifference(-10, 10)).toBe(20);
    });
  });

  describe("checkAxisCrossing", () => {
    it("erkennt eine eingehaltene Achse", () => {
      // Beide Kameras unterhalb der Achse → gleiche Seite.
      const r = checkAxisCrossing(STAGE, "cam-unten", null);
      expect(r.axis).toEqual(["a", "b"]);
      expect(r.valid).toBe(true);
    });

    it("erkennt einen Achsensprung", () => {
      // cam-oben → cam-unten: verschiedene Seiten.
      const r = checkAxisCrossing(STAGE, "cam-unten", "cam-oben");
      expect(r.crossedAxis).toBe(true);
      expect(r.valid).toBe(false);
      expect(r.message).toContain("Achsensprung");
    });

    it("erkennt keinen Sprung bei gleicher Seite", () => {
      const r = checkAxisCrossing(STAGE, "cam-unten", "cam-unten");
      expect(r.crossedAxis).toBe(false);
      expect(r.valid).toBe(true);
    });

    it("meldet die Seiten der Kameras", () => {
      const r = checkAxisCrossing(STAGE, "cam-unten", "cam-oben");
      expect(r.cameraSide).not.toBe(0);
      expect(r.previousSide).not.toBe(0);
      expect(r.cameraSide).not.toBe(r.previousSide);
    });

    it("behandelt eine Kamera auf der Achse als neutral", () => {
      const r = checkAxisCrossing(STAGE, "cam-auf-achse", "cam-oben");
      expect(r.cameraSide).toBe(0);
      expect(r.crossedAxis).toBe(false);
      expect(r.message).toContain("auf der Achse");
    });

    it("kommt mit nur einer Figur zurecht", () => {
      const one = [STAGE[0], STAGE[2]];
      const r = checkAxisCrossing(one, "cam-unten", null);
      expect(r.axis).toBeNull();
      expect(r.valid).toBe(true);
    });

    it("kommt mit leerer Bühne zurecht", () => {
      const r = checkAxisCrossing([], "cam-unten", null);
      expect(r.valid).toBe(true);
    });

    it("kommt mit null zurecht", () => {
      const r = checkAxisCrossing(null, "x", null);
      expect(r.valid).toBe(true);
    });

    it("ist deterministisch", () => {
      const a = checkAxisCrossing(STAGE, "cam-unten", "cam-oben");
      const b = checkAxisCrossing(STAGE, "cam-unten", "cam-oben");
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe("computeFrustum", () => {
    it("berechnet das Sichtfeld", () => {
      const f = computeFrustum(STAGE, { cameraId: "cam-unten", shotSize: "medium", angle: "eye-level", focalLength: 50 });
      expect(f.origin).toEqual({ x: 5, y: 7 });
      expect(f.halfAngle).toBe(22);
      expect(f.edges.length).toBe(2);
    });

    it("nutzt einen größeren Winkel für Totale", () => {
      const close = computeFrustum(STAGE, { cameraId: "cam-unten", shotSize: "close-up", angle: "eye-level", focalLength: 85 });
      const wide = computeFrustum(STAGE, { cameraId: "cam-unten", shotSize: "wide", angle: "eye-level", focalLength: 24 });
      expect(wide.halfAngle).toBeGreaterThan(close.halfAngle);
      expect(wide.range).toBeGreaterThan(close.range);
    });

    it("beschreibt den Bildausschnitt", () => {
      const f = computeFrustum(STAGE, { cameraId: "cam-unten", shotSize: "close-up", angle: "low", focalLength: 85 });
      expect(f.framing).toContain("Nahaufnahme");
      expect(f.framing).toContain("Untersicht");
      expect(f.framing).toContain("85mm");
    });

    it("kommt ohne Setup zurecht", () => {
      const f = computeFrustum(STAGE, null);
      expect(f.origin).toEqual({ x: 0, y: 0 });
      expect(f.halfAngle).toBeGreaterThan(0);
    });

    it("kommt mit leerer Bühne zurecht", () => {
      const f = computeFrustum([], { cameraId: "x", shotSize: "wide", angle: "high", focalLength: 35 });
      expect(f.origin).toEqual({ x: 0, y: 0 });
    });

    it("ist deterministisch", () => {
      const setup = { cameraId: "cam-unten", shotSize: "medium" as const, angle: "eye-level" as const, focalLength: 50 };
      expect(JSON.stringify(computeFrustum(STAGE, setup))).toBe(JSON.stringify(computeFrustum(STAGE, setup)));
    });
  });

  describe("analyzeBlocking", () => {
    it("zählt Figuren und Kameras", () => {
      const r = analyzeBlocking(STAGE);
      expect(r.characterCount).toBe(2);
      expect(r.cameraCount).toBe(3);
    });

    it("erkennt Blicklinien", () => {
      // Mira schaut nach rechts (0°) → Halden liegt bei 0°.
      const r = analyzeBlocking(STAGE);
      const miraToHalden = r.sightLines.find((s) => s.from === "a" && s.to === "b");
      expect(miraToHalden).toBeDefined();
    });

    it("warnt bei überlappenden Positionen", () => {
      const overlapping: StageElement[] = [
        { id: "a", label: "A", kind: "character", x: 5, y: 5, rotation: 0 },
        { id: "b", label: "B", kind: "prop", x: 5.2, y: 5, rotation: 0 },
      ];
      const r = analyzeBlocking(overlapping);
      expect(r.warnings.some((w) => w.includes("auseinander"))).toBe(true);
    });

    it("warnt ohne Kamera", () => {
      const r = analyzeBlocking([STAGE[0], STAGE[1]]);
      expect(r.warnings.some((w) => w.includes("Keine Kamera"))).toBe(true);
    });

    it("warnt ohne Figuren", () => {
      const r = analyzeBlocking([STAGE[2]]);
      expect(r.warnings.some((w) => w.includes("Keine Figuren"))).toBe(true);
    });

    it("kommt mit leerer Bühne zurecht", () => {
      const r = analyzeBlocking([]);
      expect(r.characterCount).toBe(0);
      expect(r.warnings.length).toBeGreaterThan(0);
    });

    it("kommt mit null zurecht", () => {
      const r = analyzeBlocking(null);
      expect(r.characterCount).toBe(0);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(analyzeBlocking(STAGE))).toBe(JSON.stringify(analyzeBlocking(STAGE)));
    });
  });

  describe("buildDefaultStage", () => {
    it("erzeugt eine Standard-Bühne", () => {
      const s = buildDefaultStage();
      expect(s.length).toBeGreaterThan(4);
      expect(s.filter((e) => e.kind === "character").length).toBe(2);
      expect(s.filter((e) => e.kind === "camera").length).toBe(2);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(buildDefaultStage())).toBe(JSON.stringify(buildDefaultStage()));
    });

    it("enthält zwei Kameras auf verschiedenen Achsenseiten", () => {
      const s = buildDefaultStage();
      const r = checkAxisCrossing(s, "cam-1", "cam-2");
      expect(r.crossedAxis).toBe(true);
    });
  });
});
