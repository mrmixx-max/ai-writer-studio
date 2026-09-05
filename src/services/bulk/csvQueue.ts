// CSV-Job-Queue: Einlesen der Bulk-Jobs-CSV für den BulkOrchestrator.
//
// Spalten (Reihenfolge beliebig, Header-Aliasse unterstützt):
//   Titel, Genre, Target-Wörterzahl, Spezial-Prompt, Sprache
//
// Design-Vertrag:
// - Reine String-/Parsing-Logik, kein LLM-Call, kein DOM → deterministisch testbar.
// - Invalide Zeilen werden gesammelt (ParseResult.invalid) statt geworfen —
//   nur strukturelle Fehler (leere Datei, fehlende Kopfzeile) werfen.
// - Genre-/Sprachwerte werden auf die Bookwriter-Typen normalisiert
//   ("Sachbuch" → "sachbuch", "Deutsch" → "de").

export type BulkJobGenre =
  | "sachbuch"
  | "ratgeber"
  | "technik"
  | "roman"
  | "kurzgeschichte"
  | "essaybuch"
  | "krimi"
  | "fantasy";

export type BulkJobLanguage = "de" | "en";

/** Ein eingelesener Bulk-Job aus der CSV. */
export interface BulkJob {
  id: string;
  title: string;
  genre: BulkJobGenre;
  /** Wortziel des Buchs; 0 = automatisch (aus der Gliederung). */
  targetWords: number;
  specialPrompt: string;
  language: BulkJobLanguage;
  /** 1-basierte CSV-Zeilennummer (inkl. Kopfzeile) — für Fehlerberichte. */
  sourceRow: number;
}

/** Eine invalide CSV-Zeile mit Fehlermeldung. */
export interface BulkCsvInvalidRow {
  row: number;
  error: string;
}

export interface BulkCsvParseResult {
  jobs: BulkJob[];
  invalid: BulkCsvInvalidRow[];
}

/** Erwartete Header (Kanonisch, deutsch). */
export const BULK_CSV_HEADERS = [
  "Titel",
  "Genre",
  "Target-Wörterzahl",
  "Spezial-Prompt",
  "Sprache",
] as const;

/** Header-Aliasse (Groß-/Kleinschreibung irrelevant). */
const HEADER_ALIASES: Record<string, keyof BulkJob> = {
  titel: "title",
  title: "title",
  buch: "title",
  genre: "genre",
  "target-wörterzahl": "targetWords",
  "target-woerterzahl": "targetWords",
  targetwords: "targetWords",
  "wortziel": "targetWords",
  "spezial-prompt": "specialPrompt",
  "spezialprompt": "specialPrompt",
  specialprompt: "specialPrompt",
  prompt: "specialPrompt",
  sprache: "language",
  language: "language",
};

/** Erlaubte Genre-Werte inkl. deutscher Labels/Aliasse → BulkJobGenre. */
const GENRE_MAP: Record<string, BulkJobGenre> = {
  sachbuch: "sachbuch",
  ratgeber: "ratgeber",
  technik: "technik",
  "technisches nonfiction": "technik",
  "nonfiction-tech": "technik",
  "nonfiction tech": "technik",
  roman: "roman",
  kurzgeschichte: "kurzgeschichte",
  "kurzgeschichte / novella": "kurzgeschichte",
  novella: "kurzgeschichte",
  essaybuch: "essaybuch",
  "essay-buch": "essaybuch",
  essay: "essaybuch",
  krimi: "krimi",
  "krimi / thriller": "krimi",
  thriller: "krimi",
  fantasy: "fantasy",
  "fantasy / science fiction": "fantasy",
  "science fiction": "fantasy",
  scifi: "fantasy",
};

