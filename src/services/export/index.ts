// Export-Service: DOCX, MD, TXT, PDF, EPUB aus TipTap-JSON.
// KDP-Ready: vollständige EPUBs mit CSS, PDF mit Seitenzahlen, DOCX mit Styles.
import { listChapters, getChapter } from "@/services/project";
import { buildCommentAppendix } from "@/services/collaboration/sharing";
import type { Project } from "@/types/project";
import { PAGE_SIZES, mmToPt, type PrintLayout } from "@/services/printlayout";

type Format = "docx" | "md" | "txt" | "pdf" | "epub";

/** Wandelt TipTap-JSON in strukturierte Blöcke (für docx/pdf). */
interface Block {
  type: "h1" | "h2" | "h3" | "p" | "quote" | "list_item" | "code" | "image";
  text: string;
  ordered?: boolean;
  items?: Block[];
}

function toBlocks(json: string): Block[] {
  let doc: any;
  try {
    doc = JSON.parse(json || "{}");
  } catch {
    return [];
  }
  const out: Block[] = [];
  walk(doc, out);
  return out;
}

function walk(node: any, out: Block[]) {
  if (!node || !node.content) return;
  for (const child of node.content) {
    if (child.type === "heading") {
      const lvl = child.attrs?.level ?? 1;
      out.push({ type: `h${lvl}` as any, text: textOf(child) });
    } else if (child.type === "blockquote") {
      out.push({ type: "quote", text: textOf(child) });
    } else if (child.type === "paragraph") {
      const t = textOf(child);
      if (t.trim()) out.push({ type: "p", text: t });
    } else if (child.type === "bullet_list" || child.type === "ordered_list") {
      const items: Block[] = [];
      if (child.content) {
        for (const item of child.content) {
          if (item.type === "list_item") {
            const t = textOf(item);
            if (t.trim()) items.push({ type: "list_item", text: t });
          }
        }
      }
      if (items.length > 0) {
        out.push({ type: "list_item", text: "", ordered: child.type === "ordered_list", items });
      }
    } else if (child.type === "code_block") {
      const t = textOf(child);
      if (t.trim()) out.push({ type: "code", text: t });
    } else if (child.type === "image") {
      const src = child.attrs?.src ?? "";
      if (src) out.push({ type: "image", text: `[Bild: ${src}]` });
    } else {
      walk(child, out);
    }
  }
}

function textOf(node: any): string {
  if (node.type === "text") return node.text || "";
  if (!node.content) return "";
  return node.content.map(textOf).join("");
}

// --- DOCX ------------------------------------------------------------------

