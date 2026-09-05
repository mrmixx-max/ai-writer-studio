// CORS- und Health-Check für lokale Ollama-Instanzen (Sprint 3, Hotfix).
//
// Ollama unter CORS: Wenn OLLAMA_ORIGINS nicht konfiguriert ist, blockiert der
// Server Requests von WebViews (tauri://localhost, http://localhost:5173) mit 403.
// Dieser Check prüft beim Router-Start, ob die lokale Ollama-Instanz CORS-Requests
// akzeptiert, und gibt eine sprechende Fehlermeldung aus.

import { OLLAMA_CORS_ORIGINS } from "./localModelProfiles";

export interface CorsCheckResult {
  ok: boolean;
  origin: string;
  errorMessage?: string;
}

/**
 * Prüft, ob eine lokale Ollama-Instanz CORS-Requests für den aktuellen
 * Origin akzeptiert. Liefert eine sprechende Fehlermeldung bei Problemen.
 */
export async function checkOllamaCors(
  baseUrl: string,
  origin: string = OLLAMA_CORS_ORIGINS[0],
): Promise<CorsCheckResult> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: { Origin: origin },
    });

    if (res.ok) {
      return { ok: true, origin };
    }

    // 403 = CORS blockiert
    if (res.status === 403) {
      return {
        ok: false,
        origin,
        errorMessage: `Ollama blockiert CORS-Requests von ${origin}. ` +
          `Starten Sie Ollama mit: OLLAMA_ORIGINS="${origin}" ollama serve`,
      };
    }

    return {
      ok: false,
      origin,
      errorMessage: `Ollama antwortet mit Status ${res.status}.`,
    };
  } catch (e) {
    return {
      ok: false,
      origin,
      errorMessage: `Ollama nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
