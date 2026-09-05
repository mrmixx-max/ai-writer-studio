// Ollama-Connection-Pool (Sprint 7, Agent 2 — Teilaufgabe 1).
//
// Problem: Parallele Ollama-Requests (z. B. parallele Chunk-Generierung,
// Router + Embedding gleichzeitig) erzeugen ungebremst viele gleichzeitige
// HTTP-Verbindungen. Ollama verarbeitet sie, aber Queueing im Server führt
// zu unkontrollierbarer Latenz und Speicherdruck (je Request ein voller
// KV-Cache im Modell-Runner).
//
// Lösung: Client-seitige Begrenzung mit FIFO-Queue. maxConcurrent = Anzahl
// gleichzeitig fliegender Requests, alles Weitere wartet gereiht. Der Slot
// wird für die GESAMTE Stream-Dauer gehalten (acquire/release-Vertrag),
// nicht nur bis zum HTTP-Response-Header — sonst würden parallele Streams
// die Grenze unterlaufen.
//
// Grundsätze:
// - Kein Breaking Change: der Pool ist additiv; acquire() gibt eine
//   release-Funktion zurück, run() kapselt den try/finally-Vertrag.
// - Queue-Timeout: wartende Requests fliegen nach queueTimeoutMs mit
//   sprechendem Fehler raus (kein hängender UI-Thread).
// - Pro baseUrl ein Pool (Singleton via getOllamaPool), Tests können
//   mit resetOllamaPools() aufräumen.

/** Optionen des Connection-Pools. Alle Felder optional. */
export interface ConnectionPoolOptions {
  /** Maximal gleichzeitig fliegende Requests (Default 4 = Ollama OLLAMA_NUM_PARALLEL-Default). */
  maxConcurrent?: number;
  /** Wie lange ein Request in der Queue warten darf, bevor er abweist (Default 60 s, 0 = unbegrenzt). */
  queueTimeoutMs?: number;
}

/** Laufzeit-Statistik des Pools (für Diagnose-Panel/Telemetrie). */
export interface PoolStats {
  maxConcurrent: number;
  /** Aktuell fliegende Requests (Slot belegt). */
  active: number;
  /** Aktuell in der Queue wartende Requests. */
  queued: number;
  /** Sauber abgeschlossene Requests (release aufgerufen). */
  completed: number;
  /** Abgewiesene Requests (Queue-Timeout). */
  rejected: number;
  /** Summierte Wartezeit in der Queue (ms). */
  totalWaitMs: number;
  /** Längste Einzel-Wartezeit in der Queue (ms). */
  maxWaitMs: number;
  /** Ø Wartezeit in der Queue über abgeschlossene Requests (ms). */
  avgWaitMs: number;
}

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
  enqueuedAt: number;
  label: string;
}

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_QUEUE_TIMEOUT_MS = 60_000;

export class OllamaConnectionPool {
  readonly maxConcurrent: number;
  readonly queueTimeoutMs: number;
  private active = 0;
  private readonly queue: Waiter[] = [];
  private completed = 0;
  private rejected = 0;
  private totalWaitMs = 0;
  private maxWaitMs = 0;

  constructor(options: ConnectionPoolOptions = {}) {
    this.maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT));
    this.queueTimeoutMs = Math.max(0, options.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS);
  }

  /** Aktuell in der Queue wartende Requests. */
  get queuedCount(): number {
    return this.queue.length;
  }

  /** Aktuell fliegende Requests. */
  get activeCount(): number {
    return this.active;
  }

  /**
   * Belegt einen Slot (oder reiht in die FIFO-Queue ein) und gibt die
   * release-Funktion zurück. Der Aufrufer MUSS release() genau einmal
   * aufrufen (auch im Fehlerfall) — der Slot gilt für die gesamte
   * Request-Dauer inkl. Stream-Verbrauch.
   */
  async acquire(label = "request"): Promise<() => void> {
    if (this.active < this.maxConcurrent) {
      return this.enter(0);
    }
    return new Promise<() => void>((resolve, reject) => {
      const enqueuedAt = Date.now();
      const timer =
        this.queueTimeoutMs > 0
          ? setTimeout(() => {
              const idx = this.queue.indexOf(waiter);
              if (idx >= 0) {
                this.queue.splice(idx, 1);
                this.rejected += 1;
                reject(
                  new Error(
                    `[OllamaConnectionPool] Queue-Timeout nach ${this.queueTimeoutMs} ms — Request "${label}" abgewiesen (${this.queuedCount} warten noch, ${this.maxConcurrent} aktiv).`,
                  ),
                );
              }
            }, this.queueTimeoutMs)
          : null;
      const waiter: Waiter = { resolve, reject, timer, enqueuedAt, label };
      this.queue.push(waiter);
    });
  }

  /**
   * Convenience: belegt einen Slot, führt fn aus und gibt den Slot in jedem
   * Fall frei (auch bei Fehler). Für Promise-basierte Arbeit; für Streams
   * acquire() verwenden, damit der Slot die ganze Stream-Dauer hält.
   */
  async run<T>(fn: () => Promise<T>, label = "request"): Promise<T> {
    const release = await this.acquire(label);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /** Statistik-Aufnahme (PoolStats). */
  getStats(): PoolStats {
    return {
      maxConcurrent: this.maxConcurrent,
      active: this.active,
      queued: this.queue.length,
      completed: this.completed,
      rejected: this.rejected,
      totalWaitMs: this.totalWaitMs,
      maxWaitMs: this.maxWaitMs,
      avgWaitMs: this.completed > 0 ? Math.round(this.totalWaitMs / this.completed) : 0,
    };
  }

  /** Intern: Slot sofort belegen (mit bereits gewarteter Zeit für die Statistik). */
  private enter(waitedMs: number): () => void {
    this.active += 1;
    this.totalWaitMs += waitedMs;
    this.maxWaitMs = Math.max(this.maxWaitMs, waitedMs);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.completed += 1;
      this.handOff();
    };
  }

  /** Intern: nächsten Wartenden in den freigewordenen Slot lassen. */
  private handOff(): void {
    const next = this.queue.shift();
    if (!next) return;
    if (next.timer) clearTimeout(next.timer);
    const waited = Date.now() - next.enqueuedAt;
    this.active += 1;
    next.resolve(this.makeRelease(waited));
  }

  /** Intern: release-Funktion für einen aus der Queue befohlenen Slot. */
  private makeRelease(waitedMs: number): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.completed += 1;
      this.totalWaitMs += waitedMs;
      this.maxWaitMs = Math.max(this.maxWaitMs, waitedMs);
      this.handOff();
    };
  }
}

// --- Pro-baseUrl Singletons ---------------------------------------------------

const pools = new Map<string, OllamaConnectionPool>();

/**
 * Pool pro Ollama-Instanz (baseUrl) — es gibt pro Server genau eine
 * Ressourcen-Grenze, also auch genau einen Pool.
 */
export function getOllamaPool(baseUrl?: string, options?: ConnectionPoolOptions): OllamaConnectionPool {
  const key = (baseUrl ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  let pool = pools.get(key);
  if (!pool) {
    pool = new OllamaConnectionPool(options);
    pools.set(key, pool);
  }
  return pool;
}

/** Alle Pools verwerfen (Tests / Rekonfiguration). */
export function resetOllamaPools(): void {
  pools.clear();
}
