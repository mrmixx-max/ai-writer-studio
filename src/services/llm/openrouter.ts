// OpenRouterProvider – Cloud-Provider (OpenAI-kompatibel, Modell-Routing).
// API-Keys: https://openrouter.ai/keys  – Key aus Config, NIEMALS hardcoden.
import { OpenAICompatibleProvider } from "./openai-compatible";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(OPENROUTER_BASE, apiKey, "OpenRouter (Cloud)");
  }
}
