// Buch-DOCX (KDP-Struktur): Titelblatt, Impressum, klickbares Inhaltsverzeichnis
// (Interne Hyperlinks auf Kapitel-Bookmarks), Kapitel jeweils auf neuer Seite
// (pageBreakBefore). Kapitelüberschriften als echte Heading1-Styles.
//
// Sprint 3 (Agent 3) — Profi-Workflow:
//  - Standardisierte Formatvorlagen: Heading1, Heading2, Standard (Fließtext),
//    Einzug (Zitate/Listen) — verlustfrei in Scrivener 3 und LibreOffice.
//  - Dokument-Metadaten (Core Properties: Titel, Autor, Keywords).
//  - VBA-Integration: Custom Properties + Custom XML Part (vba.ts) für die
//    externen "AI Text Refinement Suites" inkl. versteckter Kapitel-Tags.

import type { Block } from "@/services/export/blocks";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
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
import {
  buildAiwsCustomProperties,
  buildAiwsCustomXml,
  aiwsHiddenTagFor,
} from "./vba";

function anchorFor(index: number): string {
  return `_kapitel_${index + 1}`;
}

/** Ein Block (bzw. Block-Gruppe) → DOCX-Paragraphen (über Formatvorlagen). */
function blockToParagraphs(b: Block): Paragraph[] {
  if (b.type === "h1") {
    return [new Paragraph({ text: b.text, style: "Heading1" })];
  }
  if (b.type === "h2") {
    return [new Paragraph({ text: b.text, style: "Heading2" })];
  }
  if (b.type === "h3") {
    return [new Paragraph({ text: b.text, style: "Heading2" })];
  }
  if (b.type === "quote") {
    return [new Paragraph({ text: b.text, style: "Einzug" })];
  }
  if (b.type === "code") {
    return [new Paragraph({
      children: [new TextRun({ text: b.text, font: "Courier New", size: 20, color: "333333" })],
      spacing: { before: 80, after: 80 },
    })];
  }
  if (b.type === "list_item" && b.items) {
    return b.items.map((it) => new Paragraph({
      children: [new TextRun({ text: it.text })],
      style: "Einzug",
    }));
  }
  if (b.type === "image") {
    return [new Paragraph({ text: b.text, style: "Standard" })];
  }
  return [new Paragraph({ text: b.text, style: "StandardEingerückt" })];
}

/** Standardisierte Formatvorlagen (deutsche Namen, Word/LibreOffice/Scrivener). */
function bookStyles() {
  return {
    default: {
      document: {
        run: { font: "Georgia", size: 24 },
      },
    },
    paragraphStyles: [
      {
        id: "Standard",
        name: "Standard",
        basedOn: "Normal",
        next: "Standard",
        quickFormat: true,
        paragraph: { spacing: { after: 160, line: 276 } },
      },
      {
        id: "Einzug",
        name: "Einzug",
        basedOn: "Standard",
        next: "Standard",
        quickFormat: true,
        paragraph: {
          indent: { left: convertInchesToTwip(0.5), firstLine: convertInchesToTwip(0.3) },
          spacing: { before: 80, after: 80 },
        },
        run: { italics: true, color: "666666" },
      },
      {
        id: "StandardEingerückt",
        name: "Standard Eingerückt",
        basedOn: "Standard",
        next: "Standard",
        quickFormat: true,
        paragraph: {
          indent: { firstLine: convertInchesToTwip(0.3) },
          spacing: { after: 0, line: 276 },
        },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Standard",
        quickFormat: true,
        paragraph: {
          spacing: { before: 300, after: 120 },
          outlineLevel: 0,
          keepNext: true,
        },
        run: { size: 32, bold: true, color: "1A2E44" },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Standard",
        quickFormat: true,
        paragraph: {
          spacing: { before: 240, after: 100 },
          outlineLevel: 1,
          keepNext: true,
        },
        run: { size: 26, bold: true, color: "1A2E44" },
      },
    ],
  };
}

