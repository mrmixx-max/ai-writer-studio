// Distribution-Pipeline-Service (WP 21.2, ONIX 3.0).
//
// Erzeugt buchhändlerische Metadaten als ONIX-3.0-XML, prüft Bücher gegen die
// 15 häufigsten Ablehnungsgründe der Distributoren und liefert die Profile für
// Amazon KDP, IngramSpark, Tolino und Apple Books.
//
// Rein lokal und deterministisch: keine Netzwerk-, keine LLM-Aufrufe. Bei
// fehlenden oder ungültigen Eingaben greifen defensive Fallbacks, statt zu
// werfen (Ausnahme: ein unbekannter Distributor — das ist ein Programmierfehler).

/** Unterstützte Distributionskanäle. */
export type Distributor = "kdp" | "ingramspark" | "tolino" | "apple";

/** Buchhändlerische Metadaten eines Werks. */
export interface BookMetadata {
  title: string;
  author: string;
  isbn: string;
  price: number;
  currency: string;
  language: string;
  publisher: string;
  publicationDate: string;
  pages: number;
  format: string;
  subjects: string[];
}

/** Ein einzelnes Compliance-Problem mit stabilem Code. */
export interface ComplianceIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

/** Lieferprofil eines Distributors. */
export interface DistributorProfile {
  name: string;
  requiredFormats: string[];
  maxFileSizeMB: number;
  colorModel: "RGB" | "CMYK";
  requiresIsbn: boolean;
}

/** Optionale Stellschrauben für die ONIX-Ausgabe (für deterministische Tests). */
export interface OnixOptions {
  /** Sender-Name im ONIX-Header. Default: "AI Writer Studio". */
  senderName?: string;
  /** Lieferantenname in ProductSupply. Default: "AI Writer Studio". */
  supplierName?: string;
  /**
   * Zeitstempel des Versands (ISO-8601). Wird NUR ausgegeben, wenn gesetzt —
   * so bleibt die Ausgabe ohne Option vollständig deterministisch.
   */
  sentDate?: string;
}

/** ONIX-3.0-Referenz-Namensraum. */
export const ONIX_REFERENCE_NS = "http://ns.editeur.org/onix/3.0/reference";

/** ONIX-Release-Version. */
export const ONIX_RELEASE = "3.0";

const DEFAULT_SENDER_NAME = "AI Writer Studio";

// --- Distributor-Profile ---------------------------------------------------

/**
 * Profile der vier Kanäle. Farbmodell und Formate folgen den Vorgaben der
 * Plattformen (IngramSpark druckt CMYK, die reinen E-Book-Kanäle RGB).
 */
export const DISTRIBUTOR_PROFILES: Record<Distributor, DistributorProfile> = {
  kdp: {
    name: "Amazon KDP",
    requiredFormats: ["EPUB", "MOBI", "KPF", "PDF"],
    maxFileSizeMB: 650,
    colorModel: "RGB",
    requiresIsbn: false,
  },
  ingramspark: {
    name: "IngramSpark",
    requiredFormats: ["PDF", "EPUB"],
    maxFileSizeMB: 500,
    colorModel: "CMYK",
    requiresIsbn: true,
  },
  tolino: {
    name: "Tolino",
    requiredFormats: ["EPUB"],
    maxFileSizeMB: 200,
    colorModel: "RGB",
    requiresIsbn: true,
  },
  apple: {
    name: "Apple Books",
    requiredFormats: ["EPUB"],
    maxFileSizeMB: 2000,
    colorModel: "RGB",
    requiresIsbn: true,
  },
};

/** Unterstützte Währungen je Kanal (defensive Whitelist). */
const SUPPORTED_CURRENCIES: Record<Distributor, string[]> = {
  kdp: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN"],
  ingramspark: ["USD", "EUR", "GBP", "AUD", "CAD"],
  tolino: ["EUR"],
  apple: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "MXN", "SEK", "NOK", "DKK", "NZD"],
};

/** Zulässiger Listenpreis-Korridor je Kanal. */
const PRICE_RANGE: Record<Distributor, { min: number; max: number }> = {
  kdp: { min: 0.99, max: 200 },
  ingramspark: { min: 1.0, max: 500 },
  tolino: { min: 0.99, max: 200 },
  apple: { min: 0.99, max: 999 },
};

