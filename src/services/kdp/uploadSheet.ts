// Upload-Spreadsheet (Sprint 5, Agent 3): KDP-Bulk-Upload-Metadaten als CSV.
//
// Erzeugt aus den finalen Buch-Metadaten eine RFC-4180-konforme CSV, die die
// Pflichtfelder des Amazon-KDP-Uploads abbildet:
//
//   Title, Subtitle, Author, Description (HTML), Keyword 1-7,
//   Primary Category, ISBN (Paperback/eBook/Hardcover),
//   List Price (USD/EUR/GBP), Pricing Strategy, Language
//
// Design-Vertrag:
// - Rein deterministisch (kein LLM-Call, kein API-Budget).
// - ISBN-Platzhalter: nicht vergebene ISBNs werden als Token
//   "{{ISBN:FORMAT}}" geschrieben (z.B. {{ISBN:PAPERBACK}}) — sie werden beim
//   ISBN-Kauf/Assets durch resolveIsbnPlaceholder ersetzt.
// - Preisstrategie konfigurierbar: eine Zeile kann feste Preise pro Währung
//   tragen; Pricing-Strategien liefert pricingStrategy.ts (deterministisch).
// - Keine Breaking Changes: neues Modul, bestehende Interfaces unangetastet.

import { logger } from "@/services/logger";

export const ISBN_PLACEHOLDER_PREFIX = "{{ISBN:";
export const ISBN_PLACEHOLDER_SUFFIX = "}}";

/** Platzhalter-Token für eine noch nicht vergebene ISBN. */
export function isbnPlaceholder(format: IsbnFormat): string {
  return `${ISBN_PLACEHOLDER_PREFIX}${format.toUpperCase()}${ISBN_PLACEHOLDER_SUFFIX}`;
}

/** Buchformate mit ISBN-Slot. */
export type IsbnFormat = "paperback" | "ebook" | "hardcover";

export const ISBN_FORMATS: IsbnFormat[] = ["paperback", "ebook", "hardcover"];

/** Prüft, ob ein String ein ISBN-Platzhalter-Token ist; liefert das Format. */
export function parseIsbnPlaceholder(value: string): IsbnFormat | null {
  if (!value.startsWith(ISBN_PLACEHOLDER_PREFIX) || !value.endsWith(ISBN_PLACEHOLDER_SUFFIX)) {
    return null;
  }
  const inner = value.slice(ISBN_PLACEHOLDER_PREFIX.length, value.length - ISBN_PLACEHOLDER_SUFFIX.length);
  const fmt = inner.toLowerCase();
  return (ISBN_FORMATS as string[]).includes(fmt) ? (fmt as IsbnFormat) : null;
}