async function toDocx(blocks: Block[], title: string): Promise<Blob> {
  const {
    Document, Packer, Paragraph, HeadingLevel, TextRun,
    AlignmentType, convertInchesToTwip,
  } = await import("docx");
  const children = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  for (const b of blocks) {
    if (b.type === "h1") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, bold: true, size: 32, color: "1A2E44" })],
        spacing: { before: 300, after: 120 }
      }));
    } else if (b.type === "h2") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, bold: true, size: 26, color: "1A2E44" })],
        spacing: { before: 240, after: 100 }
      }));
    } else if (b.type === "h3") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, bold: true, size: 22, color: "333333" })],
        spacing: { before: 200, after: 80 }
      }));
    } else if (b.type === "quote") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, italics: true, color: "666666" })],
        indent: { left: convertInchesToTwip(0.5) },
        spacing: { before: 80, after: 80 },
      }));
    } else if (b.type === "code") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, font: "Courier New", size: 20, color: "333333" })],
        spacing: { before: 80, after: 80 },
      }));
    } else if (b.type === "list_item" && b.items) {
      for (let i = 0; i < b.items.length; i++) {
        const prefix = b.ordered ? `${i + 1}. ` : "• ";
        children.push(new Paragraph({
          children: [new TextRun({ text: prefix + b.items[i].text })],
          indent: { left: convertInchesToTwip(0.3) },
        }));
      }
    } else if (b.type === "image") {
      children.push(new Paragraph({
        children: [new TextRun({ text: b.text, italics: true, color: "999999" })],
      }));
    } else {
      children.push(new Paragraph({ children: [new TextRun(b.text)], spacing: { after: 80 } }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
  const buf = await Packer.toBlob(doc);
  return buf;
}

// --- PDF -------------------------------------------------------------------

/** PDF-Layout-Optionen (aus dem PrintLayout-Service, alles optional). */
export interface PdfLayoutOptions {
  /** Seitenmaße in PDF-Punkten (Standard A4). */
  pageWidthPt?: number;
  pageHeightPt?: number;
  /** Seitenränder in PDF-Punkten (Standard 50). */
  marginPt?: { top: number; right: number; bottom: number; left: number };
  /** Schrift: "serif" (Times) | "sans" (Helvetica) | "mono" (Courier). */
  fontFamily?: "serif" | "sans" | "mono";
  fontSizePt?: number;
  /** Zeilenhöhe als Vielfaches der Schriftgröße. */
  lineHeight?: number;
  paragraphAlign?: "left" | "justify";
  firstLineIndentPt?: number;
  paragraphSpacingPt?: number;
  /** Kopf-/Fußzeilen mit Tokens {title}, {author}, {page}. */
  header?: { left?: string; center?: string; right?: string };
  footer?: { left?: string; center?: string; right?: string };
  hfFontSizePt?: number;
}

async function toPdf(blocks: Block[], title: string, options: PdfLayoutOptions = {}): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const PDF_FONTS: Record<
    NonNullable<PdfLayoutOptions["fontFamily"]>,
    { regular: string; bold: string; mono: string }
  > = {
    serif: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold, mono: StandardFonts.Courier },
    sans: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, mono: StandardFonts.Courier },
    mono: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold, mono: StandardFonts.Courier },
  };

  const {
    pageWidthPt = 595.28,
    pageHeightPt = 841.89,
    marginPt = { top: 50, right: 50, bottom: 50, left: 50 },
    fontFamily = "serif",
    fontSizePt = 12,
    lineHeight = 1.5,
    paragraphAlign = "left",
    firstLineIndentPt = 0,
    paragraphSpacingPt = 6,
    header,
    footer,
    hfFontSizePt = 9,
  } = options;
  const pdf = await PDFDocument.create();
  const f = PDF_FONTS[fontFamily];
  const font = await pdf.embedFont(f.regular);
  const bold = await pdf.embedFont(f.bold);
  const mono = await pdf.embedFont(f.mono);
  const maxWidth = pageWidthPt - marginPt.left - marginPt.right;
  let page = pdf.addPage([pageWidthPt, pageHeightPt]);
  let y = pageHeightPt - marginPt.top;
  let pageNum = 1;

  const drawHf = (p: any, num: number) => {
    const ctx = { title, author: "", page: num };
    const size = hfFontSizePt;
    const hfY = pageHeightPt - marginPt.top + 14;
    const ftY = marginPt.bottom - 14;
    const color = rgb(0.5, 0.5, 0.5);
    const drawLine = (tpl: string | undefined, x: number, yy: number, align: "l" | "c" | "r") => {
      if (!tpl) return;
      const s = tpl.replace(/\{title\}/g, ctx.title).replace(/\{author\}/g, ctx.author).replace(/\{page\}/g, String(num));
      if (!s.trim()) return;
      let xx = x;
      if (align === "c") xx = pageWidthPt / 2 - font.widthOfTextAtSize(s, size) / 2;
      if (align === "r") xx = pageWidthPt - marginPt.right - font.widthOfTextAtSize(s, size);
      p.drawText(s, { x: xx, y: yy, size, font, color });
    };
    if (header) {
      drawLine(header.left, marginPt.left, hfY, "l");
      drawLine(header.center, marginPt.left, hfY, "c");
      drawLine(header.right, marginPt.left, hfY, "r");
    }
    if (footer) {
      drawLine(footer.left, marginPt.left, ftY, "l");
      drawLine(footer.center, marginPt.left, ftY, "c");
      drawLine(footer.right, marginPt.left, ftY, "r");
    }
  };

  const newPage = () => {
    drawHf(page, pageNum);
    page = pdf.addPage([pageWidthPt, pageHeightPt]);
    y = pageHeightPt - marginPt.top;
    pageNum++;
  };

  page.drawText(title, { x: marginPt.left, y: pageHeightPt / 2, size: fontSizePt * 2, font: bold, color: rgb(0, 0, 0) });

  for (const b of blocks) {
    if (y < marginPt.bottom + fontSizePt) newPage();

    let fnt = font;
    let size = fontSizePt;
    const spacing = paragraphSpacingPt;
    let indent = paragraphAlign === "justify" || firstLineIndentPt > 0 ? firstLineIndentPt : 0;
    if (b.type === "h1") { fnt = bold; size = Math.round(fontSizePt * 1.7); indent = 0; }
    else if (b.type === "h2") { fnt = bold; size = Math.round(fontSizePt * 1.35); indent = 0; }
    else if (b.type === "h3") { fnt = bold; size = Math.round(fontSizePt * 1.15); indent = 0; }
    else if (b.type === "code") { fnt = mono; size = Math.round(fontSizePt * 0.85); indent = 0; }
    else if (b.type === "quote") { indent = 18; }

    const lh = size * lineHeight + (b.type === "p" ? spacing : 0);
    const textToRender = b.type === "list_item" && b.items
      ? b.items.map((it, i) => (b.ordered ? `${i + 1}. ` : "• ") + it.text).join("\n")
      : b.text;
    const lines = wrap(textToRender, size, fnt, maxWidth - indent);
    const alignJustify = b.type === "p" && paragraphAlign === "justify";

    for (let li = 0; li < lines.length; li++) {
      if (y < marginPt.bottom + fontSizePt) newPage();
      const line = lines[li];
      const x = marginPt.left + (li === 0 ? indent : 0);
      if (alignJustify && li < lines.length - 1 && line.includes(" ")) {
        // Flattersatz: Wortzwischenräume gleichmäßig verteilen.
        const words = line.split(/\s+/);
        const naturalWidth = words.reduce((w, wd) => w + fnt.widthOfTextAtSize(wd, size), 0) + (words.length - 1) * fnt.widthOfTextAtSize(" ", size);
        const gap = (maxWidth - indent - naturalWidth) / Math.max(words.length - 1, 1);
        let xx = x;
        for (const wd of words) {
          page.drawText(wd, { x: xx, y, size, font: fnt, color: rgb(0, 0, 0) });
          xx += fnt.widthOfTextAtSize(wd, size) + fnt.widthOfTextAtSize(" ", size) + gap;
        }
      } else {
        page.drawText(line, { x, y, size, font: fnt, color: rgb(0, 0, 0) });
      }
      y -= lh;
    }
    y -= 6;
  }
  drawHf(page, pageNum);

  const buf = await pdf.save();
  return new Blob([buf as BlobPart], { type: "application/pdf" });
}

