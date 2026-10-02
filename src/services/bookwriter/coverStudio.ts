// Cover-Studio (WP 10.2): Spine-Calculator & Umschlag-SVG.
//
// Lokal, deterministisch, ohne LLM. Der Service berechnet die Buchrückenbreite
// aus Seitenzahl und Papierart, schätzt die Seitenzahl aus der Wortzahl und
// erzeugt ein druckfähiges Umschlag-SVG (Rückseite + Rücken + Vorderseite)
// inklusive Beschnittzugabe (Bleed, Default 3 mm).
//
// Entwurfsregeln (analog printPreflight.ts):
// - Reine Funktionen, kein IO, keine Zufallswerte, keine Zeitstempel.
// - Defensiv: fehlende/ungültige Eingaben liefern dokumentierte Fallbacks,
//   die Funktionen werfen nie.
//
// Druckkoordinaten: Alle Maße in Millimetern. Das SVG nutzt mm als Einheit
// (`width="…mm"`) und einen viewBox in mm, damit 1 Einheit = 1 mm gilt.

// ---------------------------------------------------------------------------
// Typen & Konstanten
// ---------------------------------------------------------------------------

/** Papierart → Papiervolumen je Blatt (2 Seiten) in mm. */
export type PaperTypeId =
  | "standard"
  | "white"
  | "cream"
  | "cream-80"
  | "premium-color";

/**
 * Papiervolumen je Blatt in mm (ein Blatt = 2 Seiten).
 *
 * Werte entsprechen den gängigen KDP-Papierdicken je Seite:
 * - White/Standard ≈ 0,0572 mm/Seite  → 0,1144 mm/Blatt
 * - Cream 80g      ≈ 0,0635 mm/Seite  → 0,1270 mm/Blatt
 *
 * Deutsche Aliase ("weiss", "creme") sind enthalten; die Suche ist
 * case-insensitiv und trimmt Leerraum.
 */
export const PAPER_TYPES: Record<string, number> = {
  standard: 0.1144,
  white: 0.1144,
  weiss: 0.1144,
  cream: 0.127,
  "cream-80": 0.127,
  creme: 0.127,
  "premium-color": 0.1144,
};

/** Fallback-Papierart, wenn keine/ungültige Angabe vorliegt. */
export const DEFAULT_PAPER_TYPE: PaperTypeId = "standard";

/** Fallback: Wörter je Seite für die Seitenzahl-Schätzung (Trade 6×9). */
export const DEFAULT_WORDS_PER_PAGE = 250;

/** Default-Trimbreite einer Einzelseite (Trade 6″ = 152,4 mm). */
export const DEFAULT_COVER_WIDTH = 152.4;

/** Default-Trimhöhe einer Einzelseite (Trade 9″ = 228,6 mm). */
export const DEFAULT_COVER_HEIGHT = 228.6;

/** Default-Beschnittzugabe in mm. */
export const DEFAULT_BLEED = 3;

/** Default-Rückenbreite in mm, falls keine gültige übergeben wird. */
export const DEFAULT_SPINE_WIDTH = 12;

/** Optionen für generateCoverSvg (alle optional, defensiv validiert). */
export interface CoverOptions {
  /** Trimbreite einer Einzelseite in mm (ohne Beschnitt). */
  width?: number;
  /** Trimhöhe in mm (ohne Beschnitt). */
  height?: number;
  /** Beschnittzugabe in mm. */
  bleed?: number;
  /** Rückenbreite in mm — überschreibt den Positionsparameter, wenn gültig. */
  spineWidth?: number;
}

const FALLBACK_TITLE = "Ohne Titel";
const FALLBACK_AUTHOR = "Unbekannter Autor";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Liefert einen bereinigten String oder einen Fallback (defensiv). */
function clean(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Zahl auf 2 Nachkommastellen runden (deterministische, lesbare Ausgabe). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Endliche Zahl > 0 oder Fallback. */
function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/** Endliche Zahl ≥ 0 oder Fallback. */
function nonNegative(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

/** Formatiert eine Zahl für die SVG-Ausgabe (max. 2 Nachkommastellen). */
function fmt(value: number): string {
  return String(round2(value));
}

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escaped XML-Sonderzeichen, damit Titel/Autor kein SVG zerstören. */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);
}

