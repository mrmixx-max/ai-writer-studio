// Multi-Platform-Publishing: Erstellt plattformfertige Manuskript-Pakete für
// Smashwords, Draft2Digital und Kobo Writing Life.
//
// Alle drei Plattformen akzeptieren DOCX und/oder EPUB mit strikten
// Anforderungen (kein Deckblatt-Bild im Manuskript bei Smashwords, OPC-/EpubCheck-
// konformes EPUB 3 bei Kobo, style-basierte Überschriften bei D2D). Der Service
// baut aus den Kapiteln ein valides Paket inkl. Copyright-/Titelseite und liefert
// eine Checkliste je Plattform.

import JSZip from "jszip";
import { listChapters, getChapter } from "@/services/project";
import type { Project } from "@/types/project";
import { toBlocks, toDocx, toEpub, type Block } from "@/services/export";

export type PublishPlatform = "smashwords" | "draft2digital" | "kobo";

export interface PublishMetadata {
  title: string;
  author: string;
  /** Sprache als ISO-Code, Standard "de". */
  language?: string;
  description?: string;
  /** ISBN des Autors, optional. */
  isbn?: string;
  copyrightYear?: number;
}

export interface PublishOptions {
  onProgress?: (percent: number, label: string) => void;
  /** Nur ein bestimmtes Kapitel publishen (sonst das ganze Projekt). */
  chapterId?: string;
}

export interface PublishPackage {
  platform: PublishPlatform;
  /** Blob (DOCX oder EPUB) — direkt uploadbar. */
  blob: Blob;
  /** Empfohlener Dateiname inkl. Endung. */
  filename: string;
  format: "docx" | "epub";
  checklist: string[];
}

const PLATFORM_FORMAT: Record<PublishPlatform, "docx" | "epub"> = {
  // Smashwords: DOCX bevorzugt (Epub-Converter akzeptiert auch EPUB, DOCX ist der Goldstandard „Meatgrinder“)
  smashwords: "docx",
  // Draft2Digital: DOCX bevorzugt (beste Stil-Erkennung), EPUB möglich
  draft2digital: "docx",
  // Kobo Writing Life: EPUB bevorzugt (direkte Annahme, EpubCheck-konform)
  kobo: "epub",
};

function platformChecklist(platform: PublishPlatform): string[] {
  switch (platform) {
    case "smashwords":
      return [
        "DOCX-Format (Meatgrinder-Goldstandard), keine Textboxen/Kopfzeilen",
        "Überschriften nur über Word-Styles (Heading 1) — KEINE manuelle Formatierung",
        "Kein Deckblatt-Bild im Manuskript — Cover wird separat hochgeladen (JPEG, min. 1400x1873 px)",
        "Copyright-Seite im Manuskript enthalten",
        "Beschreibung max. 4000 Zeichen, Tags max. 25",
      ];
    case "draft2digital":
      return [
        "DOCX mit konsistenten Word-Styles (Heading 1 für Kapitel) oder EPUB",
        "Frontmatter (Titel/Autor/Copyright) am Dateianfang",
        "Cover separat hochladen (JPEG/PNG, min. 1024 px Höhe)",
        "Territorien & Preise im D2D-Dashboard konfigurieren",
      ];
    case "kobo":
      return [
        "EPUB 3 ohne DRM (KWL), EpubCheck-konform",
        "dc:language gesetzt, ISBN optional im EPUB-Metadata",
        "Cover separat hochladen (JPEG, ideal 1600x2560 px)",
        "Keine verschachtelten Tabellen, kein CSS-JavaScript",
      ];
  }
}

/** Sammelt Kapitel als Blöcke (wiederverwendet die Export-Logik). */
async function collectBlocks(
  project: Project,
  chapterId: string | undefined,
  meta: PublishMetadata,
  onProgress?: (percent: number, label: string) => void,
): Promise<Block[]> {
  const blocks: Block[] = [];
  // Frontmatter: Titel-, Copyright- und Beschreibungsseite
  blocks.push({ type: "h1", text: meta.title });
  blocks.push({ type: "p", text: `von ${meta.author}` });
  blocks.push({ type: "p", text: `Copyright © ${meta.copyrightYear ?? new Date().getFullYear()} ${meta.author}` });
  blocks.push({ type: "p", text: "Alle Rechte vorbehalten. Kein Teil dieses Werkes darf ohne schriftliche Genehmigung des Autors vervielfältigt werden." });
  if (meta.description) blocks.push({ type: "quote", text: meta.description });
  blocks.push({ type: "p", text: "***" });

  if (chapterId) {
    const ch = getChapter(chapterId);
    if (!ch) throw new Error(`Kapitel ${chapterId} nicht gefunden.`);
    blocks.push({ type: "h1", text: ch.title });
    blocks.push(...toBlocks(ch.content));
  } else {
    const chapters = listChapters(project.id);
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      onProgress?.(Math.round((i / Math.max(chapters.length, 1)) * 60), `Kapitel „${c.title}“ wird gelesen…`);
      blocks.push({ type: "h1", text: c.title });
      blocks.push(...toBlocks(c.content));
    }
  }
  return blocks;
}

/**
 * Erstellt das Publish-Paket für eine Plattform: DOCX (Smashwords/D2D)
 * oder EPUB (Kobo) inkl. Frontmatter und Plattform-Checkliste.
 */
export async function buildPublishPackage(
  project: Project,
  platform: PublishPlatform,
  meta: PublishMetadata,
  options: PublishOptions = {},
): Promise<PublishPackage> {
  const { onProgress, chapterId } = options;
  const format = PLATFORM_FORMAT[platform];
  onProgress?.(5, `Paket für ${platform} wird vorbereitet…`);
  const blocks = await collectBlocks(project, chapterId, meta, onProgress);
  onProgress?.(70, `${format.toUpperCase()} wird erzeugt…`);
  const blob = format === "docx"
    ? await toDocx(blocks, meta.title)
    : await toEpub(blocks, meta.title, meta.author);
  const safeTitle = meta.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "manuskript";
  const filename = `${safeTitle} - ${meta.author} - ${platform}.${format}`;
  onProgress?.(100, "Paket fertig.");
  return {
    platform,
    blob,
    filename,
    format,
    checklist: platformChecklist(platform),
  };
}

/** Erstellt Pakete für ALLE Plattformen gleichzeitig. */
export async function buildAllPublishPackages(
  project: Project,
  meta: PublishMetadata,
  options: PublishOptions = {},
): Promise<PublishPackage[]> {
  const platforms: PublishPlatform[] = ["smashwords", "draft2digital", "kobo"];
  const out: PublishPackage[] = [];
  for (let i = 0; i < platforms.length; i++) {
    options.onProgress?.(Math.round((i / platforms.length) * 100), `Paket ${i + 1}/${platforms.length} (${platforms[i]})…`);
    out.push(await buildPublishPackage(project, platforms[i], meta, { ...options, onProgress: undefined }));
  }
  options.onProgress?.(100, "Alle Pakete fertig.");
  return out;
}

/**
 * Lädt ein Publish-Paket als ZIP herunter (DOCX + EPUB + Checkliste als Text).
 * Nützlich, um alle Plattform-Artefakte in einem Rutsch abzulegen.
 */
export async function downloadPublishBundle(packages: PublishPackage[]): Promise<void> {
  const zip = new JSZip();
  for (const pkg of packages) {
    const buf = await pkg.blob.arrayBuffer();
    zip.file(pkg.filename, buf);
    zip.file(`${pkg.platform}-checklist.txt`, pkg.checklist.join("\n"));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "publish-paket.zip";
  a.click();
  URL.revokeObjectURL(url);
}
