// Print & Layout-Service: Seitenformate, Ränder, Kopf-/Fußzeilen, Typografie
// und Buch-Layout (Hardcover/Softcover). Liefert die Datenbasis für die
// Print-Vorschau und den PDF-Layout-Editor und wird vom Export-Service
// (PDF) übernommen.
//
// Persistenz: localStorage (Client-Einstellungen, kein DB-Schema nötig).

// --- Seitengrößen -----------------------------------------------------------

export type PageSizeId = "a4" | "a5" | "us-letter" | "6x9" | "5.25x8";

export interface PageSize {
  id: PageSizeId;
  label: string;
  /** Breite/Höhe in Millimetern. */
  widthMm: number;
  heightMm: number;
}

/** mm → PDF-Punkte (pdf-lib arbeitet in pt, 1 pt = 1/72 inch). */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export const PAGE_SIZES: Record<PageSizeId, PageSize> = {
  a4: { id: "a4", label: "A4 (210 × 297 mm)", widthMm: 210, heightMm: 297 },
  a5: { id: "a5", label: "A5 (148 × 210 mm)", widthMm: 148, heightMm: 210 },
  "us-letter": { id: "us-letter", label: "US Letter (216 × 279 mm)", widthMm: 215.9, heightMm: 279.4 },
  "6x9": { id: "6x9", label: "Trade 6″ × 9″ (152 × 229 mm)", widthMm: 152.4, heightMm: 228.6 },
  "5.25x8": { id: "5.25x8", label: "Digest 5.25″ × 8″ (133 × 203 mm)", widthMm: 133.35, heightMm: 203.2 },
};

// --- Ränder -----------------------------------------------------------------

export interface PageMargins {
  /** Alle Werte in Millimetern. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGINS: PageMargins = { top: 25, right: 25, bottom: 25, left: 25 };

export const MARGIN_PRESETS: { label: string; margins: PageMargins }[] = [
  { label: "Standard", margins: { top: 25, right: 25, bottom: 25, left: 25 } },
  { label: "Buch (schmal)", margins: { top: 20, right: 17, bottom: 20, left: 17 } },
  { label: "Weit", margins: { top: 35, right: 35, bottom: 35, left: 35 } },
  { label: "Manuskript", margins: { top: 25, right: 40, bottom: 25, left: 40 } },
];

// --- Kopf-/Fußzeilen --------------------------------------------------------

export interface HeaderFooterConfig {
  headerEnabled: boolean;
  footerEnabled: boolean;
  /** Links/Mitte/Rechts; Tokens: {title} {author} {page} {chapter} — "{page}" nur im Footer. */
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  fontSizePt: number;
}

export const DEFAULT_HEADER_FOOTER: HeaderFooterConfig = {
  headerEnabled: false,
  footerEnabled: true,
  headerLeft: "",
  headerCenter: "{title}",
  headerRight: "",
  footerLeft: "",
  footerCenter: "{page}",
  footerRight: "",
  fontSizePt: 9,
};

/** Ersetzt Tokens ({title}, {author}, {page}) im Zeilentext. */
export function renderHfToken(
  template: string,
  ctx: { title: string; author: string; page: number },
): string {
  return template
    .replace(/\{title\}/g, ctx.title)
    .replace(/\{author\}/g, ctx.author)
    .replace(/\{page\}/g, String(ctx.page));
}

// --- Typografie -------------------------------------------------------------

export type FontFamilyId = "serif" | "sans" | "mono";
export type ParagraphAlign = "left" | "justify";

export interface TypographySettings {
  fontFamily: FontFamilyId;
  /** Fließtext-Größe in pt. */
  fontSizePt: number;
  /** Zeilenabstand als Vielfaches der Schriftgröße (1.0–2.0). */
  lineHeight: number;
  paragraphAlign: ParagraphAlign;
  /** Erstzeilen-Einzug in mm (0 = aus). */
  firstLineIndentMm: number;
  /** Abstand nach Absatz in pt. */
  paragraphSpacingPt: number;
  /** Skalierung der Überschriften relativ zur Fließtextgröße. */
  headingScale: number;
}

