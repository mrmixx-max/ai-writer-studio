// Tests: Leitmotiv-Network (WP 39.1).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  trackSymbols,
  analyzeMetamorphosis,
  generateResonanceHeatmap,
  SYMBOL_CATEGORIES,
  SYMBOL_CATALOG,
  ACT_COUNT,
} from "./leitmotifNetwork";
import type { SymbolTrack } from "./leitmotifNetwork";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Einen Symbol-Track bauen. */
function track(
  symbol: string,
  category: SymbolTrack["category"],
  occurrences: SymbolTrack["occurrences"],
): SymbolTrack {
  return { symbol, category, occurrences };
}

// ---------------------------------------------------------------------------
// 1) trackSymbols
// ---------------------------------------------------------------------------

describe("trackSymbols", () => {
  it("katalogisiert Gegenstände, Wetterlagen, Farben und Tiere", () => {
    const chapters = [
      "Der Spiegel glänzte. Draußen fiel Regen. Sie trug ein rotes Kleid. Ein Wolf heulte.",
      "Der Spiegel brach. Die Sonne schien.",
      "Regen prasselte. Ein Wolf und noch ein Wolf.",
    ];
    const result = trackSymbols(chapters);

    expect(result.map((t) => t.symbol)).toEqual([
      "spiegel",
      "regen",
      "sonne",
      "rot",
      "wolf",
    ]);

    const byName = new Map(result.map((t) => [t.symbol, t]));
    expect(byName.get("spiegel")?.category).toBe("object");
    expect(byName.get("regen")?.category).toBe("weather");
    expect(byName.get("sonne")?.category).toBe("weather");
    expect(byName.get("rot")?.category).toBe("color");
    expect(byName.get("wolf")?.category).toBe("animal");

    expect(byName.get("spiegel")?.occurrences).toEqual([
      { chapter: 1, count: 1 },
      { chapter: 2, count: 1 },
    ]);
    expect(byName.get("regen")?.occurrences).toEqual([
      { chapter: 1, count: 1 },
      { chapter: 3, count: 1 },
    ]);
    expect(byName.get("wolf")?.occurrences).toEqual([
      { chapter: 1, count: 1 },
      { chapter: 3, count: 2 },
    ]);
  });

  it("zählt mehrfache Vorkommen im selben Kapitel", () => {
    const result = trackSymbols(["Regen, Regen und nochmals Regen."]);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("regen");
    expect(result[0].occurrences).toEqual([{ chapter: 1, count: 3 }]);
  });

  it("wertet Substrings nicht als Symbol (kein Substring-Matching)", () => {
    // „Brot" enthält „rot", darf aber keine Farbe auslösen.
    expect(trackSymbols(["Das Brot lag auf dem Tisch."])).toEqual([]);
  });

  it("ignoriert leere und Nicht-String-Kapitel, hält Kapitelnummern stabil", () => {
    const chapters = ["", "   ", 42, null, "Ein Wolf."] as unknown as string[];
    const result = trackSymbols(chapters);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("wolf");
    // Index 4 ⇒ Kapitel 5 (leere/ungültige Kapitel zählen weiter).
    expect(result[0].occurrences).toEqual([{ chapter: 5, count: 1 }]);
  });

  it("akzeptiert Umlaut- und Schreibvarianten (schluessel / weisse)", () => {
    const result = trackSymbols(["Der Schluessel und das weisse Tuch."]);
    expect(result.map((t) => t.symbol)).toEqual(["schlüssel", "weiß"]);
  });

  it("liefert ein leeres Array bei Nicht-Array-Eingabe", () => {
    expect(trackSymbols(undefined as unknown as string[])).toEqual([]);
    expect(trackSymbols("kein Array" as unknown as string[])).toEqual([]);
    expect(trackSymbols(null as unknown as string[])).toEqual([]);
  });

  it("mutiert die Eingabe nicht", () => {
    const input = ["Ein Wolf jagt einen Wolf.", "Regen."];
    const copy = [...input];
    trackSymbols(input);
    expect(input).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// 2) analyzeMetamorphosis
// ---------------------------------------------------------------------------

describe("analyzeMetamorphosis", () => {
  it("weist Grenzkapitel korrekt den drei Akten zu (maxChapter = 9)", () => {
    // 9 Kapitel → Akt 1 = 1–3, Akt 2 = 4–6, Akt 3 = 7–9.
    const t = track("regen", "weather", [
      { chapter: 3, count: 1 },
      { chapter: 4, count: 1 },
      { chapter: 6, count: 1 },
      { chapter: 9, count: 1 },
    ]);
    const curve = analyzeMetamorphosis(t);

    expect(curve.symbol).toBe("regen");
    expect(curve.acts).toHaveLength(3);
    expect(curve.acts.map((a) => a.act)).toEqual([1, 2, 3]);
    expect(curve.acts.map((a) => a.occurrences)).toEqual([1, 2, 1]);
  });

  it("erkennt evolves=true bei aufsteigender Präsenz", () => {
    const t = track("wolf", "animal", [
      { chapter: 1, count: 1 },
      { chapter: 5, count: 1 },
      { chapter: 9, count: 5 },
    ]);
    const curve = analyzeMetamorphosis(t);

    expect(curve.evolves).toBe(true);
    expect(curve.acts[2].meaning).toContain("dominant");
    expect(curve.acts[2].meaning).toContain("aufsteigend");
  });

  it("erkennt evolves=false bei konstanter Präsenz", () => {
    const t = track("sonne", "weather", [
      { chapter: 1, count: 2 },
      { chapter: 5, count: 2 },
      { chapter: 9, count: 2 },
    ]);
    const curve = analyzeMetamorphosis(t);
    expect(curve.evolves).toBe(false);
  });

  it("evolviert nicht, wenn das Symbol nur in einem Akt auftritt", () => {
    const t = track("ring", "object", [{ chapter: 1, count: 3 }]);
    const curve = analyzeMetamorphosis(t);
    expect(curve.acts.map((a) => a.occurrences)).toEqual([3, 0, 0]);
    expect(curve.evolves).toBe(false);
  });

  it("liefert drei abwesend-Akte bei einem Track ohne Auftritte", () => {
    const curve = analyzeMetamorphosis(track("messer", "object", []));
    expect(curve.acts).toEqual([
      { act: 1, meaning: "abwesend", occurrences: 0 },
      { act: 2, meaning: "abwesend", occurrences: 0 },
      { act: 3, meaning: "abwesend", occurrences: 0 },
    ]);
    expect(curve.evolves).toBe(false);
  });

  it("liefert ein leeres Ergebnis bei ungültigem Track", () => {
    const expected = { symbol: "", acts: [], evolves: false };
    expect(analyzeMetamorphosis(null as unknown as SymbolTrack)).toEqual(expected);
    expect(analyzeMetamorphosis(undefined as unknown as SymbolTrack)).toEqual(expected);
    expect(analyzeMetamorphosis({} as unknown as SymbolTrack)).toEqual(expected);
    expect(analyzeMetamorphosis({ symbol: "   " } as unknown as SymbolTrack)).toEqual(expected);
  });

  it("wirft nicht bei null/undefined", () => {
    expect(() => analyzeMetamorphosis(null as unknown as SymbolTrack)).not.toThrow();
    expect(() => analyzeMetamorphosis(undefined as unknown as SymbolTrack)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3) generateResonanceHeatmap
// ---------------------------------------------------------------------------

describe("generateResonanceHeatmap", () => {
  it("baut die Matrix alphabetisch und zählt Auftritte", () => {
    const tracks = [
      track("wolf", "animal", [
        { chapter: 1, count: 1 },
        { chapter: 3, count: 2 },
      ]),
      track("regen", "weather", [{ chapter: 2, count: 1 }]),
    ];
    const heatmap = generateResonanceHeatmap(tracks);

    expect(heatmap.symbols).toEqual(["regen", "wolf"]);
    expect(heatmap.chapters).toBe(3);
    expect(heatmap.matrix).toEqual([
      [0, 1, 0],
      [1, 0, 2],
    ]);
    // wolf tritt in Kap. 1 und 3 auf → Lücke in Kap. 2.
    expect(heatmap.gaps).toEqual(["wolf"]);
  });

  it("meldet Lücken zwischen erstem und letztem Auftreten", () => {
    const heatmap = generateResonanceHeatmap([
      track("wolf", "animal", [
        { chapter: 1, count: 1 },
        { chapter: 3, count: 1 },
        { chapter: 5, count: 1 },
      ]),
    ]);
    expect(heatmap.chapters).toBe(5);
    expect(heatmap.matrix).toEqual([[1, 0, 1, 0, 1]]);
    expect(heatmap.gaps).toEqual(["wolf"]);
  });

  it("meldet keine Lücke bei durchgehender Präsenz", () => {
    const heatmap = generateResonanceHeatmap([
      track("regen", "weather", [
        { chapter: 1, count: 1 },
        { chapter: 2, count: 1 },
        { chapter: 3, count: 1 },
      ]),
    ]);
    expect(heatmap.gaps).toEqual([]);
  });

  it("erzeugt keine Lücke für ein Symbol mit nur einem Auftritt", () => {
    const heatmap = generateResonanceHeatmap([
      track("schnee", "weather", [{ chapter: 4, count: 1 }]),
    ]);
    expect(heatmap.chapters).toBe(4);
    expect(heatmap.matrix).toEqual([[0, 0, 0, 1]]);
    expect(heatmap.gaps).toEqual([]);
  });

  it("führt doppelte Symbol-Tracks zusammen (Summe je Kapitel)", () => {
    const heatmap = generateResonanceHeatmap([
      track("wolf", "animal", [
        { chapter: 1, count: 1 },
        { chapter: 3, count: 1 },
      ]),
      track("wolf", "animal", [
        { chapter: 1, count: 2 },
        { chapter: 2, count: 1 },
      ]),
    ]);
    expect(heatmap.symbols).toEqual(["wolf"]);
    expect(heatmap.chapters).toBe(3);
    expect(heatmap.matrix).toEqual([[3, 1, 1]]);
    expect(heatmap.gaps).toEqual([]);
  });

  it("liefert eine leere Heatmap bei fehlenden Tracks", () => {
    const empty = { symbols: [], chapters: 0, matrix: [], gaps: [] };
    expect(generateResonanceHeatmap([])).toEqual(empty);
    expect(generateResonanceHeatmap(undefined as unknown as SymbolTrack[])).toEqual(empty);
    expect(generateResonanceHeatmap([track("wolf", "animal", [])])).toEqual(empty);
  });

  it("ignoriert ungültige Track-Einträge defensiv", () => {
    const tracks = [
      null,
      { symbol: "" },
      track("wolf", "animal", [{ chapter: 0, count: 1 }]),
      track("wolf", "animal", [{ chapter: 2, count: "3" as unknown as number }]),
    ] as unknown as SymbolTrack[];
    const heatmap = generateResonanceHeatmap(tracks);
    expect(heatmap.symbols).toEqual(["wolf"]);
    expect(heatmap.chapters).toBe(2);
    expect(heatmap.matrix).toEqual([[0, 3]]);
  });

  it("wirft nicht bei null/undefined", () => {
    expect(() =>
      generateResonanceHeatmap(null as unknown as SymbolTrack[]),
    ).not.toThrow();
    expect(() =>
      generateResonanceHeatmap(undefined as unknown as SymbolTrack[]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Vertrag / Konstanten
// ---------------------------------------------------------------------------

describe("Vertrag", () => {
  it("führt genau die vier Symbol-Kategorien", () => {
    expect(SYMBOL_CATEGORIES).toEqual(["object", "weather", "color", "animal"]);
  });

  it("setzt die Aktanzahl auf 3", () => {
    expect(ACT_COUNT).toBe(3);
  });

  it("hält den Katalog konsistent (lowercase, eindeutig, alle Kategorien)", () => {
    const seen = new Set<string>();
    const categories = new Set<string>();
    for (const def of SYMBOL_CATALOG) {
      expect(def.symbol).toBe(def.symbol.toLowerCase());
      expect(def.symbol.length).toBeGreaterThan(0);
      expect(seen.has(def.symbol)).toBe(false);
      seen.add(def.symbol);
      categories.add(def.category);
      expect(def.keywords.length).toBeGreaterThan(0);
      for (const keyword of def.keywords) {
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
    expect([...categories].sort()).toEqual(["animal", "color", "object", "weather"]);
  });
});