/** Maximale Titellänge (KDP/ONIX-Praxis). */
const MAX_TITLE_LENGTH = 200;

/** Sprachcode → ONIX/ISO-639-2(B). Fallback: der Rohcode. */
const LANGUAGE_TO_ONIX: Record<string, string> = {
  de: "ger",
  ger: "ger",
  deu: "ger",
  en: "eng",
  eng: "eng",
  fr: "fre",
  fre: "fre",
  fra: "fre",
  es: "spa",
  spa: "spa",
  it: "ita",
  ita: "ita",
  nl: "dut",
  dut: "dut",
  nld: "dut",
  pt: "por",
  por: "por",
  pl: "pol",
  pol: "pol",
};

/** Format-Schlüsselwörter → ONIX ProductForm (ONIX-Codeliste 150). */
const FORMAT_TO_ONIX: Array<{ match: RegExp; code: string }> = [
  { match: /epub|e-?book|digital|kindle|kpf|mobi/i, code: "EB" },
  { match: /audio|hörbuch|hoerbuch|mp3|m4b/i, code: "AJ" },
  { match: /hardcover|hardback|gebunden|festeinband|hc/i, code: "BB" },
  { match: /paperback|softcover|taschenbuch|broschur|pb/i, code: "BC" },
  { match: /pdf/i, code: "EB" },
];

// --- Öffentliche API -------------------------------------------------------

/**
 * Liefert das Profil eines Distributors.
 *
 * @throws Error bei unbekanntem Distributor (Programmierfehler, kein Datenmangel).
 */
export function getDistributorProfile(distributor: Distributor): DistributorProfile {
  const profile = DISTRIBUTOR_PROFILES[distributor];
  if (!profile) {
    throw new Error(`Unbekannter Distributor: ${String(distributor)}`);
  }
  // Defensive Kopie, damit Aufrufer das Registry nicht mutieren können.
  return { ...profile, requiredFormats: [...profile.requiredFormats] };
}

/**
 * Prüft ein Buch gegen die 15 typischen Ablehnungsgründe eines Distributors.
 *
 * Liefert eine (ggf. leere) Liste strukturierter Probleme. Reihenfolge ist
 * stabil, damit UI/Tests deterministisch bleiben.
 */
