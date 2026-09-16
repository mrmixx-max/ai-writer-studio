// Kapitel-Vorschläge per KI: Titel, Stil und Wortzahl für den Kapitel-Modus
// (ChapterPlanner "Neues Kapitel").
//
// Reine Service-Schicht ohne UI: suggestChapter() liefert 3 Titel-Vorschläge
// + Stil-Empfehlung + Wortzahl-Empfehlung aus Thema/Synopsis. Mit Offline-
// Fallback (Heuristik), damit die UI nie hängt.

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";

/** Ein Titel-Vorschlag mit Begründung. */
export interface ChapterTitleSuggestion {
  title: string;
  reason: string;
}

/** Stil-Empfehlung für ein Kapitel. */
export interface ChapterStyleSuggestion {
  style: string;
  reason: string;
}

/** Wortzahl-Empfehlung für ein Kapitel. */
export interface ChapterLengthSuggestion {
  words: number;
  reason: string;
}

/** Komplett-Vorschlag für ein neues Kapitel. */
export interface ChapterSuggestion {
  titles: ChapterTitleSuggestion[];
  style: ChapterStyleSuggestion;
  length: ChapterLengthSuggestion;
  /** true = vom Modell, false = Heuristik (offline). */
  usedLLM: boolean;
}

/** Eingaben für den Vorschlag (Thema/Synopsis aus dem Planer-Formular). */
export interface ChapterSuggestInput {
  topic: string;
  synopsis?: string;
  purpose?: string;
  genre?: string;
}

/** Kapiteltypen mit typischen Wortzahlen (Heuristik + Prompt-Kontext). */
const PURPOSE_WORDS: Record<string, number> = {
  Einleitung: 1500,
  Szene: 2000,
  Sachkapitel: 2500,
  Dialog: 1200,
  Spannungsriss: 1800,
  Höhepunkt: 2500,
  Auflösung: 1500,
  Schluss: 1200,
};

/**
 * Heuristik-Fallback ohne Modell: Titel aus Thema/Synopsis, Stil nach
 * Kapiteltyp, Wortzahl nach Typ-Tabelle.
 */
export function suggestChapterOffline(input: ChapterSuggestInput): ChapterSuggestion {
  const theme = input.synopsis?.trim() || input.topic.trim() || "Kapitel";
  const short = theme.length > 40 ? `${theme.slice(0, 37)}…` : theme;
  const purpose = input.purpose?.trim();
  return {
    titles: [
      { title: short, reason: "Arbeitstitel aus deiner Synopsis" },
      { title: `${short} — Auftakt`, reason: "Variante mit Spannungsbogen" },
      { title: `${purpose ? `${purpose}: ` : ""}${short}`, reason: "Variante mit Kapiteltyp" },
    ],
    style: {
      style: purpose === "Dialog" ? "dialogstark, szenisch" : "sachlich-nah, bildhaft",
      reason: purpose ? `Abgeleitet aus Kapiteltyp „${purpose}“` : "Standard für neue Kapitel",
    },
    length: {
      words: (purpose && PURPOSE_WORDS[purpose]) || 2000,
      reason: purpose
        ? `Typisch für „${purpose}“`
        : "Standard-Zielwortzahl für neue Kapitel",
    },
    usedLLM: false,
  };
}

/** Parst die LLM-Antwort (JSON) — wirft bei ungültigem Format. */
export function parseChapterSuggestion(raw: string): Omit<ChapterSuggestion, "usedLLM"> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Kein JSON in der Antwort.");
  const data = JSON.parse(raw.slice(start, end + 1)) as {
    titles?: { title?: unknown; reason?: unknown }[];
    style?: { style?: unknown; reason?: unknown };
    length?: { words?: unknown; reason?: unknown };
  };
  const titles = (Array.isArray(data.titles) ? data.titles : [])
    .filter((t) => typeof t?.title === "string" && (t.title as string).trim())
    .slice(0, 3)
    .map((t) => ({
      title: (t.title as string).trim().slice(0, 120),
      reason: typeof t.reason === "string" ? (t.reason as string).trim().slice(0, 200) : "",
    }));
  if (!titles.length) throw new Error("Keine Titel in der Antwort.");
  const styleText =
    typeof data.style?.style === "string" && (data.style.style as string).trim()
      ? (data.style.style as string).trim().slice(0, 200)
      : "sachlich-nah, bildhaft";
  const words = Math.min(
    8000,
    Math.max(200, Math.round(Number(data.length?.words) || 2000)),
  );
  return {
    titles,
    style: {
      style: styleText,
      reason:
        typeof data.style?.reason === "string"
          ? (data.style.reason as string).trim().slice(0, 200)
          : "Empfehlung des Modells",
    },
    length: {
      words,
      reason:
        typeof data.length?.reason === "string"
          ? (data.length.reason as string).trim().slice(0, 200)
          : "Empfehlung des Modells",
    },
  };
}

/** Prompt für den Modell-Call (Titel + Stil + Wortzahl als JSON). */
export function buildChapterSuggestPrompt(input: ChapterSuggestInput): string {
  return (
    `Du bist ein erfahrener Lektor. Schlage für ein neues Buchkapitel Titel, Stil und Wortzahl vor.\n\n` +
    `Thema: ${input.topic.trim() || "(nicht angegeben)"}\n` +
    `Synopsis: ${input.synopsis?.trim() || "(keine)"}\n` +
    `Kapiteltyp: ${input.purpose?.trim() || "(offen)"}\n` +
    `Genre: ${input.genre?.trim() || "(offen)"}\n\n` +
    `Antworte NUR als JSON-Objekt (kein Markdown, keine Erklärung):\n` +
    `{"titles": [{"title": "...", "reason": "..."}, ...genau 3...], ` +
    `"style": {"style": "kurze Stilbeschreibung", "reason": "..."}, ` +
    `"length": {"words": <Zahl 200-8000>, "reason": "..."}}`
  );
}

/**
 * Holt Kapitel-Vorschläge vom Modell (mit Offline-Fallback).
 * Abort gehört zum Vertrag und wird nicht geschluckt.
 */
export async function suggestChapter(
  input: ChapterSuggestInput,
  signal?: AbortSignal,
): Promise<ChapterSuggestion> {
  const settings = loadSettings();
  try {
    const provider = createProvider(settings);
    const healthy = await provider.healthCheck().catch(() => false);
    if (!healthy) return suggestChapterOffline(input);
    const chunks: string[] = [];
    for await (
      const token of provider.chat(
        [{ role: "user", content: buildChapterSuggestPrompt(input) }],
        { model: settings.model, temperature: 0.7, maxTokens: 1024 },
        signal,
      )
    ) {
      if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      chunks.push(token);
    }
    const parsed = parseChapterSuggestion(chunks.join(""));
    return { ...parsed, usedLLM: true };
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || signal?.aborted) throw e;
    return suggestChapterOffline(input);
  }
}
