// Robustes Parsing der Modell-Antwort in GeneratedPrompt[].
// Strategie: 1) JSON-Array parsen. 2) Fallback: jede nicht-leere Zeile = Prompt.
// Niemals abstürzen.

import type { GeneratedPrompt, PromptFilters } from "./types";

/**
 * Parst rohen LLM-Output in ein Array von Prompts.
 * @param raw     Vollständiger Text vom Modell (nicht gestreamed, sondern gesammelt)
 * @param filters Filter-Kontext (für Genre/Type-Fallback-Werte)
 */
export function parsePrompts(raw: string, filters: PromptFilters): GeneratedPrompt[] {
  if (!raw || !raw.trim()) return [];

  // Versuch 1: klassisches JSON-Array (auch wenn Whitespace/Backticks drumherum)
  const json = extractJsonArray(raw);
  if (json) {
    try {
      const arr = JSON.parse(json) as unknown[];
      if (Array.isArray(arr)) {
        const out: GeneratedPrompt[] = [];
        for (const item of arr) {
          const p = normalizeItem(item, filters);
          if (p) out.push(p);
        }
        if (out.length > 0) return out.slice(0, filters.count);
      }
    } catch {
      // stumm weitermachen zum Fallback
    }
  }

  // Fallback: Zeilen-Parsing
  return lineFallback(raw, filters);
}

/** Findet das erste [...] im Text, auch wenn Einleitungstext davor steht. */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

/** Normalisiert ein einzelnes Array-Element zu GeneratedPrompt. */
function normalizeItem(item: unknown, filters: PromptFilters): GeneratedPrompt | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (!text) return null;
  return {
    text,
    genre: typeof o.genre === "string" ? o.genre : filters.genres[0] ?? "Überraschung",
    type: typeof o.type === "string" ? o.type : filters.promptType,
    hook: typeof o.hook === "string" ? o.hook.trim() : "",
  };
}

/** Fallback: jede nicht-leere Zeile wird ein Prompt. */
function lineFallback(raw: string, filters: PromptFilters): GeneratedPrompt[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("[") && !l.startsWith("]") && !l.startsWith("{"))
    .slice(0, filters.count)
    .map((text) => ({
      text,
      genre: filters.genres[0] ?? "Überraschung",
      type: filters.promptType,
      hook: "",
    }));
}
