// KDP-Cover-Validierung (Sprint 13, Agent 5).
//
// Quellen (KDP-Hilfe, Stand 2026 — aus Doku-Wissen, kein Browsing noetig):
//   - KDP eBook-Cover: Dateiformat JPEG oder TIFF.
//   - Idealmaß 2560 x 1600 px (Hochformat, Hoehe x Breite; Verhaeltnis 1,6 : 1).
//   - Mindestmaß: kurze Kante >= 1000 px.
//   - KDP lehnt Cover mit uebermaessigen Weißraendern im manuellen Review ab.
//   - Cover-Datei < 50 MB.
//
// Design-Entscheidung (Header-Parse statt <img>-Decode):
//   Reiner TypeScript-Header-Parse fuer PNG (IHDR) und JPEG (SOFn), null neue
//   Dependencies. Gruende: (1) synchron und ohne DOM/Canvas — laeuft
//   identisch in Browser, Node und Vitest; (2) keine Bilddaten im Speicher
//   als Bitmap, nur die ersten Bytes; (3) deterministisch testbar mit
//   handgebauten Minimal-Buffern. TIFF wird nur per Magie erkannt (IFD-Parse
//   waere unverhaeltnismaessig komplex) — Maße dann per Warnung an den Autor
//   delegiert. Weißraum-Erkennung ist ohne Pixel-Analyse unmoeglich und bleibt
//   bewusst außen vor (dokumentierte Limitation, kein stilles "ok").
//
// Nahtstelle zu kdpPackage.ts: Die Cover-Issues werden per
// toUploadValidationIssues() auf UploadValidationIssue (field: "file")
// abgebildet und per mergeCoverIntoValidation() additiv in das bestehende
// Pre-Flight-Ergebnis gemischt — keine eigene Validierungslogik im Bundle.

import type {
  UploadValidationIssue,
  UploadValidationResult,
} from "./kdpUploadValidation";

/** KDP-Idealmaß eBook-Cover: 1600 px breit x 2560 px hoch (Hochformat). */
export const KDP_COVER_IDEAL_WIDTH = 1600;
export const KDP_COVER_IDEAL_HEIGHT = 2560;

/** KDP-Mindestmaß: kurze Kante mindestens 1000 px (darunter: Fehler). */
export const KDP_COVER_MIN_SHORT_EDGE = 1000;

/** KDP-Idealverhaeltnis Hoehe/Breite = 2560/1600 = 1,6. */
export const KDP_COVER_IDEAL_RATIO = KDP_COVER_IDEAL_HEIGHT / KDP_COVER_IDEAL_WIDTH;

/** Toleranz ums Idealverhaeltnis (±5 % → Warnung, kein Fehler). */
export const KDP_COVER_RATIO_TOLERANCE = 0.05;

/** KDP-Limit Cover-Datei: 50 MB (darueber: Fehler). */
export const KDP_COVER_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Darunter ist die Datei fast sicher ein Platzhalter (Warnung, kein Fehler). */
export const KDP_COVER_TINY_FILE_BYTES = 5 * 1024;

/**
 * KDP-eBook-Cover-Formate (Dateiendung). PNG ist technisch lesbar, wird von
 * KDP aber nicht als eBook-Cover akzeptiert → Warnung (Konvertierung
 * nach JPEG), kein Fehler, damit bestehende PNG-Bundles nicht brechen.
 */
export const KDP_COVER_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".tif", ".tiff"] as const;

export type KdpCoverFormat = "jpeg" | "png" | "tiff" | "unknown";

export interface KdpCoverDimensions {
  width: number;
  height: number;
}

export type KdpCoverIssueCode =
  | "empty"
  | "unsupported-format"
  | "png-format"
  | "extension-mismatch"
  | "too-large"
  | "tiny-file"
  | "undecodable"
  | "tiff-unchecked"
  | "too-small"
  | "below-ideal"
  | "landscape"
  | "ratio";

export interface KdpCoverIssue {
  code: KdpCoverIssueCode;
  severity: "error" | "warning";
  /** Deutsche Meldung. */
  message: string;
  /** Deutsche Handlungsanweisung. */
  fix: string;
}

