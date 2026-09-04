// Tests: AutoBookWriter Qualität & Kohärenz (B1-B4).
//
// Reine Logik-Tests ohne LLM-Mocking: Rolling Context, Glossar-Merge,
// Outline-Validierung, Wortzahl-Steuerung (deterministische Funktionen).
import { describe, it, expect } from "vitest";
import {
  buildChapterContext,
  lastParagraph,
  estimateTokens,
  mergeEntities,
  evaluateWordCount,
  validateOutline,
  getTargetWords,
  DEFAULT_WORDS_PER_CHAPTER,
  WORD_TOLERANCE_PERCENT,
  MAX_ENTITIES,
  type BookOutline,
} from "./bookwriter";
import { deriveMinMax } from "./chapterPlan";

function makeOutline(chapterCount = 8): BookOutline {
  return {
    title: "KI im Alltag",
    genre: "Sachbuch",
    targetAudience: "Erwachsene",
    chapters: Array.from({ length: chapterCount }, (_, i) => ({
      number: i + 1,
      title: `Kapitel ${i + 1}`,
      summary: `Kapitel ${i + 1} behandelt das Thema KI im Alltag mit vielen Beispielen und praktischen Tipps für Einsteiger sowie Fortgeschrittene im Umgang mit künstlicher Intelligenz.`,
    })),
  };
}

function makeChapter(number: number, title: string, paragraphCount: number, wordsPerPara = 100) {
  const para = Array.from({ length: wordsPerPara }, (_, i) => `Wort${i}`).join(" ");
  return {
    number,
    title,
    content: Array.from({ length: paragraphCount }, (_, i) => `Absatz ${i}: ${para}`).join("\n\n"),
  };
}

describe("B1: Rolling Context", () => {
  it("buildChapterContext enthält Outline, Summaries, Übergangsabsatz und Glossar", () => {
    const outline = makeOutline(8);
    outline.chapterSummaries = ["K1-Zusammenfassung mit Inhalt."];
    outline.entities = ["Dr. Weber", "Quantencomputer"];
    const prev = makeChapter(1, "Kapitel 1", 5);

    const ctx = buildChapterContext(outline, 2, [prev]);
    expect(ctx).toContain("Gliederung:");
    expect(ctx).toContain("K1-Zusammenfassung");
    expect(ctx).toContain("Letzter Absatz von Kapitel 1");
    expect(ctx).toContain("Absatz 4:");
    expect(ctx).toContain("Dr. Weber");
  });

  it("Kontext für Kapitel 8 (8x1000 Wörter Buch) bleibt unter 4000 Tokens", () => {
    // Simuliere 8 Kapitel à ~1000 Wörter (~6000 Zeichen je Kapitel).
    const outline = makeOutline(8);
    outline.chapterSummaries = Array.from(
      { length: 7 },
      (_, i) => Array.from({ length: 200 }, (_, j) => `W${i}_${j}`).join(" "),
    ); // 200 Wörter ≈ 1200 Zeichen je Summary
    outline.entities = ["Dr. Weber", "Fachbegriff A", "Zahl 42"];
    const previousChapters = Array.from({ length: 7 }, (_, i) =>
      makeChapter(i + 1, `Kapitel ${i + 1}`, 10, 100),
    );

    const ctx = buildChapterContext(outline, 8, previousChapters);

    // Akzeptanzkriterium: < 4000 Tokens (~16.000 Zeichen bei 4 Zeichen/Token).
    expect(estimateTokens(ctx)).toBeLessThan(4000);
    expect(ctx).not.toContain("Absatz 0"); // Kein Vollkontext
    expect(ctx.length).toBeLessThan(16000);
  });

  it("lastParagraph liefert den letzten nicht-leeren Absatz", () => {
    expect(lastParagraph("Erster Absatz.\n\nZweiter Absatz.\n\n  \nDritter Absatz.")).toBe(
      "Dritter Absatz.",
    );
    expect(lastParagraph("   ")).toBe("");
    expect(lastParagraph("")).toBe("");
  });

  it("Kapitel 1 bekommt keine Summaries/Übergang", () => {
    const ctx = buildChapterContext(makeOutline(8), 1, []);
    expect(ctx).not.toContain("Zusammenfassungen");
    expect(ctx).not.toContain("Letzter Absatz");
  });
});

