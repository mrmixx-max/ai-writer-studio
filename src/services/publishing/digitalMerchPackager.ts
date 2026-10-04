// Digital-Merch- & Lesezeichen-Studio-Service (WP 47.2).
//
// Zweck: Aus Manuskript-Zitaten druckfertige Fan-Artikel erzeugen —
//   - Lesezeichen (50×200 mm, 300 DPI)
//   - Smartphone-Wallpaper (1080×2400 px)
//   - Fan-Bundle (ZIP-Inhalt als Manifest + Dankeskarte)
//   - Zitat-Auswahl aus einem Manuskript
//
// Entwurfsregeln (analog zu den übrigen Publishing-Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleiche Eingabe → byte-identische Ausgabe (keine Zeitstempel, keine
//     Zufallswerte, keine Zähler außerhalb der Reihenfolge der Eingabe).
//   - Rein funktional: Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben (null, NaN, Infinity,
//     leere Strings, unbekannte Enum-Werte) liefern sichere Defaults statt zu
//     werfen.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Rahmenstil eines Lesezeichens. */
export type FrameStyle = "ornate" | "minimal" | "none";

export interface BookmarkOptions {
  /** Schriftfamilie (Font-Stack). Ungültige Werte fallen auf den Default zurück. */
  font: string;
  frameStyle: FrameStyle;
  /** Hintergrundfarbe (Hex, Name oder rgb()/hsl()). */
  backgroundColor: string;
  /** Textfarbe (Hex, Name oder rgb()/hsl()). */
  textColor: string;
}

export interface BookmarkDesign {
  widthMm: number;
  heightMm: number;
  dpi: number;
  quote: string;
  font: string;
  frameStyle: string;
  svg: string;
}

export interface WallpaperOptions {
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
}

export interface WallpaperDesign {
  width: number;
  height: number;
  quote: string;
  svg: string;
}

/** Art eines Artikels im Fan-Bundle. */
export type FanBundleItemKind = "bookmark" | "wallpaper" | "quote-card";

export interface FanBundleItem {
  id: string;
  kind: FanBundleItemKind;
  name: string;
  data: string;
}

