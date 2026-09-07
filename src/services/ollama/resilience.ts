// Ollama-Resilienz (Sprint 13, Agent 1).
//
// Additive helpers, no breaking changes:
// - requestWithTimeout(): fetch with abort-based timeout guard.
// - SingleFlight: concurrent identical requests share one promise
//   (Ollama on CPU serves one at a time -- dedupe instead of hammering).
// - SerialQueue: FIFO queue (concurrency 1) for CPU-bound Ollama calls.
// - Model fallback chain: preferred -> fallbacks -> clear offline error.
// - OllamaHealthCache: stale-health cache, no probe on every call.
//
// All messages German, ASCII-only (shell-safe). No real Ollama needed;
// fetch is injectable for tests.

/** Default request timeout (30 s, Router-Konvention). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Default health-cache TTL (15 s -- health without probing every call). */
export const DEFAULT_HEALTH_TTL_MS = 15_000;

/** Clear offline hint shown when Ollama is unreachable. */
export const OFFLINE_MESSAGE =
  "Ollama ist nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).";

/** Error kinds of the resilience layer. */
export type OllamaResilienceErrorKind = "timeout" | "offline" | "model-missing" | "aborted";

/** Typed error of the resilience layer (kind is machine-readable). */
export class OllamaResilienceError extends Error {
  readonly kind: OllamaResilienceErrorKind;
  readonly cause?: unknown;
  constructor(kind: OllamaResilienceErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "OllamaResilienceError";
    this.kind = kind;
    this.cause = cause;
  }
}

// --- Offline / model-missing detection ---------------------------------------

/** True for network-level failures (refused, DNS, fetch failed). */
export function isOfflineError(e: unknown): boolean {
  if (typeof e === "string") return /fetch failed|failed to fetch|econnrefused|enotfound|network/i.test(e);
  if (e instanceof OllamaResilienceError) return e.kind === "offline";
  if (e instanceof TypeError) return true;
  const text = errorText(e);
  return /fetch failed|failed to fetch|econnrefused|enotfound|network error|load failed|socket hang up/i.test(text);
}

/** True when the error means "model not installed" (retry with fallback). */
export function isModelMissingError(e: unknown): boolean {
  if (e instanceof OllamaResilienceError) return e.kind === "model-missing";
  if (e && typeof e === "object" && (e as { status?: unknown }).status === 404) return true;
  const text = errorText(e).toLowerCase();
  return (
    text.includes("not found") ||
    text.includes("no such model") ||
    text.includes("unknown model") ||
    text.includes("does not exist") ||
    text.includes("nicht installiert") ||
    text.includes("nicht gefunden") ||
    /model .* not (available|found|installed)/.test(text)
  );
}

function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const parts: string[] = [];
    const rec = e as Record<string, unknown>;
    if (typeof rec["message"] === "string") parts.push(rec["message"] as string);
    if (typeof rec["status"] === "number") parts.push(`HTTP ${rec["status"] as number}`);
    const cause = rec["cause"];
    if (typeof cause === "string") parts.push(cause);
    else if (cause && typeof cause === "object" && typeof (cause as { message?: unknown }).message === "string") {
      parts.push((cause as { message: string }).message);
    }
    return parts.join(" ");
  }
  return "";
}

/** Wraps any failure into the clear offline error (keeps the cause). */
export function toOfflineError(e: unknown): OllamaResilienceError {
  if (e instanceof OllamaResilienceError && e.kind === "offline") return e;
  return new OllamaResilienceError("offline", OFFLINE_MESSAGE, e);
}

// --- Timeout guard ------------------------------------------------------------

/**
 * fetch with timeout guard: aborts after timeoutMs (AbortController),
 * passes an already-aborted external signal through as "aborted",
 * maps network failures to the clear offline error.
 * Additive: existing callers keep working, timeoutMs/fetchFn are optional.
 */
export async function requestWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const ms = Math.max(1, Math.floor(timeoutMs));
  const external = init.signal;
  if (external?.aborted) {
    throw new OllamaResilienceError("aborted", "Ollama-Request wurde abgebrochen (Signal war bereits abgebrochen).");
  }
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  const onExternalAbort = (): void => ctrl.abort();
  external?.addEventListener("abort", onExternalAbort);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (external?.aborted && !timedOut) {
      throw new OllamaResilienceError("aborted", "Ollama-Request wurde abgebrochen.", e);
    }
    if (timedOut) {
      throw new OllamaResilienceError(
        "timeout",
        `Ollama-Request nach ${ms} ms abgebrochen (Timeout). Ollama ausgelastet oder Modell noch am Laden?`,
        e,
      );
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new OllamaResilienceError("aborted", "Ollama-Request wurde abgebrochen.", e);
    }
    if (isOfflineError(e)) throw toOfflineError(e);
    throw e;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

// --- Single-flight (identical concurrent requests share one promise) ----------