function wrap(text: string, fontSize: number, font: any, maxWidth: number): string[] {
  const allLines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (cur) allLines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) allLines.push(cur);
  }
  return allLines;
}

// --- MD / TXT --------------------------------------------------------------

function toMd(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.type === "h1") return `# ${b.text}`;
    if (b.type === "h2") return `## ${b.text}`;
    if (b.type === "h3") return `### ${b.text}`;
    if (b.type === "quote") return `> ${b.text}`;
    if (b.type === "code") return `\`\`\`\n${b.text}\n\`\`\``;
    if (b.type === "list_item" && b.items) {
      return b.items.map((it, i) => (b.ordered ? `${i + 1}. ` : "- ") + it.text).join("\n");
    }
    return b.text;
  }).join("\n\n");
}

function toTxt(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.type === "list_item" && b.items) {
      return b.items.map((it, i) => (b.ordered ? `${i + 1}. ` : "• ") + it.text).join("\n");
    }
    return b.text;
  }).join("\n\n");
}

// --- EPUB ------------------------------------------------------------------

const EPUB_CSS = `body { font-family: Georgia, serif; line-height: 1.6; margin: 5%; color: #333; }
h1 { font-size: 1.8em; margin-top: 1.5em; margin-bottom: 0.5em; page-break-before: always; }
h1:first-child { page-break-before: avoid; }
h2 { font-size: 1.4em; margin-top: 1.2em; }
h3 { font-size: 1.2em; margin-top: 1em; }
p { margin: 0.5em 0; text-align: justify; }
blockquote { margin: 1em 2em; padding-left: 1em; border-left: 3px solid #ccc; font-style: italic; color: #555; }
code, pre { font-family: "Courier New", monospace; background: #f4f4f4; padding: 0.2em 0.4em; font-size: 0.9em; }
pre { padding: 1em; overflow-x: auto; }
ul, ol { margin: 0.5em 0; padding-left: 2em; }
img { max-width: 100%; height: auto; }
`;

