// Verbindungstest für Settings-UI. Liefert Status + Modellliste oder Fehler.

import type { AppSettings } from "@/types/config";
import { createProvider } from "./index";
import { isTauriRuntime } from "./localFetch";
import { ProviderError } from "@/types/llm";

export interface ConnectionResult {
  ok: boolean;
  models: string[];
  message: string;
}

export async function testConnection(settings: AppSettings): Promise<ConnectionResult> {
  const provider = createProvider(settings);
  // Transport-Diagnose: Welcher Pfad wird benutzt? (Rust-Proxy vs. WebView-fetch)
  // und: meldet sich das Tauri-Backend überhaupt? Das steht dann in der
  // Provider-Karte statt einer geratenen Ursache.
  const transport = isTauriRuntime() ? "rust-proxy" : "webview-fetch";
  let tauriBridge: string;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    // Harmloser Backend-Ping: git_version existiert immer (kein Server nötig).
    await invoke<string>("git_version");
    tauriBridge = "ok";
  } catch (e) {
    tauriBridge = `defekt (${e instanceof Error ? e.message : String(e)})`;
  }
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
        message:
          `${provider.describe()} nicht erreichbar. ${hint} ` +
          `[transport=${transport}, tauri-bridge=${tauriBridge}]`,
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
