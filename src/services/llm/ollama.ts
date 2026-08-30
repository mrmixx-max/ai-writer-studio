// OllamaProvider – lokaler Standard-Provider.
// Endpunkte: GET  {base}/api/tags   → Modellliste
//            POST {base}/api/chat    → Streaming (NDJSON, stream:true)

import type { ChatMessage, ChatOptions, LLMProvider } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { assertOk, parseNdjson, fetchWithTimeout } from "./stream";

const HEALTH_TIMEOUT = 5000;
const FETCH_TIMEOUT = 30000;

export class OllamaProvider implements LLMProvider {
  constructor(private readonly baseUrl: string) {}

  describe(): string {
    return `Ollama (lokal: ${this.baseUrl})`;
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
    const payload = {
      model: options.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    };
    let res: Response;
    try {
      res = await fetchWithTimeout(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, options.timeoutMs ?? FETCH_TIMEOUT);
    } catch (e) {
      throw new ProviderError(
        "Ollama nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).",
        e,
      );
    }
    await assertOk(res, "Ollama chat");
    // Ollama streamt pro Zeile ein Objekt mit .message.content
    yield* parseNdjson(res.body!, "message.content", signal);
  }
}