async function toEpub(blocks: Block[], title: string, author: string = "Autor"): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");

  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const bodyHtml = blocks.map((b) => {
    if (b.type === "h1") return `<h1>${escapeXml(b.text)}</h1>`;
    if (b.type === "h2") return `<h2>${escapeXml(b.text)}</h2>`;
    if (b.type === "h3") return `<h3>${escapeXml(b.text)}</h3>`;
    if (b.type === "quote") return `<blockquote>${escapeXml(b.text)}</blockquote>`;
    if (b.type === "code") return `<pre><code>${escapeXml(b.text)}</code></pre>`;
    if (b.type === "list_item" && b.items) {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items.map((it) => `<li>${escapeXml(it.text)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    if (b.type === "image") return `<p><img src="${escapeXml(b.text)}" /></p>`;
    return `<p>${escapeXml(b.text)}</p>`;
  }).join("\n");

  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="de" lang="de">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>de</dc:language>
    <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:date>${new Date().toISOString().split("T")[0]}</dc:date>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>`;

  zip.file("OEBPS/content.xhtml", xhtml);
  zip.file("OEBPS/content.opf", contentOpf);
  zip.file("OEBPS/styles.css", EPUB_CSS);

  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Blob([buf as BlobPart], { type: "application/epub+zip" });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}

// --- Download --------------------------------------------------------------

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Re-exports für KDP-Packaging ------------------------------------------

export { toBlocks, toDocx, toPdf, toEpub, toMd };
export type { Block };

// --- Öffentliche API -------------------------------------------------------

export interface ExportOptions {
  /** Fortschritt in Prozent (0-100) — für UI-Feedback bei langen Exports. */
  onProgress?: (percent: number, label: string) => void;
  /** Autor für EPUB-Metadaten */
  author?: string;
  /** Hängt die Kommentare als Anhang "Anmerkungen" an den Export an. */
  includeComments?: boolean;
  /** PDF-Layout (Seitenformat, Ränder, Typografie, Kopf-/Fußzeilen). */
  pdf?: PdfLayoutOptions;
}

/** Wandelt PrintLayout-Einstellungen (mm) in PDF-Optionen (pt) um. */
export function printLayoutToPdfOptions(layout: PrintLayout): PdfLayoutOptions {
  const page = PAGE_SIZES[layout.pageSize];
  const hf = layout.headerFooter;
  return {
    pageWidthPt: mmToPt(page.widthMm),
    pageHeightPt: mmToPt(page.heightMm),
    marginPt: {
      top: mmToPt(layout.margins.top),
      right: mmToPt(layout.margins.right),
      bottom: mmToPt(layout.margins.bottom),
      left: mmToPt(layout.margins.left),
    },
    fontFamily: layout.typography.fontFamily,
    fontSizePt: layout.typography.fontSizePt,
    lineHeight: layout.typography.lineHeight,
    paragraphAlign: layout.typography.paragraphAlign,
    firstLineIndentPt: mmToPt(layout.typography.firstLineIndentMm),
    paragraphSpacingPt: layout.typography.paragraphSpacingPt,
    header: hf.headerEnabled
      ? { left: hf.headerLeft, center: hf.headerCenter, right: hf.headerRight }
      : undefined,
    footer: hf.footerEnabled
      ? { left: hf.footerLeft, center: hf.footerCenter, right: hf.footerRight }
      : undefined,
    hfFontSizePt: hf.fontSizePt,
  };
}

/** Exportiert ein Kapitel oder das ganze Projekt. */
export async function exportProject(
  project: Project,
  format: Format,
  chapterId?: string,
  options: ExportOptions = {},
): Promise<void> {
  const { onProgress, author } = options;
  let title = project.name;
  let blocks: Block[] = [];

  if (chapterId) {
    const ch = getChapter(chapterId);
    if (!ch) return;
    title = ch.title;
    blocks = toBlocks(ch.content);
    if (options.includeComments) blocks.push(...buildCommentAppendix(chapterId, ch.title));
  } else {
    const chapters = listChapters(project.id);
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      onProgress?.(Math.round((i / chapters.length) * 30), `Kapitel "${c.title}" wird gelesen…`);
      blocks.push({ type: "h1", text: c.title });
      blocks.push(...toBlocks(c.content));
      if (options.includeComments) blocks.push(...buildCommentAppendix(c.id, c.title));
    }
  }

  onProgress?.(40, "Export wird erstellt…");
  const pdfOpts = options.pdf;

  let blob: Blob;
  let ext: string;
  switch (format) {
    case "docx":
      blob = await toDocx(blocks, title);
      ext = "docx";
      break;
    case "pdf":
      blob = await toPdf(blocks, title, pdfOpts);
      ext = "pdf";
      break;
    case "md":
      blob = new Blob([toMd(blocks)], { type: "text/markdown" });
      ext = "md";
      break;
    case "txt":
      blob = new Blob([toTxt(blocks)], { type: "text/plain" });
      ext = "txt";
      break;
    case "epub":
      blob = await toEpub(blocks, title, author);
      ext = "epub";
      break;
  }

  onProgress?.(90, "Datei wird heruntergeladen…");
  download(blob!, `${title}.${ext}`);
  onProgress?.(100, "Export fertig.");
}

/** Export eines einzelnen Editor-Inhalts (Insel-Export). */
export async function exportContent(
  json: string,
  title: string,
  format: Format,
  options: ExportOptions = {},
): Promise<void> {
  const { onProgress, author } = options;
  onProgress?.(20, "Inhalt wird verarbeitet…");
  const blocks = toBlocks(json);
  onProgress?.(50, "Export wird erstellt…");
  const pdfOpts = options.pdf;

  let blob: Blob;
  let ext: string;
  switch (format) {
    case "docx":
      blob = await toDocx(blocks, title);
      ext = "docx";
      break;
    case "pdf":
      blob = await toPdf(blocks, title, pdfOpts);
      ext = "pdf";
      break;
    case "md":
      blob = new Blob([toMd(blocks)], { type: "text/markdown" });
      ext = "md";
      break;
    case "txt":
      blob = new Blob([toTxt(blocks)], { type: "text/plain" });
      ext = "txt";
      break;
    case "epub":
      blob = await toEpub(blocks, title, author);
      ext = "epub";
      break;
  }

  onProgress?.(90, "Datei wird heruntergeladen…");
  download(blob!, `${title}.${ext}`);
  onProgress?.(100, "Export fertig.");
}

export type { Format };

// --- Multi-Platform-Publishing (Smashwords / Draft2Digital / Kobo) ----------
export {
  buildPublishPackage,
  buildAllPublishPackages,
  downloadPublishBundle,
} from "./publishing";
export type { PublishPlatform, PublishMetadata, PublishPackage } from "./publishing";