/** Sprach-Aliasse → BulkJobLanguage. */
const LANGUAGE_MAP: Record<string, BulkJobLanguage> = {
  de: "de",
  deutsch: "de",
  german: "de",
  en: "en",
  englisch: "en",
  english: "en",
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `bulkj_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Trennt eine CSV-Zeile in Felder auf (RFC 4180): unterstützt quoted Fields
 * mit Kommas, ""-Escapes und eingebetteten Zeilenumbrüchen.
 * `i`/`lines` werden by-reference über den Rückgabewert manipuliert —
 * deshalb implementiert als Klasse-loser Helfer mit Index-Objekt.
 */
function splitCsvFields(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      pushRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Letzte Zeile (falls nicht mit Zeilenumbruch endend) — nur wenn Inhalt.
  if (field !== "" || row.length > 0) pushRow();

  return rows;
}

function normalizeGenre(raw: string): BulkJobGenre | null {
  const key = raw.trim().toLowerCase();
  return GENRE_MAP[key] ?? null;
}

function normalizeLanguage(raw: string): BulkJobLanguage | null {
  const key = raw.trim().toLowerCase();
  if (!key) return "de"; // Default
  return LANGUAGE_MAP[key] ?? null;
}

/**
 * Parst die Bulk-Jobs-CSV.
 *
 * Wirft nur bei strukturellen Fehlern (leere Eingabe, fehlende/unbekannte
 * Kopfzeile) — einzelne invalide Datenzeilen landen in `invalid`.
 */
export function parseBulkJobsCsv(text: string): BulkCsvParseResult {
  if (!text || !text.trim()) {
    throw new Error("CSV ist leer.");
  }

  // BOM entfernen.
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows = splitCsvFields(cleaned);
  if (rows.length === 0) {
    throw new Error("CSV ist leer.");
  }

  // Kopfzeile mappen (Header-Aliasse, Reihenfolge beliebig).
  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const colMap: Partial<Record<keyof BulkJob, number>> = {};
  for (let c = 0; c < headerRow.length; c++) {
    const key = HEADER_ALIASES[headerRow[c]];
    if (key && colMap[key] === undefined) colMap[key] = c;
  }
  if (colMap.title === undefined || colMap.genre === undefined) {
    throw new Error(
      `Kopfzeile erkennt keine gültigen Spalten. Erwartet: ${BULK_CSV_HEADERS.join(", ")}`,
    );
  }

  const jobs: BulkJob[] = [];
  const invalid: BulkCsvInvalidRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNo = r + 1; // 1-basiert inkl. Kopfzeile
    const cells = (key: keyof BulkJob): string => {
      const idx = colMap[key];
      return idx !== undefined && idx < row.length ? row[idx].trim() : "";
    };

    // Leere/Whitespace-Zeilen überspringen.
    if (row.every((c) => !c.trim())) continue;

    const title = cells("title");
    const genreRaw = cells("genre");
    const wordsRaw = cells("targetWords");
    const specialPrompt = cells("specialPrompt");
    const languageRaw = cells("language");

    if (!title) {
      invalid.push({ row: rowNo, error: "Zeile ohne Titel." });
      continue;
    }
    const genre = normalizeGenre(genreRaw);
    if (!genre) {
      invalid.push({
        row: rowNo,
        error: `Unbekanntes Genre: "${genreRaw}". Erlaubt: ${Object.values(new Set(Object.values(GENRE_MAP))).join(", ")}`,
      });
      continue;
    }

    let targetWords = 0;
    if (wordsRaw) {
      const n = Number(wordsRaw.replace(/\s/g, "").replace(/\./g, ""));
      if (!Number.isFinite(n) || n < 0) {
        invalid.push({ row: rowNo, error: `Ungültige Target-Wörterzahl: "${wordsRaw}".` });
        continue;
      }
      targetWords = Math.round(n);
    }

    const language = normalizeLanguage(languageRaw);
    if (!language) {
      invalid.push({ row: rowNo, error: `Unbekannte Sprache: "${languageRaw}". Erlaubt: de, en.` });
      continue;
    }

    jobs.push({
      id: nextId(),
      title,
      genre,
      targetWords,
      specialPrompt,
      language,
      sourceRow: rowNo,
    });
  }

  return { jobs, invalid };
}