export function checkCompliance(book: BookMetadata, distributor: Distributor): ComplianceIssue[] {
  const profile = getDistributorProfile(distributor);
  const issues: ComplianceIssue[] = [];

  const title = safeString(book?.title);
  const author = safeString(book?.author);
  const rawIsbn = safeString(book?.isbn);
  const currency = safeString(book?.currency).toUpperCase();
  const language = safeString(book?.language);
  const publisher = safeString(book?.publisher);
  const publicationDate = safeString(book?.publicationDate);
  const format = safeString(book?.format).toUpperCase();
  const subjects = Array.isArray(book?.subjects)
    ? book.subjects.map((s) => safeString(s)).filter((s) => s.length > 0)
    : [];
  const price = typeof book?.price === "number" ? book.price : NaN;
  const pages = typeof book?.pages === "number" ? book.pages : NaN;

  // 1 — ISBN fehlt
  if (rawIsbn === "") {
    issues.push({
      code: "MISSING_ISBN",
      message: "ISBN fehlt. Für die Auslieferung ist eine gültige ISBN-13 erforderlich.",
      severity: profile.requiresIsbn ? "error" : "warning",
    });
  } else if (!isValidIsbn(rawIsbn)) {
    // 2 — ISBN ungültig (Länge/Prüfsumme)
    issues.push({
      code: "INVALID_ISBN",
      message: `ISBN "${rawIsbn}" ist ungültig (erwartet ISBN-10/13 mit korrekter Prüfziffer).`,
      severity: "error",
    });
  }

  // 3 — Titel fehlt
  if (title === "") {
    issues.push({
      code: "MISSING_TITLE",
      message: "Titel fehlt. Der Titel ist ein Pflichtfeld jedes Kanals.",
      severity: "error",
    });
  } else if (title.length > MAX_TITLE_LENGTH) {
    // 4 — Titel zu lang
    issues.push({
      code: "TITLE_TOO_LONG",
      message: `Titel überschreitet ${MAX_TITLE_LENGTH} Zeichen (aktuell: ${title.length}).`,
      severity: "warning",
    });
  }

  // 5 — Autor fehlt
  if (author === "") {
    issues.push({
      code: "MISSING_AUTHOR",
      message: "Autor fehlt. Ohne Verfasser wird das Werk abgelehnt.",
      severity: "error",
    });
  }

  // 6 — Preis fehlt/ungültig
  const range = PRICE_RANGE[distributor];
  if (Number.isNaN(price) || price <= 0) {
    issues.push({
      code: "MISSING_PRICE",
      message: "Listenpreis fehlt oder ist ungültig.",
      severity: "error",
    });
  } else if (price < range.min) {
    // 7 — Preis unter Minimum
    issues.push({
      code: "PRICE_BELOW_MIN",
      message: `Listenpreis ${price} liegt unter dem Minimum von ${range.min} für ${profile.name}.`,
      severity: "error",
    });
  } else if (price > range.max) {
    // 8 — Preis über Maximum
    issues.push({
      code: "PRICE_ABOVE_MAX",
      message: `Listenpreis ${price} liegt über dem Maximum von ${range.max} für ${profile.name}.`,
      severity: "warning",
    });
  }

  // 9 — Währung fehlt/nicht unterstützt
  if (currency === "") {
    issues.push({
      code: "INVALID_CURRENCY",
      message: "Währung fehlt (z. B. EUR oder USD).",
      severity: "error",
    });
  } else if (!SUPPORTED_CURRENCIES[distributor].includes(currency)) {
    issues.push({
      code: "INVALID_CURRENCY",
      message: `Währung ${currency} wird von ${profile.name} nicht unterstützt.`,
      severity: "error",
    });
  }

  // 10 — Sprache fehlt
  if (language === "") {
    issues.push({
      code: "MISSING_LANGUAGE",
      message: "Sprache fehlt (z. B. de oder en).",
      severity: "warning",
    });
  }

  // 11 — Verlag fehlt
  if (publisher === "") {
    issues.push({
      code: "MISSING_PUBLISHER",
      message: "Verlag fehlt. Die meisten Kanäle verlangen einen Verlagsnamen.",
      severity: "warning",
    });
  }

  // 12 — Erscheinungsdatum fehlt/ungültig
  if (!isValidPublicationDate(publicationDate)) {
    issues.push({
      code: "INVALID_PUBLICATION_DATE",
      message: `Erscheinungsdatum "${publicationDate}" fehlt oder ist ungültig (erwartet JJJJ-MM-TT).`,
      severity: "error",
    });
  }

  // 13 — Seitenzahl ungültig
  if (Number.isNaN(pages) || pages <= 0 || !Number.isInteger(pages)) {
    issues.push({
      code: "INVALID_PAGE_COUNT",
      message: "Seitenzahl fehlt oder ist ungültig (positive Ganzzahl erwartet).",
      severity: "warning",
    });
  }

  // 14 — Format nicht unterstützt
  if (format === "") {
    issues.push({
      code: "UNSUPPORTED_FORMAT",
      message: `Dateiformat fehlt. Unterstützt: ${profile.requiredFormats.join(", ")}.`,
      severity: "error",
    });
  } else if (!profile.requiredFormats.some((f) => f.toUpperCase() === format)) {
    issues.push({
      code: "UNSUPPORTED_FORMAT",
      message: `Format ${format} wird von ${profile.name} nicht unterstützt (erlaubt: ${profile.requiredFormats.join(", ")}).`,
      severity: "error",
    });
  }

  // 15 — Keine Schlagwörter/Kategorien
  if (subjects.length === 0) {
    issues.push({
      code: "MISSING_SUBJECTS",
      message: "Keine Schlagwörter/Kategorien angegeben. Sie verbessern die Auffindbarkeit.",
      severity: "warning",
    });
  }

  return issues;
}

/**
 * Generiert ONIX-3.0-XML für buchhändlerische Metadaten.
 *
 * Fehlende Felder werden defensiv durch leere, aber strukturell gültige
 * Platzhalter ersetzt, sodass die Ausgabe immer wohlgeformtes XML bleibt.
 */
