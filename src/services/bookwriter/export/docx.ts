// Buch-DOCX (KDP-Struktur): Titelblatt, Impressum, klickbares Inhaltsverzeichnis
// (Interne Hyperlinks auf Kapitel-Bookmarks), Kapitel jeweils auf neuer Seite
// (pageBreakBefore). Kapitelüberschriften als echte Heading1-Styles.

import type { Block } from "@/services/export/blocks";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  InternalHyperlink, Bookmark, PageBreak, convertInchesToTwip,
} from "docx";
import type { ParagraphChild } from "docx";
import type { BookChapterInput } from "./types";
import {
  buildTitlePageBlocks,
  chapterHeading,
  normalizedChapterBlocks,
} from "./structure";
import { normalizeTypography } from "./typography";

function anchorFor(index: number): string {
  return `_kapitel_${index + 1}`;
}

/** Ein Block (bzw. Block-Gruppe) → DOCX-Paragraphen. */
function blockToParagraphs(b: Block): Paragraph[] {
  if (b.type === "h1") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, bold: true, size: 32, color: "1A2E44" })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
    })];
  }
  if (b.type === "h2") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, bold: true, size: 26, color: "1A2E44" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
    })];
  }
  if (b.type === "h3") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, bold: true, size: 22, color: "333333" })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 80 },
    })];
  }
  if (b.type === "quote") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, italics: true, color: "666666" })],
      indent: { left: convertInchesToTwip(0.5) },
      spacing: { before: 80, after: 80 },
    })];
  }
  if (b.type === "code") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, font: "Courier New", size: 20, color: "333333" })],
      spacing: { before: 80, after: 80 },
    })];
  }
  if (b.type === "list_item" && b.items) {
    return b.items.map((it, i) => new Paragraph({
      children: [new TextRun({ text: (b.ordered ? `${i + 1}. ` : "• ") + it.text })],
      indent: { left: convertInchesToTwip(0.3) },
    }));
  }
  if (b.type === "image") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, italics: true, color: "999999" })],
    })];
  }
  return [new Paragraph({
    children: [new TextRun({ text: b.text })],
    spacing: { after: 80 },
  })];
}

export async function buildBookDocxBlob(
  meta: { title: string; author: string },
  chapters: BookChapterInput[],
  blocksPerChapter: Block[][],
): Promise<Blob> {
  const year = new Date().getFullYear();
  const children: Paragraph[] = [];

  // --- Titelblatt (eigene Seite) ---
  const titleBlocks = buildTitlePageBlocks(meta.title, meta.author, year);
  for (const b of titleBlocks) {
    const ps = blockToParagraphs(b);
    if (b.type === "h1") {
      ps[0] = new Paragraph({
        children: [new TextRun({ text: b.text, bold: true, size: 56, color: "1A2E44" })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      });
    }
    children.push(...ps);
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- Impressum (eigene Seite) ---
  children.push(new Paragraph({
    children: [new TextRun({ text: "Impressum", bold: true, size: 26 })],
    heading: HeadingLevel.HEADING_1,
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `© ${year} ${meta.author}. Alle Rechte vorbehalten.` })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text:
        "Dieses Werk einschließlich seiner Inhalte ist urheberrechtlich geschützt. " +
        "Jede Verwertung außerhalb der Grenzen des Urheberrechtsgesetzes ist ohne " +
        "Zustimmung des Autors unzulässig und strafbar.",
    })],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- Klickbares Inhaltsverzeichnis (eigene Seite) ---
  children.push(new Paragraph({
    children: [new TextRun({ text: "Inhaltsverzeichnis", bold: true, size: 26 })],
    heading: HeadingLevel.HEADING_1,
  }));
  chapters.forEach((c, i) => {
    children.push(new Paragraph({
      children: [new InternalHyperlink({
        anchor: anchorFor(i),
        children: [new TextRun({
          text: normalizeTypography(chapterHeading(c, i)),
          color: "0563C1",
          underline: {},
        })],
      })],
      spacing: { after: 60 },
    }));
  });

  // --- Kapitel: jede beginnt auf neuer Seite, Heading1 + Bookmark ---
  chapters.forEach((c, i) => {
    const headingText = normalizeTypography(chapterHeading(c, i));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new Bookmark({
        id: anchorFor(i),
        children: [new TextRun({ text: headingText, bold: true, size: 32, color: "1A2E44" })],
      }) as unknown as ParagraphChild],
    }));
    for (const b of normalizedChapterBlocks(blocksPerChapter[i] ?? [])) {
      children.push(...blockToParagraphs(b));
    }
  });

  const doc = new Document({
    creator: meta.author,
    title: meta.title,
    styles: {
      default: {
        heading1: { run: { size: 32, bold: true, color: "1A2E44" } },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}