// Buch-Struktur (C2): gemeinsame Titelblatt-/Impressum-/TOC-Bausteine für
// DOCX und EPUB; Markdown baut seine eigene Fassung in markdown.ts.

import type { Block } from "@/services/export/blocks";
import type { BookChapterInput } from "./types";
import { normalizeTypography } from "./typography";

/** Kapitel-Blöcke mit typografisch normalisiertem Text. */
export function normalizedChapterBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({
    ...b,
    text: normalizeTypography(b.text),
    items: b.items?.map((it) => ({ ...it, text: normalizeTypography(it.text) })),
  }));
}

/** Titelblatt + Impressum als Blöcke (DOCX nutzt sie, EPUB eigenes XHTML). */
export function buildTitlePageBlocks(
  title: string,
  author: string,
  year: number,
): Block[] {
  return [
    { type: "h1", text: title },
    { type: "p", text: `von ${author}` },
    { type: "p", text: "" },
    { type: "p", text: `© ${year} ${author}` },
    { type: "p", text: "Alle Rechte vorbehalten." },
    {
      type: "p",
      text:
        "Dieses Werk einschließlich seiner Inhalte ist urheberrechtlich geschützt. " +
        "Jede Verwertung außerhalb der Grenzen des Urheberrechtsgesetzes ist ohne " +
        "Zustimmung des Autors unzulässig und strafbar.",
    },
    { type: "p", text: "" },
  ];
}

/** Klickbares Inhaltsverzeichnis: Einträge mit EPUB-Dateianker. */
export interface TocEntry {
  number: number;
  title: string;
  /** Anker ohne "#" (XHTML-Datei je Kapitel). */
  anchor: string;
}

export function buildTocEntries(chapters: BookChapterInput[]): TocEntry[] {
  return chapters.map((c, i) => ({
    number: c.number ?? i + 1,
    title: c.title,
    anchor: `kapitel-${c.number ?? i + 1}`,
  }));
}

/** "Kapitel N: Titel" als Kapitelüberschrift-Text (KDP-Konvention). */
export function chapterHeading(chapter: BookChapterInput, index: number): string {
  return `Kapitel ${chapter.number ?? index + 1}: ${chapter.title}`;
}

/**
 * Ein Kapitel als eigenständiges XHTML (EPUB, UTF-8).
 * Ein eindeutiges id-Attribut auf dem <h1> macht das Inhaltsverzeichnis klickbar.
 */
export function buildEpubChapterXhtml(
  chapter: BookChapterInput,
  blocks: Block[],
  bookTitle: string,
): string {
  const anchor = `kapitel-${chapter.number ?? 0}`;
  const body = blocks
    .map((b) => {
      if (b.type === "h2") return `<h2>${xmlEscape(b.text)}</h2>`;
      if (b.type === "h3") return `<h3>${xmlEscape(b.text)}</h3>`;
      if (b.type === "quote") return `<blockquote>${xmlEscape(b.text)}</blockquote>`;
      if (b.type === "code") {
        return `<pre><code>${xmlEscape(b.text)}</code></pre>`;
      }
      if (b.type === "list_item" && b.items) {
        const tag = b.ordered ? "ol" : "ul";
        const items = b.items
          .map((it) => `<li>${xmlEscape(it.text)}</li>`)
          .join("");
        return `<${tag}>${items}</${tag}>`;
      }
      if (b.type === "image") {
        return `<p><em>${xmlEscape(b.text)}</em></p>`;
      }
      return `<p>${xmlEscape(b.text)}</p>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="de" lang="de">
<head>
  <meta charset="UTF-8" />
  <title>${xmlEscape(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<h1 id="${anchor}">${xmlEscape(chapterHeading(chapter, chapter.number ? chapter.number - 1 : 0))}</h1>
<p><em>${xmlEscape(bookTitle)}</em></p>
${body}
</body>
</html>`;
}

/** Titelblatt als eigenständiges XHTML (EPUB). */
export function buildEpubTitleXhtml(title: string, author: string, year: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="de" lang="de">
<head>
  <meta charset="UTF-8" />
  <title>Titelblatt</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<h1 id="titel">${xmlEscape(title)}</h1>
<p>von ${xmlEscape(author)}</p>
<p>© ${year} ${xmlEscape(author)}</p>
<p>Alle Rechte vorbehalten.</p>
</body>
</html>`;
}

export function xmlEscape(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  }[c]!));
}