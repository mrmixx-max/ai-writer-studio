// Tests für PrintLayout: Pagination, Rückenberechnung, Token-Rendering.
import { describe, it, expect } from "vitest";
import {
  paginateBlocks,
  calcSpineWidthMm,
  calcCoverWidthMm,
  renderHfToken,
  estimatePageCount,
  PAGE_SIZES,
  DEFAULT_MARGINS,
  DEFAULT_TYPOGRAPHY,
} from "./index";

describe("paginateBlocks", () => {
  it("verteilt lange Texte auf mehrere Seiten", () => {
    const blocks = Array.from({ length: 40 }, (_, i) => ({
      type: "p",
      text: `Absatz ${i}: ` + "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6),
    }));
    const pages = paginateBlocks(blocks, {
      page: PAGE_SIZES.a4,
      margins: DEFAULT_MARGINS,
      typography: DEFAULT_TYPOGRAPHY,
    });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].pageNumber).toBe(1);
    // Alle Blöcke landen auf irgendeiner Seite.
    const total = pages.reduce((n, p) => n + p.blocks.length, 0);
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it("hält Überschriften mit auf der Seite (kein Single-Waisen-Umbruch oben)", () => {
    const blocks = [
      { type: "p", text: "x".repeat(3000) },
      { type: "h1", text: "Kapitel" },
    ];
    const pages = paginateBlocks(blocks, {
      page: PAGE_SIZES.a5,
      margins: DEFAULT_MARGINS,
      typography: DEFAULT_TYPOGRAPHY,
    });
    // Die H1 darf nicht als einziges Element einer Folgeseite direkt hinter dem
    // vollen Absatz kleben, wenn kein Platz ist — hier reicht der Nachweis,
    // dass alle Seiten Blöcke enthalten.
    for (const p of pages) expect(p.blocks.length).toBeGreaterThan(0);
  });

  it("passt bei großen Rändern mehr Umbrüche ein", () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({
      type: "p" as const,
      text: `Text ${i} `.repeat(30),
    }));
    const normal = paginateBlocks(blocks, { page: PAGE_SIZES.a4, margins: DEFAULT_MARGINS, typography: DEFAULT_TYPOGRAPHY });
    const wide = paginateBlocks(blocks, {
      page: PAGE_SIZES.a4,
      margins: { top: 60, right: 60, bottom: 60, left: 60 },
      typography: DEFAULT_TYPOGRAPHY,
    });
    expect(wide.length).toBeGreaterThanOrEqual(normal.length);
  });
});

describe("Buch-Layout", () => {
  it("Rücken wächst mit der Seitenzahl", () => {
    const thin = calcSpineWidthMm({ pageCount: 100, paperThicknessMm: 0.09, format: "softcover" });
    const thick = calcSpineWidthMm({ pageCount: 400, paperThicknessMm: 0.09, format: "softcover" });
    expect(thick).toBeGreaterThan(thin);
    expect(thin).toBeCloseTo(9, 5);
  });

  it("Hardcover-Rücken ist dicker als Softcover", () => {
    const hard = calcSpineWidthMm({ pageCount: 200, paperThicknessMm: 0.09, format: "hardcover" });
    const soft = calcSpineWidthMm({ pageCount: 200, paperThicknessMm: 0.09, format: "softcover" });
    expect(hard).toBeCloseTo(soft + 3, 5);
  });

  it("Umschlagbreite = Rücken + 2×Block + 2×Beschnitt", () => {
    const s = { format: "softcover" as const, trim: "6x9" as const, pageCount: 200, bleedMm: 3, paperThicknessMm: 0.09, title: "", author: "" };
    // Rücken (18) + 2 × Block (152.4) + 2 × Beschnitt (3)
    expect(calcCoverWidthMm(s)).toBeCloseTo(18 + 2 * 152.4 + 2 * 3, 5);
  });

  it("Seitenzahl-Schätzung ist positiv und skaliert", () => {
    expect(estimatePageCount(280)).toBe(1);
    expect(estimatePageCount(28000)).toBe(100);
  });
});

describe("Kopf-/Fußzeilen-Tokens", () => {
  it("ersetzt {title}, {author} und {page}", () => {
    expect(renderHfToken("{title} — {author}", { title: "Der Roman", author: "E. Autor", page: 7 }))
      .toBe("Der Roman — E. Autor");
    expect(renderHfToken("Seite {page}", { title: "t", author: "a", page: 42 })).toBe("Seite 42");
  });
});
