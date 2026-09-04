// Export-Kern für generierte Bücher (Bookwriter → Markdown, DOCX, EPUB).
//
// Pure Transformationen: TipTap-JSON / Klartext-Kapitel → Block → Zielformat.
// KDP-Struktur: Titelblatt + Impressum + klickbares Inhaltsverzeichnis +
// Kapitel auf neuer Seite. Deutsche Typografie (Anführungszeichen,
// Gedankenstriche, keine doppelten Leerzeichen) wird beim Export normalisiert.
//
// DOCX: `docx` npm-Paket (bereits Dependency, kein neues Paket).
// EPUB: JSZip (bereits Dependency) — EPUB 3 mit OPF + NCX (Kompatibilität),
//       ein XHTML-Dokument je Kapitel, UTF-8.

import { toBlocks } from "@/services/export/blocks";
import { normalizeTypography } from "./typography";
import { buildBookMarkdown } from "./markdown";
import { buildBookDocxBlob } from "./docx";
import { buildBookEpubBlob } from "./epub";
import { logger } from "@/services/logger";
import type { ExportBookInput, ExportBookResult, ExportFormat, BookChapterInput } from "./types";

export type { ExportBookInput, ExportBookResult, ExportFormat, BookChapterInput };
export { normalizeTypography, buildBookMarkdown };
export { buildTitlePageBlocks, buildEpubChapterXhtml, xmlEscape } from "./structure";
export { checkExportGate, formatNeedsRevisionWarning } from "./gate";
export { saveExportBlob } from "./save";
export type { ExportGateResult } from "./gate";
export type { SaveExportResult } from "./save";

/**
 * Exportiert ein generiertes Buch in das gewünschte Format.
 *
 * - markdown: Buch-Markdown mit Titel/Impressum/Inhaltsverzeichnis.
 * - docx: KDP-Struktur mit Titelblatt, TOC-Hyperlinks,
 *   Kapiteln auf neuer Seite (pageBreakBefore).
 * - epub: EPUB 3 (OPF + NCX), ein XHTML-Kapitel je Datei, UTF-8.
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
  } else {
    blob = await buildBookEpubBlob(meta, chapters, blocksPerChapter);
  }

  onProgress?.(90, "Datei wird benannt…");
  const filename = `${sanitizeFilename(input.title)}.${format === "markdown" ? "md" : format}`;

  onProgress?.(100, "Export fertig.");
  logger.info(
    `Book-Export ${format.toUpperCase()}: ${filename} (${blob.size} Bytes, ${chapters.length} Kapitel)`,
    "exportBook",
  );
  return { filename, blob, format };
}

/** Entfernt Dateisystem-gefährliche Zeichen aus Dateinamen. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}