/** Papiervolumen je Blatt in mm für eine Papierart (case-insensitiv). */
function paperVolume(paperType: unknown): number {
  const fallback = PAPER_TYPES[DEFAULT_PAPER_TYPE]!;
  if (typeof paperType !== "string") return fallback;
  const key = paperType.trim().toLowerCase();
  return PAPER_TYPES[key] ?? fallback;
}

// ---------------------------------------------------------------------------
// 1) Rückenbreite
// ---------------------------------------------------------------------------

/**
 * Berechnet die Buchrückenbreite in mm.
 *
 * Formel: (Seitenzahl / 2) × Papiervolumen (mm je Blatt = 2 Seiten).
 *
 * Defensiv: negative/ungültige Seitenzahlen ergeben 0; unbekannte Papierarten
 * fallen auf {@link DEFAULT_PAPER_TYPE} zurück. Das Ergebnis wird auf zwei
 * Nachkommastellen gerundet.
 *
 * @param pageCount Seitenzahl des Innenblocks
 * @param paperType Papierart (z. B. "standard", "cream"); Aliasse möglich
 */
export function calculateSpineWidth(pageCount: number, paperType: string): number {
  const pages =
    typeof pageCount === "number" && Number.isFinite(pageCount) && pageCount > 0
      ? pageCount
      : 0;
  return round2((pages / 2) * paperVolume(paperType));
}

// ---------------------------------------------------------------------------
// 2) Seitenzahl-Schätzung
// ---------------------------------------------------------------------------

/**
 * Schätzt die Seitenzahl aus der Wortanzahl.
 *
 * Defensiv: ungültige Wortanzahl ⇒ Minimum 1 Seite; ungültiges
 * {@link wordsPerPage} ⇒ {@link DEFAULT_WORDS_PER_PAGE}.
 *
 * @param wordCount    Gesamtwortzahl des Manuskripts
 * @param wordsPerPage Wörter je Seite (Default 250)
 */
export function estimatePageCount(
  wordCount: number,
  wordsPerPage: number = DEFAULT_WORDS_PER_PAGE,
): number {
  const perPage =
    typeof wordsPerPage === "number" && Number.isFinite(wordsPerPage) && wordsPerPage > 0
      ? wordsPerPage
      : DEFAULT_WORDS_PER_PAGE;
  const words =
    typeof wordCount === "number" && Number.isFinite(wordCount) && wordCount > 0
      ? wordCount
      : 0;
  return Math.max(1, Math.ceil(words / perPage));
}

// ---------------------------------------------------------------------------
// 3) Umschlag-SVG
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein druckfähiges Umschlag-SVG (Full Wrap) mit Rückseite, Rücken und
 * Vorderseite inkl. Beschnittzugabe.
 *
 * Aufbau (Maße in mm, viewBox 1 Einheit = 1 mm):
 *   [Bleed] [Rückseite] [Rücken] [Vorderseite] [Bleed]
 * Gesamtbreite  = 2 × width + spine + 2 × bleed
 * Gesamthöhe    = height + 2 × bleed
 *
 * Der Rücken aus `options.spineWidth` überschreibt den Positionsparameter,
 * sofern er eine gültige Zahl ≥ 0 ist. Alle anderen Optionen fallen bei
 * ungültigen Werten auf ihre Defaults zurück. Titel/Autor werden XML-escaped;
 * leere Angaben erhalten einen Fallback. Das Ergebnis ist deterministisch.
 *
 * @param title       Buchtitel (Vorderseite + Rücken)
 * @param author      Autor (Vorderseite)
 * @param spineWidth  Rückenbreite in mm (Fallback, meist aus calculateSpineWidth)
 * @param options     Optionale Maße/Überschreibungen
 */
