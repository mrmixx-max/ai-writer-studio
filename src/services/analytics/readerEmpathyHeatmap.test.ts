/**
 * Tests: readerEmpathyHeatmap (WP 71.1)
 */

import { describe, it, expect } from "vitest";
import {
  analyzeEmpathyHeatmap,
  glowOpacity,
  summarizeHeatmap,
  REACTION_MARKERS,
  REACTION_LABELS,
  type ReactionKind,
} from "./readerEmpathyHeatmap";

const TEAR_TEXT = `Sie weinte, als sie den letzten Atemzug hörte. Der Verlust war zu groß.

Er trat ein und sah die Waffe. Panik, Angst, keine Zeit mehr. Er rannte.

Sie lachte laut, ein alberner Patzer, alle kicherten.`;

describe("readerEmpathyHeatmap", () => {
  describe("analyzeEmpathyHeatmap", () => {
    it("zerlegt Text in Absätze", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.paragraphs.length).toBe(3);
    });

    it("erkennt Tränen-Marker", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.paragraphs[0].tears).toBeGreaterThan(0);
      expect(h.paragraphs[0].dominant).toBe("tears");
    });

    it("erkennt Adrenalin-Marker", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.paragraphs[1].adrenaline).toBeGreaterThan(0);
      expect(h.paragraphs[1].dominant).toBe("adrenaline");
    });

    it("erkennt Lach-Marker", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.paragraphs[2].laughter).toBeGreaterThan(0);
      expect(h.paragraphs[2].dominant).toBe("laughter");
    });

    it("erkennt Gänsehaut-Marker", () => {
      const h = analyzeEmpathyHeatmap(
        "Die Wahrheit wurde enthüllt, eine Epische Katharsis, die Rettung kam unverhofft.",
      );
      expect(h.paragraphs[0].goosebumps).toBeGreaterThan(0);
    });

    it("erkennt Flexionen über Regex", () => {
      // 'weinte' und 'weinen' müssen beide greifen.
      const a = analyzeEmpathyHeatmap("Sie weinte lange.");
      const b = analyzeEmpathyHeatmap("Sie wollte weinen.");
      expect(a.paragraphs[0].tears).toBeGreaterThan(0);
      expect(b.paragraphs[0].tears).toBeGreaterThan(0);
    });

    it("berechnet die Durchschnitte", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.averages.tears).toBeGreaterThan(0);
      expect(h.averages.adrenaline).toBeGreaterThan(0);
      expect(h.averages.laughter).toBeGreaterThan(0);
    });

    it("bestimmt den Klimax-Absatz", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.climaxParagraph).not.toBeNull();
      expect(h.climaxParagraph).toBeGreaterThanOrEqual(1);
    });

    it("erzeugt Hotspots über der Schwelle", () => {
      const strong = analyzeEmpathyHeatmap(
        "Sie weinte und weinte, Tränen der Trauer, Verlust, Abschied, Schmerz, sie schluchzte und weinte.",
      );
      expect(strong.hotspots.length).toBeGreaterThan(0);
      expect(strong.hotspots[0].intensity).toBeGreaterThanOrEqual(40);
    });

    it("sortiert Hotspots absteigend", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      for (let i = 1; i < h.hotspots.length; i++) {
        expect(h.hotspots[i - 1].intensity).toBeGreaterThanOrEqual(h.hotspots[i].intensity);
      }
    });

    it("zählt die Gesamtwörter", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.totalWords).toBeGreaterThan(20);
    });

    it("speichert eine Vorschau", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(h.paragraphs[0].preview.length).toBeGreaterThan(10);
      expect(h.paragraphs[0].preview.length).toBeLessThanOrEqual(80);
    });

    it("liefert Nullwerte für emotionslosen Text", () => {
      const h = analyzeEmpathyHeatmap("Der Tisch steht im Raum. Die Wand ist weiß.");
      expect(h.paragraphs[0].peak).toBe(0);
      expect(h.hotspots).toEqual([]);
      expect(h.climaxParagraph).toBeNull();
    });

    it("ist deterministisch", () => {
      const a = analyzeEmpathyHeatmap(TEAR_TEXT);
      const b = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("begrenzt alle Werte auf 0–100", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      for (const p of h.paragraphs) {
        for (const v of [p.tears, p.goosebumps, p.laughter, p.adrenaline, p.peak]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    });

    it("kommt mit leerem Text zurecht", () => {
      const h = analyzeEmpathyHeatmap("");
      expect(h.paragraphs).toEqual([]);
      expect(h.totalWords).toBe(0);
      expect(h.climaxParagraph).toBeNull();
    });

    it("kommt mit null zurecht", () => {
      const h = analyzeEmpathyHeatmap(null as unknown as string);
      expect(h.paragraphs).toEqual([]);
    });

    it("kommt mit einem einzelnen Absatz ohne Leerzeilen zurecht", () => {
      const h = analyzeEmpathyHeatmap("Nur ein Satz.");
      expect(h.paragraphs.length).toBe(1);
    });
  });

  describe("glowOpacity", () => {
    it("ist 0 bei Intensität 0", () => {
      expect(glowOpacity(0)).toBe(0);
    });

    it("bleibt unter 1 für die Lesbarkeit", () => {
      expect(glowOpacity(100)).toBeLessThanOrEqual(0.7);
    });

    it("steigt mit der Intensität", () => {
      expect(glowOpacity(80)).toBeGreaterThan(glowOpacity(20));
    });

    it("begrenzt Werte außerhalb des Bereichs", () => {
      expect(glowOpacity(-50)).toBe(0);
      expect(glowOpacity(500)).toBeLessThanOrEqual(0.7);
    });

    it("kommt mit NaN zurecht", () => {
      expect(glowOpacity(Number.NaN)).toBe(0);
    });
  });

  describe("summarizeHeatmap", () => {
    it("fasst die Heatmap zusammen", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      const s = summarizeHeatmap(h);
      expect(s).toContain("Empathie-Heatmap");
      expect(s).toContain("3 Absätze");
    });

    it("nennt den Höhepunkt", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(summarizeHeatmap(h)).toContain("Höhepunkt");
    });

    it("listet Hotspots", () => {
      const strong = analyzeEmpathyHeatmap(
        "Sie weinte und weinte, Tränen der Trauer, Verlust, Abschied, sie schluchzte.",
      );
      expect(summarizeHeatmap(strong)).toContain("Hotspot");
    });

    it("kommt mit leerer Heatmap zurecht", () => {
      expect(summarizeHeatmap(null)).toContain("Keine");
    });

    it("ist deterministisch", () => {
      const h = analyzeEmpathyHeatmap(TEAR_TEXT);
      expect(summarizeHeatmap(h)).toBe(summarizeHeatmap(h));
    });
  });

  describe("REACTION_MARKERS / REACTION_LABELS", () => {
    it("hat für jede Reaktion Marker", () => {
      const all: ReactionKind[] = ["tears", "goosebumps", "laughter", "adrenaline"];
      for (const k of all) {
        expect(REACTION_MARKERS[k].length).toBeGreaterThan(0);
      }
    });

    it("hat für jede Reaktion ein Label", () => {
      expect(Object.keys(REACTION_LABELS).length).toBe(4);
    });
  });
});