/** ISBN-13-Prüfsumme (optional nutzbar vor Upload). */
export function isValidIsbn13(isbn: string): boolean {
  const digits = isbn.replace(/[-\s]/g, "");
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

/** Ersetzt ISBN-Platzhalter-Tokens durch konkrete ISBNs. */
export function resolveIsbnPlaceholders(
  text: string,
  isbns: Partial<Record<IsbnFormat, string>>,
): string {
  return text.replace(
    /\{\{ISBN:(paperback|ebook|hardcover)\}\}/gi,
    (_m, fmt: string) => {
      const key = fmt.toLowerCase() as IsbnFormat;
      return isbns[key] ?? _m;
    },
  );
}

// --- Spalten-Definition -----------------------------------------------------------

/** Spalten in KDP-Upload-Reihenfolge. */
export const UPLOAD_SHEET_COLUMNS = [
  "Title",
  "Subtitle",
  "Author",
  "Description (HTML)",
  "Keyword 1",
  "Keyword 2",
  "Keyword 3",
  "Keyword 4",
  "Keyword 5",
  "Keyword 6",
  "Keyword 7",
  "Primary Category",
  "ISBN (Paperback)",
  "ISBN (eBook)",
  "ISBN (Hardcover)",
  "List Price (USD)",
  "List Price (EUR)",
  "List Price (GBP)",
  "Pricing Strategy",
  "Language",
] as const;

export type UploadSheetColumn = (typeof UPLOAD_SHEET_COLUMNS)[number];

/** ISO-Sprachcode für die Language-Spalte. */
export type SheetLanguage = "de" | "en" | "fr" | "es" | "it";

/** Preis-Mapping pro Währung. */
export type SheetPrices = {
  USD?: number;
  EUR?: number;
  GBP?: number;
};

/** ISBN-Zuordnung je Format (null/undefined = Platzhalter). */
export interface SheetIsbn {
  format: IsbnFormat;
  /** Konkrete ISBN-13 oder null → Platzhalter-Token. */
  isbn: string | null;
}

/** Eingabe für eine Datenzeile. */
export interface UploadSheetRowInput {
  title: string;
  subtitle?: string;
  author?: string;
  /** Klartext-Klappentext; wird zu HTML (Absätze → <p>). */
  description: string;
  /** Bis zu 7 Keywords; darüber hinaus verworfen (mit Warning). */
  keywords: string[];
  /** Amazon-KDP-Kategorie-Pfad, z.B. "Fiction > Mystery & Detective > General". */
  primaryCategory: string;
  language?: SheetLanguage;
  isbns?: SheetIsbn[];
  /** Feste Preise pro Währung (aus der gewählten Preisstrategie). */
  pricing?: {
    strategy?: string;
    prices: SheetPrices;
  };
}

export interface UploadSheetOptions {
  /** UTF-8-BOM voranstellen (Excel-Kompatibilität). Default: false. */
  bom?: boolean;
}

export interface UploadSheetResult {
  /** CSV-Inhalt (Header + Datenzeilen, CRLF-frei via \n). */
  csv: string;
  /** Anzahl Datenzeilen (ohne Header). */
  rowCount: number;
  /** Nicht-kritische Hinweise (z.B. >7 Keywords). */
  warnings: string[];
}

// --- Helpers -----------------------------------------------------------------------

/** Escapet ein CSV-Feld nach RFC 4180 (Quotes bei Komma/Quote/Newline). */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Wandelt Klartext-Absätze in HTML-<p>-Tags (HTML-Sonderzeichen escaped). */
export function toHtmlDescription(text: string): string {
  const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
}

function formatPrice(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toFixed(2);
}

const ISBN_COLUMN_LABELS: Record<IsbnFormat, string> = {
  paperback: "Paperback",
  ebook: "eBook",
  hardcover: "Hardcover",
};

// --- Builder -------------------------------------------------------------------------

/**
 * Baut das KDP-Bulk-Upload-Sheet (CSV) aus den Buch-Metadaten.
 * Deterministisch: gleicher Input → gleicher Output.
 */
export function buildKdpUploadSheet(
  options: UploadSheetRowInput[] | { rows: UploadSheetRowInput[] } & UploadSheetOptions,
): UploadSheetResult {
  // Overload-Freundlichkeit: Array direkt oder Objekt mit rows + Optionen.
  const { rows, options: opts } = Array.isArray(options)
    ? { rows: options, options: {} as UploadSheetOptions }
    : { rows: options.rows, options: options as UploadSheetOptions };

  const bom = opts.bom ?? false;
  const warnings: string[] = [];

  if (rows.length === 0) {
    throw new Error("Upload-Sheet ohne Zeilen kann nicht erstellt werden.");
  }

  const header = [...UPLOAD_SHEET_COLUMNS] as string[];
  const dataRows: string[][] = [];

  for (const row of rows) {
    if (!row.title || !row.title.trim()) {
      throw new Error("Upload-Zeile ohne Titel kann nicht erstellt werden.");
    }
    if (!row.description || !row.description.trim()) {
      throw new Error(`Upload-Zeile "${row.title}" ohne Beschreibung kann nicht erstellt werden.`);
    }

    // Keywords: max. 7 (KDP-Limit), je max. 50 Zeichen.
    const rawKeywords = (row.keywords ?? []).map((k) => k.trim()).filter(Boolean);
    const usable = rawKeywords.filter((k) => k.length <= 50);
    const droppedLong = rawKeywords.length - usable.length;
    if (droppedLong > 0) {
      warnings.push(`${droppedLong} Keyword(s) über 50 Zeichen verworfen (KDP-Limit).`);
    }
    const keywords = usable.slice(0, 7);
    if (usable.length > 7) {
      warnings.push(`${usable.length - 7} Keyword(s) über Slot 7 verworfen (KDP erlaubt max. 7).`);
    }

    // ISBNs: Format → Wert oder Platzhalter.
    const isbnMap = new Map<IsbnFormat, string>();
    for (const entry of row.isbns ?? []) {
      if (entry.isbn && entry.isbn.trim()) {
        isbnMap.set(entry.format, entry.isbn.trim());
      }
    }

    const cells = new Map<string, string>();
    const set = (col: UploadSheetColumn, value: string): void => {
      cells.set(col, escapeCsvField(value));
    };

    set("Title", row.title.trim());
    set("Subtitle", (row.subtitle ?? "").trim());
    set("Author", (row.author ?? "").trim());
    set("Description (HTML)", toHtmlDescription(row.description));
    for (let i = 0; i < 7; i++) {
      set(`Keyword ${i + 1}` as UploadSheetColumn, keywords[i] ?? "");
    }
    set("Primary Category", (row.primaryCategory ?? "").trim());

    for (const fmt of ISBN_FORMATS) {
      const label = ISBN_COLUMN_LABELS[fmt];
      set(`ISBN (${label})` as UploadSheetColumn, isbnMap.get(fmt) ?? isbnPlaceholder(fmt));
    }

    set("List Price (USD)", formatPrice(row.pricing?.prices.USD));
    set("List Price (EUR)", formatPrice(row.pricing?.prices.EUR));
    set("List Price (GBP)", formatPrice(row.pricing?.prices.GBP));
    set("Pricing Strategy", (row.pricing?.strategy ?? "").trim());
    set("Language", row.language ?? "de");

    dataRows.push(header.map((col) => cells.get(col) ?? ""));
  }

  const lines = [header.join(","), ...dataRows.map((r) => r.join(","))];
  let csv = lines.join("\n");
  if (bom) csv = "\uFEFF" + csv;

  const result: UploadSheetResult = { csv, rowCount: dataRows.length, warnings };
  logger.info(
    `KDP-Upload-Sheet erstellt: ${dataRows.length} Buch/Bücher, ${header.length} Spalten${warnings.length ? `, ${warnings.length} Warnung(en)` : ""}`,
    "buildKdpUploadSheet",
  );
  return result;
}

// --- ContextManager-Brücke ----------------------------------------------------------

/**
 * Erzeugt eine Upload-Sheet-Zeile aus der Fakten-Base des ContextManagers.
 * Die Fakten-Arten "isbn" und "pricing" liefern ISBN-/Preis-Daten;
 * Titel/Untertitel/Autor/Beschreibung/Keywords/Kategorie kommen als Parameter.
 */
export function buildSheetRowFromFacts(
  base: Omit<UploadSheetRowInput, "isbns" | "pricing">,
  facts: Array<{ kind: string; key: string; value: string }>,
): UploadSheetRowInput {
  const isbns: SheetIsbn[] = [];
  let strategy: string | undefined;
  const prices: SheetPrices = {};

  for (const f of facts) {
    if (f.kind === "isbn") {
      const fmt = f.key.trim().toLowerCase();
      if ((ISBN_FORMATS as string[]).includes(fmt)) {
        isbns.push({ format: fmt as IsbnFormat, isbn: f.value.trim() || null });
      }
    } else if (f.kind === "pricing") {
      const key = f.key.trim();
      if (key === "strategy") {
        strategy = f.value.trim();
      } else if (key === "USD" || key === "EUR" || key === "GBP") {
        const n = Number(f.value);
        if (!Number.isNaN(n)) prices[key] = n;
      }
    }
  }

  return {
    ...base,
    isbns,
    pricing: Object.keys(prices).length > 0 || strategy ? { strategy, prices } : undefined,
  };
}
