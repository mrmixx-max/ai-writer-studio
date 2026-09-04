// Retry-/Timeout-Hilfen für die Generierungs-Pipeline (A2/A3).
//
// - Retry nur bei: Timeout, Netzwerkfehler, ungültigem JSON (nach Repair).
// - Kein Retry bei: AbortController-Abbruch, 4xx vom Provider.
// - Exponentielles Backoff 1s / 3s / 8s + Jitter (±20%).
import { ProviderError } from "@/types/llm";

/** Klassifizierbare Fehlerursachen für die Retry-Entscheidung. */
export type FailureKind = "timeout" | "network" | "json" | "http4xx" | "abort" | "unknown";

/** Fehler mit Ursachen-Tag — von isAbortError / klassifizieren erzeugt. */
export class ClassifiedError extends Error {
  constructor(
    message: string,
    public readonly kind: FailureKind,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ClassifiedError";
  }
}

/** true, wenn der Fehler von einem AbortController-Abbruch stammt. */
export function isAbortError(e: unknown): boolean {
  if (e instanceof ClassifiedError) return e.kind === "abort";
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}

/**
 * Klassifiziert einen Fehler für die Retry-Entscheidung.
 * Timeout-, Netzwerk- und JSON-Fehler sind retrybar; 4xx und Abort nicht.
 */
export function classifyError(e: unknown): FailureKind {
  if (e instanceof ClassifiedError) return e.kind;
  if (e instanceof Error) {
    if (e.name === "AbortError") return "abort";
    if (e.name === "TimeoutError") return "timeout";
    if (e instanceof ProviderError) {
      const msg = `${e.message} ${e.cause instanceof Error ? `${e.cause.message}` : ""}`;
      if (/HTTP 4\d\d/.test(msg)) return "http4xx";
      if (/Timeout/i.test(msg) || e.cause instanceof Error && /Timeout/i.test(e.cause.name + e.cause.message)) return "timeout";
      return "network";
    }
    // Rohe 4xx-Meldung aus assertOk ("... (HTTP 4xx). ...")
    if (/HTTP 4\d\d/.test(e.message)) return "http4xx";
    if (/network|fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket/i.test(e.message)) return "network";
    if (/timeout|timed out|ETIMEDOUT/i.test(e.message)) return "timeout";
    if (/JSON/i.test(e.message)) return "json";
  }
  return "unknown";
}

/** Retrybar: Timeout, Netzwerk, ungültiges JSON. Nicht: Abort, 4xx. */
export function isRetryable(e: unknown): boolean {
  const kind = classifyError(e);
  return kind === "timeout" || kind === "network" || kind === "json";
}

/** Backoff-Delays in ms: 1s / 3s / 8s (max. 3 Versuche = 2 Pausen). */
export const BACKOFF_DELAYS_MS = [1000, 3000, 8000] as const;

/** Maximale Anzahl Versuche (inkl. Erstversuch). */
export const MAX_ATTEMPTS = 3;

/** Jitter ±20% um den Basis-Delay. */
function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

/** Wartet ms Millisekunden; bricht sofort ab, wenn das Signal feuert. */
export function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Führt fn mit bis zu MAX_ATTEMPTS Versuchen aus.
 * - Retrybar (Timeout/Netzwerk/JSON): Backoff 1s/3s/8s + Jitter.
 * - Abort oder 4xx: sofort weiterwerfen, kein Retry.
 * - onJsonRetry: wird beim erneuten Versuch nach JSON-Fehler aufgerufen
 *   (z.B. um einen schärferen Prompt zu setzen).
 */
export async function withRetry<T>(
  fn: (attempt: number, isJsonRetry: boolean) => Promise<T>,
  signal?: AbortSignal,
  onJsonRetry?: (attempt: number) => void,
): Promise<T> {
  let lastError: unknown;
  let jsonRetryUsed = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await fn(attempt, jsonRetryUsed);
    } catch (e: unknown) {
      lastError = e;
      // Abbruch: NIEMALS retryen — Abort gehört zum Vertrag.
      if (isAbortError(e)) throw e;
      // 4xx vom Provider: Client-Fehler, Retry hilft nicht.
      if (classifyError(e) === "http4xx") throw e;
      // Nicht retrybar (unknown etc.): weiterwerfen.
      if (!isRetryable(e)) throw e;
      // Letzter Versuch erreicht: Fehler weiterwerfen.
      if (attempt === MAX_ATTEMPTS) throw e;

      // Wiederholter JSON-Fehler → nächster Versuch mit schärferem Prompt.
      if (classifyError(e) === "json" && !jsonRetryUsed) {
        jsonRetryUsed = true;
        onJsonRetry?.(attempt);
      }

      const base = BACKOFF_DELAYS_MS[Math.min(attempt - 1, BACKOFF_DELAYS_MS.length - 1)];
      await sleepWithAbort(jitter(base), signal);
    }
  }
  // Unerreichbar, aber TypeScript-treu.
  throw lastError;
}

/**
 * Kombiniert ein externes AbortSignal mit einem Timeout zu einem neuen
 * Controller-Signal. Wird der Timeout erreicht, feuert `timeoutSignal`
 * (Name "TimeoutError"); wird das externe Signal abgebrochen, ebenfalls.
 */
export function createTimeoutController(
  timeoutMs: number,
  external?: AbortSignal,
): { controller: AbortController; timeoutSignal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Timeout", "TimeoutError"));
  }, timeoutMs);
  const onExternalAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) onExternalAbort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  const clear = () => {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  };
  return { controller, timeoutSignal: controller.signal, clear };
}
