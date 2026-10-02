/**
 * Hermes Engine Turbo & VRAM-Profiler (WP 25.2)
 *
 * Lokaler, deterministischer Service für:
 * - optimale Kontextfenster-Wahl anhand des verfügbaren Grafikspeichers
 * - synthetischer (deterministischer) Tokens-pro-Sekunde-Benchmark
 * - Prompt-Bereinigung (redundante Whitespaces) vor dem Modell-Aufruf
 * - nahtloser Umschaltung von GPU- auf CPU-Thread-Modus (Offline-Fallback)
 *
 * KEINE LLM-Aufrufe, KEIN Netzwerk, KEINE Wanduhr-Zeitabhängigkeit.
 * Alle Ergebnisse sind bei gleicher Eingabe identisch. Defensive Fallbacks überall.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface ContextConfig {
  contextWindow: number;
  kvCacheSize: number;
  batchSize: number;
}

export interface ModelConfig {
  name: string;
  size: number;
  vramRequirement: number;
}

export interface BenchmarkResult {
  tokensPerSecond: number;
  totalTokens: number;
  durationMs: number;
}

export interface FallbackConfig {
  mode: 'gpu' | 'cpu';
  threads: number;
  batchSize: number;
  reason: string;
}

// ─── Konstanten ─────────────────────────────────────────────────────────────

/** 1 GB in MB (binär, wie von GPU-Treibern/Profiler-Tools üblich). */
const GB_TO_MB = 1024;

/** Kontextfenster-Stufen. */
const CONTEXT_4K = 4096;
const CONTEXT_8K = 8192;
const CONTEXT_16K = 16384;

/** VRAM-Schwellenwerte in MB (< 4 GB → 4K, 4–8 GB → 8K, > 8 GB → 16K). */
const THRESHOLD_4GB_MB = 4096;
const THRESHOLD_8GB_MB = 8192;

/** KV-Cache belegt ~1/8 des Kontextfensters (Faustformel für 4-bit/8-bit KV). */
const KV_CACHE_DIVISOR = 8;

/** Batch-Größe je VRAM-Stufe (vor Modell-Druck-Anpassung). */
const BATCH_BY_TIER = { small: 1, medium: 2, large: 4 } as const;

/** Obergrenze für CPU-Threads (deterministische Hardware-Annahme). */
const MAX_CPU_THREADS = 8;

/** Annahme, wenn die Kernzahl nicht ermittelt werden kann. */
const DEFAULT_CPU_CORES = 4;

/** Basis-Durchsatz für ein 1-GB-Modell (deterministisch, nicht gemessen). */
const BENCHMARK_BASE_TPS = 40;

/** Zusätzliche Verlangsamung pro GB Modellgröße. */
const BENCHMARK_SIZE_PENALTY = 0.5;

/** Untergrenze, damit keine Division durch 0 entsteht. */
const MIN_TOKENS_PER_SECOND = 0.01;

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Akzeptiert nur endliche, nicht-negative Zahlen; sonst Fallback. */
function sanitizeNonNegative(value: unknown, fallback: number): number {
  const num = sanitizeNumber(value, fallback);
  return num >= 0 ? num : fallback;
}

