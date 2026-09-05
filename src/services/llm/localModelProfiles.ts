// Local-Model-Optimierung (Sprint 3, Agent 1 — Task 3).
//
// System-Prompts und Token-Limits für DeepSeek und Qwen via Ollama.
// Motivation: Lokale Modelle unterscheiden sich stark im Prompting-Verhalten.
// DeepSeek (V3/R1-Distills) neigt zu Erklärtext vor dem eigentlichen Ergebnis
// und "denkt" sichtbar; Qwen (2.5/3) folgt Instruktionen besser, braucht aber
// bei langen Kontexten (Bookwriter Rolling Context) engere Token-Limits.
//
// Grundsätze (identisch zur Modell-Heuristik des Routers):
// - Konfiguration ist immer übersteuerbar (Settings → Profile → Defaults).
// - Erfindet NIE Modell-IDs: Erkennung nur über Namensmuster, ohne Treffer
//   bleibt ein neutraler Default aktiv.
// - Kein Breaking Change: alle Felder optional, bestehende Aufrufer unangetastet.

import type { ChatMessage, ChatOptions } from "@/types/llm";

/** Modell-Familien mit bekanntem Tuning-Bedarf. */
export type LocalModelFamily = "deepseek" | "qwen" | "default";

/** Erkennung über Modellnamen (Ollama-Tags wie "deepseek-r1:14b", "qwen2.5:7b"). */
export function detectLocalModelFamily(model: string): LocalModelFamily {
  const m = (model ?? "").toLowerCase();
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("qwen")) return "qwen";
  return "default";
}

/** Normalisierter System-Prompt je Familie (bewusst kurz — lokale Kontexte sind klein). */
export interface LocalModelProfile {
  family: LocalModelFamily;
  /** System-Prompt, der vor den User-Prompt gesetzt wird. */
  systemPrompt: string;
  /** Output-Limit in Tokens (num_predict). */
  maxTokens: number;
  /** Empfohlene Temperatur (niedriger für strikte JSON-Aufgaben). */
  temperature: number;
  /** Empfohlenes Kontext-Fenster (num_ctx beim echten Provider). */
  contextTokens: number;
}

/** DeepSeek-R1/V3-Distills: strikt, keine Meta-Kommentare, kein <think> im Output. */
const DEEPSEEK_PROFILE: LocalModelProfile = {
  family: "deepseek",
  systemPrompt:
    "Du bist ein präziser Schreib- und Analyse-Assistent. Antworte NUR mit dem angeforderten Ergebnis — keine Einleitung, keine Erklärung, keine Meta-Kommentare, keine <think>-Blöcke im Output. Halte dich exakt an das geforderte Format (z. B. nur valides JSON).",
  maxTokens: 8192,
  temperature: 0.6,
  contextTokens: 16384,
};

/** Qwen 2.5/3: instruktionsgetreu; Kontext-Budget enger fassen als Default. */
const QWEN_PROFILE: LocalModelProfile = {
  family: "qwen",
  systemPrompt:
    "Du bist ein hilfreicher Schreibassistent für Autoren. Folge den Instruktionen exakt, antworte auf Deutsch im angeforderten Format und ohne Zusatztext.",
  maxTokens: 4096,
  temperature: 0.7,
  contextTokens: 8192,
};

/** Neutraler Default für alle anderen Modelle (kein Verhaltenssprung). */
const DEFAULT_PROFILE: LocalModelProfile = {
  family: "default",
  systemPrompt: "",
  maxTokens: 2048,
  temperature: 0.7,
  contextTokens: 4096,
};

const PROFILES: Record<LocalModelFamily, LocalModelProfile> = {
  deepseek: DEEPSEEK_PROFILE,
  qwen: QWEN_PROFILE,
  default: DEFAULT_PROFILE,
};

/** Profil für ein Modell liefern (ohne Treffer → neutraler Default). */
export function getLocalModelProfile(model: string): LocalModelProfile {
  return PROFILES[detectLocalModelFamily(model)];
}

/** Konfigurierbare Overrides (z. B. aus AppSettings). Alle Felder optional. */
export interface LocalModelOverrides {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  contextTokens?: number;
}

/** Overrides je Familie — zur Laufzeit via configureLocalModelProfiles() setzbar. */
const familyOverrides: Record<LocalModelFamily, LocalModelOverrides> = {
  deepseek: {},
  qwen: {},
  default: {},
};

/**
 * Setzt Overrides für eine Modell-Familie (z. B. aus den App-Einstellungen).
 * null/undefined entfernt die Overrides wieder (Rückkehr zu den Defaults).
 */
