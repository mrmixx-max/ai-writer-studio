// Zentrale Typen für den LLM-Provider-Layer

export type ProviderId =
  | "ollama"
  | "lmstudio"
  | "openai"
  | "openrouter"
  | "gpt2api";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey?: string; // nur für OpenAI
  defaultModel?: string;
}

/**
 * Einheitliches Interface für alle LLM-Provider.
 * chat() streamt Token über einen AsyncGenerator – kein Blocking.
 */
export interface LLMProvider {
  /** Liste verfügbarer Modell-IDs */
  listModels(): Promise<string[]>;
  /** Streaming-Chat. Yield pro Token-Delta (String). */
  chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, void, unknown>;
  /** true wenn der Server erreichbar ist */
  healthCheck(): Promise<boolean>;
  /** Menschlesbarer Status für UI (deutsch) */
  describe(): string;
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