export const FONT_FAMILY_LABELS: Record<FontFamilyId, string> = {
  serif: "Serif (Times/Georgia)",
  sans: "Serifenlos (Helvetica)",
  mono: "Monospace (Courier)",
};

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontFamily: "serif",
  fontSizePt: 12,
  lineHeight: 1.5,
  paragraphAlign: "left",
  firstLineIndentMm: 0,
  paragraphSpacingPt: 6,
  headingScale: 1.5,
};

// --- Buch-Layout ------------------------------------------------------------

export type BookFormat = "hardcover" | "softcover" | "paperback";

export interface BookLayoutSettings {
  format: BookFormat;
  /** Zuschnitt des Innenblocks. */
  trim: PageSizeId;
  /** Geschätzte Seitenzahl (aus Wortzahl berechnet, vom Editor überschreibbar). */
  pageCount: number;
  /** Anschnitt für Hardcover-Cover in mm. */
  bleedMm: number;
  /** Papierdicke je Seite in mm (Cream 80g ≈ 0.1, Standard ≈ 0.09). */
  paperThicknessMm: number;
  title: string;
  author: string;
}

export const DEFAULT_BOOK_LAYOUT: BookLayoutSettings = {
  format: "softcover",
  trim: "6x9",
  pageCount: 200,
  bleedMm: 3,
  paperThicknessMm: 0.09,
  title: "",
  author: "",
};

export const BOOK_FORMAT_LABELS: Record<BookFormat, string> = {
  hardcover: "Hardcover",
  softcover: "Softcover (Trade)",
  paperback: "Paperback (Mass Market)",
};

/**
 * Buchrückenbreite in mm: Seitenzahl × Papierdicke + Pappenabzug bei Hardcover.
 * Rough guide: Hardcover-Pappen addieren ca. 3 mm.
 */
export function calcSpineWidthMm(s: Pick<BookLayoutSettings, "pageCount" | "paperThicknessMm" | "format">): number {
  const base = Math.max(s.pageCount, 1) * s.paperThicknessMm;
  return s.format === "hardcover" ? base + 3 : base;
}

/** Gesamtbreite des Umschlags in mm (Rücken + 2 × Innenblock + 2 × Beschnitt). */
export function calcCoverWidthMm(s: BookLayoutSettings): number {
  const page = PAGE_SIZES[s.trim];
  return calcSpineWidthMm(s) + 2 * page.widthMm + 2 * s.bleedMm;
}

export function calcCoverHeightMm(s: BookLayoutSettings): number {
  return PAGE_SIZES[s.trim].heightMm + 2 * s.bleedMm;
}

/** Grobe Schätzung der Seitenzahl aus Wortzahl (≈ 280 Wörter/Seite Trade). */
export function estimatePageCount(wordCount: number, trim: PageSizeId = "6x9"): number {
  const wordsPerPage = trim === "6x9" || trim === "5.25x8" ? 280 : 400;
  return Math.max(1, Math.ceil(wordCount / wordsPerPage));
}

// --- Vorschau-Pagination ----------------------------------------------------

/** Paginierte Vorschau-Seite: enthält die Blöcke, die auf diese Seite fallen. */
export interface PreviewPage {
  pageNumber: number;
  blocks: PreviewBlock[];
  /** true, wenn der Umbruch mitten in einem Absatz erzwungen wurde. */
  breakMidParagraph: boolean;
}

export interface PreviewBlock {
  type: "h1" | "h2" | "h3" | "p" | "quote" | "code" | "list_item";
  text: string;
  /** Geschätzte Zeilenanzahl des Blocks auf dieser Seite. */
  lines: number;
}

/**
 * Schätzt den Zeilenumbruch pro Block anhand des zur Verfügung stehenden
 * Textbereichs (Zeichenbreite ≈ 0.5 × Schriftgröße) und paginiert Blöcke
 * seitenweise. Guter Näherungswert für die Seitenansicht — das endgültige
 * Layout bestimmt der PDF/Drucker-Renderer.
 */
