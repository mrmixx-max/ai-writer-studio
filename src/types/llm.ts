// Zentrale Typen für den LLM-Provider-Layer

export type ProviderId =
  | "ollama"
  | "lmstudio"
  | "openai"
  | "openrouter"
  | "gpt2api"
  | "nous";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
  /**
   * Sprint 7: Response-Caching für identische Prompts (opt-in).
   * Nur für deterministische Aufgaben setzen (temperature niedrig, gleiche
   * Erwartung bei Wiederholung, z. B. Outline-Re-Render).
   */
  cache?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey?: string; // nur für OpenAI
  defaultModel?: string;
}

export interface LLMProviderCapabilities {
  /** true = lokaler Provider (keine Cloud-Konnektivität) */
  local: boolean;
  /** Streaming-Chat unterstützt */
  streaming: boolean;
  /** Strukturierter JSON-Output (response_format/json mode) unterstützt */
  jsonMode: boolean;
  /** Bekannte maximale Kontextlänge in Tokens (null = unbekannt) */
  maxContextTokens: number | null;
}

/**
 * Einheitliches Interface für alle LLM-Provider.
 * chat() streamt Token über einen AsyncGenerator – kein Blocking.
 * signal erlaubt Abbruch einer laufenden Anfrage.
 */
export interface LLMProvider {
  /** Liste verfügbarer Modell-IDs */
  listModels(): Promise<string[]>;
  /** Streaming-Chat. Yield pro Token-Delta (String). signal bricht den Stream ab. */
  chat(messages: ChatMessage[], options: ChatOptions, signal?: AbortSignal): AsyncGenerator<string, void, unknown>;
  /** true wenn der Server erreichbar ist */
  healthCheck(): Promise<boolean>;
  /** Menschlesbarer Status für UI (deutsch) */
  describe(): string;
  /**
   * Fähigkeiten des Providers (Sprint 2, B1). Optional, damit bestehende
   * Provider-Implementierungen nicht brechen — Fallback via getCapabilities().
   */
  capabilities?(): LLMProviderCapabilities;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
