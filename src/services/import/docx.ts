// DOCX-Import: Word-Datei (.docx) → ImportedDocument.
// Liest word/document.xml aus dem ZIP und parst w:p / w:tbl über DOMParser
// (kein zusätzliches npm-Dependency nötig). Der Zugriff erfolgt über
// localName-Matching — robust gegen unpräfixte Namespaces und Umgebungen mit
// eingeschränktem getElementsByTagNameNS (happy-dom, WebView).
// Heading-Styles bestimmen die Kapitelgrenzen; Tabellen werden als Textzeilen
// übernommen.

import { ImportError, type ImportedChapter, type ImportedDocument, type ImportProgress } from "./types";
import { blocksToTipTap, type ImportBlock } from "./tiptap";

export interface DocxImportOptions {
  /** Fortschritt-Callback. */
  onProgress?: ImportProgress;
  /** Neues Kapitel pro Heading 1 (Standard) oder pro Heading 1+2. */
  splitLevel?: 1 | 2;
}

/** Alle Nachfahren (inkl. scope selbst) mit passendem localName — namespace-agnostisch. */
function byLocal(scope: Element | Document, name: string): Element[] {
  const out: Element[] = [];
  const root = scope instanceof Document ? scope.documentElement : scope;
  if (!root) return out;
  const visit = (el: Element) => {
    if (el.localName === name) out.push(el);
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return out;
}

function attr(el: Element, name: string): string {
  return el.getAttribute(name) || el.getAttributeNS("*", name) || "";
}

/** Parst DOCX-Bytes (Uint8Array/ArrayBuffer) zu Blöcken inkl. Kapitel-Split. */
export async function importDocx(
  data: ArrayBuffer | Uint8Array,
  options: DocxImportOptions = {},
): Promise<ImportedDocument> {
  const { onProgress, splitLevel = 1 } = options;
  onProgress?.(10, "DOCX wird entpackt…");
  const JSZipCtor = (await import("jszip")).default;
  let zip;
  try {
    zip = await JSZipCtor.loadAsync(data);
  } catch (e) {
    throw new ImportError("Ungültige DOCX-Datei (kein ZIP-Archiv).", e);
  }
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new ImportError("Ungültige DOCX-Datei: word/document.xml fehlt.");
  }
  onProgress?.(35, "Dokument wird geparst…");
  const xml = await entry.async("string");
  const doc = parseXml(xml);
  const meta = await readDocxMeta(data);
  onProgress?.(60, "Inhalt wird konvertiert…");

  const body = byLocal(doc, "body")[0];
  if (!body) throw new ImportError("Kein Dokumentkörper gefunden.");

  const chapters: ImportedChapter[] = [];
  let current: { title: string; blocks: ImportBlock[] } | null = null;
  let title = meta.title || "Word-Import";
  let sawAnyHeading = false;

  const pushChapter = () => {
    if (current) {
      chapters.push({
        title: current.title,
        content: blocksToTipTap(current.blocks.length ? current.blocks : [{ type: "p", text: "" }]),
        orderIndex: chapters.length,
      });
      current = null;
    }
  };

  for (const node of Array.from(body.children)) {
    const local = node.localName;
    if (local === "p") {
      const { style, text } = paragraphInfo(node);
      if (!text.trim() && !hasPageBreak(node)) continue;
      const headingMatch = /^Heading(\d)$/.exec(style);
      const lvl = headingMatch ? Number(headingMatch[1]) : 0;
      if (style === "Title" && !sawAnyHeading) {
        // Buchtitelseite (Word-Style "Title") → Projekttitel, kein Kapitel.
        if (!titleFromMeta(meta) && text.trim()) title = text.trim();
        continue;
      }
      if (lvl >= 1 && lvl <= splitLevel) {
        sawAnyHeading = true;
        pushChapter();
        if (chapters.length === 0 && !titleFromMeta(meta)) title = text.trim() || title;
        current = { title: text.trim() || `Kapitel ${chapters.length + 1}`, blocks: [] };
      } else {
        if (!current) current = { title: meta.title || "Kapitel 1", blocks: [] };
        if (lvl > splitLevel) {
          current.blocks.push({ type: `h${Math.min(lvl, 3)}` as ImportBlock["type"], text: text });
        } else if (hasPageBreak(node) && current.blocks.length > 0) {
          // Seitenwechsel als weicher Trenner: eigenes Kapitel mit Fortlaufend-Titel.
          pushChapter();
          current = { title: `Kapitel ${chapters.length + 1}`, blocks: [{ type: "p", text }] };
        } else if (/Quote/.test(style)) {
          current.blocks.push({ type: "quote", text });
        } else if (/ListParagraph/.test(style)) {
          current.blocks.push({ type: "list_item", text });
        } else {
          current.blocks.push({ type: "p", text });
        }
      }
    } else if (local === "tbl") {
      if (!current) current = { title: chapters.length === 0 ? title : `Kapitel ${chapters.length + 1}`, blocks: [] };
      for (const row of byLocal(node, "tr")) {
        const cells = byLocal(row, "tc")
          .map((tc) => paragraphText(tc))
          .filter((t) => t.trim())
          .join(" | ");
        if (cells) current.blocks.push({ type: "p", text: cells });
      }
    } else if (local === "sectPr") {
      continue; // Abschnittsformatierung ignorieren
    }
  }
  pushChapter();

  if (chapters.length === 0) {
    throw new ImportError("DOCX enthält keinen lesbaren Text.");
  }
  if (!sawAnyHeading && !titleFromMeta(meta) && chapters.length > 0) {
    // Kein einziges Heading: erstes Kapitel als Projekttitel-Vorschlag nutzen.
    title = chapters[0].title;
  }
  onProgress?.(100, "DOCX-Import fertig.");
  return { title, chapters, meta };
}

function titleFromMeta(meta: Record<string, string>): string | undefined {
  return meta.title && meta.title.trim() ? meta.title.trim() : undefined;
}

/** Namespace-tolerantes XML-Parsen mit Parserfehler-Erkennung. */
function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const err = doc.getElementsByTagName("parsererror").length > 0 ||
    byLocal(doc, "parsererror").length > 0;
  if (err) throw new ImportError("XML im Dokument konnte nicht geparst werden.");
  return doc;
}

function paragraphInfo(p: Element): { style: string; text: string } {
  let style = "";
  for (const s of byLocal(p, "pStyle")) {
    style = attr(s, "w:val") || attr(s, "val");
  }
  return { style, text: paragraphText(p) };
}

function paragraphText(scope: Element): string {
  let out = "";
  for (const r of byLocal(scope, "r")) {
    for (const t of byLocal(r, "t")) {
      out += t.textContent ?? "";
    }
    for (const br of byLocal(r, "br")) {
      if (attr(br, "w:type") !== "page") out += " ";
    }
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

function hasPageBreak(p: Element): boolean {
  for (const br of byLocal(p, "br")) {
    if (attr(br, "w:type") === "page") return true;
  }
  return false;
}

/** Liest docProps/core.xml (async) für Titel/Autor-Metadaten. */
export async function readDocxMeta(data: ArrayBuffer | Uint8Array): Promise<Record<string, string>> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file("docProps/core.xml");
  if (!entry) return {};
  const xml = await entry.async("string");
  const doc = parseXml(xml);
  const meta: Record<string, string> = {};
  // Namespace-tolerant: nach localName suchen (dc:title → localName "title").
  const pick = (local: string) => byLocal(doc, local)[0]?.textContent?.trim() || "";
  const title = pick("title");
  const creator = pick("creator");
  if (title) meta.title = title;
  if (creator) meta.author = creator;
  return meta;
}
