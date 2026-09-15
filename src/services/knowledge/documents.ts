// Dokumente als Wissensquellen: Datei (md/txt/docx) einlesen und als
// Referenztext in den Projekt-Wissensindex aufnehmen (RAG-Faktenbasis).
//
// Reine Service-Schicht ohne UI: Der Aufrufer (KnowledgePanel) liefert ein
// File-Objekt (Browser FileReader — kein Plugin nötig) und Settings.

import type { AppSettings } from "@/types/config";
import type { KnowledgeSource } from "@/types/knowledge";
import { addReferenceText } from "./sources";
import { indexSingleSource, type IndexOptions } from "./indexer";
import { importFiles } from "@/services/import";

/** Lesbare Formate für den Datei-Upload (Import-Parser laufen im Browser). */
const TEXT_EXTS = [".md", ".markdown", ".txt", ".text"];
const DOCX_EXT = ".docx";

export function isSupportedDocument(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(DOCX_EXT) || TEXT_EXTS.some((ext) => lower.endsWith(ext))
  );
}

/**
 * Liest eine Datei als Text. Markdown/Text direkt, DOCX über den
 * Import-Parser (Kapitel werden mit Überschriften zusammengefügt).
 * Wirft ImportError bei unlesbarem/unsupported Format.
 */
export async function readDocumentFile(file: {
  name: string;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<{ name: string; text: string }> {
  const lower = file.name.toLowerCase();
  if (TEXT_EXTS.some((ext) => lower.endsWith(ext))) {
    const text = await file.text();
    if (!text.trim()) throw new Error(`Datei ist leer: ${file.name}`);
    return { name: file.name, text };
  }
  if (lower.endsWith(DOCX_EXT)) {
    const data = await file.arrayBuffer();
    const doc = await importFiles([{ name: file.name, data }], {
      apply: false,
    });
    const text = doc.chapters
      .map((ch) => `# ${ch.title}\n\n${ch.content}`)
      .join("\n\n")
      .trim();
    if (!text) throw new Error(`Kein Text extrahierbar: ${file.name}`);
    return { name: doc.title || file.name, text };
  }
  throw new Error(
    `Format nicht unterstützt: ${file.name} (nur .md, .txt, .docx)`,
  );
}

/**
 * Nimmt einen Dokuments-Text als Referenzquelle auf und indexiert ihn sofort,
 * damit er für RAG-Abfragen (runKIAction) verfügbar ist.
 */
export async function addDocumentSource(
  projectId: string,
  fileName: string,
  text: string,
  settings: AppSettings,
  onProgress?: IndexOptions["onProgress"],
): Promise<KnowledgeSource> {
  const src = await addReferenceText(projectId, fileName, text);
  await indexSingleSource(projectId, src.id, settings, onProgress);
  return src;
}
