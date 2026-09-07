// Bilder-Backup (Sprint 14, Agent 5): erweitert das One-Click-Backup aus
// backup.ts um Bild-Assets (Cover + generierte Bilder).
//
// Design:
// - Wiederverwendung statt Duplikat: Export ruft exportBackup() auf,
//   Validierung ruft validateBackup() auf, Restore ruft restoreBackup() auf.
// - Bilder leben ausserhalb der DB (Data-URLs aus CoverGen/ImageGen) und
//   werden dem Export als Eingabe uebergeben. Jedes Bild erhaelt einen
//   SHA-256-Hash (reine TS-Implementierung, sync, keine neue Dependency,
//   laeuft in Browser + Node).
// - Restore validiert die Bildintegritaet (Hash-Nachberechnung) und meldet
//   korrupte/fehlende Bilder — wirft nie, wie restoreBackup().
// - Speicherformat: BackupFile + zusaetzlich `images: StoredImage[]` und
//   `imageCounts`. Alte Backups ohne `images` bleiben lesbar.

import type { Database } from "sql.js";
import {
  BACKUP_FORMAT,
  exportBackup,
  restoreBackup,
  validateBackup,
  type BackupFile,
  type RestoreResult,
} from "@/services/db/backup";

/** Formatkennung fuer Backups mit Bildanteil. */
export const IMAGE_BACKUP_FORMAT = BACKUP_FORMAT;

/** Version des Bilder-Backup-Formats (unabhaengig von BACKUP_VERSION). */
export const IMAGE_BACKUP_VERSION = 1;

/** Erlaubte Bildarten im Backup. */
export type ImageAssetKind = "cover" | "generated";

/** Bild-Asset als Eingabe fuer den Export (Data-URL aus CoverGen/ImageGen). */
export interface ImageAssetInput {
  id: string;
  kind: ImageAssetKind;
  /** Optionale Projektzuordnung. */
  projectId?: string;
  mimeType: string;
  /** Vollstaendige Data-URL (z.B. data:image/png;base64,...). */
  dataUrl: string;
}

/** Gespeichertes Bild im Backup inkl. Integritaets-Hash. */
export interface StoredImageAsset {
  id: string;
  kind: ImageAssetKind;
  projectId: string | null;
  mimeType: string;
  dataUrl: string;
  /** SHA-256 (Hex) ueber die vollstaendige dataUrl-Zeichenkette. */
  sha256: string;
  /** Laenge der dataUrl in Zeichen (Plausibilitaetscheck). */
  byteLength: number;
}

/** Backup mit Bildanteil. */
export interface BackupWithImagesFile extends BackupFile {
  imageBackupVersion: number;
  imageCounts: { images: number; cover: number; generated: number };
  images: StoredImageAsset[];
}

/** Einzelner Bildfehler beim Validieren/Wiederherstellen. */
export interface ImageIssue {
  id: string;
  /** "missing": kein Bildinhalt | "corrupt": Hash weicht ab | "invalid": Metadaten ungueltig */
  kind: "missing" | "corrupt" | "invalid";
  detail: string;
}

export interface ValidateImagesResult {
  ok: boolean;
  images: StoredImageAsset[];
  issues: ImageIssue[];
}

/** Wohin Restore Bilder schreibt (injizierbar, Default: nur validieren). */
export interface ImageStore {
  save: (image: StoredImageAsset) => void | Promise<void>;
}

export type ImageProblemPolicy = "fail" | "skip";

export interface RestoreWithImagesOptions {
  /** Verhalten bei korrupten Bildern. Default: "fail". */
  onCorrupt?: ImageProblemPolicy;
  /** Verhalten bei fehlenden Bildern. Default: "fail". */
  onMissing?: ImageProblemPolicy;
  /** Optionaler Zielspeicher fuer wiederhergestellte Bilder. */
  imageStore?: ImageStore;
}

export interface RestoreWithImagesResult extends RestoreResult {
  restoredImages: number;
  skippedImages: number;
  imageIssues: ImageIssue[];
}

// ---------------------------------------------------------------------------
// SHA-256 (rein, synchron, ohne Dependencies — FIPS 180-4).
// ---------------------------------------------------------------------------

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return out;
}

/** SHA-256-Hex einer UTF-8-Zeichenkette (synchron, dependency-frei). */
export function sha256HexSync(input: string): string {
  const msg = utf8Bytes(input);
  const bitLen = input.length >= 0 ? msg.length * 8 : 0;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // 64-Bit-Laenge als zwei 32-Bit-Worte (High, Low).
  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  msg.push(
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
  );
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array<number>(64);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] =
        ((msg[off + i * 4] << 24) |
          (msg[off + i * 4 + 1] << 16) |
          (msg[off + i * 4 + 2] << 8) |
          msg[off + i * 4 + 3]) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/** Hash eines Bildinhalts (definiert als SHA-256 der dataUrl-Zeichenkette). */
