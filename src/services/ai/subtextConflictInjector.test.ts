/**
 * Tests: subtextConflictInjector (WP 60.2 — Subtext- & Konflikt-Injektor)
 */

import { describe, it, expect } from "vitest";
import {
  injectSubtext,
  generateMicroReaction,
  analyzeSubtextDensity,
  AGENDA_LABELS,
  type HiddenAgenda,
} from "./subtextConflictInjector";

const DIALOGUE = [
  { speaker: "Mira", text: "Ich war die ganze Nacht hier." },
  { speaker: "Kessler", text: "Das habe ich gehört." },
  { speaker: "Mira", text: "Du glaubst mir nicht." },
  { speaker: "Kessler", text: "Ich glaube, was ich sehe." },
];

describe("subtextConflictInjector — injectSubtext", () => {
  it("reichert einen Dialog an", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "knows-lie", carrier: "Mira" });
    expect(r.lines.length).toBe(4);
    expect(r.injectedCount).toBeGreaterThan(0);
  });

  it("verändert nur die Trägerfigur", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "knows-lie", carrier: "Mira" });
    const kessler = r.lines.filter((l) => l.speaker === "Kessler");
    kessler.forEach((l) => {
      expect(l.hasSubtext).toBe(false);
      expect(l.text).toBe(l.original);
    });
  });

  it("erhält den Originaltext des Kerns", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    const mira = r.lines.find((l) => l.speaker === "Mira");
    expect(mira?.text).toContain("Ich war die ganze Nacht hier");
  });

  it("unterstützt alle fünf Agenden", () => {
    const all: HiddenAgenda[] = ["knows-lie", "secret-love", "jealousy", "guilt", "distrust"];
    all.forEach((a) => {
      const r = injectSubtext(DIALOGUE, { agenda: a, carrier: "Mira" });
      expect(r.agenda).toBe(a);
      expect(r.agendaLabel).toBe(AGENDA_LABELS[a]);
    });
  });

  it("unterschiedliche Agenden erzeugen unterschiedlichen Text", () => {
    const a = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    const b = injectSubtext(DIALOGUE, { agenda: "jealousy", carrier: "Mira" });
    expect(a.text).not.toBe(b.text);
  });

  it("ist deterministisch", () => {
    const a = injectSubtext(DIALOGUE, { agenda: "distrust", carrier: "Mira" });
    const b = injectSubtext(DIALOGUE, { agenda: "distrust", carrier: "Mira" });
    expect(a.text).toBe(b.text);
  });

  it("fügt Körpersprache ein", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    expect(r.lines.some((l) => l.reaction !== undefined)).toBe(true);
  });

  it("formatiert den Dialog mit Sprechern", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    expect(r.text).toContain("MIRA:");
    expect(r.text).toContain("KESSLER:");
  });

  it("formatiert Körpersprache in Klammern", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    expect(r.text).toMatch(/\(.*\.\)/);
  });

  it("nutzt die erste Figur als Träger ohne Angabe", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt" });
    expect(r.lines[0].hasSubtext).toBe(true);
  });

  it("fällt bei unbekannter Agenda auf knows-lie zurück", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "unbekannt" as never });
    expect(r.agenda).toBe("knows-lie");
  });

  it("berechnet die Wortzahl", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    expect(r.wordCount).toBeGreaterThan(10);
  });

  it("kommt mit leerem Dialog zurecht", () => {
    const r = injectSubtext([]);
    expect(r.lines).toEqual([]);
    expect(r.text).toBe("");
    expect(r.injectedCount).toBe(0);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(injectSubtext(null).lines).toEqual([]);
    expect(injectSubtext(undefined).text).toBe("");
    expect(injectSubtext("kein Array").injectedCount).toBe(0);
    expect(injectSubtext([{ speaker: "", text: "" }]).lines).toEqual([]);
  });

  it("kommt mit null-Optionen zurecht", () => {
    expect(injectSubtext(DIALOGUE, null).lines.length).toBe(4);
  });

  it("mutiert die Eingabe nicht", () => {
    const copy = JSON.parse(JSON.stringify(DIALOGUE));
    injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    expect(DIALOGUE).toEqual(copy);
  });

  it("exportiert die Agenda-Labels", () => {
    expect(AGENDA_LABELS["knows-lie"]).toBe("Weiß von der Lüge");
    expect(AGENDA_LABELS["secret-love"]).toBe("Heimliche Liebe");
  });
});

describe("subtextConflictInjector — generateMicroReaction", () => {
  it("liefert eine Reaktion", () => {
    const r = generateMicroReaction("guilt", "seed");
    expect(r.length).toBeGreaterThan(10);
  });

  it("ist deterministisch", () => {
    expect(generateMicroReaction("guilt", "x")).toBe(generateMicroReaction("guilt", "x"));
  });

  it("unterschiedliche Agenden liefern unterschiedliche Reaktionen", () => {
    const a = generateMicroReaction("guilt", "x");
    const b = generateMicroReaction("jealousy", "x");
    expect(a).not.toBe(b);
  });

  it("fällt bei unbekannter Agenda zurück", () => {
    expect(generateMicroReaction("unbekannt").length).toBeGreaterThan(10);
  });

  it("kommt ohne Argumente zurecht", () => {
    expect(generateMicroReaction().length).toBeGreaterThan(10);
  });
});

describe("subtextConflictInjector — analyzeSubtextDensity", () => {
  it("erkennt Subtext im angereicherten Dialog", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    const d = analyzeSubtextDensity(r.text);
    expect(d.density).toBeGreaterThan(0);
  });

  it("meldet ausreichend Subtext bei guter Dichte", () => {
    const r = injectSubtext(DIALOGUE, { agenda: "guilt", carrier: "Mira" });
    const d = analyzeSubtextDensity(r.text);
    expect(d.sufficient).toBe(true);
  });

  it("meldet zu wenig Subtext bei plattem Dialog", () => {
    const flat = "A: Ja.\n\nB: Nein.\n\nA: Okay.";
    expect(analyzeSubtextDensity(flat).sufficient).toBe(false);
  });

  it("listet die Marker auf", () => {
    const d = analyzeSubtextDensity("Die Antwort kam zu schnell und der Blick senkte sich.");
    expect(d.markers.length).toBeGreaterThan(0);
  });

  it("zählt die Beiträge", () => {
    const d = analyzeSubtextDensity("A: Eins.\n\nB: Zwei.");
    expect(d.lineCount).toBe(2);
  });

  it("Dichte bleibt zwischen 0 und 1", () => {
    const d = analyzeSubtextDensity("Die Stimme wurde zu leise.\n\nDer Blick blieb.");
    expect(d.density).toBeGreaterThanOrEqual(0);
    expect(d.density).toBeLessThanOrEqual(1);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(analyzeSubtextDensity("").density).toBe(0);
    expect(analyzeSubtextDensity(null).sufficient).toBe(false);
    expect(analyzeSubtextDensity(undefined).markers).toEqual([]);
  });
});
