// LMStudioProvider – lokaler OpenAI-kompatibler Provider.
// Reiner Wrapper um OpenAICompatibleProvider (kein Key nötig).
import { OpenAICompatibleProvider } from "./openai-compatible";

export class LMStudioProvider extends OpenAICompatibleProvider {
  constructor(baseUrl: string) {
    super(baseUrl, undefined, `LM Studio (lokal: ${baseUrl})`);
  }
}
