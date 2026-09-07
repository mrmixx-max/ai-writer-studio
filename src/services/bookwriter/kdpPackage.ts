// KDP-Upload-Bundle (Sprint 11, Agent 3): manueller Upload ohne KDP-API.
//
// Amazon bietet KEINE oeffentliche KDP-Upload-REST-API fuer Self-Publisher
// (siehe kdpUpload.ts). Die Produktoberflaeche ist deshalb ein perfektes
// Manual-Upload-Paket: Manuskript + Cover + Manifest als ZIP, das der Autor
// unveraendert im KDP-Webformular hochlaedt.
//
// Komposition bestehender Bausteine — keine neue Validierungslogik:
//   - validateUploadArtefact (kdpUploadValidation.ts) → Pre-Flight-Gate
//   - buildUploadPackage (kdpUpload.ts)               → UI-Checkliste
//   - exportBook (export/)                            → liefert das Manuskript-Blob
//     (der Aufrufer exportiert und uebergibt das Blob; dieser Service hasht,
//     prueft und buendelt nur)
//   - JSZip (bereits Dependency, auch von releasePackage.ts genutzt) → ZIP
//
// Dateilayout im ZIP:
//   manuscript.<docx|epub>   das Manuskript (exakt 1 Datei, KDP-Upload)
//   cover.<jpg|png>          das Cover (falls mitgegeben)
//   kdp-manifest.json        Titel/Autor/Sprache/ISBN + SHA256-Hashes +
//                            Validierungs- und Checklistenstand

import JSZip from "jszip";
import type { KdpMetadata } from "@/types/bookwriter";
import {
  validateUploadArtefact,
  type UploadFile,
  type UploadValidationResult,
} from "./kdpUploadValidation";
import { buildUploadPackage } from "./kdpUpload";
import { mergeCoverIntoValidation, validateKdpCover } from "./kdpCover";

/** Version des Manifest-Schemas (Breaking Changes → Major hochzaehlen). */
export const KDP_BUNDLE_VERSION = "1.0";

/** Dateiname des Manifests im ZIP. */
export const KDP_BUNDLE_MANIFEST_NAME = "kdp-manifest.json";

/** Rolle einer Datei im Bundle. */
export type KdpBundleFileRole = "manuscript" | "cover" | "manifest";

/** Eine Eingabedatei (Blob kommt aus dem Export-Service bzw. Cover-Upload). */
export interface KdpBundleInputFile {
  name: string;
  blob: Blob;
  mimeType: string;
}

export interface KdpBundleInput {
  title: string;
  author?: string;
  language?: string;
  /** ISBN-13 optional — KDP vergibt alternativ eine eigene. */
  isbn?: string | null;
  metadata: KdpMetadata;
  /** Exakt 1 Manuskript-Datei (DOCX/EPUB aus exportBook). */
  manuscript: KdpBundleInputFile;
  /** Cover-Datei optional (Fallback: metadata.coverImage als Nachweis). */
  cover?: KdpBundleInputFile | null;
  now?: () => number;
}

/** Eine Datei im Manifest (mit Integritaets-Hash). */
export interface KdpBundleFileEntry {
  name: string;
  role: KdpBundleFileRole;
  sizeBytes: number;
  mimeType: string;
  /** SHA256-Hex ueber die exakten Bundle-Bytes. */
  sha256: string;
}

export interface KdpBundleManifest {
  version: string;
  title: string;
  author: string;
  language: string;
  isbn: string | null;
  /** ISO-8601-Erstellungszeitpunkt. */
  createdAt: string;
  files: KdpBundleFileEntry[];
  validation: {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    issues: UploadValidationResult["issues"];
  };
  /** Checkliste aus buildUploadPackage (kdpUpload.ts) — importiert, nicht kopiert. */
  checklist: { label: string; ok: boolean }[];
  /** Ob ein Cover nachgewiesen ist (Datei im Bundle oder metadata.coverImage). */
  coverPresent: boolean;
}

export interface KdpBundle {
  manifest: KdpBundleManifest;
  manuscript: KdpBundleInputFile;
  cover: KdpBundleInputFile | null;
  /** Upload freigegeben: Pre-Flight-Validierung ok UND Cover vorhanden. */
  canUpload: boolean;
  validation: UploadValidationResult;
}

/** Ergebnis der Hash-Nachpruefung je Datei. */
export interface KdpBundleHashCheck {
  name: string;
  expected: string;
  actual: string | null;
  ok: boolean;
}

/**
 * SHA256-Hex ueber rohe Bytes (WebCrypto; in Node via webcrypto verfuegbar).
 * Reine Funktion — gleiche Bytes liefern immer den gleichen Hash.
 */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) {
    throw new Error("SHA-256: keine WebCrypto-Implementierung verfuegbar.");
  }
  const digest = await subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Entfernt Dateisystem-gefaehrliche Zeichen aus Dateinamen. */
