// Tests: Genre-Tropen- & Archetypen-Kompass (WP 53.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  getGenreTropes,
  checkTropeFulfillment,
  calculateSubversionScore,
} from "./genreArchetypeCompass";
import type {
  Genre,
  Manuscript,
  TropeFulfillment,
  Chapter,
} from "./genreArchetypeCompass";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

const ch = (number: number, tropes: string[]): Chapter => ({ number, tropes });

const ms = (chapters: Chapter[]): Manuscript => ({ chapters });

/** Alle Tropen-IDs eines Genres (in Katalogreihenfolge). */
function allTropeIds(genre: Genre): string[] {
  return getGenreTropes(genre).tropes.map((t) => t.id);
}

// ---------------------------------------------------------------------------
// getGenreTropes
// ---------------------------------------------------------------------------

describe("getGenreTropes", () => {
  it("liefert die fünf Whodunit-Tropen mit korrektem coreCount", () => {
    const result = getGenreTropes("whodunit");
    expect(result.genre).toBe("whodunit");
    expect(result.tropes).toHaveLength(5);
    expect(result.coreCount).toBe(4);
    expect(result.tropes.map((t) => t.id)).toEqual([
      "corpse-early",
      "closed-circle",
      "false-alibi",
      "red-herring",
      "finale-reconstruction",
    ]);
  });

  it("liefert die fünf Heist-Tropen mit coreCount 4", () => {
    const result = getGenreTropes("heist");
    expect(result.tropes).toHaveLength(5);
    expect(result.coreCount).toBe(4);
    expect(result.tropes.map((t) => t.id)).toEqual([
      "planning",
      "crew-assembly",
      "the-heist",
      "something-goes-wrong",
      "showdown",
    ]);
  });

  it("liefert die fünf Enemies-to-Lovers-Tropen mit coreCount 4", () => {
    const result = getGenreTropes("enemies-to-lovers");
    expect(result.tropes).toHaveLength(5);
    expect(result.coreCount).toBe(4);
  });

  it("liefert die fünf First-Contact-Tropen mit coreCount 4", () => {
    const result = getGenreTropes("first-contact");
    expect(result.tropes).toHaveLength(5);
    expect(result.coreCount).toBe(4);
    expect(result.tropes.map((t) => t.id)).toContain("first-signal");
    expect(result.tropes.map((t) => t.id)).toContain("peace");
  });

  it("liefert die fünf Coming-of-Age-Tropen, alle als Kern", () => {
    const result = getGenreTropes("coming-of-age");
    expect(result.tropes).toHaveLength(5);
    expect(result.coreCount).toBe(5);
    expect(result.tropes.every((t) => t.isCore)).toBe(true);
  });

  it("jede Trope hat id, name, description und isCore", () => {
    for (const genre of [
      "whodunit",
      "heist",
      "enemies-to-lovers",
      "first-contact",
      "coming-of-age",
    ] as Genre[]) {
      for (const trope of getGenreTropes(genre).tropes) {
        expect(typeof trope.id).toBe("string");
        expect(trope.id.length).toBeGreaterThan(0);
        expect(typeof trope.name).toBe("string");
        expect(trope.name.length).toBeGreaterThan(0);
        expect(typeof trope.description).toBe("string");
        expect(trope.description.length).toBeGreaterThan(0);
        expect(typeof trope.isCore).toBe("boolean");
      }
    }
  });

  it("defensiv: unbekanntes Genre liefert eine leere Checkliste", () => {
    // @ts-expect-error absichtlich ungültiges Genre prüfen
    const result = getGenreTropes("western");
    expect(result.tropes).toEqual([]);
    expect(result.coreCount).toBe(0);
  });

  it("gibt frische Kopien zurück (Mutation isoliert den Katalog)", () => {
    const first = getGenreTropes("heist");
    first.tropes[0].name = "MUTIERT";
    first.tropes.pop();
    const second = getGenreTropes("heist");
    expect(second.tropes).toHaveLength(5);
    expect(second.tropes[0].name).not.toBe("MUTIERT");
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    expect(JSON.stringify(getGenreTropes("first-contact"))).toBe(
      JSON.stringify(getGenreTropes("first-contact")),
    );
  });
});

