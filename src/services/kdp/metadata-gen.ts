// KI-Metadaten-Generierung für KDP.
//
// Erzeugt Beschreibung (Klappentext) und Keywords aus den vorhandenen
// Metadaten über den konfigurierten LLM-Provider. Enthält einen
// deterministischen Fallback, falls kein LLM verfügbar ist.

import { completeOnce } from "@/services/llm";
import type { AppSettings } from "@/types/config";
import type { KdpMetadata } from "@/types/bookwriter";

/** Eingabe für die Metadaten-Generierung. */
export interface MetadataGenInput {
  title: string;
  subtitle?: string;
  authorName?: string;
  genre?: string;
  audience?: string;
  /** Kurze Inhaltsangabe / Summary als Grundlage. */
  summary?: string;
}

/** Ergebnis der Beschreibungs-Generierung. */
export interface GeneratedDescription {
  /** Haupt-Klappentext (Amazon-Beschreibung). */
  description: string;
  /** Kurzbeschreibung (max. 2000 Zeichen). */
  shortDescription: string;
  /** true, wenn per LLM erzeugt; false = Fallback. */
  viaLlm: boolean;
}

/** Ergebnis der Keyword-Generierung. */
export interface GeneratedKeywords {
  /** Bis zu 7 Keywords, je max. 50 Zeichen. */
  keywords: string[];
  viaLlm: boolean;
}

/** Baut den Prompt für die Beschreibungs-Generierung. */
export function buildDescriptionPrompt(input: MetadataGenInput): string {
  const parts = [
    "Du bist ein erfahrener Amazon-KDP-Copywriter.",
    "Schreibe einen verkaufsstarken Klappentext (150–250 Wörter, Deutsch, keine Spoiler)",
    "und eine Kurzbeschreibung von maximal 400 Zeichen.",
    "Antworte NUR mit JSON im Format:",
    '{"description": "...", "shortDescription": "..."}',
    "",
    `Titel: ${input.title}`,
  ];
  if (input.subtitle) parts.push(`Untertitel: ${input.subtitle}`);
  if (input.authorName) parts.push(`Autor: ${input.authorName}`);
  if (input.genre) parts.push(`Genre: ${input.genre}`);
  if (input.audience) parts.push(`Zielgruppe: ${input.audience}`);
  if (input.summary) parts.push(`Inhalt: ${input.summary}`);
  return parts.join("\n");
}

/** Baut den Prompt für die Keyword-Generierung. */
export function buildKeywordsPrompt(input: MetadataGenInput): string {
  const parts = [
    "Du bist ein Amazon-KDP-SEO-Experte.",
    "Generiere genau 7 Such-Keywords (Deutsch, je max. 50 Zeichen, keine Markennamen).",
    "Antworte NUR mit JSON im Format:",
    '{"keywords": ["...", "..."]}',
    "",
    `Titel: ${input.title}`,
  ];
  if (input.genre) parts.push(`Genre: ${input.genre}`);
  if (input.audience) parts.push(`Zielgruppe: ${input.audience}`);
  if (input.summary) parts.push(`Inhalt: ${input.summary.slice(0, 800)}`);
  return parts.join("\n");
}

/** Extrahiert das erste JSON-Objekt aus einer LLM-Antwort. */
export function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Bestimmt Genre/Zielgruppe heuristisch aus vorhandenen Metadaten. */
export function enrichInput(
  metadata: Pick<KdpMetadata, "title" | "subtitle" | "categories" | "authorBio" | "seriesIdea">,
  authorName?: string,
): MetadataGenInput {
  const category = metadata.categories.find((c) => c.trim())?.split(">")[1]?.trim();
  return {
    title: metadata.title,
    subtitle: metadata.subtitle || undefined,
    authorName,
    genre: category || metadata.seriesIdea || undefined,
    audience: undefined,
    summary: metadata.authorBio || undefined,
  };
}

/** Fallback: einfache Beschreibung ohne LLM. */
function fallbackDescription(input: MetadataGenInput): GeneratedDescription {
  const description = [
    `${input.title}${input.subtitle ? ` – ${input.subtitle}` : ""}.`,
    input.summary ? input.summary.trim() : "Ein Buch, das neugierig macht und zum Weiterlesen einlädt.",
    "Jetzt entdecken und selbst überzeugen!",
  ]
    .filter(Boolean)
    .join("\n\n");
  const shortDescription = description.replace(/\n+/g, " ").slice(0, 400);
  return { description, shortDescription, viaLlm: false };
}

/** Fallback: Keywords aus Titel/Genre ableiten. */
function fallbackKeywords(input: MetadataGenInput): GeneratedKeywords {
  const words = `${input.title} ${input.genre ?? ""} ${input.audience ?? ""}`
    .toLowerCase()
    .split(/[\s,.;:!?]+/)
    .filter((w) => w.length > 3);
  const keywords = [...new Set(words)].slice(0, 7);
  return { keywords: keywords.length ? keywords : ["buch", "lesen"], viaLlm: false };
}

/** Erzeugt Beschreibung + Kurzbeschreibung per LLM (mit Fallback). */
export async function generateKdpDescription(
  input: MetadataGenInput,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<GeneratedDescription> {
  try {
    const raw = await completeOnce(settings, buildDescriptionPrompt(input), undefined, signal);
    const json = extractJson(raw);
    const description = typeof json?.description === "string" ? json.description.trim() : "";
    const shortDescription = typeof json?.shortDescription === "string" ? json.shortDescription.trim() : "";
    if (!description) return fallbackDescription(input);
    return {
      description,
      shortDescription: shortDescription || description.slice(0, 400),
      viaLlm: true,
    };
  } catch {
    return fallbackDescription(input);
  }
}

/** Erzeugt bis zu 7 Keywords per LLM (mit Fallback). */
export async function generateKdpKeywords(
  input: MetadataGenInput,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<GeneratedKeywords> {
  try {
    const raw = await completeOnce(settings, buildKeywordsPrompt(input), undefined, signal);
    const json = extractJson(raw);
    const list = Array.isArray(json?.keywords) ? (json.keywords as unknown[]) : [];
    const keywords = list
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 7);
    if (keywords.length === 0) return fallbackKeywords(input);
    return { keywords, viaLlm: true };
  } catch {
    return fallbackKeywords(input);
  }
}