export function generateOnixMetadata(book: BookMetadata, options: OnixOptions = {}): string {
  const title = safeString(book?.title) || "Ohne Titel";
  const author = safeString(book?.author) || "Unbekannter Autor";
  const isbn = normalizeIsbn(safeString(book?.isbn));
  const currency = (safeString(book?.currency).toUpperCase() || "EUR").slice(0, 3);
  const language = toOnixLanguage(safeString(book?.language));
  const publisher = safeString(book?.publisher) || "Unabhängig veröffentlicht";
  const date = normalizePublicationDate(safeString(book?.publicationDate)) || "1970-01-01";
  const pages = Number.isFinite(book?.pages) && book.pages > 0 ? Math.trunc(book.pages) : 0;
  const formatCode = toOnixProductForm(safeString(book?.format));
  const price =
    typeof book?.price === "number" && Number.isFinite(book.price) && book.price > 0
      ? book.price
      : 0;
  const subjects = (Array.isArray(book?.subjects) ? book.subjects : [])
    .map((s) => safeString(s))
    .filter((s) => s.length > 0)
    .slice(0, 10);

  const senderName = safeString(options.senderName) || DEFAULT_SENDER_NAME;
  const supplierName = safeString(options.supplierName) || DEFAULT_SENDER_NAME;
  const sentDate = safeString(options.sentDate);

  const recordReference = isbn || `local-${slugify(title)}`;

  const lines: string[] = [];
  const push = (indent: number, text: string) => lines.push(`${"  ".repeat(indent)}${text}`);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<ONIXMessage release="${ONIX_RELEASE}" xmlns="${ONIX_REFERENCE_NS}">`);
  push(1, "<Header>");
  push(2, "<Sender>");
  push(3, `<SenderName>${escapeXml(senderName)}</SenderName>`);
  push(2, "</Sender>");
  if (sentDate !== "") {
    push(2, `<SentDateTime>${escapeXml(sentDate)}</SentDateTime>`);
  }
  push(1, "</Header>");

  push(1, "<Product>");
  push(2, `<RecordReference>${escapeXml(recordReference)}</RecordReference>`);
  push(2, "<NotificationType>03</NotificationType>");

  // Produkt-Identifikator (ISBN-13 → ProductIDType 15, sonst 01 = Proprietär)
  push(2, "<ProductIdentifier>");
  push(3, `<ProductIDType>${isbn.length === 13 ? "15" : "01"}</ProductIDType>`);
  push(3, `<IDValue>${escapeXml(isbn || recordReference)}</IDValue>`);
  push(2, "</ProductIdentifier>");

  // Deskriptiver Teil
  push(2, "<DescriptiveDetail>");
  push(3, "<ProductComposition>00</ProductComposition>");
  push(3, `<ProductForm>${formatCode}</ProductForm>`);
  push(3, "<TitleDetail>");
  push(4, "<TitleType>01</TitleType>");
  push(4, "<TitleElement>");
  push(5, "<TitleElementLevel>01</TitleElementLevel>");
  push(5, `<TitleText>${escapeXml(title)}</TitleText>`);
  push(4, "</TitleElement>");
  push(3, "</TitleDetail>");
  push(3, "<Contributor>");
  push(4, "<SequenceNumber>1</SequenceNumber>");
  push(4, "<ContributorRole>A01</ContributorRole>");
  push(4, `<PersonName>${escapeXml(author)}</PersonName>`);
  push(3, "</Contributor>");
  push(3, "<Language>");
  push(4, "<LanguageRole>01</LanguageRole>");
  push(4, `<LanguageCode>${escapeXml(language)}</LanguageCode>`);
  push(3, "</Language>");
  for (const subject of subjects) {
    push(3, "<Subject>");
    push(4, "<SubjectSchemeIdentifier>20</SubjectSchemeIdentifier>");
    push(4, `<SubjectHeadingText>${escapeXml(subject)}</SubjectHeadingText>`);
    push(3, "</Subject>");
  }
  if (pages > 0) {
    push(3, "<Extent>");
    push(4, "<ExtentType>00</ExtentType>");
    push(4, `<ExtentValue>${pages}</ExtentValue>`);
    push(4, "<ExtentUnit>03</ExtentUnit>");
    push(3, "</Extent>");
  }
  push(2, "</DescriptiveDetail>");

  // Publishing-Detail
  push(2, "<PublishingDetail>");
  push(3, "<Publisher>");
  push(4, "<PublishingRole>01</PublishingRole>");
  push(4, `<PublisherName>${escapeXml(publisher)}</PublisherName>`);
  push(3, "</Publisher>");
  push(3, "<PublishingDate>");
  push(4, "<PublishingDateRole>01</PublishingDateRole>");
  push(4, `<Date>${escapeXml(date)}</Date>`);
  push(3, "</PublishingDate>");
  push(2, "</PublishingDetail>");

  // Liefer-/Preis-Teil
  push(2, "<ProductSupply>");
  push(3, "<Market>");
  push(4, "<Territory>");
  push(5, "<CountriesIncluded>WORLD</CountriesIncluded>");
  push(4, "</Territory>");
  push(3, "</Market>");
  push(3, "<SupplyDetail>");
  push(4, "<Supplier>");
  push(5, "<SupplierRole>01</SupplierRole>");
  push(5, `<SupplierName>${escapeXml(supplierName)}</SupplierName>`);
  push(4, "</Supplier>");
  push(4, "<ProductAvailability>20</ProductAvailability>");
  push(4, "<Price>");
  push(5, "<PriceType>01</PriceType>");
  push(5, `<PriceAmount>${price.toFixed(2)}</PriceAmount>`);
  push(5, `<CurrencyCode>${escapeXml(currency)}</CurrencyCode>`);
  push(4, "</Price>");
  push(3, "</SupplyDetail>");
  push(2, "</ProductSupply>");

  push(1, "</Product>");
  lines.push("</ONIXMessage>");

  return lines.join("\n");
}

// --- Interne Helfer --------------------------------------------------------

/** Wandelt beliebige Werte defensiv in einen getrimmten String. */
function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Escaped XML-Sonderzeichen und entfernt unzulässige Steuerzeichen. */
export function escapeXml(value: string): string {
  return value
    // Steuerzeichen außer Tab/LF/CR sind in XML 1.0 unzulässig — das Entfernen
    // ist gewollt, daher die Regel hier bewusst lokal deaktiviert.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Entfernt Trennzeichen aus einer ISBN. */
function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** Prüft ISBN-10/ISBN-13 inklusive Prüfziffer. */
export function isValidIsbn(raw: string): boolean {
  const isbn = normalizeIsbn(raw);
  if (isbn.length === 13) {
    if (!/^\d{13}$/.test(isbn)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10 === Number(isbn[12]);
  }
  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const char = isbn[i];
      const value = char === "X" ? 10 : Number(char);
      sum += value * (10 - i);
    }
    return sum % 11 === 0;
  }
  return false;
}

/** Akzeptiert JJJJ, JJJJ-MM, JJJJ-MM-TT und ISO-Datetimes. */
export function isValidPublicationDate(value: string): boolean {
  return normalizePublicationDate(value) !== null;
}

/** Normalisiert ein Datum auf JJJJ-MM-TT; null, wenn ungültig/leer. */
export function normalizePublicationDate(value: string): string | null {
  const raw = safeString(value);
  if (raw === "") return null;

  const yearOnly = /^(\d{4})$/.exec(raw);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year < 1000 || year > 2999) return null;
    return `${yearOnly[1]}-01-01`;
  }

  const yearMonth = /^(\d{4})-(\d{2})$/.exec(raw);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (year < 1000 || year > 2999 || month < 1 || month > 12) return null;
    return `${yearMonth[1]}-${yearMonth[2]}-01`;
  }

  const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    if (year < 1000 || year > 2999 || month < 1 || month > 12) return null;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) return null;
    return `${full[1]}-${full[2]}-${full[3]}`;
  }

  return null;
}

/** Mappt einen Sprachcode auf ISO-639-2(B); Fallback: der Rohcode (lowercase). */
function toOnixLanguage(raw: string): string {
  const code = raw.toLowerCase();
  if (code === "") return "und"; // ONIX-Code für "nicht bestimmt"
  return LANGUAGE_TO_ONIX[code] ?? code;
}

/** Mappt ein Format-Schlüsselwort auf den ONIX-ProductForm-Code. */
function toOnixProductForm(raw: string): string {
  const value = raw.trim();
  if (value === "") return "EB";
  for (const entry of FORMAT_TO_ONIX) {
    if (entry.match.test(value)) return entry.code;
  }
  return "EB";
}

/** Erzeugt einen URL-tauglichen Slug als Fallback-Record-Reference. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unbenannt";
}
