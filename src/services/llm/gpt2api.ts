// Gpt2ApiProvider – OpenAI-kompatibles Gateway (gpt2api, Go/Reverse-Proxy für chatgpt.com).
// Siehe https://github.com/laowang74152/gpt2api – spricht /v1/chat/completions (SSE).
// Basis-URL ist konfigurierbar (Default http://localhost:8080/v1), Key optional.
import { OpenAICompatibleProvider } from "./openai-compatible";

export class Gpt2ApiProvider extends OpenAICompatibleProvider {
  constructor(baseUrl: string, apiKey: string | undefined) {
    super(baseUrl, apiKey, `gpt2api (Gateway: ${baseUrl})`);
  }
}
