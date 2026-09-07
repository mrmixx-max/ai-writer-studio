// Tests für den Bilingual-Export (Sprint 15, Agent 4).
// Alles gemockt / ohne Provider: reine Markdown-Transformationen,
// Blob-Erzeugung wird über text() verifiziert.

import { describe, it, expect } from "vitest";
import {
  exportBilingual,
  buildBilingualMarkdown,
  buildBilingualToc,
  buildBilingualChapterMd,
  contentToMarkdown,
  slugifyChapterId,
  type BilingualBook,
} from "./bilingualExport";

/** TipTap-JSON aus Absatz-Texten bauen. */
function tt(...texts: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: texts.map((t) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    })),
  });
}

function mockBook(): BilingualBook {
  return {
    id: "book-1",
    title: "Mein Buch",
    titleDe: "Mein Buch",
    titleEn: "My Book",
    author: "Max Autor",
    chapters: [
      {
        id: "ch-1",
        titleDe: "Anfang",
        titleEn: "Beginning",
        contentDe: tt("Es war einmal."),
        contentEn: tt("Once upon a time."),
      },
      {
        id: "ch-2",
        titleDe: "Ende",
        titleEn: "Ending",
        contentDe: "# Überschrift\n\nDeutscher **Text**.",
        contentEn: "# Heading\n\nEnglish **text**.",
      },
    ],
  };
}

describe("slugifyChapterId", () => {
  it("normalisiert IDs zu Ankern", () => {
    expect(slugifyChapterId("Ch 1: Anfang!")).toBe("ch-1-anfang");
  });

  it("fällt bei leerem Ergebnis auf 'chapter' zurück", () => {
    expect(slugifyChapterId("!!!")).toBe("chapter");
  });
});

describe("contentToMarkdown", () => {
  it("konvertiert TipTap-JSON über die Export-Pipeline", () => {
    expect(contentToMarkdown(tt("Hallo Welt."))).toBe("Hallo Welt.");
  });

  it("übernimmt Markdown direkt", () => {
    const md = "# Titel\n\nAbsatz.";
    expect(contentToMarkdown(md)).toBe(md);
  });

  it("liefert Leerstring für leeren Inhalt", () => {
    expect(contentToMarkdown("")).toBe("");
    expect(contentToMarkdown("   ")).toBe("");
  });
});

describe("buildBilingualToc", () => {
  it("enthält DE- und EN-Blöcke mit Sprach-Markern", () => {
    const toc = buildBilingualToc(mockBook());
    expect(toc).toContain("<!-- lang:de -->");
    expect(toc).toContain("<!-- /lang:de -->");
    expect(toc).toContain("<!-- lang:en -->");
    expect(toc).toContain("<!-- /lang:en -->");
    expect(toc).toContain("Inhaltsverzeichnis / Table of Contents");
  });

  it("verlinkt jedes Kapitel in beiden Sprachen mit Anker", () => {
    const toc = buildBilingualToc(mockBook());
    expect(toc).toContain("[Anfang](#ch-1-de)");
    expect(toc).toContain("[Beginning](#ch-1-en)");
    expect(toc).toContain("[Ende](#ch-2-de)");
    expect(toc).toContain("[Ending](#ch-2-en)");
  });
});

describe("buildBilingualChapterMd", () => {
  it("stellt DE links und EN rechts in der Side-by-Side-Tabelle dar", () => {
    const md = buildBilingualChapterMd(mockBook().chapters[0], 0);
    expect(md).toContain("| 🇩🇪 Deutsch (DE) | 🇬🇧 English (EN) |");
    const tableRow = md.split("\n").find((l) => l.startsWith("| Es war"));
    expect(tableRow).toBeDefined();
    // DE-Inhalt vor EN-Inhalt in der Tabellenzeile (links/rechts).
    expect(tableRow!.indexOf("Es war einmal.")).toBeLessThan(
      tableRow!.indexOf("Once upon a time."),
    );
  });

  it("enthält Volltext-Sektionen mit Sprach-Markern und Anker", () => {
    const md = buildBilingualChapterMd(mockBook().chapters[0], 0);
    expect(md).toContain('<a id="ch-1-de"></a><a id="ch-1-en"></a>');
    expect(md).toContain("<!-- lang:de -->");
    expect(md).toContain("### 🇩🇪 Anfang");
    expect(md).toContain("<!-- lang:en -->");
    expect(md).toContain("### 🇬🇧 Beginning");
  });

  it("nummeriert Kapitel fortlaufend", () => {
    const md = buildBilingualChapterMd(mockBook().chapters[1], 1);
    expect(md).toContain("## 2. Ende / Ending");
  });
});

describe("buildBilingualMarkdown", () => {
  it("enthält Titel, Autor und Bilingual-Marker", () => {
    const md = buildBilingualMarkdown(mockBook(), "de", true);
    expect(md).toContain("# Mein Buch");
    expect(md).toContain("Max Autor");
    expect(md).toContain("<!-- bilingual: de+en -->");
  });

  it("nutzt bei targetLang=en den englischen Titel", () => {
    const md = buildBilingualMarkdown(mockBook(), "en", true);
    expect(md).toContain("# My Book");
  });

  it("lässt bei complete=false Titelseite/TOC weg, behält Kapitel", () => {
    const md = buildBilingualMarkdown(mockBook(), "de", false);
    expect(md).not.toContain("Inhaltsverzeichnis");
    expect(md).toContain("<!-- bilingual: de+en -->");
    expect(md).toContain("Anfang / Beginning");
    expect(md).toContain("Ende / Ending");
  });
});

describe("exportBilingual", () => {
  it("liefert einen Markdown-Blob mit beiden Sprachen", async () => {
    const blob = await exportBilingual(mockBook(), "de", true);
    expect(blob.type).toContain("text/markdown");
    const text = await blob.text();
    expect(text).toContain("Es war einmal.");
    expect(text).toContain("Once upon a time.");
    expect(text).toContain("<!-- lang:de -->");
    expect(text).toContain("<!-- lang:en -->");
  });

  it("exportiert alle Kapitel (Side-by-Side-Tabellen je Kapitel)", async () => {
    const text = await (await exportBilingual(mockBook(), "en", true)).text();
    const tables = text.split("\n").filter((l) => l.includes("| 🇩🇪 Deutsch (DE) |"));
    expect(tables).toHaveLength(2);
  });
});
