// Prompt-Generator-Service: nutzt den bestehenden LLMProvider-Layer.
// Streamt Tokens ins Ergebnis-Panel, sammelt den vollen Text und parst am Ende robust.

import type { AppSettings } from "@/types/config";
import { createProvider } from "@/services/llm";
import { PROMPT_GENERATOR_TEMPLATE } from "./template";
import { parsePrompts } from "./parse";
import { OFFLINE_PROMPTS } from "./offlinePrompts";
import type { GeneratedPrompt, PromptFilters } from "./types";

/** Wählt zufällige Offline-Prompts (Fallback wenn kein Provider erreichbar). */
export function pickOfflinePrompts(filters: PromptFilters): GeneratedPrompt[] {
  const pool = OFFLINE_PROMPTS.filter(
    (p) => filters.genres.includes("Überraschung") || filters.genres.includes(p.genre as any),
  );
  const src = pool.length > 0 ? pool : OFFLINE_PROMPTS;
  const shuffled = [...src].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, filters.count).map((p) => ({
    text: p.text,
    genre: p.genre,
    type: p.type,
    hook: "",
  }));
}

/**
 * Generiert Prompts über den aktiven LLM-Provider.
 * @param onToken  Callback für jeden gestreamten Token (UI-Streaming)
 * @param usedTexts Letzte ~20 Prompt-Texte (für "bereits verwendet")
 * @returns Geparstes Prompt-Array (oder Offline-Fallback bei Fehler)
 */
export async function generatePrompts(
  settings: AppSettings,
  filters: PromptFilters,
  onToken: (t: string) => void,
  usedTexts: string[] = [],
): Promise<{ prompts: GeneratedPrompt[]; offline: boolean; model: string }> {
  // Offline-Check: healthCheck
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) {
    return { prompts: pickOfflinePrompts(filters), offline: true, model: "offline" };
  }

  // System-Prompt aus Template bauen
  const sysContent = PROMPT_GENERATOR_TEMPLATE.replace("{{count}}", String(filters.count))
    .replace("{{genre}}", filters.genres.join(", ") || "Überraschung")
    .replace("{{type}}", filters.promptType)
    .replace("{{tone}}", filters.tone)
    .replace("{{target_length}}", filters.targetLength)
    .replace("{{used}}", usedTexts.length ? usedTexts.map((t) => `- ${t}`).join("\n") : "(keine)");

  const messages = [
    { role: "system" as const, content: sysContent },
    {
      role: "user" as const,
      content: `Erzeuge jetzt ${filters.count} Prompt(s) nach obigen Regeln als JSON-Array.`,
    },
  ];

  // Streamen + sammeln
  let raw = "";
  try {
    for await (const token of provider.chat(messages, {
      model: settings.model,
      temperature: 0.9, // Kreativität laut Spec
      maxTokens: settings.maxTokens,
    })) {
      raw += token;
      onToken(token);
    }
  } catch {
    // Bei Stream-Abbruch: was wir haben parsen, sonst Offline-Fallback
    const partial = parsePrompts(raw, filters);
    if (partial.length > 0) return { prompts: partial, offline: false, model: settings.model };
    return { prompts: pickOfflinePrompts(filters), offline: true, model: "offline" };
  }

  const prompts = parsePrompts(raw, filters);
  if (prompts.length === 0) {
    return { prompts: pickOfflinePrompts(filters), offline: true, model: "offline" };
  }
  return { prompts, offline: false, model: settings.model };
}
