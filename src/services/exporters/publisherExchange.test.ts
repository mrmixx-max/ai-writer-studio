import { describe, it, expect } from "vitest";
import {
  exportToIcml,
  exportToDocxWithTrackChanges,
  exportToFountain,
} from "./publisherExchange";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function makeChapter(overrides: Partial<BookChapterInput> = {}): BookChapterInput {
  return {
    number: 1,
    title: "Testkapitel",
    content: "Dies ist ein Testabsatz mit Inhalt.",
    status: "final",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ICML-Tests
// ---------------------------------------------------------------------------

describe("exportToIcml", () => {
  it("sollte valides XML mit DOCTYPE und Article-Root erzeugen", () => {
    const result = exportToIcml([makeChapter()]);
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<!DOCTYPE Article SYSTEM "http://ns.adobe.com/ICML/1.0/">');
    expect(result).toContain("<Article>");
    expect(result).toContain("</Article>");
  });

  it("sollte Kapitelüberschrift mit ParagraphStyleRange enthalten", () => {
    const result = exportToIcml([makeChapter({ title: "Probelauf" })]);
    expect(result).toContain("ParagraphStyleRange");
    expect(result).toContain("Kapitel 1: Probelauf");
  });

  it("sollte Kapitelinhalt als CharacterStyleRange mit Content enthalten", () => {
    const result = exportToIcml([makeChapter({ content: "Hallo Welt" })]);
    expect(result).toContain("CharacterStyleRange");
    expect(result).toContain("<Content>");
  });

  it("sollte mehrere Kapitel korrekt nummerieren", () => {
    const chapters = [
      makeChapter({ number: 1, title: "Erstes" }),
      makeChapter({ number: 2, title: "Zweites" }),
    ];
    const result = exportToIcml(chapters);
    expect(result).toContain("Kapitel 1: Erstes");
    expect(result).toContain("Kapitel 2: Zweites");
  });

  it("sollte leeres Array zu leerem Article zurückgeben", () => {
    const result = exportToIcml([]);
    expect(result).toContain("<Article>");
    expect(result).toContain("</Article>");
    expect(result).not.toContain("ParagraphStyleRange");
  });

  it("sollte defensiv auf fehlenden Status reagieren", () => {
    const chapter = makeChapter();
    delete chapter.status;
    const result = exportToIcml([chapter]);
    expect(result).toContain("Kapitel 1: Testkapitel");
  });
});

// ---------------------------------------------------------------------------
// DOCX mit Track-Changes Tests
// ---------------------------------------------------------------------------

describe("exportToDocxWithTrackChanges", () => {
  it("sollte ein Blob mit DOCX-MIME-Typ zurückgeben", async () => {
    const result = await exportToDocxWithTrackChanges([makeChapter()]);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toContain("wordprocessingml");
  });

  it("sollte w:ins-Elemente für needs_revision-Kapitel enthalten", async () => {
    const chapters = [
      makeChapter({ number: 1, status: "final" }),
      makeChapter({ number: 2, status: "needs_revision" }),
    ];
    const result = await exportToDocxWithTrackChanges(chapters);
    const text = await result.text();
    expect(text).toContain("<w:ins");
    expect(text).toContain('w:author="AI Writer Studio"');
  });

  it("sollte w:trackChanges in settings.xml enthalten", async () => {
    const result = await exportToDocxWithTrackChanges([makeChapter()]);
    const text = await result.text();
    expect(text).toContain("<w:trackChanges/>");
  });

  it("sollte defensiv auf leeres Array reagieren", async () => {
    const result = await exportToDocxWithTrackChanges([]);
    expect(result).toBeInstanceOf(Blob);
    const text = await result.text();
    expect(text).toContain("<w:document");
  });
});

// ---------------------------------------------------------------------------
// Fountain-Tests
// ---------------------------------------------------------------------------

describe("exportToFountain", () => {
  it("sollte Titelblatt mit Title und Author enthalten", () => {
    const result = exportToFountain([makeChapter({ title: "Mein Buch" })]);
    expect(result).toContain("Title: Mein Buch");
    expect(result).toContain("Author:");
  });

  it("sollte Kapitel als Section-Überschriften mit # enthalten", () => {
    const result = exportToFountain([makeChapter({ title: "Anfang" })]);
    expect(result).toContain("# Kapitel 1: Anfang");
  });

  it("sollte Kapitelinhalt als Action-Lines enthalten", () => {
    const result = exportToFountain([makeChapter({ content: "Der Himmel ist blau." })]);
    expect(result).toContain("# Kapitel 1:");
  });

  it("sollte leeres Array zu minimalem Fountain zurückgeben", () => {
    const result = exportToFountain([]);
    expect(result).toContain("Title:");
    expect(result).toContain("Author:");
  });

  it("sollte defensiv auf fehlenden Status reagieren", () => {
    const chapter = makeChapter();
    delete chapter.status;
    const result = exportToFountain([chapter]);
    expect(result).toContain("Kapitel 1: Testkapitel");
  });
});
