// Tests für die Beat-Sheet-Vorlagen (WP 5.1).
//
// Kernaussage: Vorlagen sind vollständig, lokal, deterministisch und
// defensiv. Sie funktionieren auch bei leeren Büchern, fehlenden Kapiteln
// und unbekannten Vorlagentypen.

import { describe, it, expect } from "vitest";
import {
  getBeatTemplate,
  listBeatTemplates,
  applyBeatTemplate,
  validateBeatCoverage,
  type BeatTemplate,
} from "./beatSheet";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

function makeChapter(over: Partial<BookChapterInput> = {}): BookChapterInput {
  return {
    number: 1,
    title: "Kapitel 1",
    content: "Ein Text.",
    ...over,
  };
}

const SAVE_THE_CAT_BEAT_IDS = [
  "opening-image",
  "theme-stated",
  "set-up",
  "catalyst",
  "debate",
  "break-into-two",
  "b-story",
  "fun-and-games",
  "midpoint",
  "bad-guys-close-in",
  "all-is-lost",
  "dark-night-of-the-soul",
  "break-into-three",
  "finale",
  "final-image",
];

describe("getBeatTemplate", () => {
  it("liefert 15 Beats für Save the Cat in korrekter Reihenfolge", () => {
    const template = getBeatTemplate("save-the-cat");
    expect(template.type).toBe("save-the-cat");
    expect(template.beats).toHaveLength(15);
    expect(template.beats.map((b) => b.id)).toEqual(SAVE_THE_CAT_BEAT_IDS);
  });

  it("liefert 12 Stationen für die Heldenreise", () => {
    const template = getBeatTemplate("hero-journey");
    expect(template.beats).toHaveLength(12);
    expect(template.beats[0].name).toBe("Ordinary World");
    expect(template.beats[11].name).toBe("Return with the Elixir");
  });

  it("liefert die Drei-Akt-Struktur mit 3 Akten à 3 Unterbeats", () => {
    const template = getBeatTemplate("three-act");
    expect(template.beats).toHaveLength(9);
    const acts = new Set(template.beats.map((b) => b.name.split(" – ")[0]));
    expect(acts).toEqual(new Set(["Akt I", "Akt II", "Akt III"]));
  });

  it("gibt jedem Beat alle Pflichtfelder und Status 'pending'", () => {
    for (const type of ["save-the-cat", "hero-journey", "three-act"] as const) {
      for (const beat of getBeatTemplate(type).beats) {
        expect(typeof beat.id).toBe("string");
        expect(beat.id.length).toBeGreaterThan(0);
        expect(beat.name.length).toBeGreaterThan(0);
        expect(beat.description.length).toBeGreaterThan(0);
        expect(beat.status).toBe("pending");
      }
    }
  });

  it("vergibt eindeutige Beat-IDs je Vorlage", () => {
    for (const type of ["save-the-cat", "hero-journey", "three-act"] as const) {
      const ids = getBeatTemplate(type).beats.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("fällt bei unbekanntem Typ defensiv auf die Drei-Akt-Vorlage zurück", () => {
    const template = getBeatTemplate("unbekannt" as never);
    expect(template.type).toBe("three-act");
    expect(template.beats).toHaveLength(9);
  });

  it("gibt frische Kopien zurück (kein geteilter Zustand)", () => {
    const a = getBeatTemplate("save-the-cat");
    a.beats[0].status = "completed";
    a.beats[0].name = "Manipuliert";
    const b = getBeatTemplate("save-the-cat");
    expect(b.beats[0].status).toBe("pending");
    expect(b.beats[0].name).toBe("Opening Image");
  });

  it("listet alle drei Vorlagen auf", () => {
    const types = listBeatTemplates().map((t) => t.type);
    expect(types).toEqual(["save-the-cat", "hero-journey", "three-act"]);
  });
});

describe("applyBeatTemplate", () => {
  it("verteilt Beats über die Kapitel und ergänzt targetChapter", () => {
    const chapters = [
      makeChapter({ number: 1, title: "A" }),
      makeChapter({ number: 2, title: "B" }),
      makeChapter({ number: 3, title: "C" }),
    ];
    const result = applyBeatTemplate(chapters, getBeatTemplate("save-the-cat"));
    expect(result).toHaveLength(3);
    // Alle 15 Beats müssen irgendwo zugeordnet sein.
    const all = result.flatMap((c) => c.beats);
    expect(all).toHaveLength(15);
    expect(all.every((b) => typeof b.targetChapter === "number")).toBe(true);
    // Erster Beat beim ersten, letzter Beat beim letzten Kapitel.
    expect(result[0].beats[0].id).toBe("opening-image");
    expect(result[2].beats.at(-1)?.id).toBe("final-image");
  });

  it("mutiert die Eingabekapitel nicht", () => {
    const chapters = [makeChapter({ number: 1, title: "A" })];
    const snapshot = JSON.stringify(chapters);
    applyBeatTemplate(chapters, getBeatTemplate("three-act"));
    expect(JSON.stringify(chapters)).toBe(snapshot);
    expect((chapters[0] as { beats?: unknown }).beats).toBeUndefined();
  });

  it("leitet den Beat-Status aus dem Kapitelinhalt ab", () => {
    const chapters = [
      makeChapter({ number: 1, content: "" }),
      makeChapter({ number: 2, content: "Ausgearbeiteter Text." }),
      makeChapter({ number: 3, content: "Fertig.", status: "completed" }),
    ];
    const result = applyBeatTemplate(chapters, getBeatTemplate("three-act"));
    // Kapitel 1 (leer) → pending, Kapitel 2 → draft, Kapitel 3 → completed.
    expect(result[0].beats.some((b) => b.status === "pending")).toBe(true);
    expect(result[1].beats.some((b) => b.status === "draft")).toBe(true);
    expect(result[2].beats.some((b) => b.status === "completed")).toBe(true);
  });

  it("respektiert ein bereits gesetztes targetChapter", () => {
    const template = getBeatTemplate("three-act");
    template.beats[0].targetChapter = 3;
    const chapters = [
      makeChapter({ number: 1, title: "A" }),
      makeChapter({ number: 2, title: "B" }),
      makeChapter({ number: 3, title: "C" }),
    ];
    const result = applyBeatTemplate(chapters, template);
    expect(result[0].beats.some((b) => b.id === "act1-setup")).toBe(false);
    expect(result[2].beats.some((b) => b.id === "act1-setup")).toBe(true);
  });

  it("verteilt bei mehr Beats als Kapiteln mehrere Beats pro Kapitel", () => {
    const chapters = [makeChapter({ number: 1 })];
    const result = applyBeatTemplate(chapters, getBeatTemplate("save-the-cat"));
    expect(result).toHaveLength(1);
    expect(result[0].beats).toHaveLength(15);
  });

  it("gibt für ein leeres Buch ein leeres Array zurück", () => {
    expect(applyBeatTemplate([], getBeatTemplate("save-the-cat"))).toEqual([]);
  });

  it("verarbeitet eine Vorlage ohne Beats defensiv", () => {
    const empty: BeatTemplate = {
      type: "three-act",
      name: "Leer",
      description: "keine Beats",
      beats: [],
    };
    const result = applyBeatTemplate([makeChapter({ number: 1 })], empty);
    expect(result).toHaveLength(1);
    expect(result[0].beats).toEqual([]);
  });

  it("ist deterministisch bei identischer Eingabe", () => {
    const chapters = [makeChapter({ number: 1 }), makeChapter({ number: 2 })];
    const a = applyBeatTemplate(chapters, getBeatTemplate("hero-journey"));
    const b = applyBeatTemplate(chapters, getBeatTemplate("hero-journey"));
    expect(a).toEqual(b);
  });
});

describe("validateBeatCoverage", () => {
  it("meldet vollständige Abdeckung bei gefüllten Kapiteln", () => {
    const chapters = [
      makeChapter({ number: 1, content: "Text A." }),
      makeChapter({ number: 2, content: "Text B." }),
      makeChapter({ number: 3, content: "Text C." }),
    ];
    const result = validateBeatCoverage(chapters, getBeatTemplate("three-act"));
    expect(result.total).toBe(9);
    expect(result.covered).toBe(9);
    expect(result.coverage).toBe(1);
    expect(result.missing).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it("meldet fehlende Beats für leere Kapitel", () => {
    const chapters = [
      makeChapter({ number: 1, content: "" }),
      makeChapter({ number: 2, content: "Text." }),
      makeChapter({ number: 3, content: "Text." }),
    ];
    const result = validateBeatCoverage(chapters, getBeatTemplate("three-act"));
    expect(result.complete).toBe(false);
    expect(result.covered).toBeLessThan(result.total);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.byStatus.pending).toBe(result.missing.length);
  });

  it("zählt den Kapitelstatus 'completed' als abgedeckt", () => {
    const chapters = [makeChapter({ number: 1, content: "", status: "completed" })];
    const result = validateBeatCoverage(chapters, getBeatTemplate("three-act"));
    expect(result.byStatus.completed).toBe(9);
    expect(result.complete).toBe(true);
  });

  it("liefert für ein leeres Buch definierte Nullwerte", () => {
    const result = validateBeatCoverage([], getBeatTemplate("save-the-cat"));
    expect(result.total).toBe(15);
    expect(result.covered).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.missing).toHaveLength(15);
  });

  it("behandelt eine Vorlage ohne Beats ohne Division durch Null", () => {
    const empty: BeatTemplate = {
      type: "three-act",
      name: "Leer",
      description: "keine Beats",
      beats: [],
    };
    const result = validateBeatCoverage([makeChapter()], empty);
    expect(result.total).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.complete).toBe(false);
    expect(Number.isNaN(result.coverage)).toBe(false);
  });

  it("ist deterministisch und mutiert die Eingabe nicht", () => {
    const chapters = [makeChapter({ number: 1, content: "Text." })];
    const snapshot = JSON.stringify(chapters);
    const template = getBeatTemplate("hero-journey");
    const a = validateBeatCoverage(chapters, template);
    const b = validateBeatCoverage(chapters, template);
    expect(a).toEqual(b);
    expect(JSON.stringify(chapters)).toBe(snapshot);
  });
});
