// ModelRegistry: erkennt jederzeit verfügbar Modelle über ALLE konfigurierten
// Anbieter (parallel, mit Cache). Grundlage für die Modell-Auswahl im KI-Panel
// und im Einstellungs-Panel.
//
// Grundsatz (wie probe.ts): Diagnose, kein Gate. Eine Prüfung wirft nie —
// ein nicht erreichbarer Anbieter ist ein normaler Zustand und liefert ein
// Ergebnis mit reachable: false und deutscher Klartextmeldung.

import type { AppSettings } from "@/types/config";
import type { ProviderId } from "@/types/llm";
import { createProvider } from "./index";
import { isCloudProvider, isPrivacyMode } from "@/services/security/privacy";

/** Ergebnis der Modellerkennung für genau einen Anbieter. */
export interface DiscoveredModels {
  /** Interner Schlüssel des Anbieters. */
  provider: ProviderId;
  /** Anzeigename für die UI. */
  label: string;
  /** Verfügbare Modell-IDs (sortiert). */
  models: string[];
  /** true, wenn der Anbieter antwortet und Modelle liefert. */
  reachable: boolean;
  /** Antwortzeit in Millisekunden, sofern erreichbar. */
  latencyMs: number | null;
  /** Deutsche Klartextmeldung (Diagnose), optional. */
  message?: string;
}

/** Reihenfolge und Anzeigenamen der geprüften Anbieter. */
export const REGISTRY_PROVIDERS: ProviderId[] = [
  "ollama",
  "lmstudio",
  "openai",
  "openrouter",
  "gpt2api",
  "nous",
];

const LABELS: Record<ProviderId, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gpt2api: "gpt2api",
  nous: "Nous Research",
};

/** Anzeigename für einen Provider-Schlüssel. */
export function labelFor(provider: ProviderId): string {
  return LABELS[provider] ?? provider;
}

/** Timeout pro Anbieterprüfung. Kurz halten: die UI darf nicht hängen. */
const PROBE_TIMEOUT_MS = 2500;

/** Cache-Gültigkeit in Millisekunden. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  key: string;
  at: number;
  results: DiscoveredModels[];
}

let cache: CacheEntry | null = null;
let inflight: { key: string; promise: Promise<DiscoveredModels[]> } | null = null;

/** Cache-Schlüssel: nur die felder, die die Erreichbarkeit beeinflussen. */
function cacheKey(settings: AppSettings): string {
  return JSON.stringify({
    o: settings.ollamaBaseUrl,
    l: settings.lmstudioBaseUrl,
    oa: settings.openaiApiKey ? "1" : "",
    or: settings.openrouterApiKey ? "1" : "",
    g: settings.gpt2apiBaseUrl,
    ga: settings.gpt2apiApiKey ? "1" : "",
    n: settings.nousBaseUrl,
    na: settings.nousApiKey ? "1" : "",
    p: settings.privacyMode,
  });
}

/** Leert den Erkennungs-Cache (z. B. für den "Aktualisieren"-Button). */
export function clearModelCache(): void {
  cache = null;
  inflight = null;
}

/** Bricht ein Promise nach ms ab; respektiert ein äußeres AbortSignal. */
function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/** Prüft genau einen Anbieter: listModels mit Timeout + deutsche Meldung. */
async function probeProvider(
  provider: ProviderId,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<DiscoveredModels> {
  const started = performance.now();
  const base: DiscoveredModels = {
    provider,
    label: LABELS[provider],
    models: [],
    reachable: false,
    latencyMs: null,
  };

  // Privatsphaeren-Modus: Cloud-Anbieter gar nicht erst anfragen.
  if (isPrivacyMode() && isCloudProvider(provider)) {
    return {
      ...base,
      message: "Privatsphären-Modus aktiv — Cloud-Anbieter werden nicht abgefragt.",
    };
  }
  // Ohne Schlüssel macht ein Cloud-Check keinen Sinn.
  if (provider === "openai" && !settings.openaiApiKey?.trim()) {
    return { ...base, message: "Kein API-Schlüssel eingetragen." };
  }
  if (provider === "nous" && !settings.nousApiKey?.trim()) {
    return { ...base, message: "Kein API-Schlüssel eingetragen." };
  }

  try {
    const instance = createProvider({ ...settings, provider });
    const models = await withTimeout(instance.listModels(), PROBE_TIMEOUT_MS, signal);
    if (signal?.aborted) return { ...base, message: "Abgebrochen." };
    if (models.length === 0) {
      return {
        ...base,
        reachable: true,
        latencyMs: Math.round(performance.now() - started),
        message: `${LABELS[provider]} antwortet, meldet aber keine Modelle.`,
      };
    }
    return {
      ...base,
      reachable: true,
      models: [...models].sort((a, b) => a.localeCompare(b)),
      latencyMs: Math.round(performance.now() - started),
      message: `${LABELS[provider]} erreichbar. ${models.length} Modelle verfügbar.`,
    };
  } catch (e) {
    if (signal?.aborted || (e as Error).message === "aborted") {
      return { ...base, message: "Abgebrochen." };
    }
    if ((e as Error).message === "timeout") {
      return {
        ...base,
        message: `${LABELS[provider]} antwortet nicht (Timeout nach ${PROBE_TIMEOUT_MS / 1000} s).`,
      };
    }
    return {
      ...base,
      message:
        `${LABELS[provider]} ist nicht erreichbar` +
        ((e as Error).message ? `: ${(e as Error).message}` : "."),
    };
  }
}

/**
 * Erkennt Modelle aller konfigurierten Anbieter parallel.
 * Ergebnisse werden 60 s gecacht; `force` umgeht den Cache.
 * Wirft nie — jeder Anbieter liefert mindestens ein unreachable-Ergebnis.
 */
export async function discoverModels(
  settings: AppSettings,
  options?: { signal?: AbortSignal; force?: boolean },
): Promise<DiscoveredModels[]> {
  const signal = options?.signal;
  const key = cacheKey(settings);

  if (!options?.force && cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.results;
  }
  if (!options?.force && inflight && inflight.key === key) {
    return inflight.promise;
  }

  const promise = Promise.all(
    REGISTRY_PROVIDERS.map((p) => probeProvider(p, settings, signal)),
  );

  if (!options?.force) {
    inflight = { key, promise };
  }

  let results: DiscoveredModels[];
  try {
    results = await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }

  cache = { key, at: Date.now(), results };
  return results;
}