export interface KdpCoverFile {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface KdpCoverValidationResult {
  issues: KdpCoverIssue[];
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  dimensions: KdpCoverDimensions | null;
  format: KdpCoverFormat;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** Magie-Erkennung ueber die ersten Bytes (reine Funktion, kein IO). */
export function detectImageFormat(bytes: Uint8Array): KdpCoverFormat {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    PNG_SIGNATURE.every((b, i) => bytes[i] === b)
  ) {
    return "png";
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "tiff";
  }
  return "unknown";
}

function u32be(bytes: Uint8Array, pos: number): number {
  return (
    (bytes[pos]! * 0x1000000 + bytes[pos + 1]! * 0x10000 + bytes[pos + 2]! * 0x100 + bytes[pos + 3]!) >>>
    0
  );
}

/** PNG-Maße aus dem IHDR-Chunk (Bytes 16–23, Big-Endian). */
export function parsePngDimensions(bytes: Uint8Array): KdpCoverDimensions | null {
  if (bytes.length < 24 || detectImageFormat(bytes) !== "png") return null;
  // Chunk-Laenge (12–15) ignorieren, Typ muss "IHDR" sein (12+4 → 16–19).
  if (
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return null;
  }
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  if (width === 0 || height === 0 || width > 100000 || height > 100000) return null;
  return { width, height };
}

/**
 * JPEG-Maße aus dem ersten SOFn-Marker (SOF0–SOF3, SOF5–SOF15 ohne
 * DHT/DAC-Marker C4/C8/CC). Segmentlängen werden uebersprungen, Marker ohne
 * Laenge (RSTn, SOI, EOI, TEM) korrekt behandelt.
 */
export function parseJpegDimensions(bytes: Uint8Array): KdpCoverDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    let marker = bytes[pos + 1]!;
    // Padding-FFs ueberspringen.
    while (marker === 0xff) {
      pos++;
      if (pos + 1 >= bytes.length) return null;
      marker = bytes[pos + 1]!;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS vor SOF
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      pos += 2;
      continue;
    }
    if (pos + 3 >= bytes.length) return null;
    const len = bytes[pos + 2]! * 256 + bytes[pos + 3]!;
    if (len < 2 || pos + 2 + len > bytes.length) return null;
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      if (len < 8 || pos + 9 >= bytes.length) return null;
      const height = bytes[pos + 5]! * 256 + bytes[pos + 6]!;
      const width = bytes[pos + 7]! * 256 + bytes[pos + 8]!;
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    pos += 2 + len;
  }
  return null;
}

