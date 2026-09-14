// Chat Service (Sprint 29): Freies Chatten mit Ollama LLM.
// streaming + history + autoren-assistent.
//
// Transport: Der persistente OllamaProvider (localFetch → Tauri-Rust-Proxy
// ohne CORS-403, Browser → window.fetch). KEIN Direkt-fetch mehr — der
// scheiterte in der installierten App an Origin https://tauri.localhost.
// keep_alive=-1 hält das Modell geladen, num_ctx=8192 deckelt den Kontext.

import { OllamaProvider } from "@/services/llm/ollama";
import type { ChatMessage as ProviderChatMessage } from "@/types/llm";
import { normalizeLocalBaseUrl } from "@/services/llm/baseUrl";
import { getLocal } from "@/services/llm/localFetch";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface SendMessageOptions {
  model?: string;
  systemPrompt?: string;
  stream?: boolean;
  temperature?: number;
  /** Overridbare Basis-URL (Default 127.0.0.1:11434). */
  baseUrl?: string;
}

const AUTHORS_SYSTEM_PROMPT = `Du bist ein erfahrener Literaturagent und Ghostwriter. Du hilfst Autoren bei:
- Handlungsideen und Plot-Entwicklung
- Charakterentwicklung und -tiefe
- Dialog-Schreibstil und -Rhythmus
- Weltbau und Recherche
- Kapitelstruktur und Pacing
- Schlusskorrektur und Stilistik

Antworte auf Deutsch, präzise und konstruktiv. Gib konkrete Beispiele. Stelle Rückfragen, wenn etwas unklar ist.`;

/** Baut den Provider für die übergebene (oder Default-) Basis-URL. */
function providerFor(baseUrl?: string): OllamaProvider {
  return new OllamaProvider(normalizeLocalBaseUrl(baseUrl ?? "http://127.0.0.1:11434"));
}

function toProviderMessages(
  messages: ChatMessage[],
  content: string,
  systemPrompt: string,
): ProviderChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((m): ProviderChatMessage => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];
}

/**
 * Sendet eine Nachricht und gibt die Antwort zurück.
 */
export async function sendMessage(
  messages: ChatMessage[],
  content: string,
  options: SendMessageOptions = {},
): Promise<ChatMessage> {
  const { model = "llama3.2", systemPrompt = AUTHORS_SYSTEM_PROMPT, temperature = 0.8 } = options;

  try {
    const provider = providerFor(options.baseUrl);
    let full = "";
    for await (const chunk of provider.chat(
      toProviderMessages(messages, content, systemPrompt),
      { model, temperature, maxTokens: 1000 },
    )) {
      full += chunk;
    }
    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: full || "Keine Antwort erhalten.",
      timestamp: Date.now(),
    };
  } catch (e) {
    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: `⚠️ Ollama nicht erreichbar (127.0.0.1:11434).\n\nFehler: ${e instanceof Error ? e.message : String(e)}\n\nStarte Ollama mit dem gewählten Modell (${model}) oder nutze den Demo-Modus.`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Streaming-Chat mit Callback.
 */
export async function sendMessageStreaming(
  messages: ChatMessage[],
  content: string,
  onChunk: (chunk: string) => void,
  options: SendMessageOptions = {},
): Promise<ChatMessage> {
  const { model = "llama3.2", systemPrompt = AUTHORS_SYSTEM_PROMPT, temperature = 0.8 } = options;

  try {
    const provider = providerFor(options.baseUrl);
    let fullContent = "";
    for await (const chunk of provider.chat(
      toProviderMessages(messages, content, systemPrompt),
      { model, temperature, maxTokens: 1000 },
    )) {
      fullContent += chunk;
      onChunk(chunk);
    }

    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: fullContent,
      timestamp: Date.now(),
    };
  } catch (e) {
    const errorMsg = `⚠️ Ollama nicht erreichbar.\n\nFehler: ${e instanceof Error ? e.message : String(e)}`;
    onChunk(errorMsg);
    return {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: errorMsg,
      timestamp: Date.now(),
    };
  }
}

/**
 * Prüft ob Ollama läuft.
 */
export async function isOllamaAvailable(baseUrl?: string): Promise<boolean> {
  try {
    const base = normalizeLocalBaseUrl(baseUrl ?? "http://127.0.0.1:11434");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    try {
      const response = await getLocal(`${base}/api/tags`, 2000, { signal: ctrl.signal });
      return response.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
