// KDP-Metadaten-Validierung.
//
// Prüft, ob die Metadaten den Anforderungen von Amazon KDP genügen.
// Liefert strukturierte Fehler/Warnungen für die UI.

import type { KdpMetadata } from "@/types/bookwriter";

/** Validierungs-Schweregrad. */
export type ValidationSeverity = "error" | "warning";

/** Ein einzelnes Validierungsergebnis. */
export interface ValidationIssue {
  field: keyof KdpMetadata | "general";
  severity: ValidationSeverity;
  message: string;
}

/** Ergebnis der vollständigen Metadaten-Prüfung. */
export interface ValidationResult {
  issues: ValidationIssue[];
  isValid: boolean;
  /** Anzahl kritischer Fehler. */
  errorCount: number;
  /** Anzahl Warnungen. */
  warningCount: number;
}

/** Maximale Längen gemäß KDP-Spezifikation. */
const LIMITS = {
  title: 200,
  subtitle: 200,
  shortDescription: 2000,
  blurb: 2000,
  keywords: 7,
  keywordLength: 50,
  categories: 2,
  authorBio: 1000,
  priceMin: 0.99,
  priceMax: 200,
} as const;

/** KDP-Browse-Kategorien (Auszug der häufigsten). */
export const KDP_CATEGORIES = [
  "Fiction > Fantasy",
  "Fiction > Science Fiction",
  "Fiction > Thriller",
  "Fiction > Mystery",
  "Fiction > Romance",
  "Fiction > Literary Fiction",
  "Nonfiction > Self-Help",
  "Nonfiction > Business & Money",
  "Nonfiction > Health & Fitness",
  "Nonfiction > Cooking",
  "Nonfiction > Computers & Technology",
  "Nonfiction > Education",
  "Nonfiction > Travel",
  "Nonfiction > Biography & Memoir",
  "Nonfiction > History",
  "Nonfiction > Religion & Spirituality",
  "Nonfiction > Science & Maths",
  "Children's eBooks",
  "Young Adult > Fantasy",
  "Young Adult > Science Fiction",
] as const;

/**
 * Validiert alle KDP-Metadaten.
 *
 * Prüft:
 *   - Titel vorhanden und nicht zu lang
 *   - Klappentext (mindestens eine Variante) vorhanden
 *   - Keywords (max. 7, je max. 50 Zeichen)
 *   - Kategorien (max. 2)
 *   - Autoren-Bio vorhanden
 */
