// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  GENRE_PROFILES,
  getGenreProfile,
  findCompTitles,
  generateQueryLetter,
  checkNormPageConformity,
  buildSubmissionDossier,
  createSampleManuscriptMeta,
  createSampleSubmissionDossier,
  type ManuscriptMeta,
} from "./literaryAgentPitchDeck";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("GENRE_PROFILES", () => {
  it("enthält sechs Genres", () => {
    expect(GENRE_PROFILES).toHaveLength(6);
  });
  it("jedes Genre hat eine Bandbreite und Vergleichstitel", () => {
    for (const g of GENRE_PROFILES) {
      expect(g.wordRange[0]).toBeLessThan(g.wordRange[1]);
      expect(g.compPool.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("getGenreProfile findet Fantasy", () => {
    expect(getGenreProfile("fantasy")?.label).toBe("Fantasy");
  });
  it("getGenreProfile liefert undefined für unbekannt", () => {
    expect(getGenreProfile("xyz" as never)).toBeUndefined();
  });
});

describe("findCompTitles", () => {
  it("ist deterministisch", () => {
    expect(findCompTitles("fantasy", 2, 42).titles).toEqual(findCompTitles("fantasy", 2, 42).titles);
  });
  it("liefert die angeforderte Anzahl ohne Duplikate", () => {
    const r = findCompTitles("thriller", 3, 42);
    expect(r.titles).toHaveLength(3);
    expect(new Set(r.titles).size).toBe(3);
  });
  it("begrenzt auf die Poolgröße", () => {
    expect(findCompTitles("fantasy", 999, 42).titles.length).toBeLessThanOrEqual(4);
  });
  it("Begründung nennt die Titel", () => {
    const r = findCompTitles("romance", 2, 7);
    expect(r.rationale).toContain("Für Leser von");
    for (const t of r.titles) expect(r.rationale).toContain(t);
  });
  it("unbekanntes Genre fällt auf das erste zurück", () => {
    expect(findCompTitles("xyz" as never, 2, 42).titles.length).toBeGreaterThan(0);
  });
});

describe("generateQueryLetter", () => {
  const meta = createSampleManuscriptMeta();
  it("ist deterministisch", () => {
    expect(generateQueryLetter(meta, 42).fullText).toBe(generateQueryLetter(meta, 42).fullText);
  });
  it("enthält alle fünf Bausteine", () => {
    const q = generateQueryLetter(meta, 42);
    expect(q.hook.length).toBeGreaterThan(0);
    expect(q.conflictParagraph.length).toBeGreaterThan(0);
    expect(q.compsParagraph.length).toBeGreaterThan(0);
    expect(q.bioParagraph.length).toBeGreaterThan(0);
    expect(q.callToAction.length).toBeGreaterThan(0);
  });
  it("interpoliert den Protagonisten in den Hook", () => {
    expect(generateQueryLetter(meta, 42).hook).toContain("Lyra Falkenstein");
  });
  it("nennt den Autor in der Bio", () => {
    expect(generateQueryLetter(meta, 42).bioParagraph).toContain("Erik Gieske");
  });
  it("Brief enthält Betreff und Grußformel", () => {
    const q = generateQueryLetter(meta, 42);
    expect(q.fullText).toContain("Betreff:");
    expect(q.fullText).toContain("Mit freundlichen Grüßen");
  });
  it("Wortzahl wird gezählt", () => {
    expect(generateQueryLetter(meta, 42).wordCount).toBeGreaterThan(50);
  });
});

describe("checkNormPageConformity", () => {
  it("Wortzahl innerhalb der Bandbreite ist gültig", () => {
    const meta: ManuscriptMeta = { ...createSampleManuscriptMeta(), genre: "fantasy", wordCount: 118000 };
    expect(checkNormPageConformity(meta).valid).toBe(true);
  });
  it("zu kurzes Manuskript ist ungültig", () => {
    const meta: ManuscriptMeta = { ...createSampleManuscriptMeta(), genre: "fantasy", wordCount: 50000 };
    const r = checkNormPageConformity(meta);
    expect(r.valid).toBe(false);
    expect(r.deviation).toContain("unter der Mindestlänge");
  });
  it("zu langes Manuskript ist ungültig", () => {
    const meta: ManuscriptMeta = { ...createSampleManuscriptMeta(), genre: "romance", wordCount: 200000 };
    const r = checkNormPageConformity(meta);
    expect(r.valid).toBe(false);
    expect(r.deviation).toContain("über der Höchstlänge");
  });
  it("Grenzwerte sind inklusiv", () => {
    const meta: ManuscriptMeta = { ...createSampleManuscriptMeta(), genre: "romance", wordCount: 65000 };
    expect(checkNormPageConformity(meta).valid).toBe(true);
  });
});

describe("buildSubmissionDossier", () => {
  const meta = createSampleManuscriptMeta();
  it("ist deterministisch", () => {
    expect(buildSubmissionDossier(meta, 42).id).toBe(buildSubmissionDossier(meta, 42).id);
  });
  it("enthält Query Letter, Comps und Normseiten-Prüfung", () => {
    const d = buildSubmissionDossier(meta, 42);
    expect(d.queryLetter.fullText.length).toBeGreaterThan(0);
    expect(d.comps.titles.length).toBeGreaterThan(0);
    expect(d.normPage.valid).toBe(true);
  });
  it("listet Anlagen und E-Mail-Vorlage", () => {
    const d = buildSubmissionDossier(meta, 42);
    expect(d.attachments.length).toBeGreaterThanOrEqual(4);
    expect(d.emailTemplate).toContain("An:");
    expect(d.emailTemplate).toContain("Betreff:");
  });
  it("erstellt eine PDF-Gliederung", () => {
    const d = buildSubmissionDossier(meta, 42);
    expect(d.pdfOutline.length).toBeGreaterThanOrEqual(5);
    expect(d.pdfOutline[0]).toContain("Deckblatt");
  });
  it("nennt das Genre-Label", () => {
    expect(buildSubmissionDossier(meta, 42).genreLabel).toBe("Fantasy");
  });
});

describe("createSampleSubmissionDossier", () => {
  it("erzeugt ein vollständiges Beispieldossier", () => {
    const d = createSampleSubmissionDossier();
    expect(d.title).toBe("Das Zwölfgestirn");
    expect(d.normPage.valid).toBe(true);
    expect(d.queryLetter.hook).toContain("Lyra Falkenstein");
  });
});
