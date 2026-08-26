// OllamaProvider – lokaler Standard-Provider.
// Endpunkte: GET  {base}/api/tags   → Modellliste
//            POST {base}/api/chat    → Streaming (NDJSON, stream:true)

import type { ChatMessage, ChatOptions, LLMProvider } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { assertOk, parseNdjson } from "./stream";

export class OllamaProvider implements LLMProvider {
  constructor(private readonly baseUrl: string) {}

  describe(): string {
    return `Ollama (lokal: ${this.baseUrl})`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
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
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new ProviderError(
        "Ollama nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).",
        e,
      );
    }
    await assertOk(res, "Ollama chat");
    // Ollama streamt pro Zeile ein Objekt mit .message.content
    yield* parseNdjson(res.body!, "message.content");
  }
}
