// Globaler fetch-Retry-Shim: retryt fehlgeschlagene Netzwerkaufrufe zentral.
// Datei: src/services/resilience/fetchRetryShim.ts
//
// Warum ein Shim statt Einbau in jede Call-Site: AI Writer Studio nutzt
// fetch() an ~30 Stellen (LLM, TTS, Whisper, Embeddings, Updater, Cloud-Sync).
// Der Shim deckt alle ab, ohne sie anfassen zu müssen.
//
// Sicherheit:
//   - Erfolgreiche Responses (auch Streams) werden sofort durchgereicht —
//     niemals wird ein bereits konsumierter Body neu angefragt.
//   - Nur Netzwerkfehler (TypeError) und 408/429/5xx werden retryt.
//   - Abbruch durch den Aufrufer (AbortError) wird nie retryt.
//   - Installierbar nur einmal (idempotent).

import { getLogger } from "@/services/logger";
import { HttpError, defaultIsRetryable, backoffDelay } from "./retry";

const log = getLogger("fetch-retry");

const RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 4000;

export function installFetchRetryShim(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__aws_fetch_retry_installed) return;
  w.__aws_fetch_retry_installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const res = await originalFetch(input, init);
        if (res.ok) return res;
        const httpErr = new HttpError(res.status, `HTTP ${res.status} — ${String(input)}`);
        if (!defaultIsRetryable(httpErr) || attempt === RETRY_ATTEMPTS) {
          return res; // 4xx etc. unverändert an den Aufrufer
        }
        lastErr = httpErr;
      } catch (err) {
        lastErr = err;
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (!defaultIsRetryable(err) || attempt === RETRY_ATTEMPTS) throw err;
      }
      const delay = backoffDelay(attempt, BASE_DELAY_MS, MAX_DELAY_MS);
      log.warn(
        `fetch fehlgeschlagen (Versuch ${attempt}/${RETRY_ATTEMPTS}), Retry in ${delay} ms`,
        String(input),
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
    throw lastErr;
  };
}
