// @vitest-environment jsdom
// FilmAndForeignRightsPitch Tests (Meilenstein 61.0 / v7.3.0)
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  buildFilmRightsDossier,
  buildForeignRightsGuide,
  generateRightsPitchPdf,
  createSampleRightsProject,
  createSampleDossier,
} from "./filmAndForeignRightsPitch";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("rechte")).toBe(hashString("rechte"));
  });

  it("unterscheidet verschiedene Strings", () => {
    expect(hashString("netflix")).not.toBe(hashString("hbo"));
  });

  it("gibt eine vorzeichenlose 32-Bit-Zahl zurück", () => {
    const h = hashString("Pitch");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch", () => {
    const a = createSeededRandom(3);
    const b = createSeededRandom(3);
    expect(a()).toBe(b());
  });

  it("liefert Werte in [0,1)", () => {
    const rng = createSeededRandom(21);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("buildFilmRightsDossier", () => {
  const project = { title: "Das Zwölfgestirn", genre: "Fantasy-Thriller" };

  it("liefert ein vollständiges 1-Seiter-Dossier", () => {
    const d = buildFilmRightsDossier(project, 42);
    expect(d.logline.length).toBeGreaterThan(0);
    expect(d.marketComparison.length).toBeGreaterThan(0);
    expect(Array.isArray(d.castingSuggestions)).toBe(true);
    expect(d.castingSuggestions.length).toBeGreaterThan(0);
    for (const c of d.castingSuggestions) {
      expect(c.role.length).toBeGreaterThan(0);
      expect(c.actorType.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
    expect(d.tonalReference.length).toBeGreaterThan(0);
    expect(d.seriesPotential.length).toBeGreaterThan(0);
    expect(d.onePageText.length).toBeGreaterThan(0);
  });

  it("hält die Logline unter 30 Wörtern", () => {
    const d = buildFilmRightsDossier(project, 1);
    const words = d.logline.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThan(30);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildFilmRightsDossier(project, 7);
    const b = buildFilmRightsDossier(project, 7);
    expect(a.logline).toBe(b.logline);
    expect(a.onePageText).toBe(b.onePageText);
  });
});

describe("buildForeignRightsGuide", () => {
  const project = { title: "Das Zwölfgestirn", genre: "Fantasy-Thriller" };

  it("liefert einen Leitfaden mit Territorien", () => {
    const g = buildForeignRightsGuide(project, 42);
    expect(Array.isArray(g.territories)).toBe(true);
    expect(g.territories.length).toBeGreaterThanOrEqual(3);
    for (const t of g.territories) {
      expect(t.territory.length).toBeGreaterThan(0);
      expect(t.language.length).toBeGreaterThan(0);
      expect(t.marketTrend.length).toBeGreaterThan(0);
      expect(t.pitchAngle.length).toBeGreaterThan(0);
    }
    expect(g.salesData.length).toBeGreaterThan(0);
    expect(g.fairStrategy.length).toBeGreaterThan(0);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = buildForeignRightsGuide(project, 9);
    const b = buildForeignRightsGuide(project, 9);
    expect(a.territories.length).toBe(b.territories.length);
    expect(a.salesData).toBe(b.salesData);
  });
});

describe("generateRightsPitchPdf", () => {
  const project = { title: "Das Zwölfgestirn", genre: "Fantasy-Thriller" };

  it("liefert ein druckfertiges PDF-Ergebnis", () => {
    const pdf = generateRightsPitchPdf(project, 42);
    expect(pdf.title.length).toBeGreaterThan(0);
    expect(Array.isArray(pdf.sections)).toBe(true);
    expect(pdf.sections.length).toBeGreaterThan(0);
    for (const s of pdf.sections) {
      expect(s.heading.length).toBeGreaterThan(0);
      expect(typeof s.body).toBe("string");
    }
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1);
    expect(pdf.printReady).toBe(true);
    expect(pdf.svgPreview).toContain("<svg");
  });

  it("ist deterministisch", () => {
    const a = generateRightsPitchPdf(project, 3);
    const b = generateRightsPitchPdf(project, 3);
    expect(a.svgPreview).toBe(b.svgPreview);
    expect(a.pageCount).toBe(b.pageCount);
  });
});

describe("createSampleRightsProject", () => {
  it("liefert ein gültiges Projekt", () => {
    const p = createSampleRightsProject();
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.genre.length).toBeGreaterThan(0);
  });
});

describe("createSampleDossier", () => {
  it("liefert ein gültiges Beispiel-Dossier", () => {
    const d = createSampleDossier();
    expect(d.logline.length).toBeGreaterThan(0);
    expect(d.onePageText.length).toBeGreaterThan(0);
  });
});
