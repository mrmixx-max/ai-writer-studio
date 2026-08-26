// Verbindungstest für Settings-UI. Liefert Status + Modellliste oder Fehler.

import type { AppSettings } from "@/types/config";
import { createProvider } from "./index";
import { ProviderError } from "@/types/llm";

export interface ConnectionResult {
  ok: boolean;
  models: string[];
  message: string;
}

export async function testConnection(settings: AppSettings): Promise<ConnectionResult> {
  const provider = createProvider(settings);
  try {
    const healthy = await provider.healthCheck();
    if (!healthy) {
      return {
        ok: false,
        models: [],
        message: `${provider.describe()} nicht erreichbar. Server starten / Endpoint prüfen.`,
      };
    }
    const models = await provider.listModels();
    return {
      ok: true,
      models,
      message: `${provider.describe()} verbunden. ${models.length} Modelle gefunden.`,
    };
  } catch (e) {
    const msg =
      e instanceof ProviderError
        ? e.message
        : `Unbekannter Fehler: ${(e as Error).message}`;
    return { ok: false, models: [], message: msg };
  }
}
