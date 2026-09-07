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
import { normalizeLocalBaseUrl } from "./baseUrl";

// Sprint 19c (Send-Debug): 3s statt 5s — der healthCheck läuft synchron vor
// jedem KI-Aufruf (runKIAction) und blockiert solange den Senden-Button
// (busy=true). Jede Sekunde weniger Wartezeit zählt; Ollama antwortet auf
// /api/tags lokal in Millisekunden, 3s reicht als Erreichbarkeits-Signal.
const HEALTH_TIMEOUT = 3000;
/** Sprint 19d: Modellliste — reine Metadaten, 10s reichen immer. */
const LIST_TIMEOUT = 10000;

/**
 * Sprint 19d (Timeout-Architektur für große lokale Modelle):
 * Empfohlene Obergrenze für /api/chat (10min). Große CPU-Modelle
 * (z.B. 14-GB-GGUF) brauchen >60s bis zum ersten Token (Model-Load +
 * Inferenz) — der alte Whole-Request-Timeout von 30s hat sie abgewürgt
 * ("Fehler bei KI-Aufruf"). chat() selbst setzt KEINEN internen Timeout
 * mehr (Abort kommt von außen über `signal`); Aufrufer, die eine harte
 * Obergrenze wollen, brechen per AbortController nach diesem Wert ab.
 * Explizites `options.timeoutMs` aktiviert weiterhin fetchWithTimeout.
 */
export const OLLAMA_CHAT_TIMEOUT_MS = 600_000;
/**
 * Sprint 19d: Default-Kontextfenster für /api/chat. Ollamas Server-Default
 * (131072) sprengt bei großen Modellen den CPU-RAM — 8192 reicht für
 * Schreib-Use-Cases und hält Model-Load + Inferenz bezahlbar.
 * Überschreibbar pro Call via `(options as { numCtx?: number }).numCtx`.
 */
export const OLLAMA_DEFAULT_NUM_CTX = 8192;
/**
 * Sprint 19d: Default für `keep_alive` im /api/chat-Payload. "keep" hält
 * das Modell nach dem Request im VRAM/RAM geladen — kein 14-GB-Reload
 * nach 5min Idle mehr. Überschreibbar pro Call via
 * `(options as { keepAlive?: string | number }).keepAlive`
 * (z.B. "15m", 0 = sofort entladen).
 */
export const OLLAMA_DEFAULT_KEEP_ALIVE = "keep";

/** Optionale, Ollama-spezifische Chat-Extras (kein Eingriff in ChatOptions nötig). */
export interface OllamaChatExtras {
  /** keep_alive für /api/chat (Default: "keep"). */
  keepAlive?: string | number;
  /** num_ctx für /api/chat (Default: 8192). */
  numCtx?: number;
}

export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Sprint 19c: localhost → 127.0.0.1 (IPv6-::1-Falle umgehen).
    this.baseUrl = normalizeLocalBaseUrl(baseUrl);
  }

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
      const res = await fetchWithTimeout(`${this.baseUrl}/api/tags`, {}, LIST_TIMEOUT);
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
    // Sprint 19d: keep_alive hält das Modell geladen (kein 14-GB-Reload nach
    // Idle), num_ctx deckelt das Kontextfenster (Server-Default 131k killt
    // den CPU-RAM). Beide pro Call überschreibbar via OllamaChatExtras.
    const extras = options as ChatOptions & OllamaChatExtras;
    const payload = {
      model: options.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      keep_alive: extras.keepAlive ?? OLLAMA_DEFAULT_KEEP_ALIVE,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
        num_ctx: extras.numCtx ?? OLLAMA_DEFAULT_NUM_CTX,
      },
    };
    // Slot VOR dem fetch belegen und erst nach komplettem Stream-Verbrauch
    // wieder freigeben — sonst unterlaufen parallele Streams die Grenze.
    const pool = getOllamaPool(this.baseUrl);
    const release = await pool.acquire("ollama.chat");
    let res: Response;
    try {
      try {
        // Sprint 19d: KEIN Whole-Request-Timeout für /api/chat — große
        // Modelle brauchen >60s bis zum ersten Token. fetch läuft ohne
        // internen Timer; Abort kommt von außen über `signal`. Nur ein
        // explizites options.timeoutMs aktiviert fetchWithTimeout.
        const init: RequestInit = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          ...(signal ? { signal } : {}),
        };
        res = options.timeoutMs != null
          ? await fetchWithTimeout(`${this.baseUrl}/api/chat`, init, options.timeoutMs)
          : await fetch(`${this.baseUrl}/api/chat`, init);
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
