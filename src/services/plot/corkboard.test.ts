// Tests für den Korkwand-Service (WP 5.1).
//
// Kernaussage: Reordering ist rein (keine Mutation), defensiv bei
// ungültigen Indizen und das Grid-Layout ist korrekt.

import { describe, it, expect } from "vitest";
import {
  reorderChapters,
  getCorkboardLayout,
  validateCorkboardMove,
  type BookChapterIndex,
} from "./corkboard";

function makeChapter(id: string, sortOrder: number): BookChapterIndex {
  return {
    id,
    title: `Kapitel ${id}`,
    logline: `Logline ${id}`,
    povCharacter: "Anna",
    location: "Berlin",
    status: "draft",
    sortOrder,
  };
}

describe("reorderChapters", () => {
  it("verschiebt ein Kapitel korrekt", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1), makeChapter("c", 2)];
    const result = reorderChapters(chapters, 0, 2);
    expect(result.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("aktualisiert sortOrder nach dem Verschieben", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1), makeChapter("c", 2)];
    const result = reorderChapters(chapters, 0, 2);
    expect(result[0].sortOrder).toBe(0);
    expect(result[1].sortOrder).toBe(1);
    expect(result[2].sortOrder).toBe(2);
  });

  it("mutiert die Eingabe nicht", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1)];
    const original = [...chapters];
    reorderChapters(chapters, 0, 1);
    expect(chapters).toEqual(original);
  });

  it("gibt Kopie zurück bei gleicher Position", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1)];
    const result = reorderChapters(chapters, 0, 0);
    expect(result).not.toBe(chapters);
    expect(result).toEqual(chapters);
  });

  it("gibt Kopie zurück bei ungültigem fromIndex", () => {
    const chapters = [makeChapter("a", 0)];
    const result = reorderChapters(chapters, -1, 0);
    expect(result).toEqual(chapters);
  });

  it("gibt Kopie zurück bei ungültigem toIndex", () => {
    const chapters = [makeChapter("a", 0)];
    const result = reorderChapters(chapters, 0, 5);
    expect(result).toEqual(chapters);
  });

  it("gibt leeres Array zurück bei leerer Liste", () => {
    expect(reorderChapters([], 0, 0)).toEqual([]);
  });
});

describe("getCorkboardLayout", () => {
  it("berechnet Grid-Layout korrekt", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1), makeChapter("c", 2)];
    const layout = getCorkboardLayout(chapters, 2);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.positions).toHaveLength(3);
  });

  it("verwendet 3 Spalten als Default", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1)];
    const layout = getCorkboardLayout(chapters);
    expect(layout.columns).toBe(3);
  });

  it("gibt leeres Layout für leere Liste zurück", () => {
    const layout = getCorkboardLayout([]);
    expect(layout.positions).toEqual([]);
    expect(layout.rows).toBe(0);
  });

  it("berechnet Positionen korrekt", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1), makeChapter("c", 2)];
    const layout = getCorkboardLayout(chapters, 2);
    expect(layout.positions[0]).toEqual({ id: "a", row: 0, col: 0, x: 20, y: 20 });
    expect(layout.positions[1]).toEqual({ id: "b", row: 0, col: 1, x: 240, y: 20 });
    expect(layout.positions[2]).toEqual({ id: "c", row: 1, col: 0, x: 20, y: 180 });
  });
});

describe("validateCorkboardMove", () => {
  it("validiert gültige Züge", () => {
    const chapters = [makeChapter("a", 0), makeChapter("b", 1)];
    expect(validateCorkboardMove(chapters, 0, 1)).toBe(true);
  });

  it("lehnt ungültige Indizen ab", () => {
    const chapters = [makeChapter("a", 0)];
    expect(validateCorkboardMove(chapters, -1, 0)).toBe(false);
    expect(validateCorkboardMove(chapters, 0, 5)).toBe(false);
  });

  it("lehnt gleiche Position ab", () => {
    const chapters = [makeChapter("a", 0)];
    expect(validateCorkboardMove(chapters, 0, 0)).toBe(false);
  });

  it("lehnt leere Liste ab", () => {
    expect(validateCorkboardMove([], 0, 0)).toBe(false);
  });
});
