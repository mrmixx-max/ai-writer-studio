// KDP-Upload-Validierung (Pre-Upload-Check, Sprint 7, Agent 1).
//
// Akzeptanzkriterium: Pre-Upload-Check — Dateigröße, Format, Pflichtfelder.
// Ergänzt die Metadaten-Validierung aus src/services/kdp/validation.ts um die
// Artefakt-Prüfung (Datei vorhanden, DOCX/EPUB, Größenlimits, ISBN-13-Prüfung).
// Die Prüfung ist rein (kein IO): Dateigröße/Format kommen als UploadFile rein.

import type { KdpMetadata } from "@/types/bookwriter";
import { isValidIsbn13 } from "@/services/kdp/uploadSheet";

/** Eine hochzuladende Datei (Artefakt aus dem Export). */
export interface UploadFile {
  name: string;
  sizeBytes: number;
  mimeType: string;
}

/** KDP-Größenlimits (Manuskript-Upload): 650 MB Maximum; sinnvolles Minimum. */
export const KDP_MAX_FILE_BYTES = 650 * 1024 * 1024;
export const KDP_MIN_FILE_BYTES = 1024; // 1 KB — darunter ist das Manuskript mit Sicherheit leer/beschädigt

/** Erlaubte Manuskript-Formate (KDP-Upload-Vertrag). */
const ALLOWED_EXTENSIONS = [".docx", ".epub"] as const;

const MIME_BY_EXT: Record<(typeof ALLOWED_EXTENSIONS)[number], string[]> = {
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".epub": ["application/epub+zip", "application/octet-stream"],
};

/** Pre-Upload-Issue. */
export interface UploadValidationIssue {
  field: "file" | "metadata" | "isbn";
  severity: "error" | "warning";
  message: string;
}

/** Ergebnis des Pre-Upload-Checks. */
export interface UploadValidationResult {
  issues: UploadValidationIssue[];
  isValid: boolean;
  errorCount: number;
  warningCount: number;
}

/** Byte → lesbare MB-Angabe. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Math.round(mb * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

/** Prüft Dateigröße + Format einer Upload-Datei. */
export function validateUploadFile(file: UploadFile): UploadValidationIssue[] {
  const issues: UploadValidationIssue[] = [];
  if (!file.name.trim()) {
    issues.push({ field: "file", severity: "error", message: "Kein Dateiname angegeben." });
    return issues;
  }
  const ext = extensionOf(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    issues.push({
      field: "file",
      severity: "error",
      message: `Nicht unterstütztes Format "${ext || "(keine Endung)"}" — KDP erwartet DOCX oder EPUB.`,
    });
  } else {
    const allowedMimes = MIME_BY_EXT[ext as (typeof ALLOWED_EXTENSIONS)[number]];
    if (file.mimeType && !allowedMimes.includes(file.mimeType)) {
      issues.push({
        field: "file",
        severity: "warning",
        message: `MIME-Type "${file.mimeType}" passt nicht zu ${ext} (erwartet: ${allowedMimes.join(" | ")}).`,
      });
    }
  }
  if (file.sizeBytes <= 0) {
    issues.push({ field: "file", severity: "error", message: "Datei ist leer (0 Bytes)." });
  } else if (file.sizeBytes < KDP_MIN_FILE_BYTES) {
    issues.push({
      field: "file",
      severity: "error",
      message: `Datei verdächtig klein (${formatBytes(file.sizeBytes)}) — vermutlich beschädigter Export.`,
    });
  } else if (file.sizeBytes > KDP_MAX_FILE_BYTES) {
    issues.push({
      field: "file",
      severity: "error",
      message: `Datei zu groß (${formatBytes(file.sizeBytes)}) — KDP-Limit ist 650 MB.`,
    });
  }
  return issues;
}

/** Prüft die KDP-Pflichtfelder der Metadaten. */
export function validateUploadMetadata(metadata: KdpMetadata): UploadValidationIssue[] {
  const issues: UploadValidationIssue[] = [];
  if (!metadata.title.trim()) {
    issues.push({ field: "metadata", severity: "error", message: "Pflichtfeld fehlt: Titel." });
  }
  const blurb = metadata.blurbVariants.find((b) => b.trim()) ?? "";
  if (!blurb) {
    issues.push({ field: "metadata", severity: "error", message: "Pflichtfeld fehlt: Klappentext." });
  }
  if (metadata.keywords.length === 0) {
    issues.push({ field: "metadata", severity: "error", message: "Pflichtfeld fehlt: mindestens 1 Keyword." });
  }
  if (metadata.priceUsd == null) {
    issues.push({
      field: "metadata",
      severity: "warning",
      message: "Kein Listenpreis gesetzt — KDP fragt den Preis beim Setup ab.",
    });
  } else if (metadata.priceUsd < 0.99 || metadata.priceUsd > 200) {
    issues.push({
      field: "metadata",
      severity: "error",
      message: `Listenpreis ${metadata.priceUsd.toFixed(2)} USD außerhalb des KDP-Bereichs (0.99–200 USD).`,
    });
  }
  return issues;
}

/**
 * Voller Pre-Upload-Check: Artefakt (Dateigröße/Format) + Pflichtfelder + ISBN.
 * Reine Funktion — kein Dateisystem-Zugriff.
 */
export function validateUploadArtefact(
  file: UploadFile | null,
  metadata: KdpMetadata,
  opts: { isbn?: string | null } = {},
): UploadValidationResult {
  const issues: UploadValidationIssue[] = [];

  if (!file) {
    issues.push({ field: "file", severity: "error", message: "Keine Manuskript-Datei angegeben." });
  } else {
    issues.push(...validateUploadFile(file));
  }

  issues.push(...validateUploadMetadata(metadata));

  if (opts.isbn != null && opts.isbn.trim()) {
    const normalized = opts.isbn.replace(/[-\s]/g, "");
    if (!isValidIsbn13(normalized)) {
      issues.push({
        field: "isbn",
        severity: "error",
        message: `ISBN "${opts.isbn}" ist keine gültige ISBN-13 (Prüfziffer falsch).`,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return { issues, isValid: errorCount === 0, errorCount, warningCount };
}
