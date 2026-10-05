/**
 * Tests: aiFilmDirectorTimeline (WP 67.2)
 */

import { describe, it, expect } from "vitest";
import {
  generateShotGrid,
  generateTimeline,
  exportProductionDossier,
  formatTimeline,
} from "./aiFilmDirectorTimeline";

describe("aiFilmDirectorTimeline", () => {
  describe("generateShotGrid", () => {
    it("generiert ein Shot-Grid", () => {
      const grid = generateShotGrid("Scene", 6);
      expect(grid.length).toBe(6);
    });

    it("vergibt Timecodes", () => {
      const grid = generateShotGrid("Scene", 3);
      expect(grid[0].timecode).toContain("00:00");
      expect(grid[0].timecode).toContain("-");
    });

    it("vergibt Kamera-Icons", () => {
      const grid = generateShotGrid("Scene", 4);
      for (const cell of grid) {
        expect(cell.cameraIcon.length).toBeGreaterThan(0);
      }
    });

    it("vergibt Prompt-Vorschauen", () => {
      const grid = generateShotGrid("Scene", 3);
      for (const cell of grid) {
        expect(cell.promptPreview.length).toBeGreaterThan(10);
      }
    });

    it("begrenzt die Anzahl auf 12", () => {
      const grid = generateShotGrid("Scene", 99);
      expect(grid.length).toBe(12);
    });

    it("ist deterministisch", () => {
      const a = generateShotGrid("Scene", 5);
      const b = generateShotGrid("Scene", 5);
      expect(a[0].timecode).toBe(b[0].timecode);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const grid = generateShotGrid("", 3);
      expect(grid.length).toBe(3);
    });
  });

  describe("generateTimeline", () => {
    it("generiert Timeline-Einträge", () => {
      const entries = generateTimeline("Scene", 6);
      expect(entries.length).toBe(6);
    });

    it("synchronisiert alle Spuren", () => {
      const entries = generateTimeline("Scene", 3);
      for (const entry of entries) {
        expect(entry.dialogue.length).toBeGreaterThan(0);
        expect(entry.foley.length).toBeGreaterThan(0);
        expect(entry.score.length).toBeGreaterThan(0);
      }
    });

    it("ist deterministisch", () => {
      const a = generateTimeline("Scene", 4);
      const b = generateTimeline("Scene", 4);
      expect(a[0].dialogue).toBe(b[0].dialogue);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const entries = generateTimeline("", 3);
      expect(entries.length).toBe(3);
    });
  });

  describe("exportProductionDossier", () => {
    it("exportiert ein Dossier", () => {
      const entries = generateTimeline("Scene", 4);
      const d = exportProductionDossier("Test Film", entries);
      expect(d.title).toBe("Test Film");
      expect(d.entries.length).toBe(4);
    });

    it("generiert Markdown", () => {
      const entries = generateTimeline("Scene", 3);
      const d = exportProductionDossier("Test", entries);
      expect(d.markdown).toContain("# Test");
      expect(d.markdown).toContain("Shot 01");
    });

    it("generiert JSON", () => {
      const entries = generateTimeline("Scene", 3);
      const d = exportProductionDossier("Test", entries);
      expect(d.json).toContain('"title"');
      expect(d.json).toContain('"shots"');
    });

    it("generiert CSV", () => {
      const entries = generateTimeline("Scene", 3);
      const d = exportProductionDossier("Test", entries);
      expect(d.csv).toContain("Index,Timecode");
      expect(d.csv).toContain("Dialogue");
    });

    it("generiert PDF", () => {
      const entries = generateTimeline("Scene", 3);
      const d = exportProductionDossier("Test", entries);
      expect(d.pdf).toContain("%PDF");
      expect(d.pdf).toContain("%%EOF");
    });

    it("ist deterministisch", () => {
      const entries = generateTimeline("Scene", 3);
      const a = exportProductionDossier("Test", entries);
      const b = exportProductionDossier("Test", entries);
      expect(a.markdown).toBe(b.markdown);
      expect(a.json).toBe(b.json);
    });

    it("ist deterministisch auch bei getrennten Aufrufen (kein Date.now)", async () => {
      const entries = generateTimeline("Scene", 3);
      const a = exportProductionDossier("Test", entries);
      // Ein Zeitversatz darf das Ergebnis nicht verändern.
      await new Promise((r) => setTimeout(r, 15));
      const b = exportProductionDossier("Test", entries);
      expect(a.markdown).toBe(b.markdown);
      expect(a.json).toBe(b.json);
      expect(a.pdf).toBe(b.pdf);
      expect(a.csv).toBe(b.csv);
    });

    it("übernimmt einen expliziten Zeitstempel", () => {
      const entries = generateTimeline("Scene", 2);
      const d = exportProductionDossier("Test", entries, "2030-06-15T12:00:00.000Z");
      expect(d.markdown).toContain("2030-06-15");
      expect(d.json).toContain("2030-06-15T12:00:00.000Z");
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const d = exportProductionDossier("", []);
      expect(d.entries).toEqual([]);
    });
  });

  describe("formatTimeline", () => {
    it("formatiert die Timeline", () => {
      const entries = generateTimeline("Scene", 3);
      const text = formatTimeline(entries);
      expect(text).toContain("Shot 01");
      expect(text).toContain("Dialogue:");
    });

    it("kommt mit null zurecht", () => {
      expect(formatTimeline(null)).toBe("");
    });

    it("kommt mit leerem Array zurecht", () => {
      expect(formatTimeline([])).toBe("");
    });
  });
});
