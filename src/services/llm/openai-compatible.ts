// OpenAICompatibleProvider – Basisklasse für alle OpenAI-kompatiblen Endpunkte.
// Genutzt für: LM Studio (lokal), OpenAI (Cloud), OpenRouter (Cloud), gpt2api (Gateway).
// Endpunkte: GET  {base}/v1/models              → Modellliste
//            POST {base}/v1/chat/completions     → Streaming (SSE, stream:true)
// base ist typischerweise .../v1  (bei OpenAI/OpenRouter ist es die volle API-URL).

import type { ChatMessage, ChatOptions, LLMProvider } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { assertOk, parseSse, fetchWithTimeout } from "./stream";

const HEALTH_TIMEOUT = 5000;
const FETCH_TIMEOUT = 30000;

export class OpenAICompatibleProvider implements LLMProvider {
  /**
   * @param baseUrl  Vollständige Basis-URL inkl. /v1 (z.B. http://localhost:1234/v1)
   * @param apiKey   Optional – nur für Cloud-Provider (OpenAI/OpenRouter/gpt2api)
   * @param label    Anzeigename für Fehler/Status
   */
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly label: string,
  ) {}

  describe(): string {
    if (this.apiKey) {
      const masked = `sk-...${this.apiKey.slice(-4)}`;
      return `${this.label} (${masked})`;
    }
    return `${this.label} (${this.baseUrl})`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.headers(),
      }, HEALTH_TIMEOUT);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
        headers: this.headers(),
      }, FETCH_TIMEOUT);
      await assertOk(res, `${this.label} listModels`);
      const data = await res.json();
      return (data.data ?? []).map((m: any) => m.id as string);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(`${this.label} nicht erreichbar. Endpoint prüfen.`, e);
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
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    };
    let res: Response;
    try {
      res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
      }, FETCH_TIMEOUT);
    } catch (e) {
      throw new ProviderError(`${this.label} nicht erreichbar. Endpoint prüfen.`, e);
    }
    await assertOk(res, `${this.label} chat`);
    // OpenAI-Format: choices[0].delta.content
    yield* parseSse(res.body!, "choices.0.delta.content", signal);
  }
}
