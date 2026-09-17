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
  opencode: "OpenCode",
};

/** Anzeigename für einen Provider-Schlüssel. */
export function labelFor(provider: ProviderId): string {
  return LABELS[provider] ?? provider;
}

/** Timeout pro Anbieterprüfung. Kurz halten: die UI darf nicht hängen. */
const PROBE_TIMEOUT_MS = 2500;

/**
 * Großzügigeres Limit für lokale Provider (Ollama/LM Studio): Unter Last
 * (Build, Inferenz, Modell-Ladung) antwortet 127.0.0.1 schon mal erst nach
 * 3–4 s — kein Grund, die Karte rot zu zeigen, wenn der Server lebt.
 */
const LOCAL_PROBE_TIMEOUT_MS = 8000;

function isLocalProvider(provider: ProviderId): boolean {
  return provider === "ollama" || provider === "lmstudio";
}

/** Cache-Gültigkeit in Millisekunden (Standard). */
const CACHE_TTL_MS = 60_000;

/**
 * Verkürzte TTL für lokale Anbieter, deren Modellbestand sich jederzeit
 * ändern kann ("ollama pull" / Modell in LM Studio laden): 10 s.
 */
const LOCAL_TTL_MS = 10_000;

/** TTL pro Anbieter: ollama lebt im Sekundentakt, Cloud-Provider seltener. */
const TTL_BY_PROVIDER: Partial<Record<ProviderId, number>> = {
  ollama: LOCAL_TTL_MS,
};

function ttlFor(provider: ProviderId): number {
  return TTL_BY_PROVIDER[provider] ?? CACHE_TTL_MS;
}

interface CacheEntry {
  key: string;
  at: number;
  result: DiscoveredModels;
}

/** Cache pro Anbieter (nicht global), damit ollama kürzer lebt als der Rest. */
const cache = new Map<ProviderId, CacheEntry>();

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
  cache.clear();
  inflight = null;
  deadHosts.clear();
}

/**
 * Tote Hosts (Audit L1): Wer einmal nicht antwortet, wird 5 Minuten lang
 * nicht erneut angefragt — sonst spammen optionale lokale Server (LM Studio,
 * gpt2api), die gar nicht installiert sind, bei jedem Panel-Wechsel die
 * Browser-Konsole mit ERR_CONNECTION_REFUSED voll. Schlüssel = Anbieter +
 * Basis-URL (URL-Wechsel hebt die Sperre sofort auf).
 */
const DEAD_HOST_TTL_MS = 5 * 60_000;
const deadHosts = new Map<string, number>();

/** Basis-URL je Anbieter (Cloud → "" — dort zählt nur der Anbieter). */
function baseFor(provider: ProviderId, settings: AppSettings): string {
  switch (provider) {
    case "ollama":
      return settings.ollamaBaseUrl || "";
    case "lmstudio":
      return settings.lmstudioBaseUrl || "";
    case "gpt2api":
      return settings.gpt2apiBaseUrl || "";
    case "opencode":
      return settings.opencodeBaseUrl || "";
    case "nous":
      return settings.nousBaseUrl || "";
    default:
      return "";
  }
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

  // Toter Host (Audit L1): kürzlich gescheitert → kein erneuter Fetch
  // (kein Console-Spam), nur das gemerkte unreachable-Ergebnis.
  const deadKey = `${provider}@${baseFor(provider, settings)}`;
  const deadAt = deadHosts.get(deadKey);
  if (deadAt !== undefined && Date.now() - deadAt < DEAD_HOST_TTL_MS) {
    return { ...base, message: `${LABELS[provider]} zuletzt nicht erreichbar — wird später erneut geprüft.` };
  }

  try {
    const instance = createProvider({ ...settings, provider });
    const timeoutMs = isLocalProvider(provider) ? LOCAL_PROBE_TIMEOUT_MS : PROBE_TIMEOUT_MS;
    const models = await withTimeout(instance.listModels(), timeoutMs, signal);
    if (signal?.aborted) return { ...base, message: "Abgebrochen." };
    // Geantwortet → Host lebt (Tot-Eintrag löschen, auch bei leerer Liste).
    deadHosts.delete(deadKey);
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
    // Gescheitert (Timeout oder Fehler) → Host für 5 Min merken, damit
    // Folge-Prüfungen keinen erneuten Fetch (Console-Spam) auslösen.
    deadHosts.set(deadKey, Date.now());
    if ((e as Error).message === "timeout") {
      const secs = (isLocalProvider(provider) ? LOCAL_PROBE_TIMEOUT_MS : PROBE_TIMEOUT_MS) / 1000;
      return {
        ...base,
        message: `${LABELS[provider]} antwortet nicht (Timeout nach ${secs} s).`,
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
  const now = Date.now();

  // Pro Anbieter entscheiden: frisch aus dem Cache, dedupliziert in flight
  // oder neu ermitteln. ollama läuft mit 10-s-TTL, alle anderen mit 60 s.
  const stale = REGISTRY_PROVIDERS.filter((p) => {
    if (options?.force) return true;
    const entry = cache.get(p);
    return !entry || entry.key !== key || now - entry.at >= ttlFor(p);
  });

  if (stale.length === 0) {
    return REGISTRY_PROVIDERS.map((p) => cache.get(p)!.result);
  }

  // Deduplizierung: Falls bereits eine identische Ermittlung läuft, an diese
  // andocken — aber nur für die Anbieter, die darin enthalten sind.
  if (!options?.force && inflight && inflight.key === key) {
    return inflight.promise;
  }

  const promise = Promise.all(
    REGISTRY_PROVIDERS.map(async (p) => {
      if (!stale.includes(p)) return cache.get(p)!.result;
      return probeProvider(p, settings, signal);
    }),
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

  results.forEach((result, i) => {
    if (!stale.includes(REGISTRY_PROVIDERS[i])) return;
    if (signal?.aborted) return;
    cache.set(REGISTRY_PROVIDERS[i], { key, at: now, result });
  });
  return results;
}
