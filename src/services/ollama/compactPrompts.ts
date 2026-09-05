// Kompakte System-Prompts für Ollama (Sprint 7, Agent 2 — Teilaufgabe 3).
//
// Problem: Lange System-Prompts kosten bei JEDEM Call Token (Prompt-Evaluation
// vor dem ersten Token). Lokale Modelle haben kleine Kontexte — jeder Prompt-
// Token geht vom nutzbaren Kontext ab und verlängert die Time-to-first-token.
//
// Lösung: Kompakte Varianten der System-Prompts, semantisch gleichwertig,
// aber mit deutlich weniger Tokens (Faustregel: ~4 Zeichen/Token). Die
// bestehenden Prompts (localModelProfiles.ts, aiwriting/*) bleiben UNVERÄNDERT —
// die kompakten Varianten werden opt-in über compactSystemPrompt()/withCompactProfile()
// genutzt.
//
// Kompaktierungsgesetze (bewusst, nicht heuristisch):
// - Eine Zeile statt Absätzen, Semikolons statt Sätzen.
// - Pflicht-Formulierungen bleiben: "NUR", "kein <think>", Format-Anforderung —
//   die lokalen Modelle folgen genau diesen Schlüsselwörtern (Sprint-3-Befund).

import type { LocalModelProfile } from "@/services/llm/localModelProfiles";
import { getEffectiveLocalModelProfile } from "@/services/llm/localModelProfiles";

/** Kompakte System-Prompts je Familie — Semantik = Original, ~70 % weniger Zeichen. */
const COMPACT_PROMPTS: Record<string, string> = {
  deepseek:
    "NUR das Ergebnis: keine Einleitung/Erklärung/Meta, kein think-Block. Format exakt (z. B. valides JSON).",
  qwen:
    "Schreibassistent: folge den Instruktionen exakt, antworte auf Deutsch im geforderten Format ohne Zusatztext.",
  default:
    "Antworte präzise im geforderten Format, ohne Zusatztext.",
};

/** Kompakter Prompt für eine Modell-Familie. */
export function compactSystemPromptForFamily(family: string): string {
  return COMPACT_PROMPTS[family] ?? COMPACT_PROMPTS.default;
}

/** Kompakter Prompt für ein Modell (via Familien-Erkennung). */
export function compactSystemPromptForModel(model: string): string {
  const m = (model ?? "").toLowerCase();
  if (m.includes("deepseek")) return COMPACT_PROMPTS.deepseek;
  if (m.includes("qwen")) return COMPACT_PROMPTS.qwen;
  return COMPACT_PROMPTS.default;
}

/**
 * Kompaktes Profil: übernimmt maxTokens/temperature/contextTokens aus dem
 * effektiven Profil, ersetzt aber den System-Prompt durch die kompakte
 * Variante. Explizit gesetzte Overrides (getEffectiveLocalModelProfile)
 * werden NICHT überschrieben — der User-Prompt gewinnt immer.
 */
export function compactProfile(model: string): LocalModelProfile {
  const eff = getEffectiveLocalModelProfile(model);
  return { ...eff, systemPrompt: compactSystemPromptForModel(model) };
}

/**
 * Kompakte Variante des Familien-Profils — analog applyLocalModelProfile
 * (Sprint 3): nur setzen, wenn kein System-Prompt vorhanden ist. So bleiben
 * aufruferseitige Prompts (Stilprofile, Bookwriter-Roles) erhalten.
 */
export function applyCompactProfile(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const hasSystem = messages.some((m) => m.role === "system");
  if (hasSystem) return messages;
  const prompt = compactSystemPromptForModel(model);
  return [{ role: "system", content: prompt }, ...messages];
}

/** Token-Ersparnis-Messung (Faustregel ~4 Zeichen/Token, Router-Konvention). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Ersparnis in Tokens: Original-Profil vs. kompaktes Profil. */
export function compactSavings(model: string): { original: number; compact: number; saved: number } {
  const original = getEffectiveLocalModelProfile(model).systemPrompt;
  const compact = compactSystemPromptForModel(model);
  const o = estimateTokens(original || "");
  const c = estimateTokens(compact);
  return { original: o, compact: c, saved: Math.max(0, o - c) };
}