export function hashImageData(dataUrl: string): string {
  return sha256HexSync(dataUrl);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function toStoredImage(img: ImageAssetInput): StoredImageAsset {
  return {
    id: img.id,
    kind: img.kind,
    projectId: img.projectId ?? null,
    mimeType: img.mimeType,
    dataUrl: img.dataUrl,
    sha256: hashImageData(img.dataUrl),
    byteLength: img.dataUrl.length,
  };
}

/**
 * Exportiert DB-Backup (via backup.ts) plus Bild-Assets als Backup-Objekt.
 * Wirft nur, wenn gar keine DB verfuegbar ist.
 */
export function exportBackupWithImages(
  images: ImageAssetInput[],
  d?: Database,
): BackupWithImagesFile {
  const base = exportBackup(d);
  const stored = (images ?? []).map(toStoredImage);
  return {
    ...base,
    imageBackupVersion: IMAGE_BACKUP_VERSION,
    imageCounts: {
      images: stored.length,
      cover: stored.filter((s) => s.kind === "cover").length,
      generated: stored.filter((s) => s.kind === "generated").length,
    },
    images: stored,
  };
}

/** Serialisiert ein Bilder-Backup nach JSON (Dateiinhalt). */
export function serializeBackupWithImages(backup: BackupWithImagesFile): string {
  return JSON.stringify(backup);
}

/** Komfort: Export direkt als JSON-String. */
export function exportBackupWithImagesJson(
  images: ImageAssetInput[],
  d?: Database,
): string {
  return serializeBackupWithImages(exportBackupWithImages(images, d));
}

// ---------------------------------------------------------------------------
// Validierung (Bilder-Anteil; Basis prueft backup.ts)
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const IMAGE_KINDS: ImageAssetKind[] = ["cover", "generated"];
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Validiert den Bilder-Anteil eines bereits geparsten Backup-Objekts.
 * - Fehlende `images`-Liste (Alt-Backup) ist ok und ergibt 0 Bilder.
 * - Eintraege ohne dataUrl -> Issue "missing".
 * - Hash-Abweichung oder Laengen-Abweichung -> Issue "corrupt".
 * - Ungueltige Metadaten -> Issue "invalid".
 * Wirft nie.
 */
export function validateImages(
  parsed: unknown,
): ValidateImagesResult {
  if (!isRecord(parsed)) return { ok: false, images: [], issues: [] };
  const raw = parsed.images;
  if (raw === undefined) return { ok: true, images: [], issues: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      images: [],
      issues: [{ id: "?", kind: "invalid", detail: "Bilderliste (images) ist kein Array." }],
    };
  }
  const images: StoredImageAsset[] = [];
  const issues: ImageIssue[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) {
      issues.push({ id: "?", kind: "invalid", detail: "Bildeintrag ohne gueltige id." });
      continue;
    }
    const id = entry.id;
    if (!IMAGE_KINDS.includes(entry.kind as ImageAssetKind)) {
      issues.push({ id, kind: "invalid", detail: `Bild ${id} hat ungueltige Art (${String(entry.kind ?? "fehlend")}).` });
      continue;
    }
    if (typeof entry.mimeType !== "string" || !entry.mimeType.startsWith("image/")) {
      issues.push({ id, kind: "invalid", detail: `Bild ${id} hat ungueltigen mimeType.` });
      continue;
    }
    if (typeof entry.dataUrl !== "string" || entry.dataUrl === "") {
      issues.push({ id, kind: "missing", detail: `Bild ${id} fehlt (kein Bildinhalt im Backup).` });
      continue;
    }
    if (typeof entry.sha256 !== "string" || !HEX64.test(entry.sha256)) {
      issues.push({ id, kind: "invalid", detail: `Bild ${id} hat keinen gueltigen SHA-256-Hash.` });
      continue;
    }
    if (typeof entry.byteLength !== "number" || entry.byteLength !== entry.dataUrl.length) {
      issues.push({ id, kind: "corrupt", detail: `Bild ${id} beschaedigt (Laengenabweichung).` });
      continue;
    }
    if (hashImageData(entry.dataUrl) !== entry.sha256) {
      issues.push({ id, kind: "corrupt", detail: `Bild ${id} beschaedigt (Hash weicht ab).` });
      continue;
    }
    images.push({
      id,
      kind: entry.kind as ImageAssetKind,
      projectId: typeof entry.projectId === "string" ? entry.projectId : null,
      mimeType: entry.mimeType,
      dataUrl: entry.dataUrl,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
    });
  }
  return { ok: issues.length === 0, images, issues };
}

/**
 * Validiert einen Bilder-Backup-JSON-String (Basis via backup.ts + Bilder-Anteil).
 * Wirft nie.
 */