function roundTo(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/** Normalisiert eine (evtl. unvollständige) ModelConfig defensiv. */
function sanitizeModelConfig(config: ModelConfig | null | undefined): ModelConfig {
  if (!config || typeof config !== 'object') {
    return { name: 'fallback', size: 1, vramRequirement: 1 };
  }
  return {
    name: sanitizeString(config.name, 'unbenannt') || 'unbenannt',
    size: sanitizeNonNegative(config.size, 1),
    vramRequirement: sanitizeNonNegative(config.vramRequirement, 1),
  };
}

/**
 * Deterministische Token-Heuristik: zählt Wort- und Interpunktions-Tokens.
 * Kein echtes BPE — nur stabil, reproduzierbar und ausreichend für den Profiler.
 */
function countTokens(text: string): number {
  const safe = sanitizeString(text, '');
  if (safe.trim().length === 0) return 0;
  const matches = safe.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

/** Ermittelt die verfügbaren CPU-Kerne (Browser/Node), defensiv. */
function detectAvailableCores(): number {
  try {
    const nav = (globalThis as { navigator?: { hardwareConcurrency?: unknown } }).navigator;
    const cores = nav && typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : NaN;
    if (Number.isFinite(cores) && cores >= 1) return Math.floor(cores);
  } catch {
    // Zugriff verweigert/kein navigator → Default.
  }
  return DEFAULT_CPU_CORES;
}

// ─── Öffentliche API ────────────────────────────────────────────────────────

/**
 * Berechnet die optimale Kontextkonfiguration anhand des verfügbaren VRAM.
 *
 * Schwellen (auf `vramMB`):
 *   < 4 GB → 4K, 4–8 GB → 8K, > 8 GB → 16K.
 *
 * `modelSize` (in GB) fließt zusätzlich ein: Übersteigt die Modellgröße den
 * verfügbaren VRAM, wird die Batch-Größe auf 1 gesenkt, damit das Modell noch
 * vollständig in den Speicher passt. Defensiv: ungültige Werte → kleinste Stufe.
 */
export function calculateOptimalContext(vramMB: number, modelSize: number): ContextConfig {
  const safeVram = sanitizeNonNegative(vramMB, 0);
  const safeModelSize = sanitizeNonNegative(modelSize, 0);

  let contextWindow: number;
  let baseBatch: number;
  if (safeVram < THRESHOLD_4GB_MB) {
    contextWindow = CONTEXT_4K;
    baseBatch = BATCH_BY_TIER.small;
  } else if (safeVram <= THRESHOLD_8GB_MB) {
    contextWindow = CONTEXT_8K;
    baseBatch = BATCH_BY_TIER.medium;
  } else {
    contextWindow = CONTEXT_16K;
    baseBatch = BATCH_BY_TIER.large;
  }

  const kvCacheSize = Math.max(1, Math.floor(contextWindow / KV_CACHE_DIVISOR));

  // Modell-Druck: Modellgröße (GB) relativ zum VRAM (GB). > 1 ⇒ Modell
  // größer als der Speicher ⇒ kein Batching möglich.
  const vramGB = Math.max(1, safeVram / GB_TO_MB);
  const modelPressure = safeModelSize / vramGB;
  const batchSize = modelPressure > 1 ? 1 : baseBatch;

  return { contextWindow, kvCacheSize, batchSize };
}

/**
 * Deterministischer Tokens-pro-Sekunde-Benchmark (kein echtes Modell).
 *
 * Der Durchsatz wird aus der Modellgröße abgeleitet: größere Modelle sind
 * langsamer. `durationMs` ergibt sich aus Tokenzahl und Durchsatz — dadurch
 * ist das Ergebnis bei gleicher Eingabe reproduzierbar.
 */
export function benchmarkTokensPerSecond(
  prompt: string,
  modelConfig: ModelConfig,
): BenchmarkResult {
  const totalTokens = countTokens(prompt);
  if (totalTokens === 0) {
    return { tokensPerSecond: 0, totalTokens: 0, durationMs: 0 };
  }

  const model = sanitizeModelConfig(modelConfig);
  const sizePenalty = model.size * BENCHMARK_SIZE_PENALTY;
  const vramPenalty = model.vramRequirement / 8;
  const rawTps = BENCHMARK_BASE_TPS / (1 + sizePenalty + vramPenalty);
  const tokensPerSecond = Math.max(MIN_TOKENS_PER_SECOND, roundTo(rawTps, 2));
  const durationMs = Math.round((totalTokens / tokensPerSecond) * 1000);

  return { tokensPerSecond, totalTokens, durationMs };
}

/**
 * Entfernt redundante Whitespaces vor dem Modell-Aufruf.
 *
 * - kollabiert mehrfache Leerzeichen/Tabs zu einem Leerzeichen
 * - normalisiert CRLF → LF und trimmt Whitespace um Zeilenumbrüche
 * - fasst 3+ Leerzeilen zu einer Leerzeile zusammen
 * - trimmt den Gesamtstring; Nicht-Strings → ''.
 */
export function optimizePrompt(prompt: string): string {
  if (typeof prompt !== 'string') return '';
  return prompt
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Schaltet nahtlos vom GPU- auf den CPU-Thread-Modus um.
 *
 * Bei ausreichend VRAM (≥ 4 GB) bleibt der GPU-Modus aktiv. Sonst greift der
 * CPU-Fallback: Threads = min(8, verfügbare Kerne), batchSize = 1.
 * Defensiv: ungültiger/negativer VRAM wird wie 0 behandelt (→ CPU).
 */
export function getOfflineFallback(vramMB: number): FallbackConfig {
  const safeVram = sanitizeNonNegative(vramMB, 0);

  if (safeVram >= THRESHOLD_4GB_MB) {
    return {
      mode: 'gpu',
      threads: 1,
      batchSize: BATCH_BY_TIER.large,
      reason: `Ausreichend VRAM (${safeVram} MB) – GPU-Modus aktiv.`,
    };
  }

  const threads = Math.max(1, Math.min(MAX_CPU_THREADS, detectAvailableCores()));
  return {
    mode: 'cpu',
    threads,
    batchSize: BATCH_BY_TIER.small,
    reason: `Nur ${safeVram} MB VRAM – CPU-Fallback mit ${threads} Threads.`,
  };
}