export function paginateBlocks(
  blocks: { type: string; text: string }[],
  opts: {
    page: PageSize;
    margins: PageMargins;
    typography: TypographySettings;
  },
): PreviewPage[] {
  const { page, margins, typography } = opts;
  const contentWidthMm = Math.max(page.widthMm - margins.left - margins.right, 20);
  const contentHeightMm = Math.max(page.heightMm - margins.top - margins.bottom, 20);
  // 1 mm ≈ 2.83 pt
  const contentHeightPt = contentHeightMm * 2.83;
  // Ø Zeichenbreite ≈ 0.5 em (Serif-Flattersatz-Näherung).
  const charsPerLine = Math.max(
    10,
    Math.floor((contentWidthMm * 2.83) / (typography.fontSizePt * 0.5)),
  );
  const linePt = typography.fontSizePt * typography.lineHeight;
  const maxLines = Math.max(4, Math.floor(contentHeightPt / linePt));

  const pages: PreviewPage[] = [];
  let current: PreviewPage = { pageNumber: 1, blocks: [], breakMidParagraph: false };
  let used = 0;

  const pushPage = (mid: boolean) => {
    pages.push(current);
    current = { pageNumber: pages.length + 1, blocks: [], breakMidParagraph: mid };
    used = 0;
  };

  for (const b of blocks) {
    const size =
      b.type === "h1" ? typography.fontSizePt * typography.headingScale
      : b.type === "h2" ? typography.fontSizePt * (typography.headingScale + 0.6) / 1.5
      : b.type === "h3" ? typography.fontSizePt * (typography.headingScale + 0.3) / 1.5
      : b.type === "code" ? typography.fontSizePt * 0.85
      : typography.fontSizePt;
    const lh = size * typography.lineHeight + (b.type === "p" ? typography.paragraphSpacingPt : 0);
    const text = b.text || "";
    const rawLines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const blockLinesPt = rawLines * lh + (b.type.startsWith("h") ? 4 : 0);

    // Überschriften bleiben zusammen mit mindestens zwei Folgezeilen.
    if (b.type.startsWith("h") && used + Math.min(rawLines, 3) * lh > maxLines * linePt) {
      pushPage(false);
    }

    if (used + blockLinesPt <= maxLines * linePt) {
      current.blocks.push({ type: b.type as PreviewBlock["type"], text, lines: rawLines });
      used += blockLinesPt;
      continue;
    }

    // Block splitten: was passt, auf die Seite; Rest auf die nächste.
    const remainingPt = maxLines * linePt - used;
    const fitLines = Math.max(0, Math.floor(remainingPt / lh));
    if (fitLines > 0) {
      const chars = fitLines * charsPerLine;
      current.blocks.push({ type: b.type as PreviewBlock["type"], text: text.slice(0, chars), lines: fitLines });
      pushPage(true);
      current.blocks.push({ type: b.type as PreviewBlock["type"], text: text.slice(chars), lines: rawLines - fitLines });
      used = (rawLines - fitLines) * lh;
    } else {
      pushPage(false);
      current.blocks.push({ type: b.type as PreviewBlock["type"], text, lines: rawLines });
      used = blockLinesPt;
    }
  }
  pages.push(current);
  return pages;
}

// --- Persistenz -------------------------------------------------------------

const STORAGE_KEY = "aiws.printlayout.v1";

export interface PrintLayout {
  pageSize: PageSizeId;
  margins: PageMargins;
  headerFooter: HeaderFooterConfig;
  typography: TypographySettings;
  book: BookLayoutSettings;
}

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  pageSize: "a4",
  margins: DEFAULT_MARGINS,
  headerFooter: DEFAULT_HEADER_FOOTER,
  typography: DEFAULT_TYPOGRAPHY,
  book: DEFAULT_BOOK_LAYOUT,
};

export function loadPrintLayout(): PrintLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINT_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<PrintLayout>;
    return {
      pageSize: parsed.pageSize ?? DEFAULT_PRINT_LAYOUT.pageSize,
      margins: { ...DEFAULT_MARGINS, ...(parsed.margins ?? {}) },
      headerFooter: { ...DEFAULT_HEADER_FOOTER, ...(parsed.headerFooter ?? {}) },
      typography: { ...DEFAULT_TYPOGRAPHY, ...(parsed.typography ?? {}) },
      book: { ...DEFAULT_BOOK_LAYOUT, ...(parsed.book ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PRINT_LAYOUT };
  }
}

export function savePrintLayout(layout: PrintLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Speichern ist best-effort (z. B. im Private Mode).
  }
}