export function validateBackupWithImages(
  json: string,
): { ok: true; backup: BackupWithImagesFile } | { ok: false; error: string } {
  if (typeof json !== "string" || json.trim() === "") {
    return { ok: false, error: "Backup-Datei ist leer." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Backup-Datei ist kein gueltiges JSON (Datei beschaedigt?)." };
  }
  const base = validateBackup(json);
  if (!base.ok) return { ok: false, error: base.error };
  if (!isRecord(parsed)) {
    return { ok: false, error: "Backup-Datei hat ein unbekanntes Format (kein Objekt)." };
  }
  if (
    parsed.imageBackupVersion !== undefined &&
    parsed.imageBackupVersion !== IMAGE_BACKUP_VERSION
  ) {
    return {
      ok: false,
      error:
        `Nicht unterstuetzte Bilder-Backup-Version (${String(parsed.imageBackupVersion)}). ` +
        `Diese App liest Version ${IMAGE_BACKUP_VERSION}.`,
    };
  }
  const imgRes = validateImages(parsed);
  if (!imgRes.ok) {
    const first = imgRes.issues[0];
    return { ok: false, error: `Bilder-Backup beschaedigt: ${first.detail}` };
  }
  const withImages = parsed as unknown as BackupWithImagesFile;
  withImages.images = imgRes.images;
  if (!Array.isArray(withImages.images)) withImages.images = [];
  if (!withImages.imageCounts) {
    withImages.imageCounts = {
      images: withImages.images.length,
      cover: withImages.images.filter((i) => i.kind === "cover").length,
      generated: withImages.images.filter((i) => i.kind === "generated").length,
    };
  }
  return { ok: true, backup: withImages };
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Spielt ein Bilder-Backup ein: DB-Anteil via restoreBackup() aus backup.ts,
 * Bilder-Anteil mit Integritaetspruefung und optionalem ImageStore.
 * Gibt IMMER ein Ergebnis zurueck und wirft nie.
 */
export async function restoreBackupWithImages(
  json: string,
  d?: Database,
  options: RestoreWithImagesOptions = {},
): Promise<RestoreWithImagesResult> {
  const onCorrupt = options.onCorrupt ?? "fail";
  const onMissing = options.onMissing ?? "fail";
  const fail = (
    base: RestoreResult,
    extra: Partial<RestoreWithImagesResult>,
    error: string,
  ): RestoreWithImagesResult => ({
    ok: false,
    restoredProjects: base.restoredProjects,
    restoredChapters: base.restoredChapters,
    restoredImages: 0,
    skippedImages: 0,
    imageIssues: [],
    ...extra,
    error,
  });

  // 1) Basis validieren (backup.ts-Regeln).
  const base = validateBackup(json);
  if (!base.ok) {
    return {
      ok: false,
      restoredProjects: 0,
      restoredChapters: 0,
      restoredImages: 0,
      skippedImages: 0,
      imageIssues: [],
      error: base.error,
    };
  }

  // 2) Bilder validieren.
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      restoredProjects: 0,
      restoredChapters: 0,
      restoredImages: 0,
      skippedImages: 0,
      imageIssues: [],
      error: "Backup-Datei ist kein gueltiges JSON (Datei beschaedigt?).",
    };
  }
  const imgRes = validateImages(parsed);
  const fatal = imgRes.issues.filter((i) =>
    i.kind === "corrupt" ? onCorrupt === "fail" : i.kind === "missing" ? onMissing === "fail" : true,
  );
  if (fatal.length > 0) {
    return {
      ok: false,
      restoredProjects: 0,
      restoredChapters: 0,
      restoredImages: 0,
      skippedImages: imgRes.issues.length,
      imageIssues: imgRes.issues,
      error: `Bilder-Backup beschaedigt: ${fatal[0].detail}`,
    };
  }

  // 3) DB-Anteil einspielen (backup.ts — ersetzt Projekte + Kapitel).
  const restored = restoreBackup(json, d);
  if (!restored.ok) {
    return {
      ...restored,
      restoredImages: 0,
      skippedImages: imgRes.images.length + imgRes.issues.length,
      imageIssues: imgRes.issues,
    };
  }

  // 4) Bilder in den Store schreiben (validierte Bilder; Issues mit skip-Policy).
  let restoredImages = 0;
  const skippedImages = imgRes.issues.length;
  if (options.imageStore) {
    try {
      for (const img of imgRes.images) {
        await options.imageStore.save(img);
        restoredImages++;
      }
    } catch (e) {
      return fail(restored, {
        restoredImages,
        skippedImages: skippedImages + (imgRes.images.length - restoredImages),
        imageIssues: [
          ...imgRes.issues,
          { id: "?", kind: "invalid", detail: `Bildspeicher-Fehler: ${(e as Error).message ?? String(e)}` },
        ],
      }, `Bilder-Restore fehlgeschlagen: ${(e as Error).message ?? String(e)}`);
    }
  } else {
    restoredImages = imgRes.images.length;
  }

  return {
    ok: true,
    restoredProjects: restored.restoredProjects,
    restoredChapters: restored.restoredChapters,
    restoredImages,
    skippedImages,
    imageIssues: imgRes.issues,
    error: null,
  };
}
