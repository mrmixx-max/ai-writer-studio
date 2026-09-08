// Tests für die AdvancedExport Engine (Sprint 23, Agent 6).
import { describe, it, expect } from "vitest";
import {
  generateTOC,
  generateTitlePage,
  generateDedicationPage,
  generateAboutAuthorPage,
  generateColophonPage,
  estimatePageCount,
  buildBookMarkdown,
  generateBook,
  defaultSections,
  defaultBookConfig,
  type BookConfig,
} from "./advancedExport";

function cfg(): BookConfig {
  return {
    ...defaultBookConfig(),
    title: "Mein Roman",
    subtitle: "Eine Geschichte",
    author: "Max Autor",
    isbn: "978-3-123456-78-9",
    dedication: "Für alle Leser.",
    acknowledgments: "Danke an alle.",
    aboutAuthor: "Max schreibt Bücher.",
    sections: [
      { type: "title-page", title: "Titelseite", content: "", pageBreak: true },
      { type: "dedication", title: "Widmung", content: "", pageBreak: true },
      { type: "toc", title: "Inhaltsverzeichnis", content: "", pageBreak: true },
      { type: "chapter", title: "Anfang", content: "Es war einmal.", pageBreak: true },
      { type: "appendix", title: "Anhang", content: "Zusatzinfos.", pageBreak: false },
    ],
  };
}

describe("generateTOC", () => {
  it("erzeugt korrektes Inhaltsverzeichnis mit Seitenzahlen", () => {
    const toc = generateTOC([
      { title: "Anfang", pageNumber: 5 },
      { title: "Mitte", pageNumber: 12 },
    ]);
    expect(toc).toContain("# Inhaltsverzeichnis");
    expect(toc).toContain("Anfang");
    expect(toc).toContain("5");
    expect(toc).toContain("Mitte");
    expect(toc).toContain("12");
  });

  it("behandelt leere Kapitel-Liste", () => {
    expect(generateTOC([])).toContain("Keine Kapitel");
  });
});

describe("generateTitlePage", () => {
  it("enthält Titel + Autor (+ Untertitel + ISBN)", () => {
    const page = generateTitlePage(cfg());
    expect(page).toContain("Mein Roman");
    expect(page).toContain("Max Autor");
    expect(page).toContain("Eine Geschichte");
    expect(page).toContain("978-3-123456-78-9");
  });
});

describe("generateDedicationPage / AboutAuthor / Colophon", () => {
  it("Widmungsseite enthält Text", () => {
    expect(generateDedicationPage("Für Mama.")).toContain("Für Mama.");
  });

  it("Über-den-Autor enthält Text", () => {
    expect(generateAboutAuthorPage("Max schreibt.")).toContain("Max schreibt.");
  });

  it("Kolofon enthält Titel, Autor und ISBN", () => {
    const c = generateColophonPage(cfg());
    expect(c).toContain("Mein Roman");
    expect(c).toContain("Max Autor");
    expect(c).toContain("978-3-123456-78-9");
  });
});

describe("estimatePageCount", () => {
  it("berechnet korrekt (Textseiten + Umbruch-Seiten)", () => {
    const c = cfg();
    const words =
      "Mein Roman Eine Geschichte Max Autor Für alle Leser. Danke an alle. Max schreibt Bücher.".split(
        /\s+/
      ).length +
      "Titelseite Anfang Es war einmal. Anhang Zusatzinfos. Inhaltsverzeichnis Widmung".split(
        /\s+/
      ).length;
    const expected = Math.max(1, Math.ceil(words / 300)) + 4; // 4 pageBreaks
    expect(estimatePageCount(c)).toBe(expected);
  });

  it("wächst mit mehr Inhalt", () => {
    const a = cfg();
    const b = cfg();
    b.sections = [
      ...b.sections,
      { type: "chapter", title: "Lang", content: "Wort ".repeat(3000), pageBreak: true },
    ];
    expect(estimatePageCount(b)).toBeGreaterThan(estimatePageCount(a));
  });
});

describe("buildBookMarkdown / generateBook", () => {
  it("enthält alle Sektionen in Reihenfolge", () => {
    const md = buildBookMarkdown(cfg());
    const idxTitle = md.indexOf("Mein Roman");
    const idxToc = md.indexOf("Inhaltsverzeichnis");
    const idxCh = md.indexOf("Anfang");
    const idxApp = md.indexOf("Anhang");
    expect(idxTitle).toBeGreaterThanOrEqual(0);
    expect(idxTitle).toBeLessThan(idxToc);
    expect(idxToc).toBeLessThan(idxCh);
    expect(idxCh).toBeLessThan(idxApp);
  });

  it("lässt TOC weg wenn includeTOC=false", () => {
    const c = cfg();
    c.includeTOC = false;
    expect(buildBookMarkdown(c)).not.toContain("# Inhaltsverzeichnis");
  });

  it("generateBook liefert Blob mit Format-MIME", async () => {
    const blob = await generateBook(cfg());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain("application/pdf");
    const text = await blob.text();
    expect(text).toContain("Mein Roman");
  });

  it("defaultSections liefert 8 Sektionen inkl. TOC + Appendix", () => {
    const s = defaultSections();
    expect(s.length).toBe(8);
    expect(s.map((x) => x.type)).toContain("toc");
    expect(s.map((x) => x.type)).toContain("appendix");
    expect(s.map((x) => x.type)).toContain("dedication");
  });
});
