// OpenAIProvider – Cloud-Provider. Key aus Config, NIEMALS hardcoden.
// Wrapper um OpenAICompatibleProvider gegen die offizielle API-URL.
import { OpenAICompatibleProvider } from "./openai-compatible";

const OPENAI_BASE = "https://api.openai.com/v1";

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(OPENAI_BASE, apiKey, "OpenAI (Cloud)");
  }
}
