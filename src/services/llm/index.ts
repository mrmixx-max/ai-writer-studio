// Factory + Manager: erzeugt den passenden Provider aus AppSettings
// und stellt eine einheitliche chat()-Schnittstelle bereit.

import type { AppSettings } from "@/types/config";
import type { ChatMessage, LLMProvider, ProviderId } from "@/types/llm";
import { OllamaProvider } from "./ollama";
import { LMStudioProvider } from "./lmstudio";
import { OpenAIProvider } from "./openai";
import { OpenRouterProvider } from "./openrouter";
import { Gpt2ApiProvider } from "./gpt2api";
import { OpenAICompatibleProvider } from "./openai-compatible";

/** Erzeugt eine Provider-Instanz anhand der aktuellen Settings. */
export function createProvider(settings: AppSettings): LLMProvider {
  switch (settings.provider) {
    case "ollama":
      return new OllamaProvider(settings.ollamaBaseUrl);
    case "lmstudio":
      return new LMStudioProvider(settings.lmstudioBaseUrl);
    case "openai":
      return new OpenAIProvider(settings.openaiApiKey);
    case "openrouter":
      return new OpenRouterProvider(settings.openrouterApiKey);
    case "gpt2api":
      return new Gpt2ApiProvider(settings.gpt2apiBaseUrl, settings.gpt2apiApiKey);
    default:
      throw new Error(`Unbekannter Provider: ${settings.provider}`);
  }
}

/** Baut die Nachrichtenliste inkl. globalem System-Prompt. */
export function buildMessages(
  userContent: string,
  settings: AppSettings,
  history?: ChatMessage[],
): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  if (settings.systemPrompt.trim()) {
    msgs.push({ role: "system", content: settings.systemPrompt });
  }
  if (history && history.length > 0) {
    msgs.push(...history);
  }
  msgs.push({ role: "user", content: userContent });
  return msgs;
}

/** Convenience-Wrapper für nicht-streamende Aufrufe (z.B. Tests). */
export async function completeOnce(
  settings: AppSettings,
  userContent: string,
  history?: ChatMessage[],
): Promise<string> {
  const provider = createProvider(settings);
  const msgs = buildMessages(userContent, settings, history);
  let out = "";
  for await (const token of provider.chat(msgs, {
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  })) {
    out += token;
  }
  return out;
}

export type { LLMProvider, ProviderId, ChatMessage };
export {
  OllamaProvider,
  LMStudioProvider,
  OpenAIProvider,
  OpenRouterProvider,
  Gpt2ApiProvider,
  OpenAICompatibleProvider,
};