export interface FanBundle {
  id: string;
  items: FanBundleItem[];
  authorName: string;
  thankYouMessage: string;
  manifest: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Lesezeichen-Maße in Millimetern. */
export const BOOKMARK_WIDTH_MM = 50;
export const BOOKMARK_HEIGHT_MM = 200;
/** Druckauflösung des Lesezeichens. */
export const BOOKMARK_DPI = 300;
/** Lesezeichen in Pixeln: 50mm / 200mm bei 300 DPI (25.4mm = 1 Zoll). */
export const BOOKMARK_WIDTH_PX = 591;
export const BOOKMARK_HEIGHT_PX = 2362;

/** Smartphone-Wallpaper in Pixeln (üblich für Full-HD-Klasse). */
export const WALLPAPER_WIDTH_PX = 1080;
export const WALLPAPER_HEIGHT_PX = 2400;

/** Version des Fan-Bundle-Manifests (Breaking Changes → Major hochzählen). */
export const FAN_BUNDLE_VERSION = "1.0";

/** Standard-Fallback-Farben. */
export const DEFAULT_BACKGROUND_COLOR = "#1a1a2e";
export const DEFAULT_TEXT_COLOR = "#f5f0e6";

/** Standard-Schriftfamilie (serif, auf allen Plattformen verfügbar). */
export const DEFAULT_FONT = "Georgia, serif";

/** Standard-Fallback für ein fehlendes Zitat. */
export const DEFAULT_QUOTE = "Eine Geschichte, die bleibt.";

/** Standard-Fallback für einen fehlenden Autorennamen. */
export const DEFAULT_AUTHOR_NAME = "Unbekannt";

/** Standard-Dankestext, wenn keine Nachricht übergeben wurde. */
export const DEFAULT_THANK_YOU_MESSAGE =
  "Danke, dass du diese Geschichte liest. Du machst sie erst lebendig.";

/** Untergrenze/Obergrenze der Wortzahl eines brauchbaren Zitats. */
export const MIN_QUOTE_WORDS = 5;
export const MAX_QUOTE_WORDS = 15;

/** Sicherheitsobergrenze für die Anzahl gewählter Zitate. */
export const MAX_SELECTED_QUOTES = 100;

/** Schriftgröße (px) des Lesezeichen-Zitats. */
const BOOKMARK_FONT_SIZE = 52;
/** Zeilenhöhe (px) des Lesezeichen-Zitats. */
const BOOKMARK_LINE_HEIGHT = 72;

/** Schriftgröße (px) des Wallpaper-Zitats (Default). */
const WALLPAPER_FONT_SIZE = 72;

/** Ungefähre Breite eines Zeichens als Vielfaches der Schriftgröße. */
const CHAR_WIDTH_FACTOR = 0.55;

/**
 * Schlüsselwörter, die auf eine leidenschaftliche Aussage hindeuten.
 * Werden nur zur Rangfolge der Zitat-Auswahl genutzt.
 */
const PASSION_KEYWORDS: readonly string[] = [
  "liebe",
  "herz",
  "kuss",
  "küsse",
  "feuer",
  "leidenschaft",
  "sehnsucht",
  "verlangen",
  "begehren",
  "für immer",
  "ewig",
  "schicksal",
  "seele",
  "blut",
  "tod",
  "leben",
] as const;

/** Zeichen, die Dialog kennzeichnen (gerade/typografische Anführungszeichen, Guillemets). */
const DIALOGUE_PATTERN = /["„“”‚‘’'»«]/;

// ---------------------------------------------------------------------------
// Interne Helfer — Sanitisierung
// ---------------------------------------------------------------------------

/**
 * Entfernt Steuerzeichen und glättet Whitespace.
 * Nicht-Strings ergeben den leeren String.
 */
function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
}

/** Escaped Text für XML/HTML-Textknoten und -Attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Prüft eine CSS-Farbe defensiv. Erlaubt Hex (#rgb/#rrggbb/#rrggbbaa),
 * einfache Farbnamen sowie rgb()/rgba()/hsl()/hsla() mit sicherem Zeichensatz.
 * Alles andere fällt auf `fallback` zurück.
 */
function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (v.length === 0 || v.length > 64) return fallback;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
  if (/^[a-zA-Z]{3,20}$/.test(v)) return v;
  if (/^(?:rgb|rgba|hsl|hsla)\([0-9a-zA-Z.,%\s/]+\)$/.test(v)) return v;
  return fallback;
}

/**
 * Prüft eine Schriftfamilie defensiv. Erlaubt nur Buchstaben, Ziffern,
 * Leerzeichen, Kommas und Bindestriche — verhindert das Ausbrechen aus dem
 * SVG-Attribut. Leere/ungültige Werte fallen auf `DEFAULT_FONT` zurück.
 */
