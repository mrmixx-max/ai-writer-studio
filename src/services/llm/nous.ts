// NousProvider – Cloud-Provider für die Nous Research Inference API.
// API (OpenAI-kompatibel): https://inference-api.nousresearch.com/v1
//   GET  {base}/models              → Modellliste
//   POST {base}/chat/completions    → Streaming (SSE, stream:true)
// Key aus Config, NIEMALS hardcoden.
import { OpenAICompatibleProvider } from "./openai-compatible";

export const NOUS_BASE_URL = "https://inference-api.nousresearch.com/v1";

export class NousProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, baseUrl: string = NOUS_BASE_URL) {
    super(baseUrl.replace(/\/+$/, ""), apiKey, "Nous Research (Cloud)");
  }
}