describe("B2: Kohärenz-Glossar", () => {
  it("mergeEntities dedupliziert case-insensitive und cappt bei 30", () => {
    const merged = mergeEntities(
      ["Dr. Weber", "Quantencomputer"],
      ["dr. weber", "Dr. Meyer", "  Quantencomputer  ", "1989"],
    );
    expect(merged).toEqual(["Dr. Weber", "Quantencomputer", "Dr. Meyer", "1989"]);

    const many = Array.from({ length: 40 }, (_, i) => `Entität ${i}`);
    expect(mergeEntities([], many).length).toBe(MAX_ENTITIES);
    expect(mergeEntities(["A"], many).length).toBe(MAX_ENTITIES);
  });

  it("mergeEntities verwirft leere Einträge", () => {
    expect(mergeEntities(["A"], ["", "   ", "B"])).toEqual(["A", "B"]);
  });

  it("Glossar verhindert Namensdrift: Mock-Prompt enthält exakte Bezeichnung", () => {
    // Akzeptanzkriterium B2: Der Prompt für Kapitel N muss das Glossar mit
    // exakten Bezeichnungen enthalten (Verbot von Namensabweichungen).
    const outline = makeOutline(8);
    outline.entities = ["Dr. Weber"];
    const ctx = buildChapterContext(outline, 3, [makeChapter(2, "Kapitel 2", 3)]);
    expect(ctx).toContain("Kohärenz-Glossar");
    expect(ctx).toContain("Dr. Weber");
    expect(ctx).toContain("keine Namensabweichungen");
    expect(ctx).not.toContain("Dr. Meyer");
  });
});

describe("B3: Harte Wortzahl-Steuerung", () => {
  it("evaluateWordCount: 400 Wörter bei Ziel 1000 ist außerhalb ±20%", () => {
    const content = Array.from({ length: 400 }, (_, i) => `W${i}`).join(" ");
    const ev = evaluateWordCount(content, 1000);
    expect(ev.withinRange).toBe(false);
    expect(ev.min).toBe(800);
    expect(ev.max).toBe(1200);
    expect(ev.deviationPercent).toBe(60);
  });

  it("evaluateWordCount: 1000 Wörter bei Ziel 1000 ist innerhalb", () => {
    const content = Array.from({ length: 1000 }, (_, i) => `W${i}`).join(" ");
    const ev = evaluateWordCount(content, 1000);
    expect(ev.withinRange).toBe(true);
    expect(ev.min).toBe(deriveMinMax(1000, WORD_TOLERANCE_PERCENT).min);
  });

  it("Grenzfälle: 799/800/1200/1201 Wörter", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => `W${i}`).join(" ");
    expect(evaluateWordCount(mk(799), 1000).withinRange).toBe(false);
    expect(evaluateWordCount(mk(800), 1000).withinRange).toBe(true);
    expect(evaluateWordCount(mk(1200), 1000).withinRange).toBe(true);
    expect(evaluateWordCount(mk(1201), 1000).withinRange).toBe(false);
  });

  it("getTargetWords nutzt Default 1000 bzw. Konfiguration", () => {
    expect(getTargetWords({})).toBe(DEFAULT_WORDS_PER_CHAPTER);
    expect(getTargetWords({ wordsPerChapter: 1500 })).toBe(1500);
  });
});

describe("B4: Outline-Qualitätsgate", () => {
  it("valide Gliederung: keine Fehler", () => {
    expect(validateOutline(makeOutline(8), { chapterCount: 8 })).toEqual([]);
  });

  it("falsche Kapitelanzahl wird erkannt", () => {
    const errors = validateOutline(makeOutline(6), { chapterCount: 8 });
    expect(errors.some((e) => e.includes("Kapitelanzahl falsch"))).toBe(true);
  });

  it("doppelte Titel werden erkannt", () => {
    const outline = makeOutline(3);
    outline.chapters[1].title = outline.chapters[0].title;
    const errors = validateOutline(outline);
    expect(errors.some((e) => e.includes("Doppelter Kapiteltitel"))).toBe(true);
  });

  it("Summaries unter 20 Wörtern werden erkannt", () => {
    const outline = makeOutline(3);
    outline.chapters[0].summary = "Zu kurz.";
    const errors = validateOutline(outline);
    expect(
      errors.some((e) => e.includes("hat nur")),
    ).toBe(true);
  });

  it("Fazit als Kapitel 1 verstößt gegen den logischen Bogen", () => {
    const outline = makeOutline(3);
    outline.chapters[0].title = "Fazit";
    const errors = validateOutline(outline);
    expect(errors.some((e) => e.includes("Einleitung fehlt"))).toBe(true);
  });

  it("doppelte Fazits werden erkannt", () => {
    const outline = makeOutline(4);
    outline.chapters[2].title = "Zwischenfazit";
    outline.chapters[3].title = "Abschluss und Fazit";
    const errors = validateOutline(outline);
    expect(errors.some((e) => e.includes("höchstens eines erlaubt"))).toBe(true);
  });

  it("ungültige/doppelte Kapitelnummern werden erkannt", () => {
    const outline = makeOutline(3);
    outline.chapters[2].number = 2; // doppelt, 3 fehlt
    const errors = validateOutline(outline);
    expect(errors.some((e) => e.includes("Kapitelnummer"))).toBe(true);
  });
});