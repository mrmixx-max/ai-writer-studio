// @vitest-environment jsdom
// Tests für das Vorlagen-System: Registrierung, Bundle-Bau, Import-Validierung.
import { describe, it, expect } from "vitest";
import {
  bookTemplates,
  characterTemplates,
  plotTemplates,
  buildBundle,
  parseBundle,
} from "./index";

describe("Vorlagen-Registrierung", () => {
  it("enthält die vier Buch-Vorlagen mit nicht-leeren Kapiteln", () => {
    expect(bookTemplates.map((t) => t.id)).toEqual([
      "book-roman",
      "book-sachbuch",
      "book-drehbuch",
      "book-essay",
    ]);
    for (const t of bookTemplates) {
      expect(t.chapters.length).toBeGreaterThan(0);
      for (const ch of t.chapters) {
        expect(ch.title).toBeTruthy();
        expect(ch.description).toBeTruthy();
      }
    }
  });

  it("enthält die vier Figuren-Archetypen", () => {
    expect(characterTemplates.map((t) => t.archetype)).toEqual([
      "Held",
      "Mentor",
      "Antagonist",
      "Liebe",
    ]);
  });

  it("enthält die drei Plot-Vorlagen", () => {
    expect(plotTemplates.map((t) => t.name)).toEqual([
      "Heldenreise",
      "Drei-Akt-Struktur",
      "In Media Res",
    ]);
    for (const p of plotTemplates) {
      expect(p.beats.length).toBeGreaterThan(0);
    }
  });
});

describe("Import/Export", () => {
  it("baut ein Paket aus einer Auswahl", () => {
    const b = buildBundle({
      bookId: "book-roman",
      characterIds: ["char-held", "char-mentor"],
      plotId: "plot-heldenreise",
    });
    expect(b).not.toBeNull();
    expect(b!.format).toBe("ai-writer-studio/templates");
    expect(b!.book?.id).toBe("book-roman");
    expect(b!.characters).toHaveLength(2);
    expect(b!.plot?.id).toBe("plot-heldenreise");
  });

  it("gibt null zurück, wenn nichts ausgewählt ist", () => {
    expect(buildBundle({})).toBeNull();
  });

  it("Export → Import liefert dieselben Vorlagen zurück", () => {
    const b = buildBundle({ bookId: "book-essay", plotId: "plot-drei-akt" })!;
    const parsed = parseBundle(JSON.stringify(b));
    expect(parsed.book?.id).toBe("book-essay");
    expect(parsed.plot?.id).toBe("plot-drei-akt");
  });

  it("lehnt ungültiges JSON ab", () => {
    expect(() => parseBundle("kein json")).toThrow(/gültiges JSON/);
  });

  it("lehnt falsches Format-Tag ab", () => {
    expect(() =>
      parseBundle(JSON.stringify({ format: "other", version: 1 })),
    ).toThrow(/Unbekanntes Format/);
  });

  it("lehnt ein leeres Paket ab", () => {
    expect(() =>
      parseBundle(JSON.stringify({ format: "ai-writer-studio/templates", version: 1 })),
    ).toThrow(/keine verwendbaren Vorlagen/);
  });
});
