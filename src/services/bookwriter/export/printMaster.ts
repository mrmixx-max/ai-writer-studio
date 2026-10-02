// WP 10.1 — EPUB3- und PDF-Print-Master-Service (lokal, deterministisch).
//
// Zwei Ausgabe-Pfade für den Buchsatz:
//   buildEpub3     → valides EPUB3-Archiv (mimetype unkomprimiert zuerst,
//                    META-INF/container.xml, OEBPS/content.opf, toc.xhtml/nav)
//   buildPrintPdf  → KDP-Druck-PDF mit Bundsteg (Bundsteg = Gutter), gespiegelten
//                    Rändern, Kolumnentiteln (running heads) und Paginierung
//   calculateGutter→ Bundsteg in mm nach KDP-Vorgabe (seitenzahlabhängig)
//
// Kein LLM, keine Netzwerk-/Tauri-Aufrufe, keine Zeitabhängigkeit außer der
// explizit übergebenen `now`-Option (Default: Date.now()). Fehlende oder
// kaputte Eingaben werden defensiv durch Defaults ersetzt, nie geworfen.
//
// Wiederverwendete Bausteine (keine Duplikation):
//   - toBlocks                    (TipTap-JSON → Block[])
//   - buildEpubChapterXhtml /
//     buildEpubTitleXhtml         (semantisches XHTML, Jutoh-optimiert)
//   - normalizedChapterBlocks     (Typografie-Normalisierung)
//   - PAGE_SIZES / mmToPt /
//     estimatePageCount           (printlayout-Service)
//   - JSZip + pdf-lib             (bereits Dependencies)

import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { toBlocks, type Block } from "@/services/export/blocks";
import {
  PAGE_SIZES,
  estimatePageCount,
  mmToPt,
  type PageSizeId,
} from "@/services/printlayout";
import {
  buildEpubChapterXhtml,
  buildEpubTitleXhtml,
  normalizedChapterBlocks,
} from "./structure";
import type { BookChapterInput } from "./types";
import { xmlEscape } from "./vba";

// ---------------------------------------------------------------------------
// Gemeinsame Helfer
// ---------------------------------------------------------------------------

/** Trimmt Strings defensiv; alles, was kein String ist, wird zu "". */
function safe(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** Ein Kapitel als "Kapitel N: Titel" (KDP-Konvention). */
function chapterHeading(chapter: BookChapterInput, index: number): string {
  return `Kapitel ${chapter.number ?? index + 1}: ${chapter.title}`;
}

/**
 * Normalisiert die Kapitelliste: entfernt ungültige Einträge, füllt fehlende
 * Nummern/Titel, erzwingt String-Inhalte. Liefert immer ein Array.
 */
export function normalizeChapters(
  chapters: BookChapterInput[] | null | undefined,
): BookChapterInput[] {
  if (!Array.isArray(chapters)) return [];
  return chapters
    .filter((c): c is BookChapterInput => !!c && typeof c === "object")
    .map((c, i) => ({
      number:
        typeof c.number === "number" && Number.isFinite(c.number)
          ? Math.floor(c.number)
          : i + 1,
      title: safe(c.title) || `Kapitel ${i + 1}`,
      content: typeof c.content === "string" ? c.content : "",
      status: c.status,
    }));
}

/**
 * Deterministische UUID (v4-förmig) aus einem Seed. Gleicher Seed → gleiche
 * UUID. Ersetzt crypto.randomUUID(), damit EPUB-Exporte reproduzierbar sind.
 */
export function stableUuid(seed: string): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x1000193 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c * 0x9e3779b1, 0x85ebca6b) >>> 0;
  }
  const part = (n: number) => n.toString(16).padStart(8, "0");
  const hex = (part(h1) + part(h2) + part(h1 ^ h2) + part((h1 + h2) >>> 0)).slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

// ---------------------------------------------------------------------------
// 1. EPUB3
// ---------------------------------------------------------------------------

