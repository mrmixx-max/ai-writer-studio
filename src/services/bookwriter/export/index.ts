// Export-Kern für generierte Bücher (Bookwriter → Markdown, DOCX, EPUB, OPML).
//
// Pure Transformationen: TipTap-JSON / Klartext-Kapitel → Block → Zielformat.
// KDP-Struktur: Titelblatt + Impressum + klickbares Inhaltsverzeichnis +
// Kapitel auf neuer Seite. Deutsche Typografie (Anführungszeichen,
// Gedankenstriche, keine doppelten Leerzeichen) wird beim Export normalisiert.
//
// DOCX: `docx` npm-Paket (bereits Dependency, kein neues Paket).
// EPUB: JSZip (bereits Dependency) — EPUB 3 mit OPF + NCX (Kompatibilität),
//       ein XHTML-Dokument je Kapitel, UTF-8. Sprint 3: semantisches HTML
//       ohne Inline-Styles (Jutoh-optimiert).
// OPML: Sprint 3 — Outline 2.0 für den verlustfreien Import in Scrivener 3.
// DOCX/VBA: Sprint 3 — Custom XML Part + Custom Properties für die externen
//       "AI Text Refinement Suites" (Microsoft Word).

import { toBlocks } from "@/services/export/blocks";
import { normalizeTypography } from "./typography";
import { buildBookMarkdown } from "./markdown";
import { buildBookDocxBlob } from "./docx";
import { buildBookEpubBlob } from "./epub";
import { buildBookOpml } from "./opml";
import { buildAiwsVbaBas, buildAiwsBasFilename } from "./vbaMacro";
import { logger } from "@/services/logger";
import type { ExportBookInput, ExportBookResult, ExportFormat, BookChapterInput, ExportVbaMacroResult } from "./types";

export type { ExportBookInput, ExportBookResult, ExportFormat, BookChapterInput };
export type { ExportVbaMacroResult };
export { normalizeTypography, buildBookMarkdown };
export { buildTitlePageBlocks, buildEpubChapterXhtml } from "./structure";
export { xmlEscape } from "./vba";
export { checkExportGate, formatNeedsRevisionWarning } from "./gate";
export { saveExportBlob } from "./save";
export { buildBookOpml } from "./opml";
export { aiwsHiddenTagFor, buildAiwsCustomXml, buildAiwsCustomProperties, AIWS_HIDDEN_TAG } from "./vba";
export { buildAiwsVbaBas, buildAiwsBasFilename, AIWS_VBA_MODULE } from "./vbaMacro";
export type { ExportGateResult } from "./gate";
export type { SaveExportResult } from "./save";

/**
 * Exportiert ein generiertes Buch in das gewünschte Format.
 *
 * - markdown: Buch-Markdown mit Titel/Impressum/Inhaltsverzeichnis.
 * - docx: KDP-Struktur mit Titelblatt, TOC-Hyperlinks, Kapiteln auf neuer
 *   Seite (pageBreakBefore), standardisierten Formatvorlagen (Heading1/2,
 *   Standard, Einzug) und VBA-Integration (Custom XML Part).
 * - epub: EPUB 3 (OPF + NCX), ein XHTML-Kapitel je Datei, UTF-8,
 *   semantisches HTML ohne Inline-Styles (Jutoh-optimiert).
 * - opml: Outline 2.0 für den verlustfreien Import in Scrivener 3.
 */
export async function exportBook(
  input: ExportBookInput,
  format: ExportFormat,
  onProgress?: (percent: number, label: string) => void,
): Promise<ExportBookResult> {
  onProgress?.(5, "Kapitel werden normalisiert…");

  const chapters: BookChapterInput[] = input.chapters.map((c, i) => ({
    number: c.number ?? i + 1,
    title: c.title,
    content: c.content,
  }));

  const author = input.author ?? "Unbekannt";
  const meta = {
    title: input.title,
    author,
    language: input.language ?? "de",
  };

  onProgress?.(20, `Typografie wird normalisiert (${chapters.length} Kapitel)…`);
  const blocksPerChapter = chapters.map((c) => toBlocks(c.content));

  onProgress?.(45, `${format.toUpperCase()} wird erstellt…`);
  let blob: Blob;
  if (format === "markdown") {
    const md = buildBookMarkdown(meta, chapters, blocksPerChapter);
    blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  } else if (format === "docx") {
    blob = await buildBookDocxBlob(meta, chapters, blocksPerChapter);
  } else if (format === "opml") {
    const opml = buildBookOpml(meta, chapters);
    blob = new Blob([opml], { type: "text/x-opml;charset=utf-8" });
  } else {
    blob = await buildBookEpubBlob(meta, chapters, blocksPerChapter);
  }

  onProgress?.(90, "Datei wird benannt…");
  const ext = { markdown: "md", docx: "docx", epub: "epub", opml: "opml" }[format];
  const filename = `${sanitizeFilename(input.title)}.${ext}`;

  // Sprint 4: dediziertes VBA-Modul ("AI Text Refinement") je Buch —
  // bereinigt harte Umbrüche, Anführungszeichen, Leerzeichen, Zero-Width
  // und mappt die DOCX-Tags auf native Word-Formatvorlagen.
  const vbaMacro: ExportVbaMacroResult = {
    filename: buildAiwsBasFilename(input.title),
    content: buildAiwsVbaBas(meta, chapters),
  };

  onProgress?.(100, "Export fertig.");
  logger.info(
    `Book-Export ${format.toUpperCase()}: ${filename} (${blob.size} Bytes, ${chapters.length} Kapitel, VBA-Makro ${vbaMacro.filename})`,
    "exportBook",
  );
  return { filename, blob, format, vbaMacro };
}

/** Entfernt Dateisystem-gefährliche Zeichen aus Dateinamen. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}
