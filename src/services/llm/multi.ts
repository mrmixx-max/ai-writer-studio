// Feature: Multi-Modell-Unterstützung — mehrere Provider/Modell-Slots parallel.
// Slots werden in AppSettings.kiModelSlots konfiguriert; runKIAction wählt
// einen Slot anhand slotId (statt global settings.provider/settings.model).
import type { AppSettings } from "@/types/config";
import type { ProviderId, LLMProvider } from "@/types/llm";
import { createProvider } from "./index";
import {
  OllamaProvider,
  LMStudioProvider,
  OpenAIProvider,
  OpenRouterProvider,
  Gpt2ApiProvider,
} from "./index";

export interface KIModelSlot {
  id: string;
  label: string; // Anzeigename in der UI
  provider: ProviderId;
  model: string;
}

export function defaultModelSlots(): KIModelSlot[] {
  return [{ id: "main", label: "Hauptmodell", provider: "ollama", model: "llama3.2" }];
}

/** Erzeugt eine Provider-Instanz für einen konkreten Slot. */
export function createSlotProvider(settings: AppSettings, slot: KIModelSlot): LLMProvider {
  switch (slot.provider) {
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
      return createProvider(settings);
  }
}

/** Findet einen Slot anhand seiner ID; fällt auf "main" bzw. den ersten Slot zurück. */
export function findSlot(slots: KIModelSlot[], slotId?: string): KIModelSlot | undefined {
  if (slotId) {
    const hit = slots.find((s) => s.id === slotId);
    if (hit) return hit;
  }
  return slots.find((s) => s.id === "main") ?? slots[0];
}

/**
 * Health-Check über alle Slots parallel — für die Modell-Auswahl-UI
 * (zeigt, welche Provider gerade erreichbar sind).
 */
export async function checkSlotHealth(
  settings: AppSettings,
  slots: KIModelSlot[],
): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    slots.map(async (s) => {
      const ok = await createSlotProvider(settings, s)
        .healthCheck()
        .catch(() => false);
      return [s.id, ok] as const;
    }),
  );
  return Object.fromEntries(entries);
}