export interface Epub3Options {
  title: string;
  author: string;
  /** BCP-47-Sprachcode (Default "de"). */
  language?: string;
  /** Optionales eigenes Stylesheet; sonst das eingebaute Print-CSS. */
  css?: string;
  /** Fixierter Zeitstempel (ms) für reproduzierbare Exporte (Default: Date.now()). */
  now?: number;
}

const DEFAULT_EPUB_CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; margin: 5%; color: #222; }
h1 { font-size: 1.8em; margin: 1.5em 0 0.5em; page-break-before: always; break-before: page; }
h2 { font-size: 1.4em; margin-top: 1.2em; }
h3 { font-size: 1.2em; margin-top: 1em; }
p { margin: 0.5em 0; text-align: justify; text-indent: 1.2em; }
p.noindent { text-indent: 0; text-align: left; }
blockquote { margin: 1em 2em; padding-left: 1em; border-left: 3px solid #ccc; font-style: italic; }
pre { font-family: "Courier New", monospace; background: #f4f4f4; padding: 1em; overflow-x: auto; font-size: 0.9em; }
ul, ol { margin: 0.5em 0; padding-left: 2em; }
h1.chapter-title { page-break-before: auto; break-before: auto; text-align: center; }
div.center { text-align: center; }
div.center p { text-align: center; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.4em 0; }
`;

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

interface EpubMeta {
  title: string;
  author: string;
  language: string;
  css: string;
  now: number;
  uuid: string;
}

function buildEpubOpf(meta: EpubMeta, chapters: BookChapterInput[]): string {
  const manifest: string[] = [
    `<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    `<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>`,
  ];
  const spine: string[] = [
    `<itemref idref="toc" linear="no"/>`,
    `<itemref idref="titlepage"/>`,
  ];

  chapters.forEach((c, i) => {
    const num = c.number ?? i + 1;
    manifest.push(
      `<item id="chap-${num}" href="kapitel-${num}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spine.push(`<itemref idref="chap-${num}"/>`);
  });

  const modified = new Date(meta.now).toISOString().replace(/\.\d+Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${xmlEscape(meta.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${meta.uuid}</dc:identifier>
    <dc:title>${xmlEscape(meta.title)}</dc:title>
    <dc:creator>${xmlEscape(meta.author)}</dc:creator>
    <dc:language>${xmlEscape(meta.language)}</dc:language>
    <dc:date>${new Date(meta.now).toISOString().slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${modified}</meta>
    <meta name="generator" content="AI Writer Studio (Print Master WP 10.1)"/>
  </metadata>
  <manifest>
${manifest.map((m) => `    ${m}`).join("\n")}
  </manifest>
  <spine>
${spine.map((s) => `    ${s}`).join("\n")}
  </spine>
</package>`;
}

function buildEpubTocXhtml(meta: EpubMeta, chapters: BookChapterInput[]): string {
  const lis = [
    `      <li><a href="titlepage.xhtml">Titelblatt</a></li>`,
    ...chapters.map((c, i) => {
      const num = c.number ?? i + 1;
      return `      <li><a href="kapitel-${num}.xhtml">${xmlEscape(chapterHeading(c, i))}</a></li>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEscape(meta.language)}" lang="${xmlEscape(meta.language)}">
<head>
  <meta charset="UTF-8" />
  <title>Inhaltsverzeichnis</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Inhaltsverzeichnis</h1>
  <ol>
${lis.join("\n")}
  </ol>
</nav>
</body>
</html>`;
}

/**
 * Erzeugt ein valides EPUB3-Archiv als Blob.
 *
 * Spec-Konformität: `mimetype` ist der erste Eintrag und UNKOMPRIMIERT (STORE);
 * `META-INF/container.xml` verweist auf `OEBPS/content.opf`; das Inhalts-
 * verzeichnis `OEBPS/toc.xhtml` ist als EPUB3-nav deklariert. Alle Zip-Einträge
 * erhalten denselben, fixierten Zeitstempel → identische Eingaben liefern
 * identische Bytes (sofern `now` gesetzt ist).
 */
export async function buildEpub3(
  chapters: BookChapterInput[],
  options: Epub3Options,
): Promise<Blob> {
  const list = normalizeChapters(chapters);
  const title = safe(options?.title) || "Unbenanntes Buch";
  const author = safe(options?.author) || "Unbekannter Autor";
  const language = safe(options?.language) || "de";
  const css =
    typeof options?.css === "string" && options.css.trim() ? options.css : DEFAULT_EPUB_CSS;
  const now =
    typeof options?.now === "number" && Number.isFinite(options.now) ? options.now : Date.now();

  const uuid = stableUuid(`${title}|${author}|${language}|${list.length}`);
  const meta: EpubMeta = { title, author, language, css, now, uuid };
  const zipDate = new Date(now);

  const zip = new JSZip();
  // mimetype MUSS erster Eintrag und unkomprimiert sein (EPUB-Spec/Calibre).
  zip.file("mimetype", "application/epub+zip", { compression: "STORE", date: zipDate });
  zip.file("META-INF/container.xml", containerXml(), { date: zipDate });

  zip.file("OEBPS/titlepage.xhtml", buildEpubTitleXhtml(title, author, new Date(now).getFullYear()), {
    date: zipDate,
  });

  list.forEach((c, i) => {
    const num = c.number ?? i + 1;
    const blocks = normalizedChapterBlocks(toBlocks(c.content));
    zip.file(
      `OEBPS/kapitel-${num}.xhtml`,
      buildEpubChapterXhtml(c, blocks, title),
      { date: zipDate },
    );
  });

  zip.file("OEBPS/toc.xhtml", buildEpubTocXhtml(meta, list), { date: zipDate });
  zip.file("OEBPS/content.opf", buildEpubOpf(meta, list), { date: zipDate });
  zip.file("OEBPS/styles.css", css, { date: zipDate });

  const buf = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
  return new Blob([buf as BlobPart], { type: "application/epub+zip" });
}

// ---------------------------------------------------------------------------
// 2. Bundsteg (Gutter)
// ---------------------------------------------------------------------------

/**
 * KDP-Bundsteg-Tabelle (Innensteg) in mm, abhängig von der Seitenzahl.
 * Quelle: Amazon-KDP-Satzvorgaben (Inches → mm).
 *   ≤150 → 0,375″ | ≤300 → 0,5″ | ≤500 → 0,625″ | ≤700 → 0,75″ | sonst 0,875″
 */
const KDP_GUTTER_BANDS_MM: { maxPages: number; gutterMm: number }[] = [
  { maxPages: 150, gutterMm: 0.375 * 25.4 },
  { maxPages: 300, gutterMm: 0.5 * 25.4 },
  { maxPages: 500, gutterMm: 0.625 * 25.4 },
  { maxPages: 700, gutterMm: 0.75 * 25.4 },
  { maxPages: Number.POSITIVE_INFINITY, gutterMm: 0.875 * 25.4 },
];

/**
 * Berechnet den Bundsteg (Innensteg) in mm für ein KDP-Druckbuch.
 *
 * @param pageCount  Seitenzahl (wird auf ≥1 geklemmt; ungültige Werte → 1).
 * @param paperType  "white" | "cream" (kein Zuschlag) | "color"/"premium-color"
 *                   (dickeres Papier → +1,5 mm, damit der Textblock sichtbar
 *                   bleibt). Unbekannte Werte erhalten keinen Zuschlag.
 * @returns Bundsteg in mm, auf 0,1 mm gerundet.
 */
export function calculateGutter(pageCount: number, paperType: string): number {
  const pages =
    typeof pageCount === "number" && Number.isFinite(pageCount)
      ? Math.max(1, Math.floor(pageCount))
      : 1;
  const band =
    KDP_GUTTER_BANDS_MM.find((b) => pages <= b.maxPages) ?? KDP_GUTTER_BANDS_MM[0];
  const pt = safe(paperType).toLowerCase();
  const colorBonus = pt === "color" || pt === "premium-color" || pt === "farbig" ? 1.5 : 0;
  return Math.round((band.gutterMm + colorBonus) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 3. Print-PDF
// ---------------------------------------------------------------------------

export interface PdfMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PdfOptions {
  title: string;
  author: string;
  /** Seitengröße: KDP-Id (z. B. "6x9") oder explizite Maße in mm. Default "6x9". */
  pageSize?: PageSizeId | { widthMm: number; heightMm: number };
  /** Außenränder in mm (Innensteg/Bundsteg wird addiert). Default 20/15/20/15. */
  margins?: Partial<PdfMarginsMm>;
  /** Papiertyp für die Bundsteg-Berechnung (Default "white"). */
  paperType?: string;
  /** Bundsteg in mm überschreiben (sonst aus Seitenzahl geschätzt). */
  gutterMm?: number;
  /** Fixierter Zeitstempel (ms) für die PDF-Metadaten (Default: Date.now()). */
  now?: number;
}

const DEFAULT_PDF_MARGINS_MM: PdfMarginsMm = { top: 20, right: 15, bottom: 20, left: 15 };
const BODY_FONT_SIZE_PT = 11;
const BODY_LINE_HEIGHT = 1.45;

/**
 * WinAnsi-sichere Ersetzung für die Standard-PDF-Fonts (Times/Helvetica/
 * Courier). Zeichen außerhalb von CP1252 (Emoji, CJK, Pfeile …) würden pdf-lib
 * beim Rendern abbrechen lassen; deutsche Typografie („ “ – … € ß) bleibt.
 */
function winAnsiSafe(s: string): string {
  return s.replace(/[\s\S]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (ch === "\n" || ch === "\t") return ch;
    if (code < 0x20 || code === 0x7f) return "";
    if (
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      ch === "€" || ch === "‚" || ch === "„" || ch === "…" || ch === "†" ||
      ch === "‡" || ch === "ˆ" || ch === "‰" || ch === "Š" || ch === "‹" ||
      ch === "Œ" || ch === "Ž" || ch === "‘" || ch === "’" || ch === "“" ||
      ch === "”" || ch === "•" || ch === "–" || ch === "—" || ch === "˜" ||
      ch === "™" || ch === "š" || ch === "›" || ch === "œ" || ch === "ž" ||
      ch === "Ÿ" || ch === "ƒ"
    ) {
      return ch;
    }
    if (ch === "\u200b" || ch === "\u00ad") return "";
    if (ch === "→") return "->";
    if (ch === "←") return "<-";
    return "?";
  });
}

/** Bricht Text an Wortgrenzen auf die verfügbare Breite um. */
function wrapText(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function resolvePageSize(ps: PdfOptions["pageSize"]): { widthMm: number; heightMm: number } {
  if (ps && typeof ps === "object") {
    const w = Number(ps.widthMm);
    const h = Number(ps.heightMm);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      return { widthMm: w, heightMm: h };
    }
  }
  if (typeof ps === "string" && Object.prototype.hasOwnProperty.call(PAGE_SIZES, ps)) {
    const p = PAGE_SIZES[ps as PageSizeId];
    return { widthMm: p.widthMm, heightMm: p.heightMm };
  }
  const fallback = PAGE_SIZES["6x9"];
  return { widthMm: fallback.widthMm, heightMm: fallback.heightMm };
}

function resolveMargins(m?: Partial<PdfMarginsMm>): PdfMarginsMm {
  const pick = (v: unknown, d: number): number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d;
  return {
    top: pick(m?.top, DEFAULT_PDF_MARGINS_MM.top),
    right: pick(m?.right, DEFAULT_PDF_MARGINS_MM.right),
    bottom: pick(m?.bottom, DEFAULT_PDF_MARGINS_MM.bottom),
    left: pick(m?.left, DEFAULT_PDF_MARGINS_MM.left),
  };
}

/**
 * Erzeugt ein KDP-Druck-PDF als Blob.
 *
 * - Seitenformat/äußere Ränder konfigurierbar (Default Trade 6×9″, 20/15 mm).
 * - Bundsteg: wird an den INNENrand addiert; die Seiten sind gespiegelt
 *   (recto/ungerade → Bundsteg links, verso/gerade → Bundsteg rechts).
 * - Kolumnentitel: verso = Buchtitel, recto = Kapiteltitel.
 * - Paginierung: Titelblatt ohne Nummer, Fließseiten fortlaufend ab 1.
 * - Jedes Kapitel beginnt auf einer neuen Seite; fehlende Inhalte werden
 *   durch einen Hinweis ersetzt, nie durch einen Absturz.
 */
export async function buildPrintPdf(
  chapters: BookChapterInput[],
  options: PdfOptions,
): Promise<Blob> {
  const list = normalizeChapters(chapters);
  const title = safe(options?.title) || "Unbenanntes Buch";
  const author = safe(options?.author) || "Unbekannter Autor";
  const now =
    typeof options?.now === "number" && Number.isFinite(options.now) ? options.now : Date.now();

  const { widthMm, heightMm } = resolvePageSize(options?.pageSize);
  const m = resolveMargins(options?.margins);
  const pageW = mmToPt(widthMm);
  const pageH = mmToPt(heightMm);
  const mPt = {
    top: mmToPt(m.top),
    right: mmToPt(m.right),
    bottom: mmToPt(m.bottom),
    left: mmToPt(m.left),
  };

  // Bundsteg: explizit überschrieben oder aus geschätzter Seitenzahl.
  const blocksPerChapter = list.map((c) => normalizedChapterBlocks(toBlocks(c.content)));
  const wordTotal = blocksPerChapter.reduce(
    (n, blocks) => n + blocks.reduce((k, b) => k + (b.items ? b.items.length : 0) + b.text.split(/\s+/).filter(Boolean).length, 0),
    0,
  );
  const trimId: PageSizeId =
    typeof options?.pageSize === "string" &&
    Object.prototype.hasOwnProperty.call(PAGE_SIZES, options.pageSize)
      ? (options.pageSize as PageSizeId)
      : "6x9";
  const estPages = estimatePageCount(wordTotal > 0 ? wordTotal : 1, trimId);
  const gutterMm =
    typeof options?.gutterMm === "number" && Number.isFinite(options.gutterMm) && options.gutterMm >= 0
      ? options.gutterMm
      : calculateGutter(estPages, options?.paperType ?? "white");
  const gutterPt = mmToPt(gutterMm);

  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor(author);
  pdf.setCreator("AI Writer Studio — Print Master (WP 10.1)");
  pdf.setProducer("AI Writer Studio");
  const stamp = new Date(now);
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);

  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.4, 0.4, 0.4);

  // --- Layout-Zustand -------------------------------------------------------
  let page!: PDFPage;
  let physPage = 0; // physische Seite (1 = Titelblatt/recto)
  let bodyPageNum = 0; // angezeigte Fließseiten-Nummer
  let y = 0;
  let leftMarginPt = mPt.left;
  let contentWidthPt = pageW - mPt.left - mPt.right;
  let currentChapterTitle = title;

  const drawRunningHead = () => {
    const recto = physPage % 2 === 1;
    const text = winAnsiSafe(recto ? currentChapterTitle || title : title);
    const size = 9;
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: leftMarginPt + (contentWidthPt - w) / 2,
      y: pageH - mPt.top + 12,
      size,
      font,
      color: grey,
    });
  };

  const drawPageNumber = () => {
    const text = String(bodyPageNum);
    const size = 9;
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: leftMarginPt + (contentWidthPt - w) / 2,
      y: Math.max(mPt.bottom - 16, 6),
      size,
      font,
      color: grey,
    });
  };

  /** Neue Seite. `isBody` steuert Kopf-/Fußzeile und Paginierung. */
  const newPage = (isBody: boolean): void => {
    physPage++;
    page = pdf.addPage([pageW, pageH]);
    const recto = physPage % 2 === 1;
    // Bundsteg liegt immer innen: recto (rechte Seite) → links, verso → rechts.
    leftMarginPt = mPt.left + (recto ? gutterPt : 0);
    contentWidthPt = pageW - leftMarginPt - (mPt.right + (recto ? 0 : gutterPt));
    y = pageH - mPt.top;
    if (isBody) {
      bodyPageNum++;
      drawRunningHead();
      drawPageNumber();
    }
  };

  // --- Titelblatt -----------------------------------------------------------
  newPage(false);
  const titleSize = 26;
  const titleW = bold.widthOfTextAtSize(winAnsiSafe(title), titleSize);
  page.drawText(winAnsiSafe(title), {
    x: Math.max(mPt.left, (pageW - titleW) / 2),
    y: pageH * 0.55,
    size: titleSize,
    font: bold,
    color: black,
  });
  const authorSize = 14;
  const authorW = font.widthOfTextAtSize(winAnsiSafe(author), authorSize);
  page.drawText(winAnsiSafe(author), {
    x: Math.max(mPt.left, (pageW - authorW) / 2),
    y: pageH * 0.55 - 34,
    size: authorSize,
    font,
    color: black,
  });

  // --- Kapitel --------------------------------------------------------------
  const renderChapter = (heading: string, blocks: Block[]) => {
    currentChapterTitle = heading;
    newPage(true);
    const hSize = BODY_FONT_SIZE_PT * 1.6;
    if (y - hSize < mPt.bottom) newPage(true);
    y -= hSize;
    page.drawText(winAnsiSafe(heading), { x: leftMarginPt, y, size: hSize, font: bold, color: black });
    y -= hSize * 0.7;

    for (const b of blocks) {
      let fnt: PDFFont = font;
      let size = BODY_FONT_SIZE_PT;
      let indent = 0;
      if (b.type === "h2") { fnt = bold; size = Math.round(BODY_FONT_SIZE_PT * 1.35); }
      else if (b.type === "h3") { fnt = bold; size = Math.round(BODY_FONT_SIZE_PT * 1.15); }
      else if (b.type === "quote") { indent = mmToPt(8); }
      else if (b.type === "code") { size = Math.round(BODY_FONT_SIZE_PT * 0.9); }

      const text = winAnsiSafe(
        b.type === "list_item" && b.items
          ? b.items.map((it, i) => (b.ordered ? `${i + 1}. ` : "• ") + it.text).join("\n")
          : b.text,
      );
      const lineH = size * BODY_LINE_HEIGHT;
      const lines = wrapText(text, size, fnt, contentWidthPt - indent);
      for (let li = 0; li < lines.length; li++) {
        if (y - lineH < mPt.bottom) newPage(true);
        const x = leftMarginPt + (li === 0 ? indent : 0);
        page.drawText(lines[li], { x, y, size, font: fnt, color: black });
        y -= lineH;
      }
      y -= mmToPt(3); // Absatzabstand
    }
  };

  if (list.length === 0) {
    renderChapter(title, [{ type: "p", text: "(Kein Inhalt vorhanden.)" }]);
  } else {
    list.forEach((c, i) => renderChapter(chapterHeading(c, i), blocksPerChapter[i] ?? []));
  }

  const buf = await pdf.save();
  return new Blob([buf as BlobPart], { type: "application/pdf" });
}
