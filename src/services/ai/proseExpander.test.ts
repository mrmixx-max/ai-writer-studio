/**
 * Tests: proseExpander (WP 54.1 — Beat-zu-Prosa-Expander / „Show, Don't Tell")
 */

import { describe, it, expect } from "vitest";
import { expandBeats, showDontTell, analyzeTelling } from "./proseExpander";

const BEATS = [
  "Miller betritt den Saloon",
  "Er trinkt Whisky",
  "Er konfrontiert den Sheriff",
  "Eine Schießerei bricht aus",
];

describe("proseExpander — expandBeats", () => {
  it("erzeugt einen Absatz je Beat", () => {
    const r = expandBeats(BEATS);
    expect(r.paragraphs.length).toBe(4);
    expect(r.beatCount).toBe(4);
  });

  it("verbindet Absätze mit Leerzeile", () => {
    const r = expandBeats(BEATS);
    expect(r.text.split("\n\n").length).toBe(4);
  });

  it("erzeugt mehr Wörter als die Beat-Eingabe", () => {
    const r = expandBeats(BEATS);
    expect(r.wordCount).toBeGreaterThan(20);
  });

  it("ist deterministisch: gleicher Input → gleicher Output", () => {
    const a = expandBeats(BEATS, { pacing: "balanced" });
    const b = expandBeats(BEATS, { pacing: "balanced" });
    expect(a.text).toBe(b.text);
    expect(a.wordCount).toBe(b.wordCount);
  });

  it("unterschiedliches Tempo erzeugt unterschiedlichen Text", () => {
    const slow = expandBeats(BEATS, { pacing: "atmospheric" });
    const fast = expandBeats(BEATS, { pacing: "staccato" });
    expect(slow.text).not.toBe(fast.text);
    expect(slow.pacing).toBe("atmospheric");
    expect(fast.pacing).toBe("staccato");
  });

  it("Zeitlupen-Tempo ist länger als Stakkato", () => {
    const slow = expandBeats(BEATS, { pacing: "atmospheric" });
    const fast = expandBeats(BEATS, { pacing: "staccato" });
    expect(slow.wordCount).toBeGreaterThan(fast.wordCount);
  });

  it("baut Sinnesanker ein", () => {
    const r = expandBeats(BEATS);
    expect(r.sensoryAnchors).toBeGreaterThan(0);
  });

  it("respektiert ein Stilprofil", () => {
    const short = expandBeats(BEATS, { styleProfile: { avgSentenceLength: 8 } });
    const long = expandBeats(BEATS, { styleProfile: { avgSentenceLength: 30 } });
    expect(short.wordCount).not.toBe(long.wordCount);
  });

  it("wendet Show-Don't-Tell an, wenn Beats Gefühle nennen", () => {
    const r = expandBeats(["Er hatte Todesangst", "Sie war wütend"]);
    expect(r.shownCount).toBeGreaterThan(0);
    expect(r.text).not.toContain("Todesangst");
  });

  it("mutiert die Eingabe nicht", () => {
    const input = [...BEATS];
    expandBeats(input);
    expect(input).toEqual(BEATS);
  });

  it("kommt mit leerer Beat-Liste zurecht", () => {
    const r = expandBeats([]);
    expect(r.text).toBe("");
    expect(r.beatCount).toBe(0);
    expect(r.wordCount).toBe(0);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(expandBeats(null).text).toBe("");
    expect(expandBeats(undefined).beatCount).toBe(0);
    expect(expandBeats("kein Array").text).toBe("");
    expect(expandBeats([null, undefined, 42, "  "]).beatCount).toBe(0);
  });

  it("fällt bei ungültigem Tempo auf balanced zurück", () => {
    const r = expandBeats(BEATS, { pacing: "unbekannt" as never });
    expect(r.pacing).toBe("balanced");
  });

  it("jeder Absatz endet mit Satzzeichen", () => {
    const r = expandBeats(BEATS);
    r.paragraphs.forEach((p) => {
      expect(/[.!?]$/.test(p.trim())).toBe(true);
    });
  });

  it("beginnt jeden Absatz groß", () => {
    const r = expandBeats(["kleine szene beginnt"]);
    expect(r.paragraphs[0].charAt(0)).toBe("K");
  });
});

describe("proseExpander — showDontTell", () => {
  it("ersetzt Todesangst durch Körperreaktionen", () => {
    const r = showDontTell("Er hatte Todesangst.");
    expect(r.replaced).toBe(1);
    expect(r.text).not.toContain("Todesangst");
    expect(r.text).toContain("Schweiß");
  });

  it("ersetzt Wut", () => {
    const r = showDontTell("Sie war wütend.");
    expect(r.replaced).toBe(1);
    expect(r.text).toContain("Kiefermuskeln");
  });

  it("ersetzt mehrere Gefühle im selben Text", () => {
    const r = showDontTell("Er hatte Angst. Sie war traurig.");
    expect(r.replaced).toBe(2);
    expect(r.replacements.length).toBe(2);
  });

  it("priorisiert Todesangst vor Angst", () => {
    const r = showDontTell("Er hatte Todesangst.");
    expect(r.replacements[0].emotion).toBe("Todesangst");
  });

  it("liefert die Ersatzreaktionen mit", () => {
    const r = showDontTell("Er war nervös.");
    expect(r.replacements[0].reactions.length).toBeGreaterThan(0);
  });

  it("lässt Text ohne Tell-Stellen unverändert", () => {
    const clean = "Der Regen fiel schräg gegen das Fenster.";
    const r = showDontTell(clean);
    expect(r.text).toBe(clean);
    expect(r.replaced).toBe(0);
  });

  it("ist idempotent bei bereits gezeigtem Text", () => {
    const once = showDontTell("Er hatte Todesangst.");
    const twice = showDontTell(once.text);
    expect(twice.replaced).toBe(0);
    expect(twice.text).toBe(once.text);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(showDontTell("").replaced).toBe(0);
    expect(showDontTell(null).text).toBe("");
    expect(showDontTell(undefined).replaced).toBe(0);
  });

  it("funktioniert wiederholt ohne Regex-Zustandsleck", () => {
    const text = "Er hatte Angst. Sie war wütend.";
    const a = showDontTell(text);
    const b = showDontTell(text);
    expect(a.text).toBe(b.text);
    expect(a.replaced).toBe(b.replaced);
  });
});

describe("proseExpander — analyzeTelling", () => {
  it("zählt Tell-Stellen", () => {
    const r = analyzeTelling("Er hatte Angst. Sie war wütend.");
    expect(r.tellCount).toBe(2);
  });

  it("benennt die Gefühle", () => {
    const r = analyzeTelling("Er hatte Todesangst.");
    expect(r.tells).toContain("Todesangst");
  });

  it("berechnet ein Verhältnis", () => {
    const r = analyzeTelling("Er hatte Angst. Der Himmel war grau. Sie ging.");
    expect(r.tellRatio).toBeGreaterThan(0);
    expect(r.tellRatio).toBeLessThanOrEqual(1);
  });

  it("findet nichts in gezeigtem Text", () => {
    const r = analyzeTelling("Kalter Schweiß lief ihm den Nacken hinab.");
    expect(r.tellCount).toBe(0);
    expect(r.tells).toEqual([]);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(analyzeTelling("").tellCount).toBe(0);
    expect(analyzeTelling(null).tellRatio).toBe(0);
    expect(analyzeTelling(undefined).tells).toEqual([]);
  });
});
