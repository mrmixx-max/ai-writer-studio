// Social-DRM-Service (WP 19.1, Direct-to-Reader Bundler).
//
// Zweck: Der Direktverkauf an Leser:innen (Newsletter, eigene Landingpage,
// Vorablese-Exemplare) braucht ein verkaufsfertiges Paket, das eine gekaufte
// Ausgabe erkennbar an die Person bindet ("Social DRM": sichtbares Ex-Libris
// plus unsichtbares, kopiertes Wasserzeichen). Kein Kopierschutz, kein
// Server-Call, kein DRM-Backend — nur deterministische, lokale Marker.
//
// Eigenschaften:
//   - 100 % lokal und deterministisch: gleiche Eingabe → gleiche Ausgabe.
//     Keine Zeitstempel, keine Zufallswerte, keine LLM-/Netzwerkaufrufe.
//   - Defensiv: fehlende/leere/ungültige Eingaben führen zu klaren
//     Fallback-Werten statt zu Exceptions.
//   - XML-sicher: Wasserzeichen landen ausschliesslich in Kommentaren und
//     CSS-Custom-Properties; Element-/Attribut-Struktur bleibt unangetastet,
//     sodass die EPUB-XHTML/OPF-Validität erhalten bleibt.
//
// Bausteine: JSZip (bereits Dependency, siehe kdpPackage.ts / releasePackage.ts).

import JSZip from "jszip";
import { logger } from "@/services/logger";

/** Version des Social-DRM-Manifests (Breaking Changes → Major hochzählen). */
export const SOCIAL_DRM_VERSION = "1.0";

/** Dateiname des Manifests im Bundle. */
export const SOCIAL_DRM_MANIFEST_NAME = "social-drm-manifest.json";

/** Standard-Fallback für einen fehlenden Lesernamen. */
export const SOCIAL_DRM_ANONYMOUS_READER = "Unbekannte Leserin";

/** Standard-Fallback für eine fehlende Bestellnummer. */
export const SOCIAL_DRM_UNKNOWN_ORDER = "unbekannt";

/** Marker-Präfix des unsichtbaren Kommentars (auch zum Wiedereinlesen). */
const WATERMARK_MARKER = "aiws-social-drm";

/** Fester ZIP-Zeitstempel (1980-01-01) → deterministische Bundle-Bytes. */
const FIXED_ZIP_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

// ---------------------------------------------------------------------------
// Normalisierung / Escaping
// ---------------------------------------------------------------------------

function sanitizeText(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  // Steuerzeichen (inkl. der in XHTML verbotenen) entfernen, Whitespace glätten.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
}

/** Lesername defensiv normalisieren (leer → neutraler Fallback). */
export function normalizeReaderName(readerName: string | null | undefined): string {
  return sanitizeText(readerName) || SOCIAL_DRM_ANONYMOUS_READER;
}

/** Bestellnummer defensiv normalisieren (leer/ungültig → Fallback). */
export function normalizeOrderId(orderId: string | null | undefined): string {
  const cleaned = sanitizeText(orderId)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || SOCIAL_DRM_UNKNOWN_ORDER;
}

/** Escaped Text für XML/HTML-Attribute und -Textknoten. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sichtbarer Wasserzeichen-Text (deterministisch, ohne SVG-Escaping). */
export function visibleWatermarkText(readerName: string, orderId: string): string {
  const reader = normalizeReaderName(readerName);
  const order = normalizeOrderId(orderId);
  return `Ex Libris · ${reader} · Bestellung ${order}`;
}

/**
 * Stabile 32-Bit-Prüfsumme (FNV-1a) über Leser + Bestellnummer.
 * Rein lokal, deterministisch — dient als Wasserzeichen-Signatur.
 */
