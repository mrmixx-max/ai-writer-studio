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
      // Diagnose für den Fehlerbericht: unterscheidet "Server tot" von
      // "Server antwortet, aber Transport blockiert" (CORS/Plugin-Rechte).
      // Das Ergebnis landet im message-Feld der Provider-Karte.
      let hint = "Server starten / Endpoint prüfen.";
      try {
        const base = (settings.ollamaBaseUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
        const probe = await fetch(`${base}/api/tags`, { method: "GET" });
        hint = probe.ok
          ? `DIAGNOSE: Server antwortet auf WebView-fetch (${probe.status}), aber der Provider-Transport meldet unerreichbar. Läuft evtl. ein alter Build ohne HTTP-Plugin? Version prüfen.`
          : `DIAGNOSE: Server antwortet mit HTTP ${probe.status} auf WebView-fetch (kein CORS-Block, aber Fehlerstatus).`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        hint = /failed to fetch|load failed|networkerror|aborted/i.test(msg)
          ? `DIAGNOSE: WebView-fetch scheitert mit Netzwerkfehler (${msg || "failed to fetch"}) — Server läuft nicht oder blockiert (CORS/403). Server starten / Endpoint prüfen.`
          : `DIAGNOSE: WebView-fetch Fehler: ${msg}. Server starten / Endpoint prüfen.`;
      }
      return {
        ok: false,
        models: [],
        message: `${provider.describe()} nicht erreichbar. ${hint}`,
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
