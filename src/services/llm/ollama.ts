// OllamaProvider – lokaler Standard-Provider.
// Endpunkte: GET  {base}/api/tags   → Modellliste
//            POST {base}/api/chat    → Streaming (NDJSON, stream:true)
//
// Sprint 7 (Performance): Der Provider läuft über den Connection-Pool
// (max. parallele Requests pro Instanz, FIFO-Queue) und unterstützt opt-in
// Response-Caching für identische Prompts. Ohne cache:true bleibt das
// Verhalten byte-identisch zu Sprint 6.

import type { ChatMessage, ChatOptions, LLMProvider, LLMProviderCapabilities } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { assertOk, parseNdjson, fetchWithTimeout } from "./stream";
import { getOllamaPool } from "@/services/ollama/connectionPool";
import { getPromptCache, promptCacheKey } from "@/services/ollama/promptCache";

const HEALTH_TIMEOUT = 5000;
const FETCH_TIMEOUT = 30000;

export class OllamaProvider implements LLMProvider {
  constructor(private readonly baseUrl: string) {}

  describe(): string {
    return `Ollama (lokal: ${this.baseUrl})`;
  }

  /** B1: Fähigkeiten des lokalen Providers. */
  capabilities(): LLMProviderCapabilities {
    return { local: true, streaming: true, jsonMode: false, maxContextTokens: null };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET" }, HEALTH_TIMEOUT);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/tags`, {}, FETCH_TIMEOUT);
      await assertOk(res, "Ollama listModels");
      const data = await res.json();
      // Ollama liefert { models: [{ name: "llama3.2" }, ...] }
      return (data.models ?? []).map((m: any) => m.name as string);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(
        "Ollama nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).",
        e,
      );
    }
  }

  async *chat(
    messages: ChatMessage[],
    options: ChatOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    // Sprint 7: opt-in Cache — identischer Prompt → sofortige Antwort ohne Inferenz.
    if (options.cache) {
      const cache = getPromptCache();
      const key = promptCacheKey(options.model, messages, {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
      const hit = cache.get(key);
      if (hit) {
        yield hit.text;
        return;
      }
      // Miss: sammeln und am Ende in den Cache legen.
      let text = "";
      for await (const chunk of this.chatUncached(messages, options, signal)) {
        text += chunk;
        yield chunk;
      }
      cache.set(key, text);
      return;
    }
    yield* this.chatUncached(messages, options, signal);
  }

  /** Ungecachter Pfad: Request über den Connection-Pool (Slot für die ganze Stream-Dauer). */
  private async *chatUncached(
    messages: ChatMessage[],
    options: ChatOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const payload = {
      model: options.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    };
    // Slot VOR dem fetch belegen und erst nach komplettem Stream-Verbrauch
    // wieder freigeben — sonst unterlaufen parallele Streams die Grenze.
    const pool = getOllamaPool(this.baseUrl);
    const release = await pool.acquire("ollama.chat");
    let res: Response;
    try {
      try {
        res = await fetchWithTimeout(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, options.timeoutMs ?? FETCH_TIMEOUT);
      } catch (e) {
        release();
        throw new ProviderError(
          "Ollama nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).",
          e,
        );
      }
      try {
        await assertOk(res, "Ollama chat");
        // Ollama streamt pro Zeile ein Objekt mit .message.content
        yield* parseNdjson(res.body!, "message.content", signal);
      } finally {
        release();
      }
    } catch (e) {
      // Abort-sicher: release kann hier doppelt laufen — release ist idempotent.
      release();
      throw e;
    }
  }
}