// ---------------------------------------------------------------------------
// checkTropeFulfillment
// ---------------------------------------------------------------------------

describe("checkTropeFulfillment", () => {
  it("erkennt vollständige Erfüllung (Rate 1, nichts fehlt)", () => {
    const ids = allTropeIds("heist");
    const result = checkTropeFulfillment(
      "heist",
      ms([ch(1, ids.slice(0, 2)), ch(2, ids.slice(2))]),
    );
    expect(result.genre).toBe("heist");
    expect(result.fulfilled).toEqual(ids);
    expect(result.missing).toEqual([]);
    expect(result.fulfillmentRate).toBe(1);
  });

  it("meldet fehlende Tropen in Checklisten-Reihenfolge", () => {
    const result = checkTropeFulfillment(
      "heist",
      ms([ch(1, ["planning"]), ch(2, ["the-heist"])]),
    );
    expect(result.fulfilled).toEqual(["planning", "the-heist"]);
    expect(result.missing).toEqual([
      "crew-assembly",
      "something-goes-wrong",
      "showdown",
    ]);
    expect(result.fulfillmentRate).toBe(0.4);
  });

  it("matcht Tropen auch über den Namen (Groß-/Kleinschreibung egal)", () => {
    const result = checkTropeFulfillment(
      "heist",
      ms([ch(1, ["PLANUNG", "  der Coup "])]),
    );
    expect(result.fulfilled).toContain("planning");
    expect(result.fulfilled).toContain("the-heist");
  });

  it("Whodunit: die frühe Leiche in Kapitel 1–3 zählt", () => {
    const result = checkTropeFulfillment(
      "whodunit",
      ms([ch(1, []), ch(2, ["corpse-early"]), ch(3, [])]),
    );
    expect(result.fulfilled).toContain("corpse-early");
  });

  it("Whodunit: die Leiche außerhalb von Kapitel 1–3 zählt nicht", () => {
    const result = checkTropeFulfillment(
      "whodunit",
      ms([ch(1, []), ch(2, []), ch(3, []), ch(4, []), ch(5, ["corpse-early"])]),
    );
    expect(result.fulfilled).not.toContain("corpse-early");
    expect(result.missing).toContain("corpse-early");
  });

  it("ignoriert unbekannte Trope-IDs", () => {
    const result = checkTropeFulfillment(
      "coming-of-age",
      ms([ch(1, ["trigger", "voellig-erfunden", "trigger"])]),
    );
    expect(result.fulfilled).toEqual(["trigger"]);
    expect(result.fulfilled).toHaveLength(1);
  });

  it("defensiv: undefined Manuskript → alles fehlt, Rate 0", () => {
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    const result = checkTropeFulfillment("heist", undefined);
    expect(result.fulfilled).toEqual([]);
    expect(result.missing).toHaveLength(5);
    expect(result.fulfillmentRate).toBe(0);
  });

  it("defensiv: Kapitel ohne tropes-Array wird übersprungen", () => {
    const result = checkTropeFulfillment("heist", {
      chapters: [
        { number: 1, tropes: ["planning"] },
        // @ts-expect-error absichtlich ungültiges Kapitel prüfen
        { number: 2 },
        // @ts-expect-error absichtlich ungültiges Kapitel prüfen
        null,
      ],
    });
    expect(result.fulfilled).toEqual(["planning"]);
  });

  it("defensiv: fehlende Kapitelnummer nutzt die Array-Position", () => {
    const result = checkTropeFulfillment("whodunit", {
      chapters: [
        // @ts-expect-error absichtlich ungültige Kapitelnummer prüfen
        { tropes: [] },
        // @ts-expect-error absichtlich ungültige Kapitelnummer prüfen
        { tropes: ["corpse-early"] },
      ],
    });
    // Index 1 → Kapitel 2 → innerhalb des Fensters 1–3.
    expect(result.fulfilled).toContain("corpse-early");
  });

  it("defensiv: unbekanntes Genre → leere Listen, Rate 0", () => {
    // @ts-expect-error absichtlich ungültiges Genre prüfen
    const result = checkTropeFulfillment("western", ms([ch(1, ["planning"])]));
    expect(result.fulfilled).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.fulfillmentRate).toBe(0);
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const input = ms([ch(1, ["trigger"]), ch(2, ["mentor", "trial"])]);
    expect(JSON.stringify(checkTropeFulfillment("coming-of-age", input))).toBe(
      JSON.stringify(checkTropeFulfillment("coming-of-age", input)),
    );
  });
});

