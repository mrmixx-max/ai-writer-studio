/**
 * Tests: visualNovelTransmuter (WP 68.1)
 */

import { describe, it, expect } from "vitest";
import {
  parseVisualNovelScript,
  generateRenPy,
  generateTwine,
  validateScript,
  averageLinesPerScene,
  toLabel,
  resolveSceneTarget,
} from "./visualNovelTransmuter";

const SAMPLE = `[bg: forest]
# Der Wald

Mira: "Ich gehe jetzt."
[emotion: angry]
Halden: "Das wagst du nicht."
> Fliehen -> Lichtung
> Bleiben -> Kampf

---

[bg: clearing]
# Die Lichtung

Mira: "Endlich frei."

---

# Der Kampf

[emotion: panic]
Halden: "Du hättest fliehen sollen."`;

describe("visualNovelTransmuter", () => {
  describe("toLabel", () => {
    it("wandelt Titel in Ren'Py-Labels um", () => {
      expect(toLabel("Der Wald")).toBe("der_wald");
    });

    it("ersetzt Umlaute", () => {
      expect(toLabel("Die Tür")).toBe("die_tuer");
      expect(toLabel("Größe")).toBe("groesse");
    });

    it("beginnt immer mit einem Buchstaben", () => {
      expect(toLabel("1. Kapitel")).toBe("szene_1_kapitel");
    });

    it("kommt mit leerem Titel zurecht", () => {
      expect(toLabel("")).toBe("szene");
    });
  });

  describe("parseVisualNovelScript", () => {
    it("zerlegt Prosa in Szenen", () => {
      const s = parseVisualNovelScript(SAMPLE, "Testspiel");
      expect(s.sceneCount).toBe(3);
      expect(s.title).toBe("Testspiel");
    });

    it("liest Hintergründe", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.scenes[0].background).toBe("forest");
      expect(s.scenes[1].background).toBe("clearing");
    });

    it("liest Sprecher und Texte", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.scenes[0].lines[0].speaker).toBe("Mira");
      expect(s.scenes[0].lines[0].text).toBe("Ich gehe jetzt.");
    });

    it("liest Emotionstags", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.scenes[0].lines[1].emotion).toBe("angry");
    });

    it("liest Entscheidungen", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.scenes[0].choices.length).toBe(2);
      expect(s.scenes[0].choices[0].label).toBe("Fliehen");
      expect(s.scenes[0].choices[0].target).toBe("Lichtung");
    });

    it("liest Szenen-Titel", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.scenes[0].title).toBe("Der Wald");
      expect(s.scenes[2].title).toBe("Der Kampf");
    });

    it("zählt Zeilen und Entscheidungen", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.lineCount).toBe(4);
      expect(s.choiceCount).toBe(2);
    });

    it("sammelt alle Sprecher", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(s.speakers).toContain("Mira");
      expect(s.speakers).toContain("Halden");
    });

    it("ist deterministisch", () => {
      const a = parseVisualNovelScript(SAMPLE, "Test");
      const b = parseVisualNovelScript(SAMPLE, "Test");
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("macht doppelte Labels eindeutig", () => {
      const s = parseVisualNovelScript("# Wald\nA: \"eins\"\n---\n# Wald\nB: \"zwei\"");
      expect(s.scenes[0].label).toBe("wald");
      expect(s.scenes[1].label).toBe("wald_2");
    });

    it("kommt mit leerem Input zurecht", () => {
      const s = parseVisualNovelScript("");
      expect(s.sceneCount).toBe(0);
      expect(s.lineCount).toBe(0);
    });

    it("kommt mit null zurecht", () => {
      const s = parseVisualNovelScript(null as unknown as string);
      expect(s.sceneCount).toBe(0);
    });

    it("behandelt Zeilen ohne Sprecher als Erzähltext", () => {
      const s = parseVisualNovelScript("Es war einmal ein Wald.");
      expect(s.scenes[0].lines[0].speaker).toBe("Erzähler");
    });
  });

  describe("generateRenPy", () => {
    it("erzeugt ein Ren'Py-Skript", () => {
      const s = parseVisualNovelScript(SAMPLE, "Testspiel");
      const rpy = generateRenPy(s);
      expect(rpy).toContain("label start:");
      // Label stammt aus dem Szenentitel („Die Lichtung" → die_lichtung).
      expect(rpy).toContain("label die_lichtung:");
    });

    it("erzeugt Menüs mit jumps", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const rpy = generateRenPy(s);
      expect(rpy).toContain("menu:");
      // Die Entscheidung zielt auf „Lichtung" und wird auf das Szenen-Label aufgelöst.
      expect(rpy).toContain("jump die_lichtung");
    });

    it("setzt Hintergründe", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const rpy = generateRenPy(s);
      expect(rpy).toContain("scene bg forest");
    });

    it("escaped Anführungszeichen im Dialog", () => {
      const s = parseVisualNovelScript('A: "Er sagte: Halt!"');
      const rpy = generateRenPy(s);
      // Jede Dialogzeile steht in genau einem Paar Anführungszeichen.
      const dialogLines = rpy.split("\n").filter((l) => l.trim().startsWith('"'));
      expect(dialogLines.length).toBeGreaterThan(0);
      for (const line of dialogLines) {
        const quotes = (line.match(/"/g) ?? []).length;
        expect(quotes % 2, `ungerade Anführungszeichen in: ${line}`).toBe(0);
      }
    });

    it("beendet die letzte Szene ohne Entscheidung mit return", () => {
      const s = parseVisualNovelScript("# Ende\nA: \"vorbei\"");
      const rpy = generateRenPy(s);
      expect(rpy).toContain("return");
    });

    it("verbindet Szenen ohne Entscheidung linear", () => {
      const s = parseVisualNovelScript("# Eins\nA: \"a\"\n---\n# Zwei\nB: \"b\"");
      const rpy = generateRenPy(s);
      expect(rpy).toContain("jump zwei");
    });

    it("ist deterministisch", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(generateRenPy(s)).toBe(generateRenPy(s));
    });

    it("kommt mit leerem Skript zurecht", () => {
      const rpy = generateRenPy(null);
      expect(rpy).toContain("label start:");
    });
  });

  describe("generateTwine", () => {
    it("erzeugt W3C-konformes HTML", () => {
      const s = parseVisualNovelScript(SAMPLE, "Testspiel");
      const html = generateTwine(s);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("erzeugt tw-storydata", () => {
      const s = parseVisualNovelScript(SAMPLE, "Testspiel");
      const html = generateTwine(s);
      expect(html).toContain("<tw-storydata");
      expect(html).toContain('format="Harlowe"');
    });

    it("erzeugt Passagen", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const html = generateTwine(s);
      expect(html).toContain("tw-passagedata");
      expect(html).toContain('name="Start"');
    });

    it("erzeugt Links für Entscheidungen", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const html = generateTwine(s);
      // Aufgelöst auf den Szenentitel, damit Twine die Passage findet.
      expect(html).toContain("[[Fliehen->Die Lichtung]]");
    });

    it("verbindet Szenen ohne Entscheidung", () => {
      const s = parseVisualNovelScript("# Eins\nA: \"a\"\n---\n# Zwei\nB: \"b\"");
      const html = generateTwine(s);
      expect(html).toContain("[[Weiter->Zwei]]");
    });

    it("escaped HTML-Sonderzeichen", () => {
      const s = parseVisualNovelScript('A: "1 < 2 & 3 > 2"');
      const html = generateTwine(s);
      expect(html).toContain("&lt;");
      expect(html).toContain("&amp;");
    });

    it("ist deterministisch", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(generateTwine(s)).toBe(generateTwine(s));
    });

    it("kommt mit leerem Skript zurecht", () => {
      const html = generateTwine(null);
      expect(html).toContain("tw-passagedata");
    });
  });

  describe("resolveSceneTarget", () => {
    it("löst ein exaktes Label auf", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const r = resolveSceneTarget("Lichtung", s.scenes);
      expect(r?.title).toBe("Die Lichtung");
    });

    it("löst einen exakten Titel auf", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const r = resolveSceneTarget("Der Kampf", s.scenes);
      expect(r?.label).toBe("der_kampf");
    });

    it("löst artikel-tolerant auf", () => {
      const s = parseVisualNovelScript("# Der Wald\nA: \"a\"");
      const r = resolveSceneTarget("Wald", s.scenes);
      expect(r?.title).toBe("Der Wald");
    });

    it("gibt null für unbekannte Ziele", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(resolveSceneTarget("Nirgendwo", s.scenes)).toBeNull();
    });

    it("gibt null bei mehrdeutigem Teilstring", () => {
      // Kein exakter Treffer für „Wald", aber zwei Kandidaten per Teilstring —
      // lieber melden als raten.
      const s = parseVisualNovelScript("# Waldhaus\nA: \"a\"\n---\n# Waldweg\nB: \"b\"");
      expect(resolveSceneTarget("Wald", s.scenes)).toBeNull();
    });

    it("kommt mit leerer Szennenliste zurecht", () => {
      expect(resolveSceneTarget("Wald", [])).toBeNull();
    });
  });

  describe("validateScript", () => {
    it("erkennt ein gültiges Skript", () => {
      const s = parseVisualNovelScript(SAMPLE);
      const v = validateScript(s);
      expect(v.valid).toBe(true);
      expect(v.brokenJumps).toEqual([]);
    });

    it("erkennt kaputte Sprünge", () => {
      const s = parseVisualNovelScript("# Eins\nA: \"a\"\n> Weiter -> Nirgendwo");
      const v = validateScript(s);
      expect(v.valid).toBe(false);
      expect(v.brokenJumps.length).toBe(1);
    });

    it("warnt bei Szenen ohne Dialog", () => {
      const s = parseVisualNovelScript("# Leer\n---\n# Voll\nA: \"text\"");
      const v = validateScript(s);
      expect(v.warnings.length).toBeGreaterThan(0);
    });

    it("kommt mit null zurecht", () => {
      const v = validateScript(null);
      expect(v.valid).toBe(false);
    });

    it("meldet ein leeres Skript als Fehler", () => {
      const v = validateScript(parseVisualNovelScript(""));
      expect(v.valid).toBe(false);
    });
  });

  describe("averageLinesPerScene", () => {
    it("berechnet den Durchschnitt", () => {
      const s = parseVisualNovelScript(SAMPLE);
      expect(averageLinesPerScene(s)).toBeGreaterThan(0);
    });

    it("kommt mit null zurecht", () => {
      expect(averageLinesPerScene(null)).toBe(0);
    });
  });
});
