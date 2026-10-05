/**
 * Tests: foreshadowingWeaver (WP 56.1 — Foreshadowing & Tschechows Gewehr)
 */

import { describe, it, expect } from "vitest";
import {
  mapTwistToClues,
  injectForeshadowing,
  auditForeshadowing,
  getCategorySignals,
  LEVEL_LABELS,
} from "./foreshadowingWeaver";

const TWIST =
  "Der Leibarzt vergiftet den König langsam mit gemahlenem Nachtschattengift.";

const SCENE =
  "Der Saal war voll. Der König hob den Becher. Die Musik spielte weiter. Niemand sah den Leibarzt an.";

describe("foreshadowingWeaver — mapTwistToClues", () => {
  it("erzeugt einen Hinweis je Stufe", () => {
    const p = mapTwistToClues(TWIST);
    expect(p.clues.length).toBe(3);
    expect(p.clues.map((c) => c.level)).toEqual([1, 2, 3]);
  });

  it("benennt die Stufen", () => {
    const p = mapTwistToClues(TWIST);
    expect(p.clues[0].levelLabel).toBe("Kaum merklich");
    expect(p.clues[1].levelLabel).toBe("Gegenstands-Verankerung");
    expect(p.clues[2].levelLabel).toBe("Ominöse Ahnung");
  });

  it("ordnet die Kategorien korrekt zu", () => {
    const p = mapTwistToClues(TWIST);
    expect(p.clues[0].category).toBe("sensory");
    expect(p.clues[1].category).toBe("object");
    expect(p.clues[2].category).toBe("dialogue");
  });

  it("extrahiert Schlüsselbegriffe", () => {
    const p = mapTwistToClues(TWIST);
    expect(p.keywords.length).toBeGreaterThan(0);
    expect(p.keywords).toContain("leibarzt");
  });

  it("greift den Twist-Begriff in den Hinweisen auf", () => {
    const p = mapTwistToClues(TWIST);
    const all = p.clues.map((c) => c.text).join(" ");
    expect(all).toContain("Leibarzt");
  });

  it("ist deterministisch", () => {
    const a = mapTwistToClues(TWIST, 24);
    const b = mapTwistToClues(TWIST, 24);
    expect(a.clues.map((c) => c.text)).toEqual(b.clues.map((c) => c.text));
    expect(a.clues.map((c) => c.suggestedChapter)).toEqual(b.clues.map((c) => c.suggestedChapter));
  });

  it("verteilt die Stufen über das Manuskript", () => {
    const p = mapTwistToClues(TWIST, 30);
    const [c1, , c3] = p.clues;
    expect(c1.suggestedChapter).toBeLessThan(c3.suggestedChapter);
  });

  it("hält Kapitel im gültigen Bereich", () => {
    const p = mapTwistToClues(TWIST, 10);
    p.clues.forEach((c) => {
      expect(c.suggestedChapter).toBeGreaterThanOrEqual(1);
      expect(c.suggestedChapter).toBeLessThanOrEqual(10);
    });
  });

  it("endet jeden Hinweis mit Satzzeichen", () => {
    const p = mapTwistToClues(TWIST);
    p.clues.forEach((c) => {
      expect(/[.!?»"]$/.test(c.text.trim())).toBe(true);
    });
  });

  it("vergibt eindeutige IDs", () => {
    const p = mapTwistToClues(TWIST);
    const ids = p.clues.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kommt mit leerem Twist zurecht", () => {
    const p = mapTwistToClues("");
    expect(p.clues).toEqual([]);
    expect(p.totalClues).toBe(0);
    expect(mapTwistToClues(null).keywords).toEqual([]);
    expect(mapTwistToClues(undefined).twist).toBe("");
  });

  it("nutzt 20 Kapitel als Standard", () => {
    expect(mapTwistToClues(TWIST).totalChapters).toBe(20);
  });

  it("exportiert die Stufen-Labels", () => {
    expect(LEVEL_LABELS[1]).toBe("Kaum merklich");
    expect(LEVEL_LABELS[2]).toBe("Gegenstands-Verankerung");
    expect(LEVEL_LABELS[3]).toBe("Ominöse Ahnung");
  });
});

describe("foreshadowingWeaver — injectForeshadowing", () => {
  it("erhält den Originaltext vollständig", () => {
    const r = injectForeshadowing(SCENE, TWIST);
    expect(r.text).toContain("Der Saal war voll");
    expect(r.text).toContain("Niemand sah den Leibarzt an");
  });

  it("fügt Hinweise ein", () => {
    const r = injectForeshadowing(SCENE, TWIST);
    expect(r.insertedCount).toBeGreaterThan(0);
    expect(r.inserted.length).toBe(r.insertedCount);
  });

  it("macht den Text länger", () => {
    const r = injectForeshadowing(SCENE, TWIST);
    expect(r.text.length).toBeGreaterThan(SCENE.length);
  });

  it("respektiert die Anzahl", () => {
    expect(injectForeshadowing(SCENE, TWIST, { count: 1 }).insertedCount).toBe(1);
    expect(injectForeshadowing(SCENE, TWIST, { count: 2 }).insertedCount).toBe(2);
  });

  it("begrenzt die Anzahl auf 1–3", () => {
    expect(injectForeshadowing(SCENE, TWIST, { count: 0 }).insertedCount).toBe(1);
    expect(injectForeshadowing(SCENE, TWIST, { count: 99 }).insertedCount).toBe(3);
  });

  it("ist deterministisch", () => {
    const a = injectForeshadowing(SCENE, TWIST, { chapter: 5 });
    const b = injectForeshadowing(SCENE, TWIST, { chapter: 5 });
    expect(a.text).toBe(b.text);
    expect(a.positions).toEqual(b.positions);
  });

  it("wählt Hinweise passend zum Zielkapitel", () => {
    const early = injectForeshadowing(SCENE, TWIST, { chapter: 1, count: 1 });
    const late = injectForeshadowing(SCENE, TWIST, { chapter: 19, count: 1 });
    expect(early.inserted[0].level).not.toBe(late.inserted[0].level);
  });

  it("fügt nie mitten im Satz ein (an Satzgrenzen)", () => {
    const r = injectForeshadowing(SCENE, TWIST);
    // Jeder eingefügte Hinweis muss als eigener Satz im Ergebnis stehen.
    r.inserted.forEach((clue) => {
      expect(r.text).toContain(clue.text);
    });
  });

  it("mutiert die Eingabe nicht", () => {
    const original = SCENE;
    injectForeshadowing(SCENE, TWIST);
    expect(SCENE).toBe(original);
  });

  it("kommt mit leerer Szene zurecht", () => {
    const r = injectForeshadowing("", TWIST);
    expect(r.insertedCount).toBeGreaterThan(0);
    expect(r.text.length).toBeGreaterThan(10);
  });

  it("kommt mit leerem Twist zurecht", () => {
    const r = injectForeshadowing(SCENE, "");
    expect(r.text).toBe(SCENE);
    expect(r.insertedCount).toBe(0);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(injectForeshadowing(null, null).insertedCount).toBe(0);
    expect(injectForeshadowing(undefined, undefined).text).toBe("");
  });
});

describe("foreshadowingWeaver — auditForeshadowing", () => {
  it("findet Stufe-2-Hinweise", () => {
    const r = auditForeshadowing("Auf dem Regal stand ein Mörser, den niemand benutzte.");
    expect(r.levelCounts[2]).toBeGreaterThan(0);
  });

  it("findet Stufe-3-Hinweise", () => {
    const r = auditForeshadowing("Man sagt, der Wein hier wisse mehr als der Wirt.");
    expect(r.levelCounts[3]).toBeGreaterThan(0);
  });

  it("findet Stufe-1-Hinweise", () => {
    const r = auditForeshadowing("Ein kaum merklicher bitterer Nachgeschmack blieb.");
    expect(r.levelCounts[1]).toBeGreaterThan(0);
  });

  it("zählt alle Hinweise", () => {
    const r = auditForeshadowing(
      "Kaum merklich blieb etwas zurück. Auf dem Regal stand ein Mörser. Man sagt, der Wein wisse mehr.",
    );
    expect(r.total).toBeGreaterThanOrEqual(3);
  });

  it("berechnet die Abdeckung", () => {
    const r = auditForeshadowing(
      "Kaum merklich blieb etwas. Auf dem Regal stand ein Mörser. Man sagt, bald sei es vorbei.",
    );
    expect(r.coverage).toBe(1);
  });

  it("coverage ist 0 bei Text ohne Hinweise", () => {
    const r = auditForeshadowing("Der Himmel war blau und die Vögel sangen.");
    expect(r.coverage).toBe(0);
    expect(r.total).toBe(0);
  });

  it("erkennt eingeflochtene Hinweise", () => {
    const injected = injectForeshadowing(SCENE, TWIST, { count: 3 });
    const r = auditForeshadowing(injected.text);
    expect(r.total).toBeGreaterThan(0);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = auditForeshadowing("");
    expect(r.total).toBe(0);
    expect(r.coverage).toBe(0);
    expect(r.findings).toEqual([]);
    expect(auditForeshadowing(null).levelCounts).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it("liefert die Signalwörter mit", () => {
    const r = auditForeshadowing("Auf dem Regal stand etwas.");
    expect(r.findings[0].signals.length).toBeGreaterThan(0);
  });
});

describe("foreshadowingWeaver — getCategorySignals", () => {
  it("liefert Signalwörter je Kategorie", () => {
    expect(getCategorySignals("sensory").length).toBeGreaterThan(0);
    expect(getCategorySignals("object")).toContain("mörser");
    expect(getCategorySignals("dialogue").length).toBeGreaterThan(0);
  });

  it("kommt mit unbekannter Kategorie zurecht", () => {
    expect(getCategorySignals("unbekannt" as never)).toEqual([]);
  });
});
