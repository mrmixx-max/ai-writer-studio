// Tests: Inhalts-, Zeichen- und Formatregeln des Preflight.

import { describe, it, expect } from "vitest";
import type { ChapterInput, PreflightInput } from "@/services/preflight/rules-base";
import {
  ruleFrontmatter,
  ruleBackmatter,
  ruleInvisibleChars,
  ruleWorkNotes,
  ruleParagraphLogic,
} from "@/services/preflight/rules-content";
import {
  ruleDocxHeadings,
  ruleDocxManualFormatting,
  rulePdfLongParagraphs,
  rulePdfUnsupportedChars,
  ruleEpubSingleChapter,
  ruleEpubImages,
  ruleMarkdownRawSyntax,
  ruleMarkdownLossyMarks,
  ruleTxtInformationLoss,
} from "@/services/preflight/rules-format";
import type { ExportFormat } from "@/types/preflight";

function doc(nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}
function para(text: string, marks?: string[]): unknown {
  return {
    type: "paragraph",
    content: [{ type: "text", text, marks: marks?.map((m) => ({ type: m })) }],
  };
}
function heading(level: number, text: string): unknown {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function chapter(over: Partial<ChapterInput> = {}): ChapterInput {
  const text = over.text ?? "Ein Kapitel mit ausreichend Text darin.";
  return {
    id: over.id ?? "c1",
    title: over.title ?? "Der Fund",
    text,
    raw: over.raw ?? doc([para(text)]),
    orderIndex: over.orderIndex ?? 0,
    wordCount: over.wordCount ?? (text.match(/[\p{L}\p{N}]+/gu) ?? []).length,
    ...over,
  };
}

function input(chapters: ChapterInput[], over: Partial<PreflightInput> = {}): PreflightInput {
  return {
    projectId: "p1",
    projectName: "Testprojekt",
    chapters,
    formats: ["docx", "pdf", "epub", "md", "txt"] as ExportFormat[],
    checkFrontmatter: false,
    checkBackmatter: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------

describe("Frontmatter", () => {
  it("prüft nur, wenn eingeschaltet", () => {
    expect(ruleFrontmatter(input([chapter()], { checkFrontmatter: false }))).toHaveLength(0);
  });

  it("meldet fehlendes Impressum als Warnung", () => {
    const f = ruleFrontmatter(input([chapter()], { checkFrontmatter: true }));
    const imprint = f.find((x) => x.ruleId === "frontmatter.missing-imprint");
    expect(imprint).toBeTruthy();
    // Rechtlich vorgeschrieben, daher Warnung und nicht nur Hinweis.
    expect(imprint?.severity).toBe("warning");
  });

  it("erkennt Impressum am Kapiteltitel", () => {
    const chapters = [chapter({ id: "a", title: "Impressum" }), chapter({ id: "b" })];
    const f = ruleFrontmatter(input(chapters, { checkFrontmatter: true }));
    expect(f.find((x) => x.ruleId === "frontmatter.missing-imprint")).toBeUndefined();
  });

  it("erkennt Impressum am Anfang des Textes", () => {
    const chapters = [
      chapter({ id: "a", text: "Alle Rechte vorbehalten. Copyright 2026." }),
      chapter({ id: "b" }),
    ];
    const f = ruleFrontmatter(input(chapters, { checkFrontmatter: true }));
    expect(f.find((x) => x.ruleId === "frontmatter.missing-imprint")).toBeUndefined();
  });

  it("prüft alle drei Frontmatter-Teile", () => {
    const f = ruleFrontmatter(input([chapter()], { checkFrontmatter: true }));
    const ids = f.map((x) => x.ruleId);
    expect(ids).toContain("frontmatter.missing-title");
    expect(ids).toContain("frontmatter.missing-imprint");
    expect(ids).toContain("frontmatter.missing-toc");
  });
});

describe("Backmatter", () => {
  it("prüft nur, wenn eingeschaltet", () => {
    expect(ruleBackmatter(input([chapter()], { checkBackmatter: false }))).toHaveLength(0);
  });

  it("erkennt eine Autorenseite", () => {
    const chapters = [chapter({ id: "a" }), chapter({ id: "b", title: "Über den Autor" })];
    const f = ruleBackmatter(input(chapters, { checkBackmatter: true }));
    expect(f.find((x) => x.ruleId === "backmatter.missing-author")).toBeUndefined();
  });

  it("meldet Backmatter nur als Hinweis", () => {
    // Backmatter ist nirgends vorgeschrieben — nie mehr als ein Hinweis.
    const f = ruleBackmatter(input([chapter()], { checkBackmatter: true }));
    for (const x of f) expect(x.severity).toBe("hint");
  });
});

describe("Unsichtbare Zeichen", () => {
  it("findet und benennt sie", () => {
    const text = "Ein Text mit\u00a0geschütztem Leerzeichen und\u200bNullbreite.";
    const f = ruleInvisibleChars(input([chapter({ text })]));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("geschütztes Leerzeichen");
    expect(f[0].structureHint).toContain("Nullbreiten");
    expect(f[0].charStart).toBeTypeOf("number");
  });

  it("zählt Vorkommen je Art", () => {
    const text = "a\u00a0b\u00a0c\u00a0d";
    const f = ruleInvisibleChars(input([chapter({ text })]));
    expect(f[0].title).toContain("3");
  });

  it("schweigt bei saubere Text", () => {
    const text = "Ein völlig normaler Text mit Umlauten: ä ö ü ß.";
    expect(ruleInvisibleChars(input([chapter({ text })]))).toHaveLength(0);
  });
});

describe("Arbeitsnotizen", () => {
  it("findet TODO und ähnliche Marker", () => {
    for (const marker of ["TODO", "FIXME", "[prüfen]", "Lorem ipsum", "???"]) {
      const text = `Ein Absatz. ${marker} Noch ein Absatz hier im Text.`;
      const f = ruleWorkNotes(input([chapter({ text })]));
      expect(f, `Marker "${marker}" sollte gefunden werden`).toHaveLength(1);
    }
  });

  it("liefert Ausschnitt und Position", () => {
    const text = "Ein Absatz mit TODO mitten im Text und danach mehr davon.";
    const f = ruleWorkNotes(input([chapter({ text })]));
    expect(f[0].excerpt).toContain("TODO");
    expect(f[0].charStart).toBeTypeOf("number");
  });

  it("schweigt bei normalem Text", () => {
    const text = "Sie fragte sich, was das bedeuten sollte. Dann ging sie fort.";
    expect(ruleWorkNotes(input([chapter({ text })]))).toHaveLength(0);
  });
});

describe("Absatzlogik", () => {
  it("meldet gemischte Einrückung", () => {
    const text = "\tEingerückt\nNicht eingerückt\n\tEingerückt\nNormal hier\nUnd weiter";
    const f = ruleParagraphLogic(input([chapter({ text })]));
    expect(f).toHaveLength(1);
  });

  it("schweigt bei durchgängiger Einrückung", () => {
    // Einheitliche Einrückung kann Absicht sein.
    const text = "\tEins\n\tZwei\n\tDrei\n\tVier\n\tFünf";
    expect(ruleParagraphLogic(input([chapter({ text })]))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
//  Format
// ---------------------------------------------------------------------------

describe("Formatregeln respektieren die Formatauswahl", () => {
  it("meldet DOCX-Befunde nur bei DOCX-Export", () => {
    const raw = doc([para("Text ohne Überschrift")]);
    const withDocx = ruleDocxHeadings(input([chapter({ raw })], { formats: ["docx"] }));
    const withoutDocx = ruleDocxHeadings(input([chapter({ raw })], { formats: ["txt"] }));
    expect(withDocx).toHaveLength(1);
    expect(withoutDocx).toHaveLength(0);
  });

  it("meldet EPUB-Befunde nur bei EPUB-Export", () => {
    const c = chapter({ wordCount: 40000 });
    expect(ruleEpubSingleChapter(input([c], { formats: ["epub"] }))).toHaveLength(1);
    expect(ruleEpubSingleChapter(input([c], { formats: ["docx"] }))).toHaveLength(0);
  });

  it("meldet TXT-Verlust nur bei TXT-Export", () => {
    const raw = doc([para("Fett", ["bold"])]);
    const c = chapter({ raw });
    expect(ruleTxtInformationLoss(input([c], { formats: ["txt"] }))).toHaveLength(1);
    expect(ruleTxtInformationLoss(input([c], { formats: ["docx"] }))).toHaveLength(0);
  });
});

describe("DOCX", () => {
  it("meldet Kapitel ohne Überschrift", () => {
    const raw = doc([para("Direkt Text, keine Überschrift.")]);
    const f = ruleDocxHeadings(input([chapter({ raw })], { formats: ["docx"] }));
    expect(f).toHaveLength(1);
    expect(f[0].affectedFormats).toEqual(["docx"]);
  });

  it("schweigt bei vorhandener Überschrift", () => {
    const raw = doc([heading(1, "Der Fund"), para("Text.")]);
    expect(ruleDocxHeadings(input([chapter({ raw })], { formats: ["docx"] }))).toHaveLength(0);
  });

  it("meldet übermäßige manuelle Formatierung", () => {
    // 10 Auszeichnungen auf ~15 Wörter ist deutlich zu viel.
    const nodes = Array.from({ length: 10 }, () => para("Wort", ["bold"]));
    const f = ruleDocxManualFormatting(
      input([chapter({ raw: doc(nodes), wordCount: 15 })], { formats: ["docx"] }),
    );
    expect(f).toHaveLength(1);
  });

  it("schweigt bei sparsamer Formatierung", () => {
    const raw = doc([para("Ein Wort", ["bold"])]);
    const f = ruleDocxManualFormatting(
      input([chapter({ raw, wordCount: 2000 })], { formats: ["docx"] }),
    );
    expect(f).toHaveLength(0);
  });
});

describe("PDF", () => {
  it("meldet sehr lange Absätze", () => {
    const long = "Wort ".repeat(500);
    const f = rulePdfLongParagraphs(input([chapter({ text: long })], { formats: ["pdf"] }));
    expect(f).toHaveLength(1);
    expect(f[0].charStart).toBeTypeOf("number");
  });

  it("meldet Emoji, die im PDF fehlen können", () => {
    const text = "Ein Text mit 🎉 Emoji darin und noch mehr Text danach.";
    const f = rulePdfUnsupportedChars(input([chapter({ text })], { formats: ["pdf"] }));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("🎉");
  });

  it("schweigt bei reinem Text", () => {
    const text = "Ein Text mit Umlauten ä ö ü und Anführungszeichen.";
    expect(rulePdfUnsupportedChars(input([chapter({ text })], { formats: ["pdf"] }))).toHaveLength(0);
  });
});

describe("EPUB", () => {
  it("meldet ein Buch aus einem einzigen langen Kapitel", () => {
    const f = ruleEpubSingleChapter(input([chapter({ wordCount: 50000 })], { formats: ["epub"] }));
    expect(f).toHaveLength(1);
  });

  it("schweigt bei kurzem Einzelkapitel", () => {
    const f = ruleEpubSingleChapter(input([chapter({ wordCount: 800 })], { formats: ["epub"] }));
    expect(f).toHaveLength(0);
  });

  it("schweigt bei mehreren Kapiteln", () => {
    const chapters = [chapter({ id: "a", wordCount: 30000 }), chapter({ id: "b" })];
    expect(ruleEpubSingleChapter(input(chapters, { formats: ["epub"] }))).toHaveLength(0);
  });

  it("meldet Bilder ohne Alternativtext", () => {
    const raw = doc([
      { type: "image", attrs: { src: "a.png", alt: "" } },
      { type: "image", attrs: { src: "b.png", alt: "Beschreibung" } },
    ]);
    const f = ruleEpubImages(input([chapter({ raw })], { formats: ["epub"] }));
    expect(f).toHaveLength(1);
    expect(f[0].title).toContain("1 von 2");
  });
});

describe("Markdown", () => {
  it("meldet rohe Markdown-Zeichen", () => {
    const text = "Ein *betontes* Wort und ein `Codewort` im Text.";
    const f = ruleMarkdownRawSyntax(input([chapter({ text })], { formats: ["md"] }));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("kursiv");
  });

  it("schweigt bei normalem Text", () => {
    const text = "Ein völlig normaler Satz ohne Sonderzeichen darin.";
    expect(ruleMarkdownRawSyntax(input([chapter({ text })], { formats: ["md"] }))).toHaveLength(0);
  });

  it("meldet Auszeichnung, die Markdown verliert", () => {
    const raw = doc([para("Unterstrichen", ["underline"])]);
    const f = ruleMarkdownLossyMarks(input([chapter({ raw })], { formats: ["md"] }));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("underline");
  });

  it("meldet fett und kursiv nicht als Verlust", () => {
    const raw = doc([para("Fett", ["bold"]), para("Kursiv", ["italic"])]);
    expect(ruleMarkdownLossyMarks(input([chapter({ raw })], { formats: ["md"] }))).toHaveLength(0);
  });
});

describe("TXT", () => {
  it("beziffert den Informationsverlust", () => {
    const raw = doc([
      heading(1, "Titel"),
      para("Fett", ["bold"]),
      { type: "image", attrs: { src: "a.png", alt: "x" } },
    ]);
    const f = ruleTxtInformationLoss(input([chapter({ raw })], { formats: ["txt"] }));
    expect(f).toHaveLength(1);
    expect(f[0].structureHint).toContain("Auszeichnung");
    expect(f[0].structureHint).toContain("Bilder");
  });

  it("schweigt bei unformatiertem Text", () => {
    // Ohne Formatierung gibt es nichts zu verlieren.
    const raw = doc([para("Nur reiner Text.")]);
    expect(ruleTxtInformationLoss(input([chapter({ raw })], { formats: ["txt"] }))).toHaveLength(0);
  });
});
