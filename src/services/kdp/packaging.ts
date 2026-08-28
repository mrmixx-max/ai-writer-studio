// KDP-Export-Packaging.
//
// B alle Export-Artefakte (DOCX, PDF, EPUB, Cover, Metadaten) in eine
// Ordnerstruktur zusammen, die direkt bei KDP hochgeladen werden kann.

import type { KdpMetadata } from "@/types/bookwriter";
import type { ChapterData } from "../bookwriter/workflow";
import { toBlocks, toDocx, toPdf, toEpub, type Block } from "../export";

/** Ergebnis des KDP-Packagings. */
export interface KdpPackageResult {
  /** Name des erstellten Ordners (im virtuellen Dateisystem). */
  folderName: string;
  /** Liste der enthaltenen Dateien. */
  files: string[];
  /** Gesamtgröße in Bytes (geschätzt). */
  totalSizeBytes: number;
}

/** Eine Datei im Paket. */
interface PackageFile {
  name: string;
  blob: Blob;
}

/**
 * Erstellt alle KDP-Export-Artepakete im Speicher.
 *
 * - DOCX des gesamten Buchs
 * - PDF des gesamten Buchs
 * - EPUB des gesamten Buchs
 * - Cover-Bild (falls vorhanden)
 * - Metadaten-JSON
 *
 * Liefert die Datei-Blobs; das Speichern geschieht in der aufrufenden Funktion
 * (Browser-Download / Electron-FS).
 */
export async function buildKdpPackage(
  chapters: ChapterData[],
  metadata: KdpMetadata,
  projectName: string,
  authorName: string = "Autor",
  onProgress?: (percent: number, label: string) => void,
): Promise<PackageFile[]> {
  const files: PackageFile[] = [];

  // --- Blöcke aus allen Kapiteln zusammensetzen ---
  onProgress?.(5, "Kapitel werden gelesen…");
  const allBlocks: Block[] = [];
  for (const ch of chapters) {
    allBlocks.push({ type: "h1", text: ch.title });
    allBlocks.push(...toBlocks(ch.content));
  }

  // --- DOCX ---
  onProgress?.(20, "DOCX wird erstellt…");
  const docxBlob = await toDocx(allBlocks, metadata.title || projectName);
  files.push({ name: `${sanitizeFileName(metadata.title || projectName)}.docx`, blob: docxBlob });

  // --- PDF ---
  onProgress?.(45, "PDF wird erstellt…");
  const pdfBlob = await toPdf(allBlocks, metadata.title || projectName);
  files.push({ name: `${sanitizeFileName(metadata.title || projectName)}.pdf`, blob: pdfBlob });

  // --- EPUB ---
  onProgress?.(70, "EPUB wird erstellt…");
  const epubBlob = await toEpub(allBlocks, metadata.title || projectName, authorName);
  files.push({ name: `${sanitizeFileName(metadata.title || projectName)}.epub`, blob: epubBlob });

  // --- Cover ---
  if (metadata.coverImage) {
    onProgress?.(85, "Cover wird übernommen…");
    const coverBlob = dataUrlToBlob(metadata.coverImage);
    if (coverBlob) {
      const ext = coverBlob.type.includes("png") ? "png" : "jpg";
      files.push({ name: `cover.${ext}`, blob: coverBlob });
    }
  }

  // --- Metadaten-JSON ---
  onProgress?.(95, "Metadaten werden geschrieben…");
  const metaJson = JSON.stringify(metadata, null, 2);
  files.push({
    name: "kdp-metadata.json",
    blob: new Blob([metaJson], { type: "application/json" }),
  });

  onProgress?.(100, "Paket fertig.");
  return files;
}

/**
 * Lädt alle Paket-Dateien einzeln herunter (Browser-Kontext).
 *
 * In einem Electron-Kontext würde dies stattdessen in einen Ordner schreiben.
 */
export async function downloadKdpPackage(
  chapters: ChapterData[],
  metadata: KdpMetadata,
  projectName: string,
  authorName?: string,
  onProgress?: (percent: number, label: string) => void,
): Promise<KdpPackageResult> {
  const files = await buildKdpPackage(chapters, metadata, projectName, authorName, onProgress);

  const folderName = sanitizeFileName(metadata.title || projectName) + "_kdp";
  const totalSizeBytes = files.reduce((sum, f) => sum + f.blob.size, 0);

  // Einzel-Downloads auslösen.
  for (const file of files) {
    downloadBlob(file.blob, `${folderName}/${file.name}`);
  }

  return {
    folderName,
    files: files.map((f) => f.name),
    totalSizeBytes,
  };
}

/** Löst einen Download aus (Browser-only). */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Wandelt einen Data-URL in ein Blob um. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, data] = dataUrl.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  } catch {
    return null;
  }
}

/** Entfernt ungültige Zeichen aus Dateinamen. */
function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}
