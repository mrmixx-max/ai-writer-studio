/**
 * Tests: loreMythGenerator (WP 57.2 — Mythen, Prophezeiungen & Balladen)
 */

import { describe, it, expect } from "vitest";
import {
  generateLore,
  analyzeMeter,
  toEpigraph,
  KIND_LABELS,
  type LoreKind,
} from "./loreMythGenerator";

describe("loreMythGenerator — generateLore", () => {
  it("erzeugt ein Folklore-Stück", () => {
    const r = generateLore({ kind: "oracle" });
    expect(r.text.length).toBeGreaterThan(30);
    expect(r.kind).toBe("oracle");
  });

  it("erzeugt einen Titel", () => {
    const r = generateLore({ kind: "oracle" });
    expect(r.title.length).toBeGreaterThan(5);
  });

  it("bindet das Thema in den Titel ein", () => {
    const r = generateLore({ kind: "tavern-song", subject: "alten Recken" });
    expect(r.title).toContain("alten Recken");
  });

  it("erzeugt die gewünschte Strophenzahl", () => {
    const r = generateLore({ stanzas: 5 });
    expect(r.stanzas.length).toBe(5);
    expect(r.lineCount).toBe(20);
  });

  it("hat vier Verse je Strophe", () => {
    const r = generateLore({ stanzas: 2 });
    r.stanzas.forEach((s) => expect(s.lines.length).toBe(4));
  });

  it("nummeriert die Strophen", () => {
    const r = generateLore({ stanzas: 3 });
    expect(r.stanzas.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it("ist deterministisch", () => {
    const a = generateLore({ kind: "oracle", subject: "dem Reich", stanzas: 3 });
    const b = generateLore({ kind: "oracle", subject: "dem Reich", stanzas: 3 });
    expect(a.text).toBe(b.text);
    expect(a.title).toBe(b.title);
  });

  it("unterstützt alle vier Textsorten", () => {
    const kinds: LoreKind[] = ["oracle", "tavern-song", "creation-myth", "battle-chronicle"];
    kinds.forEach((k) => {
      const r = generateLore({ kind: k });
      expect(r.kind).toBe(k);
      expect(r.text.length).toBeGreaterThan(20);
    });
  });

  it("unterschiedliche Textsorten erzeugen unterschiedlichen Text", () => {
    const oracle = generateLore({ kind: "oracle" });
    const tavern = generateLore({ kind: "tavern-song" });
    expect(oracle.text).not.toBe(tavern.text);
  });

  it("nutzt Standard-Metrum je Textsorte", () => {
    expect(generateLore({ kind: "oracle" }).meter).toBe("trochee");
    expect(generateLore({ kind: "tavern-song" }).meter).toBe("iambus");
    expect(generateLore({ kind: "creation-myth" }).meter).toBe("alliterative");
  });

  it("nutzt Standard-Reimschema je Textsorte", () => {
    expect(generateLore({ kind: "oracle" }).rhymeScheme).toBe("ABAB");
    expect(generateLore({ kind: "tavern-song" }).rhymeScheme).toBe("AABB");
    expect(generateLore({ kind: "creation-myth" }).rhymeScheme).toBe("none");
  });

  it("erlaubt Überschreiben von Metrum und Reim", () => {
    const r = generateLore({ kind: "oracle", meter: "iambus", rhymeScheme: "AABB" });
    expect(r.meter).toBe("iambus");
    expect(r.rhymeScheme).toBe("AABB");
  });

  it("begrenzt die Strophenzahl auf 1–8", () => {
    expect(generateLore({ stanzas: 0 }).stanzas.length).toBe(1);
    expect(generateLore({ stanzas: 99 }).stanzas.length).toBe(8);
  });

  it("trennt Strophen mit Leerzeile", () => {
    const r = generateLore({ stanzas: 3 });
    expect(r.text.split("\n\n").length).toBe(3);
  });

  it("berechnet die Wortzahl", () => {
    const r = generateLore({ stanzas: 2 });
    expect(r.wordCount).toBeGreaterThan(20);
  });

  it("fällt bei unbekannter Textsorte auf oracle zurück", () => {
    expect(generateLore({ kind: "unbekannt" as never }).kind).toBe("oracle");
  });

  it("kommt ohne Optionen zurecht", () => {
    const r = generateLore();
    expect(r.kind).toBe("oracle");
    expect(r.stanzas.length).toBe(3);
  });

  it("kommt mit null zurecht", () => {
    expect(generateLore(null).text.length).toBeGreaterThan(20);
    expect(generateLore(undefined).lineCount).toBe(12);
  });

  it("mutiert die Optionen nicht", () => {
    const opts = { kind: "oracle" as LoreKind, subject: "X", stanzas: 2 };
    const copy = { ...opts };
    generateLore(opts);
    expect(opts).toEqual(copy);
  });

  it("exportiert die Textsorten-Labels", () => {
    expect(KIND_LABELS.oracle).toBe("Ominöser Orakelspruch");
    expect(KIND_LABELS["tavern-song"]).toBe("Tavernenlied");
  });
});

describe("loreMythGenerator — analyzeMeter", () => {
  it("zählt die Verse", () => {
    const r = analyzeMeter("Erste Zeile hier\nZweite Zeile dort\nDritte Zeile nun");
    expect(r.lineCount).toBe(3);
  });

  it("berechnet die mittlere Silbenzahl", () => {
    const r = analyzeMeter("Der Rabe fliegt\nDie Sonne sinkt");
    expect(r.avgSyllables).toBeGreaterThan(0);
  });

  it("erkennt ein Metrum", () => {
    const r = analyzeMeter(
      "Wenn der Rabe schweigt und der Fluss sich dreht\nWird das Kind aus Eisen seinen Vater sehn",
    );
    expect(r.detectedMeter).not.toBeNull();
  });

  it("erkennt Stabreim", () => {
    const r = analyzeMeter(
      "Berge brachen braun\nBerge brachen bald\nBerge bissen beide\nBerge blieben blank",
    );
    expect(r.detectedMeter).toBe("alliterative");
  });

  it("berechnet die Reimquote", () => {
    const r = analyzeMeter("Der Held so alt\nDie Nacht so kalt\nDas Schwert so schwer\nUnd niemand mehr");
    expect(r.rhymeRatio).toBeGreaterThan(0);
  });

  it("erkennt ein Reimschema", () => {
    const r = analyzeMeter("Der Held so alt\nDie Nacht so kalt");
    expect(r.detectedRhyme).toBe("AABB");
  });

  it("meldet none bei ungereimtem Text", () => {
    const r = analyzeMeter("Ganz anderer Anfang\nVöllig verschieden Ende");
    expect(r.detectedRhyme).toBe("none");
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzeMeter("");
    expect(r.lineCount).toBe(0);
    expect(r.detectedMeter).toBeNull();
    expect(analyzeMeter(null).rhymeRatio).toBe(0);
    expect(analyzeMeter(undefined).avgSyllables).toBe(0);
  });

  it("analysiert den eigenen Output", () => {
    const piece = generateLore({ kind: "oracle", stanzas: 2 });
    const r = analyzeMeter(piece.text);
    expect(r.lineCount).toBe(8);
    expect(r.avgSyllables).toBeGreaterThan(0);
  });
});

describe("loreMythGenerator — toEpigraph", () => {
  it("wandelt ein Stück in ein Epigraph um", () => {
    const piece = generateLore({ kind: "oracle" });
    const ep = toEpigraph(piece);
    expect(ep).not.toBeNull();
    expect(ep?.text).toBe(piece.text);
  });

  it("markiert In-Universe-Texte als fiktiv", () => {
    const piece = generateLore({ kind: "creation-myth" });
    const ep = toEpigraph(piece);
    expect(ep?.kind).toBe("fictional");
  });

  it("übernimmt den Titel als Quelle", () => {
    const piece = generateLore({ kind: "tavern-song" });
    const ep = toEpigraph(piece);
    expect(ep?.source).toBe(piece.title);
  });

  it("setzt einen Standard-Autor", () => {
    const piece = generateLore({ kind: "oracle" });
    const ep = toEpigraph(piece);
    expect(ep?.author).toContain("Orakelspruch");
  });

  it("übernimmt einen eigenen Autor", () => {
    const piece = generateLore({ kind: "oracle" });
    const ep = toEpigraph(piece, { author: "Die Seherin von Arden" });
    expect(ep?.author).toBe("Die Seherin von Arden");
  });

  it("übernimmt die Kapitelnummer", () => {
    const piece = generateLore({ kind: "oracle" });
    const ep = toEpigraph(piece, { chapter: 7 });
    expect(ep?.chapter).toBe(7);
  });

  it("setzt das Fleuron-Flag", () => {
    const piece = generateLore({ kind: "oracle" });
    expect(toEpigraph(piece, { fleuron: true })?.fleuron).toBe(true);
    expect(toEpigraph(piece)?.fleuron).toBe(false);
  });

  it("vergibt eine stabile ID", () => {
    const piece = generateLore({ kind: "oracle", subject: "dem Reich" });
    const a = toEpigraph(piece);
    const b = toEpigraph(piece);
    expect(a?.id).toBe(b?.id);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(toEpigraph(null)).toBeNull();
    expect(toEpigraph(undefined)).toBeNull();
    expect(toEpigraph({} as never)).toBeNull();
  });
});
