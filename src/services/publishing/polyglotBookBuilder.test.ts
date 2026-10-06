/**
 * Tests: PolyglotBookBuilder (WP 84.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createEmptyBilingualBook,
  addParagraphPair,
  formatBilingualBook,
  checkBaselineAlignment,
  calculateOpticalCompensation,
  createSampleBilingualBook,
} from "./polyglotBookBuilder";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("createEmptyBilingualBook", () => {
  it("erstellt leeres Buch", () => {
    const book = createEmptyBilingualBook("Test", "de-en");
    expect(book.title).toBe("Test");
    expect(book.pairs).toEqual([]);
  });
});

describe("addParagraphPair", () => {
  it("fügt Paar hinzu", () => {
    let book = createEmptyBilingualBook("Test", "de-en");
    book = addParagraphPair(book, "Hallo", "Hello");
    expect(book.pairs).toHaveLength(1);
  });
});

describe("checkBaselineAlignment", () => {
  it("prüft Ausrichtung", () => {
    let book = createEmptyBilingualBook("Test", "de-en");
    book = addParagraphPair(book, "Hallo", "Hello");
    expect(checkBaselineAlignment(book)).toBe(true);
  });
});

describe("calculateOpticalCompensation", () => {
  it("berechnet Ausgleich", () => {
    const comp = calculateOpticalCompensation("Kurzer Text", "Ein viel längerer Text für die Übersetzung", 12);
    expect(comp).toBeGreaterThanOrEqual(0);
  });
});

describe("formatBilingualBook", () => {
  it("formatiert Buch als Text", () => {
    const book = createSampleBilingualBook();
    const text = formatBilingualBook(book);
    expect(text).toContain("ZWEISPRACHIGES BUCH");
  });
});

describe("createSampleBilingualBook", () => {
  it("erstellt Beispiel-Buch", () => {
    const book = createSampleBilingualBook();
    expect(book.title).toBeTruthy();
    expect(book.pairs.length).toBeGreaterThan(0);
  });
});