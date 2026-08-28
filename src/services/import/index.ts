// Import-Fassade: einheitliche Einstiegspunkte für alle Formate.
// UI-Aufruf: importFiles([{name, data}]) erkennt das Format automatisch.
// Nach erfolgreichem Parse: applyImport() legt Projekt + Kapitel via project-Service an.

import { createProject, createChapter } from "@/services/project";
import { ImportError, type ImportedDocument, type ImportProgress } from "./types";
import { importMarkdownFiles, isMarkdownFile } from "./markdown";
import { importDocx } from "./docx";
import { importScrivenerWithFiles } from "./scrivener";
import JSZip from "jszip";

export type { ImportedDocument, ImportedChapter, ImportProgress, ImportError } from "./types";
export { isMarkdownFile, parseMarkdown, parseMarkdownToChapters } from "./markdown";
export { importDocx, readDocxMeta } from "./docx";
export { parseScrivx, flattenBinder, rtfToText, importScrivener, importScrivenerWithFiles } from "./scrivener";
export { blocksToTipTap } from "./tiptap";

export type ImportFormat = "markdown" | "docx" | "scrivener" | "unknown";

/** Erkennt das Format anhand von Dateiname/Inhalt. */
export function detectFormat(name: string): ImportFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith(".scrivx")) return "scrivener";
  if (lower.endsWith(".docx")) return "docx";
  if (isMarkdownFile(name)) return "markdown";
  if (lower.endsWith(".scriv")) return "scrivener"; // Paket — ZIP mit project.scrivx
  return "unknown";
}

export interface ImportFile {
  name: string;
  /** Inhalt als Text (Markdown/.scrivx) ODER Bytes (DOCX/ZIP-Pakete). */
  text?: string;
  data?: ArrayBuffer | Uint8Array;
}

export interface ImportOptions {
  onProgress?: ImportProgress;
  /** Markdown: neues Kapitel pro H1 innerhalb einer Datei. */
  splitOnH1?: boolean;
  /** DOCX: Kapitelgrenze (Heading-Level). Standard 1. */
  docxSplitLevel?: 1 | 2;
  /** Nach dem Parse automatisch Projekt anlegen (Standard: true). */
  apply?: boolean;
}

/** Importiert eine oder mehrere Dateien und erkennt das Format automatisch. */
export async function importFiles(
  files: ImportFile[],
  options: ImportOptions = {},
): Promise<ImportedDocument> {
  const { onProgress } = options;
  if (files.length === 0) throw new ImportError("Keine Dateien übergeben.");

  // Gemischte Markdown-Menge
  const allMarkdown = files.every((f) => isMarkdownFile(f.name));
  if (allMarkdown) {
    return importMarkdownFiles(
      files.map((f) => ({ name: f.name, text: f.text ?? new TextDecoder().decode(f.data as Uint8Array) })),
      { onProgress, splitOnH1: options.splitOnH1 },
    );
  }
  if (files.length > 1) {
    throw new ImportError("Mehrere Dateien werden nur für Markdown unterstützt.");
  }
  const file = files[0];
  const format = detectFormat(file.name);
  onProgress?.(5, `Format erkannt: ${format}`);

  switch (format) {
    case "markdown": {
      const text = file.text ?? new TextDecoder().decode(file.data as Uint8Array);
      return importMarkdownFiles([{ name: file.name, text }], {
        onProgress,
        splitOnH1: options.splitOnH1,
      });
    }
    case "docx": {
      if (!file.data && !file.text) throw new ImportError("DOCX benötigt Binärdaten.");
      return importDocx(file.data ?? new TextEncoder().encode(file.text!), {
        onProgress,
        splitLevel: options.docxSplitLevel ?? 1,
      });
    }
    case "scrivener": {
      let xml = file.text ?? "";
      const docFiles: Record<string, string> = {};
      if (file.data) {
        // .scriv-Paket (ZIP) oder nacktes .scrivx als Bytes
        const zip = await JSZip.loadAsync(file.data);
        const scrivxEntry = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith(".scrivx"));
        if (scrivxEntry) {
          xml = await zip.file(scrivxEntry)!.async("string");
          for (const key of Object.keys(zip.files)) {
            if (/\/?Files\/Docs\/[^/]+\.(rtf|txt)$/i.test(key)) {
              docFiles[key] = await zip.file(key)!.async("string");
            }
          }
        } else {
          throw new ImportError("Kein project.scrivx im .scriv-Paket gefunden.");
        }
      }
      if (!xml.trim().startsWith("<")) {
        throw new ImportError(".scrivx-Inhalt konnte nicht gelesen werden.");
      }
      return importScrivenerWithFiles(xml, docFiles, { onProgress: onProgress });
    }
    default:
      throw new ImportError(
        `Nicht unterstütztes Format: „${file.name}“. Erwartet: .md/.txt, .docx, .scrivx/.scriv.`,
      );
  }
}

/**
 * Legt aus einem ImportedDocument ein neues Projekt samt Kapiteln an.
 * Gibt die Projekt-ID zurück.
 */
export async function applyImport(doc: ImportedDocument, onProgress?: ImportProgress): Promise<string> {
  onProgress?.(10, `Projekt „${doc.title}“ wird angelegt…`);
  const project = await createProject(doc.title);
  for (let i = 0; i < doc.chapters.length; i++) {
    const ch = doc.chapters[i];
    onProgress?.(Math.round(10 + (i / doc.chapters.length) * 90), `Kapitel „${ch.title}“ wird angelegt…`);
    await createChapter(project.id, ch.title, ch.content);
  }
  onProgress?.(100, "Import abgeschlossen.");
  return project.id;
}
