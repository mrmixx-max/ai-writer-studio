// Multilingual Pipeline (Sprint 6, Agent 3): automatische Übersetzung fertiger
// Manuskripte in mehrere Zielsprachen + Lokalisierung der KDP-Metadaten.
//
// Baut auf bestehenden Interfaces auf (keine Breaking Changes):
//  - translatorService.ts: translateBook / translateChapter mit Markup-Erhaltung
//    (markupGuard.ts: mask/restore ⟦M##⟧-Platzhalter, markupIntact-Verifikation)
//  - kdp/uploadSheet.ts: buildKdpUploadSheet (RFC-4180-CSV, KDP-Spaltenvertrag)
//
// Design-Vertrag:
// - Alle LLM-Calls über die LLMChatFn-Abstraktion → provider-agnostisch, Tests
//   mit Fake-Chat (0 echte API-Calls).
// - Kapitel-Markup bleibt strikt erhalten: maskiert vor dem Call, restauriert
//   danach, Struktur-Verifikation je Kapitel (markupIntact).
// - Metadaten: ein JSON-Call pro Zielsprache; ungültige Antworten →
//   deterministischer Fallback (Original unverändert, viaLlm=false).
// - Upload-Sheet: eine Zeile pro Sprache (Quellsprache + Lokalisierungen),
//   ISBNs/Preise/Kategorie unangetastet, Language-Spalte je Zeile.
// - Call-Budget: estimateTranslationApiCalls schätzt Kapitel×Sprachen +
//   Sprachen vor dem Start (Deckel gegen das Sprint-Budget).

import {
  translateBook,
  translateChapter,
  type LLMChatFn,
  type TranslationChapter,
  type TranslationResult,
} from "./translatorService";
import {
  buildKdpUploadSheet,
  type UploadSheetRowInput,
  type SheetLanguage,
} from "@/services/kdp/uploadSheet";
import type { KdpMetadata } from "@/types/bookwriter";
import { logger } from "@/services/logger";

// --- Sprach-Ziele -----------------------------------------------------------------

/** Eine Zielsprache der Pipeline. */
export interface TranslationTarget {
  /** ISO-Code für die KDP-Language-Spalte (en/es/fr). */
  code: SheetLanguage;
  /** Deutsches Sprach-Label für die LLM-Prompts. */
  label: string;
}

/** Standard-Zielsprachen der Sprint-6-Pipeline. */
export const TRANSLATION_TARGETS: TranslationTarget[] = [
  { code: "en", label: "Englisch" },
  { code: "es", label: "Spanisch" },
  { code: "fr", label: "Französisch" },
];

/** Optionen der Buch-Übersetzung. */
export interface MultilingualOptions {
  /** Ziel-Sprach-Teilmenge (Default: alle TRANSLATION_TARGETS). */
  targets?: TranslationTarget[];
  /** Quellsprache (Default: "Deutsch"). */
  sourceLanguage?: string;
  /** Glossar "Begriff = Übersetzung" für alle Kapitel-Calls. */
  glossary?: Record<string, string>;
}

// --- Teil 1: Buch-Übersetzung (kapitelweise, Markup erhalten) ----------------------

export interface BookTranslationResult {
  /** ISO-Code der Zielsprache. */
  language: string;
  /** Übersetzte Kapitel in Buch-Reihenfolge (Markup erhalten). */
  chapters: TranslationResult[];
}

/**
 * Übersetzt ein fertiges Buch (Kapitel-Artefakt des Bookwriter-Laufs) in alle
 * Zielsprachen. Kapitelweise via translateBook — Markup-Erhaltung je Kapitel
 * durch markupGuard. Fortschritt läuft global über alle Sprachen (1..N).
 */