export function configureLocalModelProfiles(
  overrides: Partial<Record<LocalModelFamily, LocalModelOverrides | null>>,
): void {
  for (const family of Object.keys(familyOverrides) as LocalModelFamily[]) {
    const o = overrides[family];
    familyOverrides[family] = o ?? {};
  }
}

/** Effektives Profil: Overrides (falls gesetzt) schlagen Familien-Defaults. */
export function getEffectiveLocalModelProfile(model: string): LocalModelProfile {
  const family = detectLocalModelFamily(model);
  const base = PROFILES[family];
  const o = familyOverrides[family] ?? {};
  return {
    family,
    systemPrompt: o.systemPrompt ?? base.systemPrompt,
    maxTokens: o.maxTokens ?? base.maxTokens,
    temperature: o.temperature ?? base.temperature,
    contextTokens: o.contextTokens ?? base.contextTokens,
  };
}

/**
 * Deckelt das vom Aufrufer gewünschte maxTokens auf das Familien-Profil
 * (Token-Limit-Optimierung): Qwen braucht bei langen Kapitel-Calls ein
 * engeres num_predict, DeepSeek darf höher. Für die neutrale Default-Familie
 * wird der Aufruferwert UNVERÄNDERT durchgereicht — kein Verhaltenssprung
 * für bestehende Modelle (kein Breaking Change).
 */
export function capMaxTokensForModel(model: string, requested: number): number {
  const family = detectLocalModelFamily(model);
  if (family === "default") return requested;
  return Math.min(requested, getEffectiveLocalModelProfile(model).maxTokens);
}

// --- CORS-Hinweis (Dokumentation der Randbedingung) --------------------------

/**
 * CORS-Kontext (warum hier KEIN Browser-Fetch-Problem gelöst wird):
 * Die App läuft als Tauri-Desktop-App — LLM-Requests gehen über das Tauri-
 * HTTP-Plugin bzw. den Rust-Kern und unterliegen NICHT den Browser-CORS-
 * Regeln. Ein Ollama-Server, der mit OLLAMA_ORIGINS=* läuft, akzeptiert die
 * App deshalb unabhängig vom Origin-Header. Wichtig bleibt für WebView-Fetches
 * (z. B. Dev-Modus im Browser): Der Origin muss in OLLAMA_ORIGINS enthalten
 * sein (tauri://localhost, http://tauri.localhost bzw. http://localhost:5173),
 * sonst blockiert Ollama selbst mit "403 Forbidden" (CORS/Origin-Check des
 * Servers, nicht des Browsers). Diese Erwartung ist hier dokumentiert und in
 * den Tests als Header-Vertrag fixiert.
 */
export const OLLAMA_CORS_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "http://localhost:5173",
] as const;

/**
 * Header-Vertrag für direkte Ollama-Requests aus dem WebView (Dev-Modus):
 * Kein custom Content-Type jenseits von application/json (würde einen
 * Preflight erzwingen), keine Credentials — Ollama erwartet keine Cookies.
 */
export function ollamaRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

// --- Prompt-/Options-Integration ---------------------------------------------

/**
 * Baut die finale Messages-Liste für einen lokalen Modell-Call:
 * Familie-Profil (oder Override) als System-Prompt, falls nicht leer.
 * Ein bestehender System-Prompt im `messages`-Array gewinnt — das Profil ist
 * nur Fallback, damit aufruferseitige Prompts (z. B. Stilprofile) erhalten
 * bleiben.
 */
export function applyLocalModelProfile(
  model: string,
  messages: ChatMessage[],
): ChatMessage[] {
  const profile = getEffectiveLocalModelProfile(model);
  const hasSystem = messages.some((m) => m.role === "system");
  if (!profile.systemPrompt || hasSystem) return messages;
  return [{ role: "system", content: profile.systemPrompt }, ...messages];
}

/**
 * Merged ChatOptions mit dem Familien-Profil: Explizite Optionen schlagen
 * Profil-Defaults. maxTokens/temperature/contextTokens werden so zwischen
 * DeepSeek und Qwen automatisch unterschiedlich gesetzt.
 */
export function withLocalModelProfile(
  model: string,
  options: Partial<ChatOptions> & { contextTokens?: number },
): ChatOptions & { contextTokens: number } {
  const profile = getEffectiveLocalModelProfile(model);
  return {
    model: options.model ?? model,
    temperature: options.temperature ?? profile.temperature,
    maxTokens: options.maxTokens ?? profile.maxTokens,
    timeoutMs: options.timeoutMs,
    systemPrompt: options.systemPrompt ?? profile.systemPrompt,
    contextTokens: options.contextTokens ?? profile.contextTokens,
  };
}