export function sanitizeBundleFilename(name: string): string {
  return name.replace(/[<>:/\\|?*"]/g, "_").trim() || "buch";
}

/**
 * Baut das Upload-Bundle: hasht Manuskript (+ Cover), validiert per
 * validateUploadArtefact und uebernimmt die Checkliste aus
 * buildUploadPackage. Reine Komposition — keine eigene Prueflogik.
 */
export async function buildKdpBundle(input: KdpBundleInput): Promise<KdpBundle> {
  const now = (input.now ?? Date.now)();
  const author = input.author?.trim() || "Unbekannt";
  const language = input.language?.trim() || "de";
  const isbn = input.isbn?.trim() || null;

  const manuscriptBytes = await blobToBytes(input.manuscript.blob);
  const manuscriptHash = await sha256Hex(manuscriptBytes);
  const file: UploadFile = {
    name: input.manuscript.name,
    sizeBytes: manuscriptBytes.length,
    mimeType: input.manuscript.mimeType,
  };

  const validation = validateUploadArtefact(file, input.metadata, { isbn });
  const pkg = buildUploadPackage(file, input.metadata, {
    uploadId: `kdp-bundle-${now}`,
    isbn,
    now: () => now,
  });

  const files: KdpBundleFileEntry[] = [
    {
      name: input.manuscript.name,
      role: "manuscript",
      sizeBytes: manuscriptBytes.length,
      mimeType: input.manuscript.mimeType,
      sha256: manuscriptHash,
    },
  ];

  let cover: KdpBundleInputFile | null = null;
  if (input.cover) {
    const coverBytes = await blobToBytes(input.cover.blob);
    files.push({
      name: input.cover.name,
      role: "cover",
      sizeBytes: coverBytes.length,
      mimeType: input.cover.mimeType,
      sha256: await sha256Hex(coverBytes),
    });
    cover = input.cover;
    // Sprint 13, Agent 5 (additiv): Cover-Bytes gegen die KDP-Cover-Specs
    // pruefen und das Ergebnis in das bestehende Pre-Flight-Ergebnis
    // mischen. Nur Fehler kippen isValid/canUpload — Warnungen (PNG,
    // unter Idealmaß, TIFF, unlesbar) lassen bestehende Bundles zu.
    // Unlesbare/Platzhalter-Bytes (z. B. Testdaten) erzeugen hoechstens
    // Warnungen, nie Fehler — ausser bei leerer Datei oder > 50 MB.
    mergeCoverIntoValidation(
      validation,
      validateKdpCover(coverBytes, {
        name: input.cover.name,
        mimeType: input.cover.mimeType,
        sizeBytes: coverBytes.length,
      }),
    );
  }

  const coverPresent = cover !== null || (input.metadata.coverImage?.trim() ?? "") !== "";

  const manifest: KdpBundleManifest = {
    version: KDP_BUNDLE_VERSION,
    title: input.title,
    author,
    language,
    isbn,
    createdAt: new Date(now).toISOString(),
    files,
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      issues: validation.issues,
    },
    checklist: pkg.checklist,
    coverPresent,
  };

  // Gate: KDP lehnt Buecher ohne Cover im Review ab — ein Bundle ohne
  // Cover-Nachweis ist nie uploadfaehig, auch bei gueltiger Validierung.
  const canUpload = validation.isValid && coverPresent;

  return { manifest, manuscript: input.manuscript, cover, canUpload, validation };
}

/** Manifest → kanonisches JSON (wird 1:1 so ins ZIP gelegt). */
export function serializeManifest(manifest: KdpBundleManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Prueft Bundle-Integritaet: recomputet SHA256 je Manifest-Datei (ohne das
 * Manifest selbst) und vergleicht mit dem manifestierten Hash.
 * `payloads` mappt Dateiname → aktuelle Bytes.
 */
export async function verifyBundleHashes(
  manifest: KdpBundleManifest,
  payloads: Record<string, Uint8Array>,
): Promise<KdpBundleHashCheck[]> {
  const checks: KdpBundleHashCheck[] = [];
  for (const entry of manifest.files) {
    if (entry.role === "manifest") continue;
    const bytes = payloads[entry.name];
    if (!bytes) {
      checks.push({ name: entry.name, expected: entry.sha256, actual: null, ok: false });
      continue;
    }
    const actual = await sha256Hex(bytes);
    checks.push({ name: entry.name, expected: entry.sha256, actual, ok: actual === entry.sha256 });
  }
  return checks;
}

/**
 * Packt das Bundle als ZIP (JSZip — bereits Dependency, kein neues Paket):
 * Manuskript + Cover + kdp-manifest.json. Das Manifest wird erst beim
 * Zippen serialisiert, damit Hashes und Metadaten garantiert konsistent sind.
 */
export async function bundleToZip(bundle: KdpBundle): Promise<{ filename: string; blob: Blob }> {
  const zip = new JSZip();
  const manuscriptBytes = await blobToBytes(bundle.manuscript.blob);
  zip.file(bundle.manuscript.name, manuscriptBytes);
  if (bundle.cover) {
    zip.file(bundle.cover.name, await blobToBytes(bundle.cover.blob));
  }
  zip.file(KDP_BUNDLE_MANIFEST_NAME, serializeManifest(bundle.manifest));
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${sanitizeBundleFilename(bundle.manifest.title)}_kdp.zip`;
  return { filename, blob };
}

/** Loest einen Browser-Download aus (reine DOM-Hilfe, kein Upload). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Baut das ZIP und laedt es herunter (manueller KDP-Upload folgt im Browser). */
export async function downloadBundleAsZip(bundle: KdpBundle): Promise<{ filename: string; sizeBytes: number }> {
  const { filename, blob } = await bundleToZip(bundle);
  downloadBlob(blob, filename);
  return { filename, sizeBytes: blob.size };
}
