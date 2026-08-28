// Wiederverwendbare Retry-Logik für Netzwerk-Operationen.
// Datei: src/services/resilience/retry.ts
//
// Einsatz: alle fetch()-basierten Aufrufe (LLM, TTS, Whisper, Embeddings,
// Cloud-Sync, Updater). Nicht retrybar sind abgebrochene Requests (AbortError)
// und 4xx-Antworten außer 408/429 — ein kaputtes Token wird durch Wiederholen
// nicht besser.

import { getLogger } from "@/services/logger";

const log = getLogger("retry");

export interface RetryOptions {
  /** Maximale Versuche (inkl. Erstversuch). Default 3. */
  attempts?: number;
  /** Basis-Delay in ms für exponentielles Backoff. Default 500. */
  baseDelayMs?: number;
  /** Maximales Delay in ms. Default 8000. */
  maxDelayMs?: number;
  /** Verteilte Fehler weiter an isRetryable statt der Defaults. */
  isRetryable?: (err: unknown) => boolean;
  /** Vor jedem erneuten Versuch aufgerufen (Versuch 2..n). */
  onRetry?: (attempt: number, err: unknown) => void;
  /** Signal des Aufrufers — Abbruch wird nie retryt. */
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Default: HTTP-Fehler mit retryable Status sind retrybar. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function defaultIsRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    // 408 Timeout, 429 Rate-Limit, alle 5xx
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    // Abort = Nutzer/Keeper-Abbruch: nie retryen
    if (err.name === "AbortError") return false;
    // Netzwerkfehler (fetch wirft TypeError)
    if (err.name === "TypeError") return true;
  }
  return true;
}

/** Exponentielles Backoff mit Jitter (±25 %). */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  const raw = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  const jitter = raw * 0.25 * (Math.random() * 2 - 1);
  // Nach dem Jitter erneut kappen: ±25 % auf maxMs darf maxMs nie überschreiten.
  return Math.min(maxMs, Math.max(0, Math.round(raw + jitter)));
}

/**
 * Führt `fn` mit Retry aus. Beispiele:
 *   await withRetry(() => fetch(url).then(r => { if (!r.ok) throw new HttpError(r.status, url); return r.json(); }));
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 8000;
  const retryable = opts.isRetryable ?? defaultIsRetryable;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!retryable(err) || attempt === attempts) throw err;
      const delay = backoffDelay(attempt, base, maxDelay);
      log.warn(
        `Versuch ${attempt}/${attempts} fehlgeschlagen, Retry in ${delay} ms`,
        err instanceof Error ? err.message : String(err),
      );
      opts.onRetry?.(attempt, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * fetch mit Retry + HttpError-Normalisierung. Nutze dies statt rohem fetch()
 * für alle nicht-streamenden Netzwerkaufrufe.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: Omit<RetryOptions, "signal"> = {},
): Promise<Response> {
  const signal = init?.signal;
  return withRetry(
    async () => {
      const res = await fetch(input, init);
      if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} — ${String(input)}`);
      return res;
    },
    { ...opts, signal: signal ?? undefined },
  );
}