export async function translateBookToLanguages(
  chapters: TranslationChapter[],
  chat: LLMChatFn,
  options: MultilingualOptions,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<BookTranslationResult[]> {
  const targets = options.targets ?? TRANSLATION_TARGETS;
  const total = targets.length * Math.max(chapters.length, 0);
  const results: BookTranslationResult[] = [];
  let completed = 0;
  for (const target of targets) {
    if (signal?.aborted) break;
    const translated = await translateBook(
      chapters,
      chat,
      {
        targetLanguage: target.label,
        sourceLanguage: options.sourceLanguage,
        glossary: options.glossary,
      },
      undefined,
      () => {
        completed += 1;
        onProgress?.(completed, Math.max(total, completed));
      },
      signal,
    );
    results.push({ language: target.code, chapters: translated });
  }

  logger.info(
    `Multilingual-Buchübersetzung abgeschlossen: ${chapters.length} Kapitel × ${results.length} Sprachen (${results.map((r) => r.language).join(", ") || "keine"})`,
    "translateBookToLanguages",
  );
  return results;
}

// --- Teil 2: KDP-Metadaten-Lokalisierung -------------------------------------------

/** Lokalisierte KDP-Metadaten einer Zielsprache. */
export interface LocalizedKdpMetadata {
  /** ISO-Code der Zielsprache. */
  language: string;
  title: string;
  subtitle: string;
  /** Übersetzter Klappentext (Klartext; das Sheet baut daraus HTML). */
  blurb: string;
  shortDescription: string;
  /** Max. 7 Keywords, je max. 50 Zeichen (KDP-Limits erzwungen). */
  keywords: string[];
  /** true = per LLM lokalisiert; false = Fallback (Original unverändert). */
  viaLlm: boolean;
  /** Nicht-kritische Hinweise (Keyword-Limits etc.). */
  warnings: string[];
}

const KDP_KEYWORD_MAX = 7;
const KDP_KEYWORD_LENGTH_MAX = 50;

/**
 * Baut den Übersetzungs-Prompt für KDP-Metadaten (exponiert für Tests):
 * Klappentext + Kurzbeschreibung + Keywords, JSON-Vertrag, keine Spoiler.
 */
export function buildMetadataTranslationPrompt(
  metadata: KdpMetadata,
  target: TranslationTarget,
  sourceLanguage = "Deutsch",
): string {
  const keywords = metadata.keywords.filter((k) => k.trim()).slice(0, KDP_KEYWORD_MAX);
  return [
    `Übersetze die folgenden KDP-Metadaten eines Buchs von ${sourceLanguage} nach ${target.label}.`,
    "",
    "REGELN:",
    "1. Übersetze Titel, Untertitel, Klappentext, Kurzbeschreibung und Keywords natürlich und verkaufsstark.",
    "2. Keine Erklärungen, keine Anmerkungen — NUR JSON.",
    '3. Antworte NUR mit JSON im Format: {"title": "...", "subtitle": "...", "blurb": "...", "shortDescription": "...", "keywords": ["...", "..."]}',
    `4. Genau ${keywords.length} Keywords, maximal ${KDP_KEYWORD_MAX}, je maximal ${KDP_KEYWORD_LENGTH_MAX} Zeichen.`,
    "",
    "METADATEN:",
    `Titel: ${metadata.title}`,
    `Untertitel: ${metadata.subtitle}`,
    `Klappentext: ${metadata.blurbVariants[0] ?? ""}`,
    `Kurzbeschreibung: ${metadata.shortDescription}`,
    `Keywords: ${keywords.join(" | ")}`,
  ].join("\n");
}

/** Extrahiert das erste JSON-Objekt aus einer LLM-Antwort (auch in Fences). */
function extractJson(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Lokalisiert KDP-Metadaten (Titel, Untertitel, Klappentext, Kurzbeschreibung,
 * Keywords) in eine Zielsprache. Ein JSON-Call; ungültige Antworten fallen
 * deterministisch auf die Original-Metadaten zurück (viaLlm=false).
 */
export async function translateKdpMetadata(
  metadata: KdpMetadata,
  chat: LLMChatFn,
  target: TranslationTarget,
  signal?: AbortSignal,
): Promise<LocalizedKdpMetadata> {
  if (signal?.aborted) {
    throw new DOMException("Metadaten-Übersetzung abgebrochen.", "AbortError");
  }

  const prompt = buildMetadataTranslationPrompt(metadata, target);
  const messages = [
    {
      role: "system" as const,
      content:
        "Du bist ein erfahrener Amazon-KDP-Copywriter und Übersetzer. Antworte ausschließlich mit gültigem JSON — kein Vorwort, keine Markdown-Fences.",
    },
    { role: "user" as const, content: prompt },
  ];

  const warnings: string[] = [];
  let raw: string;
  try {
    raw = await chat(messages, signal);
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) throw err;
    logger.warn(
      `Metadaten-Lokalisierung (${target.code}) fehlgeschlagen: ${err instanceof Error ? err.message : String(err)} — Fallback auf Original.`,
      "translateKdpMetadata",
    );
    raw = "";
  }

  const parsed = raw ? extractJson(raw) : null;
  if (!parsed) {
    return {
      language: target.code,
      title: metadata.title,
      subtitle: metadata.subtitle,
      blurb: metadata.blurbVariants[0] ?? "",
      shortDescription: metadata.shortDescription,
      keywords: metadata.keywords.filter((k) => k.trim()).slice(0, KDP_KEYWORD_MAX),
      viaLlm: false,
      warnings: ["Metadaten-Lokalisierung nicht möglich — Original-Metadaten unverändert übernommen."],
    };
  }

  // Keywords: KDP-Limits erzwingen (max. 7, je max. 50 Zeichen).
  const rawKeywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
    : [];
  const usable = rawKeywords.filter((k) => k.length <= KDP_KEYWORD_LENGTH_MAX);
  const droppedLong = rawKeywords.length - usable.length;
  if (droppedLong > 0) {
    warnings.push(`${droppedLong} Keyword(s) über ${KDP_KEYWORD_LENGTH_MAX} Zeichen verworfen (KDP-Limit).`);
  }
  const keywords = usable.slice(0, KDP_KEYWORD_MAX);
  if (usable.length > KDP_KEYWORD_MAX) {
    warnings.push(`${usable.length - KDP_KEYWORD_MAX} Keyword(s) über Slot ${KDP_KEYWORD_MAX} verworfen (KDP erlaubt max. ${KDP_KEYWORD_MAX}).`);
  }

  logger.info(
    `KDP-Metadaten lokalisiert (${target.code}): ${usable.length ? keywords.length : 0} Keywords, ${warnings.length} Warning(s)`,
    "translateKdpMetadata",
  );

  return {
    language: target.code,
    title: asString(parsed.title, metadata.title),
    subtitle: asString(parsed.subtitle, metadata.subtitle),
    blurb: asString(parsed.blurb, metadata.blurbVariants[0] ?? ""),
    shortDescription: asString(parsed.shortDescription, metadata.shortDescription),
    keywords,
    viaLlm: true,
    warnings,
  };
}

/** Lokalisiert die Metadaten für alle Zielsprachen (sequentiell). */
export async function translateKdpMetadataToLanguages(
  metadata: KdpMetadata,
  chat: LLMChatFn,
  options: MultilingualOptions,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<LocalizedKdpMetadata[]> {
  const targets = options.targets ?? TRANSLATION_TARGETS;
  const results: LocalizedKdpMetadata[] = [];
  let completed = 0;
  for (const target of targets) {
    if (signal?.aborted) break;
    const localized = await translateKdpMetadata(metadata, chat, target, signal);
    results.push(localized);
    completed += 1;
    onProgress?.(completed, targets.length);
  }
  return results;
}

// --- Teil 3: lokalisiertes KDP-Upload-Sheet ----------------------------------------

/**
 * Baut das KDP-Upload-Sheet für alle Sprach-Ausgaben: eine Zeile pro Sprache —
 * zuerst die Quellsprache (Original-Zeile), dann eine Zeile je Lokalisierung.
 * ISBNs, Preise, Kategorie und Autor bleiben unangetastet; Title/Subtitle/
 * Description/Keywords/Language kommen aus den lokalisierten Metadaten.
 *
 * Rein deterministisch (kein LLM-Call) — die Übersetzungen müssen bereits
 * vorliegen (translateKdpMetadataToLanguages).
 */
export function buildLocalizedUploadSheet(
  sourceRow: UploadSheetRowInput,
  translations: LocalizedKdpMetadata[],
): ReturnType<typeof buildKdpUploadSheet> {
  if (!sourceRowHasTitle(sourceRow)) {
    throw new Error("Upload-Zeile ohne Titel kann nicht erstellt werden.");
  }

  const rows: UploadSheetRowInput[] = [sourceRow];
  for (const t of translations) {
    rows.push({
      ...sourceRow,
      title: t.title || sourceRow.title,
      subtitle: t.subtitle || sourceRow.subtitle,
      description: t.blurb || sourceRow.description,
      keywords: t.keywords.length > 0 ? t.keywords : sourceRow.keywords,
      language: (["de", "en", "fr", "es", "it"] as SheetLanguage[]).includes(t.language as SheetLanguage)
        ? (t.language as SheetLanguage)
        : sourceRow.language,
    });
  }

  const result = buildKdpUploadSheet({ rows });
  logger.info(
    `Lokalisiertes KDP-Upload-Sheet erstellt: ${result.rowCount} Zeilen (de${translations.map((t) => ` + ${t.language}`).join("")})`,
    "buildLocalizedUploadSheet",
  );
  return result;
}

function sourceRowHasTitle(row: UploadSheetRowInput): boolean {
  return Boolean(row.title && row.title.trim());
}

// --- API-Budget -------------------------------------------------------------------

/**
 * Schätzt die API-Calls der vollen Pipeline: Kapitel-Calls (Kapitel ×
 * Sprachen) + Metadaten-Calls (1 je Sprache). Default-Zielsprachen: 3.
 */
export function estimateTranslationApiCalls(
  chapterCount: number,
  targets: TranslationTarget[] = TRANSLATION_TARGETS,
): number {
  const metaCalls = targets.length;
  return chapterCount * targets.length + metaCalls;
}

// --- Convenience: komplette Pipeline in einem Aufruf -------------------------------

/**
 * Führt die komplette Sprint-6-Pipeline aus: Buch kapitelweise in alle
 * Zielsprachen übersetzen (Markup erhalten) UND die KDP-Metadaten je Sprache
 * lokalisieren. Nutzt eine LLMChatFn (z.B. an createProvider angebunden);
 * liefert Buch-Übersetzungen + lokalisierte Metadaten zurück.
 */
export async function runMultilingualPipeline(input: {
  chapters: TranslationChapter[];
  metadata: KdpMetadata;
  chat: LLMChatFn;
  options?: MultilingualOptions;
  onProgress?: (completed: number, total: number, label: string) => void;
  signal?: AbortSignal;
}): Promise<{
  books: BookTranslationResult[];
  metadataByLanguage: LocalizedKdpMetadata[];
}> {
  const options = input.options ?? {};
  const targets = options.targets ?? TRANSLATION_TARGETS;
  const totalCalls =
    input.chapters.length * targets.length + targets.length;
  let done = 0;

  const books = await translateBookToLanguages(
    input.chapters,
    input.chat,
    options,
    (completed) => {
      done = completed;
      input.onProgress?.(done, totalCalls, "Kapitel-Übersetzung");
    },
    input.signal,
  );

  const metadataByLanguage = await translateKdpMetadataToLanguages(
    input.metadata,
    input.chat,
    options,
    (completed) => {
      input.onProgress?.(done + completed, totalCalls, "Metadaten-Lokalisierung");
    },
    input.signal,
  );

  logger.info(
    `Multilingual-Pipeline fertig: ${books.length} Buch-Sprachen, ${metadataByLanguage.length} Metadaten-Lokalisierungen`,
    "runMultilingualPipeline",
  );
  return { books, metadataByLanguage };
}

// Re-Export für Pipeline-Nutzer, die einzelne Kapitel übersetzen wollen.
export { translateChapter };