function sanitizeFont(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_FONT;
  const cleaned = value.replace(/[^A-Za-z0-9 ,-]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_FONT;
}

/** Bildet einen Rahmenstil auf einen gültigen Wert ab (Default: minimal). */
function sanitizeFrameStyle(value: unknown): FrameStyle {
  return value === "ornate" || value === "minimal" || value === "none" ? value : "minimal";
}

/** Liefert ein endliches, positives Maß oder den Fallback. */
function safePositive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Bildet einen Wert auf eine ganze Zahl im Intervall [min, max] ab. */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

/** Deterministische 32-Bit-Prüfsumme (FNV-1a) über einen String. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Deterministische UTF-8-Byte-Länge eines Strings. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Bricht Text gierig in Zeilen um, deren Länge höchstens `maxChars` beträgt.
 * Wörter, die länger als `maxChars` sind, bleiben ungetrennt (keine Endlosschleife).
 */
function wrapText(text: string, maxChars: number): string[] {
  const limit = Math.max(1, Math.floor(maxChars));
  const words = text.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= limit) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Zeichen pro Zeile aus nutzbarer Breite und Schriftgröße. */
function charsPerLine(usableWidth: number, fontSize: number): number {
  return Math.max(1, Math.floor(usableWidth / (fontSize * CHAR_WIDTH_FACTOR)));
}

/**
 * Rendert einen zentrierten, umbrochenen Textblock als <text>/<tspan>-Element.
 * Rein deterministisch; alle Koordinaten sind ganze Pixel.
 */
function renderCenteredText(
  text: string,
  opts: {
    centerX: number;
    centerY: number;
    usableWidth: number;
    fontSize: number;
    lineHeight: number;
    font: string;
    color: string;
  },
): string {
  const lines = wrapText(text, charsPerLine(opts.usableWidth, opts.fontSize));
  if (lines.length === 0) return "";

  const startY = Math.round(opts.centerY - ((lines.length - 1) * opts.lineHeight) / 2);
  const tspans = lines
    .map((line, i) => {
      const y = startY + i * opts.lineHeight;
      return `<tspan x="${opts.centerX}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return (
    `<text x="${opts.centerX}" y="${startY}" ` +
    `font-family="${escapeXml(opts.font)}" font-size="${opts.fontSize}" ` +
    `fill="${escapeXml(opts.color)}" text-anchor="middle" ` +
    `font-style="italic">${tspans}</text>`
  );
}

/** Rahmen-Markup für ein Lesezeichen. */
function renderBookmarkFrame(style: FrameStyle, color: string): string {
  const stroke = escapeXml(color);
  if (style === "none") return "";
  if (style === "minimal") {
    return `<rect x="30" y="30" width="531" height="2302" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  }
  // ornate: doppelter Rahmen + Eckornamente
  const ornaments = [
    [44, 44],
    [547, 44],
    [44, 2318],
    [547, 2318],
  ]
    .map(
      ([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${stroke}" stroke-width="2"/>`,
    )
    .join("");
  return (
    `<rect x="20" y="20" width="551" height="2322" fill="none" stroke="${stroke}" stroke-width="6"/>` +
    `<rect x="44" y="44" width="503" height="2274" fill="none" stroke="${stroke}" stroke-width="2"/>` +
    ornaments
  );
}

// ---------------------------------------------------------------------------
// Öffentliche API — Lesezeichen
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein druckfertiges Lesezeichen (50×200 mm, 300 DPI = 591×2362 px)
 * als deterministisches SVG.
 *
 * Defensive Fallbacks: fehlende/unbekannte Options → Defaults; leeres Zitat →
 * `DEFAULT_QUOTE`; ungültige Farben → Default-Farben; unbekannter Rahmenstil →
 * `minimal`.
 */
export function generateBookmark(quote: string, options?: BookmarkOptions | null): BookmarkDesign {
  const safeQuote = sanitizeText(quote) || DEFAULT_QUOTE;
  const font = sanitizeFont(options?.font);
  const frameStyle = sanitizeFrameStyle(options?.frameStyle);
  const backgroundColor = sanitizeColor(options?.backgroundColor, DEFAULT_BACKGROUND_COLOR);
  const textColor = sanitizeColor(options?.textColor, DEFAULT_TEXT_COLOR);

  const width = BOOKMARK_WIDTH_PX;
  const height = BOOKMARK_HEIGHT_PX;
  const margin = frameStyle === "ornate" ? 70 : 50;
  const usableWidth = width - 2 * margin;

  const frame = renderBookmarkFrame(frameStyle, textColor);
  const text = renderCenteredText(safeQuote, {
    centerX: Math.round(width / 2),
    centerY: Math.round(height / 2),
    usableWidth,
    fontSize: BOOKMARK_FONT_SIZE,
    lineHeight: BOOKMARK_LINE_HEIGHT,
    font,
    color: textColor,
  });

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(backgroundColor)}"/>` +
    frame +
    text +
    `</svg>`;

  return {
    widthMm: BOOKMARK_WIDTH_MM,
    heightMm: BOOKMARK_HEIGHT_MM,
    dpi: BOOKMARK_DPI,
    quote: safeQuote,
    font,
    frameStyle,
    svg,
  };
}

// ---------------------------------------------------------------------------
// Öffentliche API — Wallpaper
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Smartphone-Wallpaper (Default 1080×2400 px) als deterministisches
 * SVG mit zentriertem, umbrochenem Zitat.
 *
 * Defensive Fallbacks: ungültige Maße → Default-Maße (auf 200–10000 px
 * begrenzt); ungültige Schriftgröße → Default; leeres Zitat → `DEFAULT_QUOTE`.
 */
export function generateWallpaper(
  quote: string,
  options?: WallpaperOptions | null,
): WallpaperDesign {
  const safeQuote = sanitizeText(quote) || DEFAULT_QUOTE;
  const width = clampInt(safePositive(options?.width, WALLPAPER_WIDTH_PX), WALLPAPER_WIDTH_PX, 200, 10000);
  const height = clampInt(
    safePositive(options?.height, WALLPAPER_HEIGHT_PX),
    WALLPAPER_HEIGHT_PX,
    200,
    10000,
  );
  const fontSize = clampInt(safePositive(options?.fontSize, WALLPAPER_FONT_SIZE), WALLPAPER_FONT_SIZE, 8, 400);
  const backgroundColor = sanitizeColor(options?.backgroundColor, DEFAULT_BACKGROUND_COLOR);
  const textColor = sanitizeColor(options?.textColor, DEFAULT_TEXT_COLOR);

  const margin = Math.round(Math.min(width, height) * 0.1);
  const usableWidth = Math.max(1, width - 2 * margin);
  const lineHeight = Math.round(fontSize * 1.35);

  const text = renderCenteredText(safeQuote, {
    centerX: Math.round(width / 2),
    centerY: Math.round(height / 2),
    usableWidth,
    fontSize,
    lineHeight,
    font: DEFAULT_FONT,
    color: textColor,
  });

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(backgroundColor)}"/>` +
    text +
    `</svg>`;

  return { width, height, quote: safeQuote, svg };
}

// ---------------------------------------------------------------------------
// Öffentliche API — Zitat-Auswahl
// ---------------------------------------------------------------------------

/** Zerlegt ein Manuskript in Kandidaten-Sätze (Satzzeichen oder Zeilenumbruch). */
function splitSentences(manuscript: string): string[] {
  return manuscript
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Wortzahl eines Satzes (Whitespace-separiert). */
function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Punktwert eines Zitats für die Rangfolge.
 * Dialog (+2) und Ausruf (+1) werden bevorzugt, leidenschaftliche
 * Schlüsselwörter (+1) heben einen Satz zusätzlich an.
 */
function quoteScore(sentence: string): number {
  let score = 0;
  if (DIALOGUE_PATTERN.test(sentence)) score += 2;
  if (sentence.includes("!")) score += 1;
  const lower = sentence.toLowerCase();
  if (PASSION_KEYWORDS.some((kw) => lower.includes(kw))) score += 1;
  return score;
}

/**
 * Wählt prägnante Zitate (5–15 Wörter) aus einem Manuskript.
 *
 * Rangfolge: Dialog/leidenschaftliche Aussagen zuerst, danach die Reihenfolge
 * im Manuskript (stabil). Duplikate (case-insensitiv) werden entfernt.
 *
 * Defensive Fallbacks: Nicht-String-Manuskript → []; ungültige Anzahl → [];
 * Anzahl wird auf `MAX_SELECTED_QUOTES` begrenzt.
 */
export function selectQuotes(manuscript: string, count: number): string[] {
  if (typeof manuscript !== "string") return [];
  const limit = clampInt(count, 0, 0, MAX_SELECTED_QUOTES);
  if (limit <= 0) return [];

  const seen = new Set<string>();
  const candidates: { text: string; index: number; score: number }[] = [];

  for (const sentence of splitSentences(manuscript)) {
    const words = wordCount(sentence);
    if (words < MIN_QUOTE_WORDS || words > MAX_QUOTE_WORDS) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ text: sentence, index: candidates.length, score: quoteScore(sentence) });
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates.slice(0, limit).map((c) => c.text);
}

// ---------------------------------------------------------------------------
// Öffentliche API — Fan-Bundle
// ---------------------------------------------------------------------------

/** Normalisiert eine Bundle-Item-ID auf einen sicheren Zeichensatz. */
function sanitizeItemId(value: unknown, index: number): string {
  const cleaned = typeof value === "string" ? value.replace(/[^A-Za-z0-9._-]/g, "-") : "";
  const trimmed = cleaned.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return trimmed.length > 0 ? trimmed : `item-${index}`;
}

/** Bildet eine Item-Art auf einen gültigen Wert ab (Default: quote-card). */
function sanitizeItemKind(value: unknown): FanBundleItemKind {
  return value === "bookmark" || value === "wallpaper" || value === "quote-card"
    ? value
    : "quote-card";
}

/** Erzeugt eine deterministische Dankeskarte als SVG. */
function buildThankYouCard(authorName: string, message: string): string {
  const width = 1000;
  const height = 1400;
  const safeAuthor = escapeXml(authorName);
  const safeMessage = escapeXml(message);
  const lines = wrapText(message, 34);
  const lineHeight = 44;
  const startY = 520 - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((line, i) => `<tspan x="500" y="${Math.round(startY + i * lineHeight)}">${escapeXml(line)}</tspan>`)
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${DEFAULT_BACKGROUND_COLOR}"/>` +
    `<rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="${DEFAULT_TEXT_COLOR}" stroke-width="3"/>` +
    `<text x="500" y="300" font-family="${escapeXml(DEFAULT_FONT)}" font-size="56" fill="${DEFAULT_TEXT_COLOR}" text-anchor="middle">Danke</text>` +
    `<text x="500" y="${Math.round(startY)}" font-family="${escapeXml(DEFAULT_FONT)}" font-size="34" fill="${DEFAULT_TEXT_COLOR}" text-anchor="middle" font-style="italic">${tspans}</text>` +
    `<text x="500" y="1150" font-family="${escapeXml(DEFAULT_FONT)}" font-size="30" fill="${DEFAULT_TEXT_COLOR}" text-anchor="middle">— ${safeAuthor}</text>` +
    `<text x="500" y="1250" font-family="${escapeXml(DEFAULT_FONT)}" font-size="22" fill="${DEFAULT_TEXT_COLOR}" text-anchor="middle">${safeMessage.length > 0 ? "Für dich" : ""}</text>` +
    `</svg>`
  );
}

/**
 * Schnürt ein Fan-Bundle: übernimmt die übergebenen Artikel, ergänzt eine
 * Dankeskarte und erzeugt ein deterministisches JSON-Manifest.
 *
 * Defensive Fallbacks: `items` wird als Array erwartet (sonst []); ungültige
 * Artikel werden normalisiert (fehlende ID → `item-<index>`, unbekannte Art →
 * `quote-card`, fehlende Daten → ""); doppelte IDs werden eindeutig gemacht.
 * Leerer Autor → `DEFAULT_AUTHOR_NAME`, leere Nachricht → `DEFAULT_THANK_YOU_MESSAGE`.
 */
export function packageFanBundle(
  items: FanBundleItem[],
  authorName: string,
  message: string,
): FanBundle {
  const safeAuthor = sanitizeText(authorName) || DEFAULT_AUTHOR_NAME;
  const safeMessage = sanitizeText(message) || DEFAULT_THANK_YOU_MESSAGE;

  const source = Array.isArray(items) ? items : [];
  const usedIds = new Set<string>();
  const normalized: FanBundleItem[] = [];

  source.forEach((raw, index) => {
    const baseId = sanitizeItemId(raw?.id, index);
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    normalized.push({
      id,
      kind: sanitizeItemKind(raw?.kind),
      name: sanitizeText(raw?.name) || id,
      data: typeof raw?.data === "string" ? raw.data : "",
    });
  });

  // Dankeskarte immer ergänzen (deterministische ID).
  const cardId = "dankeskarte";
  normalized.push({
    id: usedIds.has(cardId) ? `${cardId}-1` : cardId,
    kind: "quote-card",
    name: "Dankeskarte",
    data: buildThankYouCard(safeAuthor, safeMessage),
  });

  const bundleId = `fanbundle-${fnv1a(
    `${safeAuthor}\u0000${safeMessage}\u0000${normalized.map((i) => `${i.id}:${i.kind}`).join("|")}`,
  )}`;

  const manifestObject = {
    version: FAN_BUNDLE_VERSION,
    kind: "fan-bundle" as const,
    id: bundleId,
    authorName: safeAuthor,
    thankYouMessage: safeMessage,
    itemCount: normalized.length,
    items: normalized.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      sizeBytes: byteLength(item.data),
    })),
  };

  return {
    id: bundleId,
    items: normalized,
    authorName: safeAuthor,
    thankYouMessage: safeMessage,
    manifest: JSON.stringify(manifestObject, null, 2),
  };
}
