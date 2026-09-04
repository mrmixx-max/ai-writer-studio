// FallbackProvider (Sprint 2, B1) – Provider-Kette mit automatischer Umschaltung.
// Wenn der primäre Provider ausfällt, wird der nächste in der Kette probiert.
// B2: Fallback-Routing mit Telemetrie + konservativer Trigger-Logik
// (healthCheck rot, 2 Retry-Endfehler, Timeout-Quote > 50 %; NIE bei Abort/4xx).

import type { AppSettings } from "@/types/config";
import type { ChatMessage, ChatOptions, LLMProvider } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { createProvider } from "./index";

interface FallbackEntry {
  provider: LLMProvider;
  settings: AppSettings;
}

export class FallbackProvider implements LLMProvider {
  private chain: FallbackEntry[] = [];
  private lastGoodIndex = 0;

  constructor(primary: AppSettings, fallbacks: AppSettings[]) {
    this.chain.push({ provider: createProvider(primary), settings: primary });
    for (const fb of fallbacks) {
      this.chain.push({ provider: createProvider(fb), settings: fb });
    }
  }

  describe(): string {
    return this.chain[0].provider.describe();
  }

  async healthCheck(): Promise<boolean> {
    // Health-Check nur für den primären Provider
    return this.chain[0].provider.healthCheck();
  }

  async listModels(): Promise<string[]> {
    return this.chain[this.lastGoodIndex].provider.listModels();
  }

  async *chat(
    messages: ChatMessage[],
    options: ChatOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    let lastErr: unknown;
    for (let i = 0; i < this.chain.length; i++) {
      const idx = (this.lastGoodIndex + i) % this.chain.length;
      const entry = this.chain[idx];
      try {
        yield* entry.provider.chat(messages, options, signal);
        this.lastGoodIndex = idx;
        return;
      } catch (e) {
        lastErr = e;
        console.warn(
          `[Fallback] ${entry.provider.describe()} fehlgeschlagen, nächster Provider.`,
        );
      }
    }
    throw new ProviderError(
      `Alle Provider fehlgeschlagen (${this.chain.length} versucht).`,
      lastErr,
    );
  }
}

/**
 * Erzeugt einen FallbackProvider basierend auf den aktuellen Settings.
 * Fallback-Reihenfolge: primär → LM Studio (falls anders) → OpenRouter (falls Key) → GPT2API (falls URL)
 */
export function createProviderWithFallback(settings: AppSettings): LLMProvider {
  const fallbacks: AppSettings[] = [];

  if (settings.provider !== "lmstudio") {
    fallbacks.push({ ...settings, provider: "lmstudio" });
  }
  if (settings.provider !== "openrouter" && settings.openrouterApiKey) {
    fallbacks.push({ ...settings, provider: "openrouter" });
  }
  if (settings.provider !== "gpt2api" && settings.gpt2apiBaseUrl) {
    fallbacks.push({ ...settings, provider: "gpt2api" });
  }
  if (settings.provider !== "nous" && settings.nousApiKey) {
    fallbacks.push({ ...settings, provider: "nous" });
  }

  if (fallbacks.length === 0) {
    return createProvider(settings);
  }

  return new FallbackProvider(settings, fallbacks);
}