/**
 * Single-flight dedupe: N concurrent run() calls with the same key share
 * one execution. Ollama on CPU serves one request at a time, so parallel
 * identical calls only hammer the server -- this collapses them.
 * After settle the key is removed, the next call re-executes.
 */
export class SingleFlight<T = unknown> {
  private readonly inflight = new Map<string, Promise<T>>();

  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = fn().finally(() => {
      if (this.inflight.get(key) === p) this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }

  /** Number of currently shared (in-flight) executions. */
  get size(): number {
    return this.inflight.size;
  }

  clear(): void {
    this.inflight.clear();
  }
}

// --- SerialQueue (FIFO, concurrency 1) ----------------------------------------

/**
 * FIFO serial queue: enqueued tasks start strictly in enqueue order,
 * one at a time (Ollama CPU serves 1 at a time). A rejected task does
 * not break the chain -- the next task still runs.
 */
export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;

  /** Currently queued + running tasks. */
  get size(): number {
    return this.pending;
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const next = this.tail.then(fn);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next.finally(() => {
      this.pending -= 1;
    });
  }
}

// --- Model fallback chain -----------------------------------------------------

/** Preferred + fallbacks, trimmed and deduped (order kept). */
export function resolveModelChain(preferred: string, fallbacks: string[] = []): string[] {
  const chain = [preferred, ...fallbacks].map((m) => (m ?? "").trim()).filter((m) => m !== "");
  return [...new Set(chain)];
}

export interface FallbackCallOptions<T> {
  preferred: string;
  fallbacks?: string[];
  call: (model: string) => Promise<T>;
  /** When to try the next model (default: isModelMissingError). */
  shouldFallback?: (e: unknown) => boolean;
}

export interface FallbackResult<T> {
  value: T;
  /** Model that actually answered. */
  model: string;
  /** All models tried, in order. */
  tried: string[];
}

/**
 * Tries preferred, then fallbacks in order. Offline errors abort the chain
 * immediately with the clear offline hint; model-missing errors continue
 * with the next model. Chain exhausted -> model-missing error listing
 * all tried models.
 */
export async function runWithFallbackChain<T>(options: FallbackCallOptions<T>): Promise<FallbackResult<T>> {
  const chain = resolveModelChain(options.preferred, options.fallbacks ?? []);
  if (chain.length === 0) {
    throw new OllamaResilienceError("model-missing", "Kein Modellname angegeben -- nichts zu versuchen.");
  }
  const shouldFallback = options.shouldFallback ?? isModelMissingError;
  const tried: string[] = [];
  let lastError: unknown = null;
  for (const model of chain) {
    tried.push(model);
    try {
      const value = await options.call(model);
      return { value, model, tried };
    } catch (e) {
      lastError = e;
      if (isOfflineError(e)) throw toOfflineError(e);
      const isLast = model === chain[chain.length - 1];
      if (isLast || !shouldFallback(e)) {
        if (isLast && isModelMissingError(e) && chain.length > 1) break;
        throw e;
      }
    }
  }
  throw new OllamaResilienceError(
    "model-missing",
    `Kein Ollama-Modell verfuegbar (versucht: ${tried.join(", ")}). Modell installieren: \`ollama pull <modell>\`.`,
    lastError,
  );
}

// --- Stale-health cache ---------------------------------------------------------

export interface HealthStatus {
  healthy: boolean;
  checkedAt: number;
  /** True when served from cache without probing. */
  fromCache: boolean;
}

export interface HealthCacheOptions {
  baseUrl?: string;
  ttlMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Stale-health cache: probes GET {base}/api/tags at most once per ttlMs.
 * Repeated health checks within the TTL are served from cache (no probe
 * on every call). Probe failures yield healthy:false (never throw).
 */
export class OllamaHealthCache {
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private last: HealthStatus | null = null;

  constructor(options: HealthCacheOptions = {}) {
    const b = (options.baseUrl ?? "http://127.0.0.1:11434").trim() || "http://127.0.0.1:11434";
    this.baseUrl = b.replace(/\/+$/, "");
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_HEALTH_TTL_MS);
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 5000);
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async check(force = false): Promise<HealthStatus> {
    if (!force && this.last && Date.now() - this.last.checkedAt < this.ttlMs) {
      return { ...this.last, fromCache: true };
    }
    let healthy: boolean;
    try {
      const res = await requestWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET" }, this.timeoutMs, this.fetchFn);
      healthy = res.ok;
    } catch {
      healthy = false;
    }
    this.last = { healthy, checkedAt: Date.now(), fromCache: false };
    return { ...this.last };
  }

  /** Forces the next check() to probe again. */
  invalidate(): void {
    this.last = null;
  }

  /** Last known status (null before the first probe). Does not probe. */
  peek(): HealthStatus | null {
    return this.last ? { ...this.last } : null;
  }
}