export function generateCoverSvg(
  title: string,
  author: string,
  spineWidth: number,
  options: CoverOptions = {},
): string {
  const safeTitle = clean(title, FALLBACK_TITLE);
  const safeAuthor = clean(author, FALLBACK_AUTHOR);

  const width = positive(options.width, DEFAULT_COVER_WIDTH);
  const height = positive(options.height, DEFAULT_COVER_HEIGHT);
  const bleed = nonNegative(options.bleed, DEFAULT_BLEED);
  // Option gewinnt, wenn gültig; sonst Positionsparameter; sonst Default.
  const spine = nonNegative(
    options.spineWidth,
    nonNegative(spineWidth, DEFAULT_SPINE_WIDTH),
  );

  const totalWidth = 2 * width + spine + 2 * bleed;
  const totalHeight = height + 2 * bleed;

  const backX = bleed;
  const spineX = bleed + width;
  const frontX = bleed + width + spine;

  const trimWidth = 2 * width + spine;
  const spineCenterX = spineX + spine / 2;
  const centerY = bleed + height / 2;
  const frontCenterX = frontX + width / 2;

  const titleFont = Math.max(6, Math.min(width, height) * 0.09);
  const authorFont = Math.max(5, Math.min(width, height) * 0.05);
  const spineFont = Math.max(5, Math.min(spine > 0 ? spine : 8, height * 0.04));

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(totalWidth)}mm" height="${fmt(totalHeight)}mm" viewBox="0 0 ${fmt(totalWidth)} ${fmt(totalHeight)}" role="img" aria-label="${escapeXml(safeTitle)}">`,
  );
  lines.push(`  <title>${escapeXml(safeTitle)} — ${escapeXml(safeAuthor)}</title>`);
  // Grundfläche (inkl. Beschnitt).
  lines.push(
    `  <rect x="0" y="0" width="${fmt(totalWidth)}" height="${fmt(totalHeight)}" fill="#ffffff"/>`,
  );
  // Rückseite.
  lines.push(
    `  <rect x="${fmt(backX)}" y="${fmt(bleed)}" width="${fmt(width)}" height="${fmt(height)}" fill="#f4f1ea" stroke="#333333" stroke-width="0.3"/>`,
  );
  // Rücken.
  lines.push(
    `  <rect x="${fmt(spineX)}" y="${fmt(bleed)}" width="${fmt(spine)}" height="${fmt(height)}" fill="#d9cfbf" stroke="#333333" stroke-width="0.3"/>`,
  );
  // Vorderseite.
  lines.push(
    `  <rect x="${fmt(frontX)}" y="${fmt(bleed)}" width="${fmt(width)}" height="${fmt(height)}" fill="#ffffff" stroke="#333333" stroke-width="0.3"/>`,
  );
  // Beschnitt-/Schnittmarkierung (Trim-Bereich, gestrichelt).
  lines.push(
    `  <rect x="${fmt(bleed)}" y="${fmt(bleed)}" width="${fmt(trimWidth)}" height="${fmt(height)}" fill="none" stroke="#999999" stroke-width="0.2" stroke-dasharray="2 2"/>`,
  );
  // Vorderseite: Titel + Autor.
  lines.push(
    `  <text x="${fmt(frontCenterX)}" y="${fmt(bleed + height * 0.38)}" text-anchor="middle" font-family="Georgia, serif" font-size="${fmt(titleFont)}" font-weight="bold" fill="#1a1a1a">${escapeXml(safeTitle)}</text>`,
  );
  lines.push(
    `  <text x="${fmt(frontCenterX)}" y="${fmt(bleed + height * 0.82)}" text-anchor="middle" font-family="Georgia, serif" font-size="${fmt(authorFont)}" fill="#1a1a1a">${escapeXml(safeAuthor)}</text>`,
  );
  // Rücken: Titel um 90° gedreht.
  lines.push(
    `  <text x="${fmt(spineCenterX)}" y="${fmt(centerY)}" transform="rotate(-90 ${fmt(spineCenterX)} ${fmt(centerY)})" text-anchor="middle" font-family="Georgia, serif" font-size="${fmt(spineFont)}" fill="#1a1a1a">${escapeXml(safeTitle)}</text>`,
  );
  lines.push(`</svg>`);

  return lines.join("\n");
}