export function watermarkSignature(readerName: string, orderId: string): string {
  const input = `${normalizeReaderName(readerName)}\u0000${normalizeOrderId(orderId)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// 1) Sichtbares Wasserzeichen (Ex-Libris als SVG)
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein sichtbares Ex-Libris als eigenständiges SVG-Dokument.
 * Deterministisch, ohne Zufallswerte; Text wird XML-escaped.
 */
export function generateVisibleWatermark(readerName: string, orderId: string): string {
  const line1 = escapeXml(`Ex Libris · ${normalizeReaderName(readerName)}`);
  const line2 = escapeXml(`Bestellung ${normalizeOrderId(orderId)}`);
  const title = escapeXml(visibleWatermarkText(readerName, orderId));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120" role="img" aria-label="${title}">
  <title>${title}</title>
  <g fill="none" stroke="#8a6d3b" stroke-width="1">
    <rect x="6" y="6" width="308" height="108" rx="6"/>
    <rect x="12" y="12" width="296" height="96" rx="4" stroke-dasharray="2 4"/>
  </g>
  <text x="160" y="52" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#5b4a2f">${line1}</text>
  <text x="160" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#8a6d3b">${line2}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// 2) Unsichtbares Wasserzeichen (CSS/XHTML)
// ---------------------------------------------------------------------------

/**
 * Unsichtbare Wasserzeichen-Deklaration als CSS-Custom-Properties.
 * Leerzeichen im Wert werden als `_` kodiert, damit die Deklaration gültig bleibt.
 */
export function buildInvisibleWatermarkCss(readerName: string, orderId: string): string {
  const reader = normalizeReaderName(readerName);
  const order = normalizeOrderId(orderId);
  // Whitespace → `_`, Anführungszeichen/Backslash entfernen: der Wert bleibt
  // als CSS-String literaler Bestandteil gültig (kein vorzeitiges Schliessen).
  const cssValue = (value: string) => value.replace(/\s/g, "_").replace(/["\\]/g, "");
  return [
    `  --aiws-wm-reader: "${cssValue(reader)}";`,
    `  --aiws-wm-order: "${cssValue(order)}";`,
    `  --aiws-wm-signature: "${watermarkSignature(reader, order)}";`,
    `  --aiws-wm-note: "social-drm";`,
  ].join("\n");
}

/**
 * Unsichtbarer Marker als XML-Kommentar (zwischen `<!--` und `-->`, daher nie
 * Teil der Elementstruktur — das XML bleibt well-formed).
 */
export function buildInvisibleWatermarkComment(readerName: string, orderId: string): string {
  const reader = normalizeReaderName(readerName);
  const order = normalizeOrderId(orderId);
  // `--` ist in XML-Kommentaren verboten: Bindestriche entschärfen.
  const safe = (value: string) => value.replace(/-/g, "- ");
  return `<!-- ${WATERMARK_MARKER} | reader: ${safe(reader)} | order: ${safe(order)} | sig: ${watermarkSignature(reader, order)} | v${SOCIAL_DRM_VERSION} -->`;
}

/**
 * Bettet das unsichtbare Wasserzeichen in einen EPUB-CSS- oder XHTML-String
 * ein. Das Format wird automatisch erkannt; leere/ungültige Eingaben werden
 * unverändert zurückgegeben (defensiver Fallback).
 */
export function embedInvisibleWatermark(epubContent: string, readerName: string, orderId: string): string {
  if (typeof epubContent !== "string" || epubContent.length === 0) {
    return "";
  }
  const lower = epubContent.toLowerCase();
  const isHtml = lower.includes("<html") || lower.includes("<!doctype html") || lower.includes("<body");
  const isCss = !isHtml && (lower.includes("{") || lower.includes("/*"));

  if (isHtml) return embedInHtml(epubContent, readerName, orderId);
  if (isCss) return embedInCss(epubContent, readerName, orderId);

  logger.warn("embedInvisibleWatermark: unbekanntes Format — Inhalt unverändert.", "socialDrm");
  return epubContent;
}

function embedInHtml(html: string, readerName: string, orderId: string): string {
  const comment = buildInvisibleWatermarkComment(readerName, orderId);
  // In XHTML wird <style>-Inhalt als XML-Zeichendaten geparst: `&`/`<` MÜSSEN
  // escaped werden, sonst zerstört ein Lesername wie "A & B" die
  // XML-Validität. Der DOM dekodiert die Entities beim Lesen zurück.
  const style = escapeXml(buildInvisibleWatermarkCss(readerName, orderId));

  // Vorhandenes <style>-Element erweitern (Custom-Properties voranstellen).
  const styleMatch = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(html);
  if (styleMatch) {
    const injected = `<style>\n${style}\n${styleMatch[1]}</style>`;
    return html.slice(0, styleMatch.index) + injected + html.slice(styleMatch.index + styleMatch[0].length);
  }

  // Neues <style> + Kommentar am Ende des <head>.
  const headMatch = /<head\b[^>]*>/i.exec(html);
  if (headMatch) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + `\n<style>\n${style}\n</style>\n${comment}` + html.slice(at);
  }

  // Fallback: Kommentar direkt vor </body> (nur Text, keine Strukturänderung).
  const bodyClose = html.lastIndexOf("</body>");
  if (bodyClose >= 0) {
    return html.slice(0, bodyClose) + comment + "\n" + html.slice(bodyClose);
  }

  return `${html}\n${comment}`;
}

function embedInCss(css: string, readerName: string, orderId: string): string {
  const comment = buildInvisibleWatermarkComment(readerName, orderId);
  const style = buildInvisibleWatermarkCss(readerName, orderId);

  // Bevorzugt: bestehenden `:root`-Block erweitern (erste Fundstelle).
  const rootMatch = /:root\s*\{([\s\S]*?)\}/i.exec(css);
  if (rootMatch) {
    const openBrace = rootMatch.index + rootMatch[0].indexOf("{") + 1;
    return css.slice(0, openBrace) + `\n${style}\n` + css.slice(openBrace);
  }

  return `${comment}\n:root {\n${style}\n}\n${css}`;
}

// ---------------------------------------------------------------------------
// Wasserzeichen-Wiedereinlesen (für das Bundle)
// ---------------------------------------------------------------------------

export interface WatermarkIdentity {
  readerName: string;
  orderId: string;
}

/**
 * Liest das Wasserzeichen aus einem personalisierten EPUB (ZIP) wieder ein.
 * Sucht den Kommentar-Marker in XHTML/CSS/OPF-Dateien. Fehlt er oder ist die
 * Datei kein lesbares ZIP, wird `null` geliefert (defensiver Fallback).
 */
export async function extractWatermarkFromEpub(epubBlob: Blob | null): Promise<WatermarkIdentity | null> {
  if (!isBlob(epubBlob)) return null;
  try {
    const zip = await JSZip.loadAsync(await epubBlob.arrayBuffer());
    for (const name of Object.keys(zip.files)) {
      if (zip.files[name].dir) continue;
      if (!/\.(xhtml|html|htm|css|opf)$/i.test(name)) continue;
      const file = zip.file(name);
      if (!file) continue;
      const parsed = parseWatermarkComment(await file.async("string"));
      if (parsed) return parsed;
    }
  } catch {
    logger.warn("extractWatermarkFromEpub: EPUB nicht lesbar — Platzhalter wird genutzt.", "socialDrm");
  }
  return null;
}

/** Parst `reader`/`order` aus einem Wasserzeichen-Kommentar. */
export function parseWatermarkComment(text: string): WatermarkIdentity | null {
  if (typeof text !== "string" || !text.includes(WATERMARK_MARKER)) return null;
  const pattern = new RegExp(`${WATERMARK_MARKER}\\s*\\|\\s*reader:\\s*(.*?)\\s*\\|\\s*order:\\s*(.*?)\\s*\\|\\s*sig:`);
  const match = pattern.exec(text);
  if (!match) return null;
  // Beim Schreiben wurden Bindestriche zu "- " (Bindestrich + Leerzeichen)
  // entschärft — für die Rückgewinnung wieder zusammenziehen.
  const unescape = (value: string) => value.trim().replace(/- /g, "-");
  const readerName = normalizeReaderName(unescape(match[1]));
  const orderId = normalizeOrderId(unescape(match[2]));
  return { readerName, orderId };
}

// ---------------------------------------------------------------------------
// 3) Direct-to-Reader Bundle
// ---------------------------------------------------------------------------

/** Rolle einer Datei im Bundle. */
export type SocialDrmFileRole = "epub" | "print-pdf" | "bonus" | "wallpaper" | "manifest";

/** Eine Datei im Bundle. */
export interface SocialDrmBundleEntry {
  /** Pfad im ZIP. */
  path: string;
  role: SocialDrmFileRole;
  sizeBytes: number;
  mimeType: string;
}

/** Wasserzeichen-Sektion des Manifests. */
export interface SocialDrmWatermarkSection {
  signature: string;
  readerName: string;
  orderId: string;
  /** true, wenn echte Leserdaten fehlen (Fallback-Marker). */
  placeholder: boolean;
  visibleSvg: string;
  invisibleComment: string;
}

export interface SocialDrmManifest {
  version: string;
  /** Kennzeichnet die Markierungsart (kein Kopierschutz). */
  kind: "social-drm";
  files: SocialDrmBundleEntry[];
  watermark: SocialDrmWatermarkSection;
  /** Verkaufsfertig: EPUB UND Druck-PDF vorhanden. */
  sellable: boolean;
  /** Hinweise auf fehlende Bestandteile — keine Fehler. */
  warnings: string[];
}

export interface SocialDrmBundleResult {
  /** Deterministischer Dateiname des ZIP-Pakets. */
  filename: string;
  /** Das fertige ZIP-Paket. */
  blob: Blob;
  /** Inhaltsverzeichnis (manifest-relevant). */
  entries: SocialDrmBundleEntry[];
  manifest: SocialDrmManifest;
  /** true, wenn das Wasserzeichen aus echten Leserdaten stammt. */
  personalized: boolean;
}

/**
 * Schnürt ein verkaufsfertiges Direct-to-Reader-Paket (ZIP).
 *
 * Enthalten (sofern vorhanden):
 *   epub/buch.epub             personalisiertes EPUB
 *   print/buch.pdf             Druck-PDF
 *   bonus/bonus-kapitel.md     Bonus-Kapitel (Klartext)
 *   wallpaper/cover.<ext>      Cover als Wallpaper (base64-Data-URL)
 *   social-drm-manifest.json   Dateiliste + Wasserzeichen-Daten
 *
 * Das Wasserzeichen wird — falls möglich — aus dem EPUB-Kommentar-Marker
 * wiedereingelesen; sonst greift ein Platzhalter (personalized === false).
 *
 * Defensiv: fehlt ein Blob, wird die Datei ausgelassen und im Manifest als
 * Warnung vermerkt; das Bundle bleibt baubar, solange mindestens EPUB oder
 * Druck-PDF vorliegt (sellable).
 * Deterministisch: feste ZIP-Zeitstempel, keine Zufallswerte.
 */
export async function bundleDirectToReader(
  epub: Blob,
  printablePdf: Blob,
  bonusChapter: string,
  coverWallpaper: string,
): Promise<SocialDrmBundleResult> {
  const epubBlob = isBlob(epub) ? epub : null;
  const pdfBlob = isBlob(printablePdf) ? printablePdf : null;
  const bonus = typeof bonusChapter === "string" ? bonusChapter.trim() : "";
  const wallpaper = typeof coverWallpaper === "string" ? coverWallpaper.trim() : "";

  const warnings: string[] = [];
  if (!epubBlob) warnings.push("Kein EPUB übergeben — EPUB fehlt im Paket.");
  if (!pdfBlob) warnings.push("Kein Druck-PDF übergeben — Druck-PDF fehlt im Paket.");
  if (!bonus) warnings.push("Kein Bonus-Kapitel übergeben — Bonus fehlt im Paket.");
  if (!wallpaper) warnings.push("Kein Cover-Wallpaper übergeben — Wallpaper fehlt im Paket.");

  const identity = await extractWatermarkFromEpub(epubBlob);
  const personalized = identity !== null;
  const readerName = identity?.readerName ?? SOCIAL_DRM_ANONYMOUS_READER;
  const orderId = identity?.orderId ?? SOCIAL_DRM_UNKNOWN_ORDER;
  const signature = watermarkSignature(readerName, orderId);

  const zip = new JSZip();
  const entries: SocialDrmBundleEntry[] = [];

  if (epubBlob) {
    const bytes = new Uint8Array(await epubBlob.arrayBuffer());
    addFile(zip, "epub/buch.epub", bytes);
    entries.push({ path: "epub/buch.epub", role: "epub", sizeBytes: bytes.length, mimeType: "application/epub+zip" });
  }

  if (pdfBlob) {
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    addFile(zip, "print/buch.pdf", bytes);
    entries.push({ path: "print/buch.pdf", role: "print-pdf", sizeBytes: bytes.length, mimeType: "application/pdf" });
  }

  if (bonus) {
    const bytes = new TextEncoder().encode(bonus);
    addFile(zip, "bonus/bonus-kapitel.md", bytes);
    entries.push({
      path: "bonus/bonus-kapitel.md",
      role: "bonus",
      sizeBytes: bytes.length,
      mimeType: "text/markdown; charset=utf-8",
    });
  }

  if (wallpaper) {
    const parsed = parseWallpaper(wallpaper);
    if (parsed) {
      const path = `wallpaper/cover.${parsed.ext}`;
      addFile(zip, path, parsed.bytes);
      entries.push({ path, role: "wallpaper", sizeBytes: parsed.bytes.length, mimeType: parsed.mimeType });
    } else {
      warnings.push("Cover-Wallpaper ist kein gültiger base64-Data-URL — Wallpaper fehlt im Paket.");
    }
  }

  const manifest: SocialDrmManifest = {
    version: SOCIAL_DRM_VERSION,
    kind: "social-drm",
    files: entries,
    watermark: {
      signature,
      readerName,
      orderId,
      placeholder: !personalized,
      visibleSvg: generateVisibleWatermark(readerName, orderId),
      invisibleComment: buildInvisibleWatermarkComment(readerName, orderId),
    },
    sellable: epubBlob !== null && pdfBlob !== null,
    warnings,
  };

  addFile(zip, SOCIAL_DRM_MANIFEST_NAME, new TextEncoder().encode(JSON.stringify(manifest, null, 2)));

  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    mimeType: "application/zip",
  });

  const slug = personalized ? bundleSlug(readerName, orderId) : "buch";
  return {
    filename: `direct-to-reader_${slug}.zip`,
    blob: new Blob([zipBytes as BlobPart], { type: "application/zip" }),
    entries,
    manifest,
    personalized,
  };
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function addFile(zip: JSZip, path: string, data: Uint8Array): void {
  // createFolders:false → keine Ordner-Einträge im ZIP (deterministische, flache
  // Dateiliste; Calibre/Reader stören sich nicht daran).
  zip.file(path, data, { date: FIXED_ZIP_DATE, compression: "DEFLATE", createFolders: false });
}

function slugify(value: string): string {
  return (
    sanitizeText(value)
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "buch"
  );
}

/** Dateinamensicherer Slug aus Bestellnummer + Lesername. */
function bundleSlug(readerName: string, orderId: string): string {
  const order = slugify(normalizeOrderId(orderId));
  const reader = slugify(normalizeReaderName(readerName));
  return `${order}-${reader}`.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "buch";
}

/** MIME + Extension eines Cover-Wallpapers aus einem base64-Data-URL ableiten. */
function parseWallpaper(input: string): { bytes: Uint8Array; ext: string; mimeType: string } | null {
  const dataUrl = /^data:([^;,]+);base64,(.*)$/is.exec(input);
  if (!dataUrl) return null;
  const mimeType = dataUrl[1].trim().toLowerCase() || "image/jpeg";
  try {
    return { bytes: decodeBase64(dataUrl[2]), ext: extensionForMime(mimeType), mimeType };
  } catch {
    return null;
  }
}

function decodeBase64(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const buffer = (globalThis as { Buffer?: { from(data: string, enc: string): Uint8Array } }).Buffer;
  if (buffer) return new Uint8Array(buffer.from(cleaned, "base64"));
  throw new Error("base64-Dekodierung nicht verfügbar");
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  return map[mimeType] ?? "jpg";
}
