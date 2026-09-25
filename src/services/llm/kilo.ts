// KiloProvider – Kilo Code API Provider
// API-Endpunkte: POST {base}/v1/chat/completions → Streaming (SSE, stream:true)
// Base URL: https://api.kilocode.ai/v1 (oder lokale Instanz)

import { OpenAICompatibleProvider } from "./openai-compatible";

const KILO_BASE = "https://api.kilocode.ai/v1";

export class KiloProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string | undefined, baseUrl: string = KILO_BASE) {
    super(baseUrl, apiKey, "Kilo Code (Cloud)", {
      local: false,
      streaming: true,
      jsonMode: true,
      maxContextTokens: 128000,
    });
  }
}