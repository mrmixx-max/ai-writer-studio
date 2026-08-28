// Erreichbarkeitsprüfung für lokale und Cloud-KI-Anbieter.
//
// Grundsatz: Die App muss ohne jeden Anbieter startbar und nutzbar bleiben.
// Diese Prüfungen sind Diagnose, kein Gate. Sie liefern immer ein Ergebnis
// und werfen nie — ein nicht laufendes Ollama ist ein normaler Zustand,
// kein Fehler.

import type { AppSettings } from "@/types/config";

/** Ergebnis einer Anbieterprüfung. */
export interface ProviderProbe {
  /** Interner Schlüssel des Anbieters. */
  provider: "ollama" | "lmstudio" | "openai" | "openrouter" | "gpt2api" | "nous";
  /** Anzeigename für die UI. */
  label: string;
  /** true, wenn der Anbieter antwortet. */
  reachable: boolean;
  /** Gefundene Modelle, sofern abfragbar. */
  models: string[];
  /** Deutsche Klartextmeldung für die UI. */
  message: string;
  /** Antwortzeit in Millisekunden, sofern erreichbar. */
  latencyMs: number | null;
}

/** Timeout pro Prüfung. Kurz halten: der Assistent darf nicht hängen. */
const PROBE_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Prüft Ollama über /api/tags. */
export async function probeOllama(baseUrl = "http://localhost:11434"): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "ollama",
    label: "Ollama",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tags`);
    if (!res.ok) {
      return {
        ...base,
        message: `Ollama antwortet, meldet aber Status ${res.status}. Läuft dort ein anderer Dienst?`,
      };
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    const latencyMs = Math.round(performance.now() - started);

    if (models.length === 0) {
      return {
        ...base,
        reachable: true,
        latencyMs,
        message:
          "Ollama läuft, es ist aber kein Modell geladen. Lade eines, zum Beispiel mit „ollama pull llama3.2“.",
      };
    }
    return {
      ...base,
      reachable: true,
      models,
      latencyMs,
      message: `Ollama läuft. ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} verfügbar.`,
    };
  } catch {
    return {
      ...base,
      message:
        `Ollama ist unter ${baseUrl} nicht erreichbar. Starte es mit „ollama serve“. ` +
        "Die App funktioniert auch ohne — nur die KI-Funktionen ruhen dann.",
    };
  }
}

/** Prüft LM Studio über den OpenAI-kompatiblen /v1/models-Endpunkt. */
export async function probeLmStudio(baseUrl = "http://localhost:1234"): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "lmstudio",
    label: "LM Studio",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  try {
    const res = await fetchWithTimeout(`${baseUrl}/v1/models`);
    if (!res.ok) {
      return {
        ...base,
        message: `LM Studio antwortet mit Status ${res.status}. Ist der lokale Server aktiviert?`,
      };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id);
    const latencyMs = Math.round(performance.now() - started);

    if (models.length === 0) {
      return {
        ...base,
        reachable: true,
        latencyMs,
        message: "LM Studio läuft, hat aber kein Modell geladen. Lade eines in der LM-Studio-Oberfläche.",
      };
    }
    return {
      ...base,
      reachable: true,
      models,
      latencyMs,
      message: `LM Studio läuft. ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} verfügbar.`,
    };
  } catch {
    return {
      ...base,
      message:
        `LM Studio ist unter ${baseUrl} nicht erreichbar. Öffne LM Studio, lade ein Modell ` +
        "und aktiviere den lokalen Server.",
    };
  }
}

/**
 * Prüft einen OpenAI-Schlüssel.
 * Bewusst nur auf ausdrückliche Anforderung aufrufen: Die Prüfung überträgt
 * den Schlüssel an einen externen Dienst.
 */
export async function probeOpenAi(apiKey: string): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "openai",
    label: "OpenAI",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  if (!apiKey.trim()) {
    return { ...base, message: "Kein API-Schlüssel eingetragen." };
  }

  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      return { ...base, message: "Der API-Schlüssel wurde abgelehnt. Bitte prüfen." };
    }
    if (!res.ok) {
      return { ...base, message: `OpenAI meldet Status ${res.status}.` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => id.startsWith("gpt-"))
      .sort();
    return {
      ...base,
      reachable: true,
      models,
      latencyMs: Math.round(performance.now() - started),
      message: `Schlüssel gültig. ${models.length} GPT-Modelle verfügbar.`,
    };
  } catch {
    return {
      ...base,
      message: "OpenAI ist nicht erreichbar. Besteht eine Internetverbindung?",
    };
  }
}

/**
 * Prüft den lokalen gpt2api-Gateway (OpenAI-kompatible ChatGPT-Web-API).
 * Akzeptiert Base-URLs mit und ohne /v1-Suffix — es wird nacheinander
 * {base}/models und {base}/v1/models versucht.
 */
export async function probeGpt2api(baseUrl = "http://localhost:8080/v1"): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "gpt2api",
    label: "GPT2API",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  const trimmed = baseUrl.replace(/\/+$/, "");
  const candidates = [`${trimmed}/models`];
  if (!/\/v1$/.test(trimmed)) candidates.push(`${trimmed}/v1/models`);

  try {
    let res: Response | null = null;
    for (const url of candidates) {
      try {
        const attempt = await fetchWithTimeout(url);
        if (attempt.ok) {
          res = attempt;
          break;
        }
        // Merken für Statusmeldung, falls keiner der Endpunkte klappt.
        res ??= attempt;
      } catch {
        // Nächsten Endpunkt versuchen.
      }
    }
    if (!res) {
      return {
        ...base,
        message:
          `gpt2api ist unter ${baseUrl} nicht erreichbar. Läuft nicht? Starte den ` +
          "gpt2api-Gateway unter http://localhost:8080 (Docker oder Binary). " +
          "Die App funktioniert auch ohne — nur die KI-Funktionen ruhen dann.",
      };
    }
    if (!res.ok) {
      return {
        ...base,
        message: `gpt2api antwortet, meldet aber Status ${res.status}. Läuft dort ein anderer Dienst?`,
      };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id);
    const latencyMs = Math.round(performance.now() - started);

    if (models.length === 0) {
      return {
        ...base,
        reachable: true,
        latencyMs,
        message: "gpt2api läuft, meldet aber keine Modelle. Prüfe die Gateway-Konfiguration.",
      };
    }
    return {
      ...base,
      reachable: true,
      models,
      latencyMs,
      message: `gpt2api läuft. ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} verfügbar.`,
    };
  } catch {
    return {
      ...base,
      message:
        `gpt2api ist unter ${baseUrl} nicht erreichbar. Läuft nicht? Starte den ` +
        "gpt2api-Gateway unter http://localhost:8080. Die App funktioniert auch ohne — " +
        "nur die KI-Funktionen ruhen dann.",
    };
  }
}

/**
 * Prüft den Nous Research API-Schlüssel über GET /v1/models (Bearer-Key).
 * Bewusst nur auf ausdrückliche Anforderung aufrufen: Die Prüfung überträgt
 * den Schlüssel an einen externen Dienst.
 */
export async function probeNous(apiKey: string, baseUrl = "https://inference-api.nousresearch.com/v1"): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "nous",
    label: "Nous Research",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  if (!apiKey.trim()) {
    return { ...base, message: "Kein API-Schlüssel eingetragen." };
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { ...base, message: "Der API-Schlüssel wurde abgelehnt. Bitte prüfen." };
    }
    if (!res.ok) {
      return { ...base, message: `Nous Research meldet Status ${res.status}.` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id).sort();
    const latencyMs = Math.round(performance.now() - started);
    if (models.length === 0) {
      return { ...base, reachable: true, latencyMs, message: "Schlüssel gültig, aber keine Modelle verfügbar." };
    }
    return {
      ...base,
      reachable: true,
      models,
      latencyMs,
      message: `Schlüssel gültig. ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} verfügbar.`,
    };
  } catch {
    return {
      ...base,
      message: "Nous Research ist nicht erreichbar. Besteht eine Internetverbindung?",
    };
  }
}

/**
 * Prüft beide lokalen Anbieter gleichzeitig.
 * OpenAI bleibt außen vor — dafür braucht es einen Schlüssel und eine
 * ausdrückliche Nutzerentscheidung.
 */
export async function probeLocalProviders(settings?: Partial<AppSettings>): Promise<ProviderProbe[]> {
  return Promise.all([
    probeOllama(settings?.ollamaBaseUrl || undefined),
    probeLmStudio(settings?.lmstudioBaseUrl || undefined),
    probeGpt2api(settings?.gpt2apiBaseUrl || undefined),
  ]);
}

/**
 * Lädt die öffentliche OpenRouter-Modellliste (kein API-Schlüssel nötig).
 * Die Liste ist groß — sie wird auf free- und verbreitete Modelle
 * gekürzt und alphabetisch sortiert.
 */
export async function probeOpenRouter(): Promise<ProviderProbe> {
  const started = performance.now();
  const base: ProviderProbe = {
    provider: "openrouter",
    label: "OpenRouter",
    reachable: false,
    models: [],
    message: "",
    latencyMs: null,
  };

  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/models");
    if (!res.ok) {
      return { ...base, message: `OpenRouter meldet Status ${res.status}.` };
    }
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const all = (data.data ?? []).map((m) => m.id);
    // Kürzen: Free-Modelle zuerst, dann verbreitete Familien — sonst
    // hätte das Auswahl-Menü mehrere hundert Einträge.
    const free = all.filter((id) => id.endsWith(":free"));
    const curated = all.filter(
      (id) =>
        !id.endsWith(":free") &&
        /^(openai|anthropic|google|meta-llama|mistralai|deepseek|z-ai|qwen)\//.test(id),
    );
    const models = [...free, ...curated].sort();
    return {
      ...base,
      reachable: true,
      models,
      latencyMs: Math.round(performance.now() - started),
      message: `OpenRouter erreichbar. ${models.length} Modelle angezeigt (${all.length} insgesamt).`,
    };
  } catch {
    return {
      ...base,
      message: "OpenRouter ist nicht erreichbar. Besteht eine Internetverbindung?",
    };
  }
}
