// KiloProvider – Kilo Code API Provider
// API-Endpunkte: POST {base}/v1/chat/completions → Streaming (SSE, stream:true)
// Base URL: https://api.kilocode.ai/v1 (oder lokale Instanz)

import { OpenAICompatibleProvider } from "./openai-compatible";
import { isTauriRuntime } from "./localFetch";

const KILO_BASE = "https://api.kilocode.ai/v1";
// Dev-Browser: Kilo-Remote-URL relativ (Vite-Proxy /kilo → api.kilocode.ai),
// um Browser-CORS ("https://api.kilocode.ai/v1 ... blocked by CORS") zu vermeiden.
// Tauri: Original-URL (cross-origin per WebView2 erlaubt; Rust-Proxy für lokale Endpunkte).
const KILO_DEV_BASE = "/kilo/v1";

export class KiloProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string | undefined, baseUrl: string = KILO_BASE) {
    // Dev-Browser: Kilo-URL relativ (→ Vite-Proxy /kilo → api.kilocode.ai), um CORS zu umgehen.
    // Tauri: Original-URL (cross-origin per WebView2 erlaubt).
    const resolved = !isTauriRuntime() && typeof window !== "undefined" && baseUrl === KILO_BASE
      ? KILO_DEV_BASE
      : baseUrl;
    super(resolved, apiKey, "Kilo Code (Cloud)", {
      local: false,
      streaming: true,
      jsonMode: true,
      maxContextTokens: 128000,
    });
  }
}