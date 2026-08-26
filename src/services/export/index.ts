// Export-Service: DOCX, MD, TXT, PDF, EPUB aus TipTap-JSON.
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import { listChapters, getChapter } from "@/services/project";
import type { Project } from "@/types/project";

type Format = "docx" | "md" | "txt" | "pdf" | "epub";

/** Wandelt TipTap-JSON in strukturierte Blöcke (für docx/pdf). */
interface Block { type: "h1" | "h2" | "h3" | "p" | "quote"; text: string; }
function toBlocks(json: string): Block[] {
  const doc = JSON.parse(json || "{}");
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

async function toDocx(blocks: Block[], title: string): Promise<Blob> {
  const ps = blocks.map((b) => {
    const run = new TextRun(b.text);
    if (b.type === "h1") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1 });
    if (b.type === "h2") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2 });
    if (b.type === "h3") return new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_3 });
    if (b.type === "quote") return new Paragraph({ children: [new TextRun({ text: b.text, italics: true })] });
    return new Paragraph({ children: [run] });
  });
  const doc = new Document({ sections: [{ children: [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), ...ps] }] });
  const buf = await Packer.toBlob(doc);
  return buf;
}

async function toPdf(blocks: Block[]): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage();
  const height = page.getSize().height;
  let y = height - 50;
  const fs = 12;
  const lh = 18;
  for (const b of blocks) {
    if (y < 50) { page = pdf.addPage(); y = height - 50; }
    const f = b.type.startsWith("h") ? bold : font;
    const size = b.type === "h1" ? 20 : b.type === "h2" ? 16 : b.type === "h3" ? 14 : fs;
    const lines = wrap(b.text, 90);
    for (const line of lines) {
      if (y < 50) { page = pdf.addPage(); y = height - 50; }
      page.drawText(line, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
      y -= lh;
    }
    y -= 6;
  }
  const buf = await pdf.save();
  return new Blob([buf as BlobPart], { type: "application/pdf" });
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).length > max) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function toMd(blocks: Block[]): string {
  return blocks.map((b) => {
    if (b.type === "h1") return `# ${b.text}`;
    if (b.type === "h2") return `## ${b.text}`;
    if (b.type === "h3") return `### ${b.text}`;
    if (b.type === "quote") return `> ${b.text}`;
    return b.text;
  }).join("\n\n");
}

function toTxt(blocks: Block[]): string {
  return blocks.map((b) => b.text).join("\n\n");
}

async function toEpub(blocks: Block[], title: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></rootfiles>`);
  const xhtml = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body>${blocks.map((b) => `<${b.type.startsWith("h") ? b.type : "p"}>${escapeXml(b.text)}</${b.type.startsWith("h") ? b.type : "p"}>`).join("")}</body></html>`;
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title></metadata><manifest><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="content"/></spine></package>`);
  zip.file("OEBPS/content.xhtml", xhtml);
  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Blob([buf as BlobPart], { type: "application/epub+zip" });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exportiert ein Kapitel oder das ganze Projekt. */
export async function exportProject(project: Project, format: Format, chapterId?: string): Promise<void> {
  let title = project.name;
  let blocks: Block[] = [];
  if (chapterId) {
    const ch = getChapter(chapterId);
    if (!ch) return;
    title = ch.title;
    blocks = toBlocks(ch.content);
  } else {
    for (const c of listChapters(project.id)) {
      blocks.push({ type: "h1", text: c.title });
      blocks.push(...toBlocks(c.content));
    }
  }

  let blob: Blob;
  let ext: string;
  switch (format) {
    case "docx": blob = await toDocx(blocks, title); ext = "docx"; break;
    case "pdf": blob = await toPdf(blocks); ext = "pdf"; break;
    case "md": blob = new Blob([toMd(blocks)], { type: "text/markdown" }); ext = "md"; break;
    case "txt": blob = new Blob([toTxt(blocks)], { type: "text/plain" }); ext = "txt"; break;
    case "epub": blob = await toEpub(blocks, title); ext = "epub"; break;
  }
  download(blob!, `${title}.${ext}`);
}

/** Export eines einzelnen Editor-Inhalts (Insel-Export). */
export async function exportContent(json: string, title: string, format: Format): Promise<void> {
  const blocks = toBlocks(json);
  let blob: Blob;
  let ext: string;
  switch (format) {
    case "docx": blob = await toDocx(blocks, title); ext = "docx"; break;
    case "pdf": blob = await toPdf(blocks); ext = "pdf"; break;
    case "md": blob = new Blob([toMd(blocks)], { type: "text/markdown" }); ext = "md"; break;
    case "txt": blob = new Blob([toTxt(blocks)], { type: "text/plain" }); ext = "txt"; break;
    case "epub": blob = await toEpub(blocks, title); ext = "epub"; break;
  }
  download(blob!, `${title}.${ext}`);
}

export type { Format };