/** Maße ueber Magie-Dispatch (PNG/JPEG; TIFF bewusst nicht — siehe Kopfkommentar). */
export function parseImageDimensions(bytes: Uint8Array): KdpCoverDimensions | null {
  const format = detectImageFormat(bytes);
  if (format === "png") return parsePngDimensions(bytes);
  if (format === "jpeg") return parseJpegDimensions(bytes);
  return null;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function issue(
  code: KdpCoverIssueCode,
  severity: "error" | "warning",
  message: string,
  fix: string,
): KdpCoverIssue {
  return { code, severity, message, fix };
}

function summarizeCounts(issues: KdpCoverIssue[]): { errorCount: number; warningCount: number } {
  return {
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  };
}

/**
 * Volle Cover-Pruefung: Format → Dateigroesse → Maße (Fehler vs. Warnungen).
 * Reine Funktion — kein Dateisystem-, DOM- oder Netzwerkzugriff.
 */
export function validateKdpCover(
  bytes: Uint8Array | null | undefined,
  file: KdpCoverFile,
): KdpCoverValidationResult {
  const issues: KdpCoverIssue[] = [];
  const sizeBytes = file.sizeBytes ?? bytes?.length ?? 0;
  const ext = extensionOf(file.name);
  const extAllowed = (KDP_COVER_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  const magic: KdpCoverFormat = bytes && bytes.length > 0 ? detectImageFormat(bytes) : "unknown";

  // 1) Leere Datei — Fehler, danach ist nichts weiter pruefbar.
  if (!bytes || bytes.length === 0 || sizeBytes <= 0) {
    issues.push(
      issue(
        "empty",
        "error",
        "Cover-Datei ist leer (0 Bytes).",
        "Cover erneut exportieren und hochladen.",
      ),
    );
    const { errorCount, warningCount } = summarizeCounts(issues);
    return { issues, isValid: false, errorCount, warningCount, dimensions: null, format: magic };
  }

  // 2) Format. Bytes schlagen die Endung (Magie luegt seltener als Dateinamen).
  const format: KdpCoverFormat =
    magic !== "unknown" ? magic : extAllowed ? "unknown" : "unknown";
  if (magic === "png" || (magic === "unknown" && ext === ".png")) {
    issues.push(
      issue(
        "png-format",
        "warning",
        "Cover ist PNG — KDP erwartet fuer das eBook-Cover JPEG oder TIFF.",
        "Cover als JPEG (sRGB) in hoechster Qualitaet exportieren und als .jpg ablegen.",
      ),
    );
  } else if (magic === "unknown" && !extAllowed) {
    issues.push(
      issue(
        "unsupported-format",
        "error",
        `Cover-Format "${ext || "(keine Endung)"}" wird von KDP nicht akzeptiert — nur JPEG oder TIFF.`,
        "Cover als JPEG (sRGB, .jpg) exportieren.",
      ),
    );
  } else if (magic !== "unknown" && ext && !extAllowed) {
    issues.push(
      issue(
        "extension-mismatch",
        "warning",
        `Dateiendung "${ext}" passt nicht zum erkannten Bildformat (${magic}) — KDP sortiert streng nach Datei.`,
        `Datei in cover.${magic === "jpeg" ? "jpg" : "tif"} umbenennen bzw. neu exportieren.`,
      ),
    );
  }

  // 3) Dateigroesse.
  if (sizeBytes > KDP_COVER_MAX_FILE_BYTES) {
    const mb = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
    issues.push(
      issue(
        "too-large",
        "error",
        `Cover-Datei zu groß (${mb} MB) — KDP-Limit ist 50 MB.`,
        "JPEG-Qualitaet senken oder das Cover auf 1600×2560 px skalieren.",
      ),
    );
  } else if (sizeBytes < KDP_COVER_TINY_FILE_BYTES) {
    issues.push(
      issue(
        "tiny-file",
        "warning",
        `Cover-Datei verdaechtig klein (${sizeBytes} Bytes) — vermutlich ein Platzhalter.`,
        "Pruefen, ob das finale Cover (idealerweise 1600×2560 px) hinterlegt ist.",
      ),
    );
  }

  // 4) Maße.
  const effectiveFormat: KdpCoverFormat =
    magic !== "unknown" ? magic : ext === ".png" ? "png" : format;
  let dimensions: KdpCoverDimensions | null = null;
  if (effectiveFormat === "tiff") {
    issues.push(
      issue(
        "tiff-unchecked",
        "warning",
        "TIFF erkannt — Maße werden nicht automatisch geprueft (Header-Parse nur fuer PNG/JPEG).",
        `Sicherstellen: kurze Kante ≥ ${KDP_COVER_MIN_SHORT_EDGE} px, ideal ${KDP_COVER_IDEAL_WIDTH}×${KDP_COVER_IDEAL_HEIGHT} px.`,
      ),
    );
  } else if (effectiveFormat === "jpeg" || effectiveFormat === "png") {
    dimensions = parseImageDimensions(bytes);
    if (!dimensions) {
      issues.push(
        issue(
          "undecodable",
          "warning",
          "Cover-Maße konnten nicht ausgelesen werden (kein lesbarer PNG/JPEG-Header) — KDP prueft das Cover erst beim Upload.",
          "Cover als JPEG (RGB, .jpg) neu speichern und erneut pruefen.",
        ),
      );
    } else {
      const { width, height } = dimensions;
      const shortEdge = Math.min(width, height);
      if (shortEdge < KDP_COVER_MIN_SHORT_EDGE) {
        issues.push(
          issue(
            "too-small",
            "error",
            `Cover zu klein (${width}×${height} px) — KDP verlangt mindestens ${KDP_COVER_MIN_SHORT_EDGE} px an der kurzen Kante.`,
            `Cover in mindestens ${KDP_COVER_IDEAL_WIDTH}×${KDP_COVER_IDEAL_HEIGHT} px (Idealmaß) neu exportieren.`,
          ),
        );
      } else if (width > height) {
        issues.push(
          issue(
            "landscape",
            "error",
            `Cover ist Querformat (${width}×${height} px) — KDP erwartet Hochformat (ideal ${KDP_COVER_IDEAL_WIDTH}×${KDP_COVER_IDEAL_HEIGHT} px).`,
            "Cover auf Hochformat zuschneiden und neu exportieren.",
          ),
        );
      } else {
        if (width < KDP_COVER_IDEAL_WIDTH || height < KDP_COVER_IDEAL_HEIGHT) {
          issues.push(
            issue(
              "below-ideal",
              "warning",
              `Cover unter Idealmaß (${width}×${height} px, ideal ${KDP_COVER_IDEAL_WIDTH}×${KDP_COVER_IDEAL_HEIGHT} px) — kann auf E-Readern unscharf wirken.`,
              `Cover in ${KDP_COVER_IDEAL_WIDTH}×${KDP_COVER_IDEAL_HEIGHT} px (JPEG, hohe Qualitaet) exportieren.`,
            ),
          );
        }
        const ratio = height / width;
        if (Math.abs(ratio - KDP_COVER_IDEAL_RATIO) / KDP_COVER_IDEAL_RATIO > KDP_COVER_RATIO_TOLERANCE) {
          issues.push(
            issue(
              "ratio",
              "warning",
              `Seitenverhaeltnis (H:B = ${Math.round(ratio * 100) / 100}:1) weicht vom KDP-Ideal 1,6:1 ab — Raender koennten beschnitten werden.`,
              "Cover auf das Verhaeltnis 1,6:1 (z. B. 1600×2560 px) zuschneiden.",
            ),
          );
        }
      }
    }
  }
  // effectiveFormat "unknown" mit erlaubter Endung (.jpg + unlesbare Bytes):
  // Faellt nicht unter jpeg/png oben — trotzdem als Warnung melden.
  if (effectiveFormat === "unknown" && extAllowed) {
    issues.push(
      issue(
        "undecodable",
        "warning",
        "Cover-Maße konnten nicht ausgelesen werden (kein lesbarer PNG/JPEG-Header) — KDP prueft das Cover erst beim Upload.",
        "Cover als JPEG (RGB, .jpg) neu speichern und erneut pruefen.",
      ),
    );
  }

  const { errorCount, warningCount } = summarizeCounts(issues);
  return {
    issues,
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    dimensions,
    format: effectiveFormat,
  };
}

/**
 * Bildet Cover-Issues auf UploadValidationIssue ab (field: "file"), damit
 * kdpPackage.ts sie additiv in sein Pre-Flight-Ergebnis mischen kann.
 * Der Fix wandert in die Nachricht — kein Typbruch im Manifest.
 */
export function toUploadValidationIssues(check: KdpCoverValidationResult): UploadValidationIssue[] {
  return check.issues.map((i) => ({
    field: "file" as const,
    severity: i.severity,
    message: `${i.message} Fix: ${i.fix}`,
  }));
}

/**
 * Mischt ein Cover-Pruefergebnis additiv in ein bestehendes
 * UploadValidationResult (mutiert `base`, gibt es zurueck) und rechnet
 * Zaehler + isValid neu. Keine Cover-Datei → No-Op.
 */
export function mergeCoverIntoValidation(
  base: UploadValidationResult,
  check: KdpCoverValidationResult | null,
): UploadValidationResult {
  if (!check) return base;
  base.issues.push(...toUploadValidationIssues(check));
  base.errorCount = base.issues.filter((i) => i.severity === "error").length;
  base.warningCount = base.issues.filter((i) => i.severity === "warning").length;
  base.isValid = base.errorCount === 0;
  return base;
}
