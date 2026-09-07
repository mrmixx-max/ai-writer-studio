// OpenAICompatibleProvider – Basisklasse für alle OpenAI-kompatiblen Endpunkte.
// Genutzt für: LM Studio (lokal), OpenAI (Cloud), OpenRouter (Cloud), gpt2api (Gateway).
// Endpunkte: GET  {base}/v1/models              → Modellliste
//            POST {base}/v1/chat/completions     → Streaming (SSE, stream:true)
// base ist typischerweise .../v1  (bei OpenAI/OpenRouter ist es die volle API-URL).

import type { ChatMessage, ChatOptions, LLMProvider, LLMProviderCapabilities } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { assertOk, parseSse, fetchWithTimeout } from "./stream";
import { normalizeLocalBaseUrl } from "./baseUrl";

// Sprint 19c (Send-Debug): 3s statt 5s — healthCheck blockiert den
// Senden-Button (busy=true) bis zum Ergebnis; lokale Endpunkte antworten
// in Millisekunden, 3s reicht als Erreichbarkeits-Signal.
const HEALTH_TIMEOUT = 3000;
const FETCH_TIMEOUT = 30000;

export class OpenAICompatibleProvider implements LLMProvider {
  /**
   * @param baseUrl  Vollständige Basis-URL inkl. /v1 (z.B. http://localhost:1234/v1)
   * @param apiKey   Optional – nur für Cloud-Provider (OpenAI/OpenRouter/gpt2api)
   * @param label    Anzeigename für Fehler/Status
   * @param capabilities Override für Subklassen (Default: Cloud-Profile)
   */
  constructor(
    private baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly label: string,
    protected readonly caps: LLMProviderCapabilities = {
      local: false,
      streaming: true,
      jsonMode: true,
      maxContextTokens: null,
    },
  ) {
    // Sprint 19c: localhost → 127.0.0.1 (IPv6-::1-Falle umgehen).
    // Betrifft nur lokale Endpunkte (LM Studio, gpt2api); Cloud-URLs
    // (api.openai.com etc.) bleiben unverändert.
    this.baseUrl = normalizeLocalBaseUrl(baseUrl);
  }

  /** B1: Fähigkeiten des Providers. */
  capabilities(): LLMProviderCapabilities {
    return { ...this.caps };
  }

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
      }, options.timeoutMs ?? FETCH_TIMEOUT);
    } catch (e) {
      throw new ProviderError(`${this.label} nicht erreichbar. Endpoint prüfen.`, e);
    }
    await assertOk(res, `${this.label} chat`);
    // OpenAI-Format: choices[0].delta.content
    yield* parseSse(res.body!, "choices.0.delta.content", signal);
  }
}
