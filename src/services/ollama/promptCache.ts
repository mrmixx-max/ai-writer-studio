// Prompt-Cache (Sprint 7, Agent 2 — Teilaufgabe 2).
//
// Problem: Identische Prompts (wiederholte Outline-Generierung, Retry nach
// UI-Refresh, identische Zusammenfassungen) verursachen redundante
// Ollama-Calls — volle Inferenz-Kosten (Zeit, Strom, KV-Cache) für dasselbe
// Ergebnis.
//
// Lösung: LRU-Cache über den Prompt-Hash (Modell + Messages + Optionen),
// mit TTL: Einträge verfallen nach ttlMs (Default 10 min) — das Modell-
// Verhalten ändert sich (Modell-Update, Settings), also keine ewigen Caches.
//
// Grundsätze:
// - Cache-Treffer sind ein bewusster Opt-in pro Call (cache: true bzw.
//   via getOrCompute) — bestehende Call-Pfade bleiben unangetastet.
// - Temperatur > 0: nur cachen, wenn der Aufrufer es ausdrücklich will
//   (deterministische Aufgaben wie Outline-Re-Render); getOrCompute
//   entscheidet der Aufrufer, die Cache-Prüfung selbst ist temperatur-
//   blind (der Cache-Key enthält die Temperatur).
// - Kein Breaking Change: neues Modul, keine bestehenden Signaturen.

/** Einträge des Prompt-Caches. */
export interface PromptCacheEntry {
  /** Vollständige Antwort (alle Stream-Chunks konkateniert). */
  text: string;
  /** Ablauf-Zeitstempel (epoch ms). */
  expiresAt: number;
  /** Wann der Eintrag geschrieben wurde (epoch ms). */
  createdAt: number;
  /** Anzahl Cache-Treffer seit Erzeugung. */
  hits: number;
}

/** Optionen des Prompt-Caches. */
export interface PromptCacheOptions {
  /** Maximale Anzahl Einträge (LRU-Eviction, Default 200). */
  maxSize?: number;
  /** TTL in ms (Default 10 min). */
  ttlMs?: number;
}

/** Statistik (für Diagnose/Telemetrie). */
export interface PromptCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  expired: number;
  hitRate: number;
}

const DEFAULT_MAX_SIZE = 200;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Deterministischer String-Hash (FNV-1a 32 bit, hex) — keine Crypto-Abhängigkeit. */
export function hashPrompt(parts: unknown[]): string {
  const json = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Cache-Key: Modell + Messages + temperature/maxTokens (nicht timeoutMs — irrelevant fürs Ergebnis). */
export function promptCacheKey(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): string {
  return hashPrompt([
    model,
    messages,
    options?.temperature ?? null,
    options?.maxTokens ?? null,
  ]);
}

export class PromptCache {
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, PromptCacheEntry>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expired = 0;

  constructor(options: PromptCacheOptions = {}) {
    this.maxSize = Math.max(1, Math.floor(options.maxSize ?? DEFAULT_MAX_SIZE));
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_TTL_MS);
  }

  /** Treffer nur bei unverfallenem Eintrag ( expired → zählt als Miss). */
  get(key: string): PromptCacheEntry | null {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (this.isExpired(entry)) {
      this.map.delete(key);
      this.expired += 1;
      this.misses += 1;
      return null;
    }
    entry.hits += 1;
    this.hits += 1;
    // LRU-Touch: Eintrag nach hinten (jüngste Nutzung).
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  /**
   * Fügt/aktualisiert einen Eintrag. Bei vollem Cache wird der älteste
   * Eintrag verdrängt (LRU). size===0 (maxSize<1 geclampt auf 1) deaktiviert
   * den Cache nicht — für einen echten Disable einfach den Cache nicht nutzen.
   */
  set(key: string, text: string): PromptCacheEntry {
    if (this.map.has(key)) this.map.delete(key);
    while (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
      this.evictions += 1;
    }
    const entry: PromptCacheEntry = {
      text,
      expiresAt: Date.now() + this.ttlMs,
      createdAt: Date.now(),
      hits: 0,
    };
    this.map.set(key, entry);
    return entry;
  }

  /** Prüft auf Vorhandensein OHNE Statistik zu verändern. */
  peek(key: string): PromptCacheEntry | null {
    const entry = this.map.get(key);
    if (!entry || this.isExpired(entry)) return null;
    return entry;
  }

  /** Manuell invalidieren (z. B. nach Modell-Wechsel). */
  delete(key: string): boolean {
    return this.map.delete(key);
  }

  /** Gesamten Cache leeren (Modell-Update, Settings-Änderung). */
  clear(): void {
    this.map.clear();
  }

  /** Entfernt verfallene Einträge (regelmäßiger Housekeeping-Aufruf optional). */
  purgeExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (this.isExpired(entry)) {
        this.map.delete(key);
        this.expired += 1;
        removed += 1;
      }
    }
    return removed;
  }

  getStats(): PromptCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expired: this.expired,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private isExpired(entry: PromptCacheEntry): boolean {
    return this.ttlMs === 0 ? false : entry.expiresAt <= Date.now();
  }
}

/**
 * Get-or-compute: prüft den Cache, führt sonst fn() aus und legt das
 * Ergebnis mit TTL ab. Standard-Einstiegspunkt für Cache-Nutzer.
 */
export async function getOrCompute<T>(
  cache: PromptCache,
  key: string,
  fn: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const hit = cache.get(key);
  if (hit) {
    return { value: hit.text as unknown as T, fromCache: true };
  }
  const value = await fn();
  if (typeof value === "string") {
    cache.set(key, value);
  }
  return { value, fromCache: false };
}

// --- Default-Singleton ---------------------------------------------------------

let defaultCache: PromptCache | null = null;

/** Default-Cache (Singleton) — für Call-Sites ohne eigenen Cache. */
export function getPromptCache(): PromptCache {
  if (!defaultCache) defaultCache = new PromptCache();
  return defaultCache;
}

/** Default-Cache verwerfen (Tests/Rekonfiguration). */
export function resetPromptCache(): void {
  defaultCache = null;
}