// ---------------------------------------------------------------------------
// calculateSubversionScore
// ---------------------------------------------------------------------------

describe("calculateSubversionScore", () => {
  const fulfilledOf = (genre: Genre, ids: string[]): TropeFulfillment => ({
    genre,
    fulfilled: ids,
    missing: allTropeIds(genre).filter((id) => !ids.includes(id)),
    fulfillmentRate: ids.length / allTropeIds(genre).length,
  });

  it("alle Tropen erfüllt → Score 0 (vollständig konventionell)", () => {
    const result = calculateSubversionScore(
      fulfilledOf("heist", allTropeIds("heist")),
    );
    expect(result).toBe(0);
  });

  it("keine Trope erfüllt → Score 1 (maximal subversiv)", () => {
    expect(calculateSubversionScore(fulfilledOf("heist", []))).toBe(1);
  });

  it("Kern-Tropen wiegen doppelt (nur optionale Trope erfüllt)", () => {
    // whodunit: 4 Kern (je 2) + 1 optional (1) = Gesamtgewicht 9.
    // Nur red-herring (optional) → 1 - 1/9 = 8/9 ≈ 0.8889.
    const result = calculateSubversionScore(fulfilledOf("whodunit", ["red-herring"]));
    expect(result).toBe(0.8889);
  });

  it("nur eine Kern-Trope erfüllt → geringerer Score als bei optionaler", () => {
    // Nur corpse-early (Kern, Gewicht 2) → 1 - 2/9 = 7/9 ≈ 0.7778.
    const result = calculateSubversionScore(fulfilledOf("whodunit", ["corpse-early"]));
    expect(result).toBe(0.7778);
    expect(result).toBeLessThan(0.8889);
  });

  it("Coming-of-Age: alle fünf Kern-Tropen erfüllt → 0, eine fehlt → 0.2", () => {
    const ids = allTropeIds("coming-of-age");
    expect(calculateSubversionScore(fulfilledOf("coming-of-age", ids))).toBe(0);
    // 5 Kern à 2 = 10; vier erfüllt = 8 → 1 - 8/10 = 0.2.
    expect(calculateSubversionScore(fulfilledOf("coming-of-age", ids.slice(0, 4)))).toBe(
      0.2,
    );
  });

  it("ignoriert unbekannte IDs in `fulfilled`", () => {
    const result = calculateSubversionScore(
      fulfilledOf("heist", ["nicht-existent", "auch-nicht"]),
    );
    expect(result).toBe(1);
  });

  it("defensiv: unbekanntes Genre → Score 0 (keine Erwartung)", () => {
    // @ts-expect-error absichtlich ungültiges Genre prüfen
    expect(calculateSubversionScore(fulfilledOf("western", []))).toBe(0);
  });

  it("defensiv: undefined Eingabe → Score 0", () => {
    // @ts-expect-error absichtlich ungültige Eingabe prüfen
    expect(calculateSubversionScore(undefined)).toBe(0);
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const f = fulfilledOf("first-contact", ["first-signal", "peace"]);
    expect(calculateSubversionScore(f)).toBe(calculateSubversionScore(f));
  });
});
