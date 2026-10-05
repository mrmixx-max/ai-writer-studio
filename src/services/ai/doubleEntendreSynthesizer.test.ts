/**
 * Tests: doubleEntendreSynthesizer (WP 64.1)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeDoubleEntendre,
  decipherLine,
  analyzeLayering,
  formatSurfaceOnly,
  formatDeciphered,
  TOPIC_LABELS,
  INTENT_LABELS,
} from "./doubleEntendreSynthesizer";

describe("doubleEntendreSynthesizer", () => {
  describe("synthesizeDoubleEntendre", () => {
    it("erzeugt einen Dialog mit Standardwerten", () => {
      const d = synthesizeDoubleEntendre();
      expect(d.lines.length).toBe(6);
      expect(d.lineCount).toBe(6);
      expect(d.topic).toBe("garden");
      expect(d.intent).toBe("accusation");
    });

    it("erzeugt einen Dialog mit benutzerdefinierten Werten", () => {
      const d = synthesizeDoubleEntendre({
        topic: "wine",
        intent: "blackmail",
        speaker: "Der Herzog",
        listener: "die Spionin",
        secret: "Ich kenne das Geheimnis von {who}",
        turns: 4,
      });
      expect(d.lines.length).toBe(4);
      expect(d.topic).toBe("wine");
      expect(d.intent).toBe("blackmail");
      expect(d.topicLabel).toBe(TOPIC_LABELS.wine);
      expect(d.intentLabel).toBe(INTENT_LABELS.blackmail);
    });

    it("ersetzt {who} durch den Gesprächspartner", () => {
      const d = synthesizeDoubleEntendre({
        topic: "chess",
        intent: "threat",
        speaker: "Der König",
        listener: "der Verräter",
        secret: "Wenn {who} einen Schritt zu weit geht, endet es schlecht",
        turns: 2,
      });
      expect(d.lines[0].subtext).toContain("der Verräter");
      expect(d.lines[0].subtext).not.toContain("{who}");
    });

    it("verwendet die Oberfläche des gewählten Themas", () => {
      const d = synthesizeDoubleEntendre({ topic: "music", turns: 4 });
      expect(d.lines[0].surface.length).toBeGreaterThan(10);
      expect(d.topicLabel).toBe(TOPIC_LABELS.music);
    });

    it("begrenzt die Beitragszahl auf 10", () => {
      const d = synthesizeDoubleEntendre({ turns: 99 });
      expect(d.lines.length).toBe(10);
    });

    it("begrenzt die Beitragszahl auf 2", () => {
      const d = synthesizeDoubleEntendre({ turns: 1 });
      expect(d.lines.length).toBe(2);
    });

    it("erzeugt Regieanweisungen", () => {
      const d = synthesizeDoubleEntendre({ turns: 6 });
      const withDir = d.lines.filter((l) => l.stageDirection !== undefined);
      expect(withDir.length).toBeGreaterThan(0);
    });

    it("erzeugt einen formatierten Oberflächentext", () => {
      const d = synthesizeDoubleEntendre({ turns: 4 });
      expect(d.surfaceText).toContain("GRÄFIN");
      expect(d.surfaceText).toContain("„");
    });

    it("erzeugt einen entschlüsselten Text", () => {
      const d = synthesizeDoubleEntendre({ turns: 4 });
      expect(d.decipheredText).toContain("Gemeint:");
    });

    it("ist deterministisch", () => {
      const a = synthesizeDoubleEntendre({ topic: "garden", intent: "warning", turns: 5 });
      const b = synthesizeDoubleEntendre({ topic: "garden", intent: "warning", turns: 5 });
      expect(a.surfaceText).toBe(b.surfaceText);
      expect(a.decipheredText).toBe(b.decipheredText);
    });

    it("kommt mit leeren Eingaben zurecht", () => {
      const d = synthesizeDoubleEntendre({});
      expect(d.lines.length).toBeGreaterThan(0);
    });

    it("kommt mit null zurecht", () => {
      const d = synthesizeDoubleEntendre(null);
      expect(d.lines.length).toBeGreaterThan(0);
    });
  });

  describe("decipherLine", () => {
    it("kennt eine Anklage", () => {
      const r = decipherLine("Ich weiß, was du getan hast — und ich habe Beweise");
      expect(r.intent).toBe("accusation");
      expect(r.signals.length).toBeGreaterThan(0);
    });

    it("kennt eine Drohung", () => {
      const r = decipherLine("Wenn du einen Schritt zu weit gehst, endet es schlecht");
      expect(r.intent).toBe("threat");
    });

    it("kennt Erpressung", () => {
      const r = decipherLine("Ich kenne ein Geheimnis von dir, das viel wert ist");
      expect(r.intent).toBe("blackmail");
    });

    it("kennt eine Warnung", () => {
      const r = decipherLine("Du solltest diesen Ort heute Nacht verlassen");
      expect(r.intent).toBe("warning");
    });

    it("kennt ein Bündnisangebot", () => {
      const r = decipherLine("Ein Bündnis wäre klüger als dieses Geplänkel");
      expect(r.intent).toBe("alliance-offer");
    });

    it("erkennt harmlose Oberflächen", () => {
      const r = decipherLine("Die Rosen stehen dieses Jahr bemerkenswert früh");
      expect(r.intent).toBeNull();
      expect(r.meaning).toContain("Harmlose");
    });

    it("kommt mit leerem Text zurecht", () => {
      const r = decipherLine("");
      expect(r.intent).toBeNull();
      expect(r.signals).toEqual([]);
    });

    it("kommt mit null zurecht", () => {
      const r = decipherLine(null);
      expect(r.intent).toBeNull();
    });
  });

  describe("analyzeLayering", () => {
    it("bewertet einen doppelbödigen Dialog", () => {
      const d = synthesizeDoubleEntendre({ turns: 6 });
      const a = analyzeLayering(d);
      expect(a.layeringRate).toBeGreaterThan(0);
      expect(a.averageSurfaceLength).toBeGreaterThan(0);
      expect(a.stageDirectionCount).toBeGreaterThan(0);
      expect(a.sufficientlyLayered).toBe(true);
    });

    it("kommt mit leerem Dialog zurecht", () => {
      const a = analyzeLayering(null);
      expect(a.layeringRate).toBe(0);
      expect(a.sufficientlyLayered).toBe(false);
    });

    it("kommt mit undefined zurecht", () => {
      const a = analyzeLayering(undefined);
      expect(a.layeringRate).toBe(0);
    });
  });

  describe("formatSurfaceOnly / formatDeciphered", () => {
    it("formatiert die Oberfläche", () => {
      const d = synthesizeDoubleEntendre({ turns: 4 });
      expect(formatSurfaceOnly(d)).toBe(d.surfaceText);
    });

    it("formatiert den entschlüsselten Text", () => {
      const d = synthesizeDoubleEntendre({ turns: 4 });
      expect(formatDeciphered(d)).toBe(d.decipheredText);
    });

    it("kommt mit null zurecht", () => {
      expect(formatSurfaceOnly(null)).toBe("");
      expect(formatDeciphered(null)).toBe("");
    });
  });

  describe("TOPIC_LABELS / INTENT_LABELS", () => {
    it("enthält alle Themen", () => {
      expect(Object.keys(TOPIC_LABELS).length).toBe(5);
    });

    it("enthält alle Absichten", () => {
      expect(Object.keys(INTENT_LABELS).length).toBe(5);
    });
  });
});