export async function buildBookDocxBlob(
  meta: { title: string; author: string; language?: string },
  chapters: BookChapterInput[],
  blocksPerChapter: Block[][],
): Promise<Blob> {
  const year = new Date().getFullYear();
  const children: Paragraph[] = [];

  // --- Titelblatt (eigene Seite) ---
  const titleBlocks = buildTitlePageBlocks(meta.title, meta.author, year);
  for (const b of titleBlocks) {
    if (b.type === "h1") {
      children.push(new Paragraph({
        text: b.text,
        style: "Heading1",
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        run: { size: 56 },
      }));
    } else {
      children.push(new Paragraph({ text: b.text, style: "Standard", alignment: AlignmentType.CENTER }));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- Impressum (eigene Seite) ---
  children.push(new Paragraph({ text: "Impressum", style: "Heading1" }));
  children.push(new Paragraph({
    text: `© ${year} ${meta.author}. Alle Rechte vorbehalten.`,
    style: "Standard",
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text:
        "Dieses Werk einschließlich seiner Inhalte ist urheberrechtlich geschützt. " +
        "Jede Verwertung außerhalb der Grenzen des Urheberrechtsgesetzes ist ohne " +
        "Zustimmung des Autors unzulässig und strafbar.",
    })],
    style: "Standard",
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // --- Klickbares Inhaltsverzeichnis (eigene Seite) ---
  children.push(new Paragraph({ text: "Inhaltsverzeichnis", style: "Heading1" }));
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
      style: "Standard",
      spacing: { after: 60 },
    }));
  });

  // --- Kapitel: jede beginnt auf neuer Seite, Heading1 + Bookmark + Hidden-Tag ---
  chapters.forEach((c, i) => {
    const headingText = normalizeTypography(chapterHeading(c, i));
    children.push(new Paragraph({
      style: "Heading1",
      pageBreakBefore: true,
      children: [new Bookmark({
        id: anchorFor(i),
        children: [new TextRun({ text: headingText, bold: true, size: 32, color: "1A2E44" })],
      }) as unknown as ParagraphChild],
    }));
    // Versteckter AIWS-Tag direkt nach der Kapitelüberschrift (VBA-Anker)
    children.push(new Paragraph({
      children: [new TextRun({ text: aiwsHiddenTagFor(c.number ?? i + 1) })],
      style: "Standard",
    }));
    for (const b of normalizedChapterBlocks(blocksPerChapter[i] ?? [])) {
      children.push(...blockToParagraphs(b));
    }
  });

  // --- VBA-Metadaten: Custom Properties + Custom XML Part ---
  const aiwsXml = buildAiwsCustomXml(
    meta,
    chapters.map((c, i) => ({
      number: c.number ?? i + 1,
      title: c.title,
      status: c.status,
      text: normalizeTypography(
        (blocksPerChapter[i] ?? []).map((b) => b.text).filter(Boolean).join(" "),
      ),
    })),
  );
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const doc = new Document({
    creator: meta.author,
    title: meta.title,
    description: `Exportiert mit AI Writer Studio — ${chapters.length} Kapitel`,
    keywords: "AI Text Refinement Suites, AI Writer Studio, Book-Export",
    customProperties: buildAiwsCustomProperties(chapters.length),
    styles: bookStyles(),
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);

  // Custom XML Part nachrüsten: das docx-Paket unterstützt keine customXml/-
  // Parts, daher ZIP-Nachbearbeitung mit JSZip (bereits Dependency).
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  zip.file("customXml/item1.xml", aiwsXml);
  zip.file(
    "customXml/itemProps1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ds:datastoreItem ds:itemID="{${uuid}}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"/>`,
  );

  const ct = await zip.file("[Content_Types].xml")!.async("string");
  const ctOverrides = [
    `<Override PartName="/customXml/item1.xml" ContentType="application/xml"/>`,
    `<Override PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/>`,
  ].join("");
  zip.file("[Content_Types].xml", ct.replace("</Types>", `${ctOverrides}</Types>`));

  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Blob([buf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
