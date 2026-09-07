import { describe, it, expect, vi } from "vitest";
import {
  applySmartQuotes,
  convertDashes,
  convertEllipsis,
  applyGermanSpacing,
  splitParagraphs,
  normalizeDoubleEnter,
  detectChapterHeading,
  findChapterHeadings,
  formatParagraph,
  formatDocument,
  countWords,
  countWordsPerChapter,
  summarizeChapterLengths,
  formatTiptapDoc,
  applyChapterHeadingStyle,
  type TipTapNode,
} from "./textFormat";

describe("convertDashes", () => {
  it("wandelt -- in Em-dash um", () => {
    expect(convertDashes("Worte -- Pause")).toBe("Worte — Pause");
  });
  it("wandelt --- in Em-dash um (nicht doppelt)", () => {
    expect(convertDashes("a --- b")).toBe("a — b");
  });
  it("ist idempotent", () => {
    expect(convertDashes(convertDashes("a -- b"))).toBe("a — b");
  });
});

describe("applySmartQuotes (deutsch)", () => {
  it('wandelt "" in „…" um', () => {
    expect(applySmartQuotes('Er sagte "Hallo".', "de")).toBe("Er sagte „Hallo“.");
  });
  it("wandelt einfache Quotes in ‚…' um", () => {
    expect(applySmartQuotes("Sie rief 'Komm!'.", "de")).toBe("Sie rief ‚Komm!‘.");
  });
  it("lässt Apostroph in Wortmitte als ’ stehen", () => {
    expect(applySmartQuotes("don't", "de")).toBe("don’t");
  });
  it("englische Locale nutzt \"…\"", () => {
    expect(applySmartQuotes('He said "hi".', "en")).toBe("He said “hi”.");
  });
});

describe("deutsche Typografie", () => {
  it("... wird zu …", () => {
    expect(convertEllipsis("Und so...")).toBe("Und so…");
  });
  it("geschütztes Leerzeichen vor ! ? : ;", () => {
    expect(applyGermanSpacing("Was ? Wirklich ! Ja : so ;")).toBe("Was ? Wirklich ! Ja : so ;");
  });
  it("Mehrfachspaces kollabieren", () => {
    expect(applyGermanSpacing("a   b")).toBe("a b");
  });
});

describe("auto-paragraph (Doppel-Enter)", () => {
  it("teilt an Doppel-Enter", () => {
    expect(splitParagraphs("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
  });
  it("normalisiert 3+ Umbrüche zu genau 2", () => {
    expect(normalizeDoubleEnter("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("Kapitelüberschrift-Erkennung", () => {
  it("erkennt 'Kapitel 3'", () => {
    expect(detectChapterHeading("Kapitel 3")).toMatchObject({ number: 3, title: "" });
  });
  it("erkennt Titel nach Doppelpunkt", () => {
    expect(detectChapterHeading("KAPITEL 3: Der Anfang")).toMatchObject({
      number: 3,
      title: "Der Anfang",
    });
  });
  it("erkennt englische Headings mit römischer Zahl", () => {
    expect(detectChapterHeading("Chapter IV – The Return")).toMatchObject({
      number: 4,
      title: "The Return",
    });
  });
  it("lehnt Fließtext ab", () => {
    expect(detectChapterHeading("Das Kapitel war lang")).toBeNull();
    expect(detectChapterHeading("Kapitel")).toBeNull();
  });
  it("findet alle Headings mit Zeilenindex", () => {
    const found = findChapterHeadings("Intro\nKapitel 1\nText\nChapter 2: X");
    expect(found.map((f) => f.heading.number)).toEqual([1, 2]);
    expect(found[0].lineIndex).toBe(1);
  });
});

describe("Wortzählung", () => {
  it("zählt deutsche Wörter mit Umlauten", () => {
    expect(countWords("Grüße aus München, süß!")).toBe(4);
  });
  it("zählt pro Kapitel inkl. Prolog-Section 0", () => {
    const counts = countWordsPerChapter("Prologtext hier.\n\nKapitel 1\nEins zwei drei.\n\nKapitel 2\nVier fünf.");
    expect(counts.map((c) => c.chapter)).toEqual([0, 1, 2]);
    expect(counts[1].words).toBe(3);
    expect(counts[2].words).toBe(2);
    expect(counts[1].heading).toBe("Kapitel 1");
  });
  it("summarizeChapterLengths nutzt injizierte complete-Funktion (Mock)", async () => {
    const complete = vi.fn(async (prompt: string) => `Mock: ${prompt.length} Zeichen`);
    const chapters = [
      { chapter: 1, heading: "Kapitel 1", words: 100, chars: 500 },
      { chapter: 2, heading: "Kapitel 2", words: 300, chars: 1500 },
    ];
    const out = await summarizeChapterLengths(chapters, complete);
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0][0]).toContain("400 Wörter");
    expect(out).toMatch(/^Mock: /);
  });
});

describe("Pipelines & TipTap", () => {
  it("formatParagraph kombiniert Striche + Quotes + Spacing", () => {
    expect(formatParagraph('Er sagte "Hallo" -- wirklich ?', { locale: "de" })).toBe(
      "Er sagte „Hallo“ — wirklich ?",
    );
  });
  it("formatDocument lässt Kapitelzeilen unverändert, formatiert Rest", () => {
    const out = formatDocument('Kapitel 1: Start\nEr sagte "Hi" -- ok.');
    expect(out.startsWith("Kapitel 1: Start")).toBe(true);
    expect(out).toContain("„Hi“ —");
  });
  it("formatTiptapDoc formatiert Textknoten ohne Mutation", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: 'a -- "b"' }] }],
    };
    const out = formatTiptapDoc(doc, { locale: "de" });
    expect(out.content?.[0].content?.[0].text).toBe("a — „b“");
    expect(doc.content?.[0].content?.[0].text).toBe('a -- "b"');
  });
  it("applyChapterHeadingStyle wandelt Kapitel-Paragrafen in heading/level 1", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Kapitel 2" }] },
        { type: "paragraph", content: [{ type: "text", text: "normaler Text" }] },
      ],
    };
    const out = applyChapterHeadingStyle(doc);
    expect(out.content?.[0].type).toBe("heading");
    expect(out.content?.[0].attrs).toMatchObject({ level: 1 });
    expect(out.content?.[1].type).toBe("paragraph");
  });
});