export function validateKdpMetadata(metadata: KdpMetadata): ValidationResult {
  const issues: ValidationIssue[] = [];

  // --- Titel ---
  if (!metadata.title.trim()) {
    issues.push({
      field: "title",
      severity: "error",
      message: "Titel ist erforderlich.",
    });
  } else if (metadata.title.length > LIMITS.title) {
    issues.push({
      field: "title",
      severity: "error",
      message: `Titel überschreitet ${LIMITS.title} Zeichen (aktuell: ${metadata.title.length}).`,
    });
  }

  // --- Klappentext ---
  const validBlurbs = metadata.blurbVariants.filter((b) => b.trim().length > 0);
  if (validBlurbs.length === 0) {
    issues.push({
      field: "blurbVariants",
      severity: "error",
      message: "Mindestens ein Klappentext ist erforderlich.",
    });
  }
  for (const blurb of validBlurbs) {
    if (blurb.length > LIMITS.blurb) {
      issues.push({
        field: "blurbVariants",
        severity: "warning",
        message: `Klappentext überschreitet ${LIMITS.blurb} Zeichen (aktuell: ${blurb.length}).`,
      });
    }
  }

  // --- Kurzbeschreibung ---
  if (metadata.shortDescription.trim().length > 0) {
    if (metadata.shortDescription.length > LIMITS.shortDescription) {
      issues.push({
        field: "shortDescription",
        severity: "warning",
        message: `Kurzbeschreibung überschreitet ${LIMITS.shortDescription} Zeichen.`,
      });
    }
  }

  // --- Keywords ---
  const validKeywords = metadata.keywords.filter((k) => k.trim().length > 0);
  if (validKeywords.length === 0) {
    issues.push({
      field: "keywords",
      severity: "warning",
      message: "Keine Keywords angegeben. KDP erlaubt bis zu 7.",
    });
  } else {
    if (validKeywords.length > LIMITS.keywords) {
      issues.push({
        field: "keywords",
        severity: "error",
        message: `Zu viele Keywords: ${validKeywords.length} (max. ${LIMITS.keywords}).`,
      });
    }
    for (const kw of validKeywords) {
      if (kw.length > LIMITS.keywordLength) {
        issues.push({
          field: "keywords",
          severity: "warning",
          message: `Keyword "${kw.slice(0, 20)}..." überschreitet ${LIMITS.keywordLength} Zeichen.`,
        });
      }
    }
  }

  // --- Kategorien ---
  const validCategories = metadata.categories.filter((c) => c.trim().length > 0);
  if (validCategories.length === 0) {
    issues.push({
      field: "categories",
      severity: "warning",
      message: "Keine Kategorien ausgewählt. KDP erlaubt bis zu 2.",
    });
  } else if (validCategories.length > LIMITS.categories) {
    issues.push({
      field: "categories",
      severity: "error",
      message: `Zu viele Kategorien: ${validCategories.length} (max. ${LIMITS.categories}).`,
    });
  }

  // --- Autoren-Bio ---
  if (!metadata.authorBio.trim()) {
    issues.push({
      field: "authorBio",
      severity: "warning",
      message: "Autoren-Bio fehlt. Empfohlen für KDP.",
    });
  } else if (metadata.authorBio.length > LIMITS.authorBio) {
    issues.push({
      field: "authorBio",
      severity: "warning",
      message: `Autoren-Bio überschreitet ${LIMITS.authorBio} Zeichen.`,
    });
  }

  // --- Preis ---
  const price = metadata.priceUsd;
  if (price == null || Number.isNaN(price)) {
    issues.push({
      field: "general",
      severity: "warning",
      message: "Kein Listenpreis gesetzt (KDP-Pflichtfeld beim Upload).",
    });
  } else if (price < LIMITS.priceMin || price > LIMITS.priceMax) {
    issues.push({
      field: "general",
      severity: "error",
      message: `Listenpreis muss zwischen ${LIMITS.priceMin} und ${LIMITS.priceMax} USD liegen (aktuell: ${price}).`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    issues,
    isValid: errorCount === 0,
    errorCount,
    warningCount,
  };
}

/**
 * Prüft, ob die Metadaten exportbereit sind (keine Fehler).
 */
export function isKdpReady(metadata: KdpMetadata): boolean {
  return validateKdpMetadata(metadata).isValid;
}

/** Ein Punkt der KDP-Checkliste. */
export interface KdpChecklistItem {
  /** Stabiler Schlüssel (für Tests/Rendering). */
  id: string;
  /** Anzeigename. */
  label: string;
  /** Kurze Erklärung, was KDP erwartet. */
  hint: string;
  /** ok = erfüllt, warn = fehlt aber nicht kritisch, err = kritisch. */
  status: "ok" | "warn" | "err";
}

/**
 * Baut die KDP-Checkliste für die UI aus den Metadaten.
 *
 * Die Reihenfolge entspricht dem KDP-Upload-Formular: Titel, Beschreibung,
 * Keywords, Kategorien, Autor, Cover.
 */
export function buildKdpChecklist(metadata: KdpMetadata): KdpChecklistItem[] {
  const result = validateKdpMetadata(metadata);
  const issuesFor = (field: string) =>
    result.issues.filter((i) => i.field === field);
  const worstFor = (field: string): KdpChecklistItem["status"] => {
    const iss = issuesFor(field);
    if (iss.some((i) => i.severity === "error")) return "err";
    if (iss.some((i) => i.severity === "warning")) return "warn";
    return "ok";
  };

  const validKeywords = metadata.keywords.filter((k) => k.trim().length > 0);
  const validCategories = metadata.categories.filter((c) => c.trim().length > 0);
  const hasBlurb = metadata.blurbVariants.some((b) => b.trim().length > 0);

  return [
    {
      id: "title",
      label: "Titel & Untertitel",
      hint: `Pflichtfeld. Max. ${LIMITS.title} Zeichen.`,
      status: worstFor("title"),
    },
    {
      id: "blurb",
      label: "Beschreibung / Klappentext",
      hint: "Mindestens ein Klappentext; ideal 150–250 Wörter.",
      status: hasBlurb ? worstFor("blurbVariants") : "err",
    },
    {
      id: "shortDescription",
      label: "Kurzbeschreibung",
      hint: `Optional, max. ${LIMITS.shortDescription} Zeichen.`,
      status: metadata.shortDescription.trim()
        ? worstFor("shortDescription")
        : "warn",
    },
    {
      id: "keywords",
      label: `Keywords (${validKeywords.length}/${LIMITS.keywords})`,
      hint: "Bis zu 7 Keywords, je max. 50 Zeichen.",
      status: worstFor("keywords"),
    },
    {
      id: "categories",
      label: `Kategorien (${validCategories.length}/${LIMITS.categories})`,
      hint: "Bis zu 2 Browse-Kategorien.",
      status: worstFor("categories"),
    },
    {
      id: "authorBio",
      label: "Autoren-Bio",
      hint: "Empfohlen, max. 1000 Zeichen.",
      status: metadata.authorBio.trim() ? worstFor("authorBio") : "warn",
    },
    {
      id: "cover",
      label: "Cover-Bild",
      hint: "Min. 1000 Pixel an der langen Seite; als JPG/PNG eingebettet.",
      status: metadata.coverImage ? "ok" : "err",
    },
    {
      id: "price",
      label: metadata.priceUsd != null ? `Listenpreis (${metadata.priceUsd} USD)` : "Listenpreis",
      hint: `Pflichtfeld beim Upload. KDP erlaubt ${LIMITS.priceMin}–${LIMITS.priceMax} USD.`,
      status:
        metadata.priceUsd == null
          ? "warn"
          : metadata.priceUsd >= LIMITS.priceMin && metadata.priceUsd <= LIMITS.priceMax
            ? "ok"
            : "err",
    },
  ];
}
