// Embedding-Layer. Lokal-first: Ollama bevorzugt, OpenAI optional, Fallback lexikalisch.
//
// Zentrale Produktregel: Die App muss ohne laufendes Ollama startbar und nutzbar bleiben.
// Deshalb wirft dieses Modul NIE bei fehlendem Modell, sondern meldet Nichtverfügbarkeit
// über `EmbeddingProbe`. Der Aufrufer entscheidet dann über den lexikalischen Fallback.

import type { AppSettings } from "@/types/config";

/** Ergebnis einer Verfügbarkeitsprüfung. */
export interface EmbeddingProbe {
  available: boolean;
  model: string | null;
  dimensions: number | null;
  /** Klartext auf Deutsch für die UI. */
  notice: string | null;
}

/** Standard-Embedding-Modelle je Provider. */
const DEFAULT_OLLAMA_EMBED_MODEL = "nomic-embed-text";
const DEFAULT_OPENAI_EMBED_MODEL = "text-embedding-3-small";

/** Timeout für Embedding-Aufrufe, damit die UI nie hängt. */
const EMBED_TIMEOUT_MS = 20000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

/** Ermittelt das zu verwendende Embedding-Modell aus den Einstellungen. */
export function embeddingModelFor(settings: AppSettings): string {
  const custom = (settings as any).embeddingModel as string | undefined;
  if (custom && custom.trim()) return custom.trim();
  if (settings.provider === "openai") return DEFAULT_OPENAI_EMBED_MODEL;
  return DEFAULT_OLLAMA_EMBED_MODEL;
}

/**
 * Prüft, ob Embeddings verfügbar sind. Wirft nicht.
 * Wird vom Knowledge-Service vor jedem Indexlauf aufgerufen.
 */
export async function probeEmbeddings(settings: AppSettings): Promise<EmbeddingProbe> {
  const model = embeddingModelFor(settings);
  try {
    const vec = await embedOne("Testsatz zur Verfügbarkeitsprüfung.", settings);
    if (!vec || vec.length === 0) {
      return {
        available: false,
        model,
        dimensions: null,
        notice: `Embedding-Modell „${model}" antwortete ohne Vektor. Es wird die lexikalische Suche verwendet.`,
      };
    }
    return { available: true, model, dimensions: vec.length, notice: null };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    return {
      available: false,
      model,
      dimensions: null,
      notice: buildUnavailableNotice(settings, model, msg),
    };
  }
}

/** Formuliert eine verständliche deutsche Fehlermeldung für die UI. */
function buildUnavailableNotice(settings: AppSettings, model: string, raw: string): string {
  const isNetwork = /fetch|network|abort|ECONNREFUSED|Failed to fetch/i.test(raw);
  if (settings.provider === "ollama" && isNetwork) {
    return `Ollama ist nicht erreichbar (${settings.ollamaBaseUrl}). Die semantische Suche steht nicht zur Verfügung – es wird die lexikalische Suche verwendet. Starte Ollama mit „ollama serve" und lade das Modell mit „ollama pull ${model}".`;
  }
  if (/not found|no such model|model .* not found/i.test(raw)) {
    return `Das Embedding-Modell „${model}" ist nicht installiert. Lade es mit „ollama pull ${model}". Bis dahin wird die lexikalische Suche verwendet.`;
  }
  if (settings.provider === "openai" && /401|invalid.*key|unauthorized/i.test(raw)) {
    return `Der OpenAI-API-Schlüssel wurde nicht akzeptiert. Es wird die lexikalische Suche verwendet.`;
  }
  return `Embeddings nicht verfügbar (${raw}). Es wird die lexikalische Suche verwendet.`;
}

/** Erzeugt einen einzelnen Embedding-Vektor. Wirft bei Nichtverfügbarkeit. */
export async function embedOne(text: string, settings: AppSettings): Promise<number[]> {
  const model = embeddingModelFor(settings);
  if (settings.provider === "openai") {
    return embedOpenAI([text], model, settings.openaiApiKey ?? "", "https://api.openai.com/v1").then((r) => r[0]);
  }
  if (settings.provider === "openrouter") {
    // OpenRouter bietet kein einheitliches Embedding-Endpoint → bewusst nicht raten.
    throw new Error("OpenRouter unterstützt keine Embeddings. Nutze Ollama oder OpenAI.");
  }
  if (settings.provider === "lmstudio" || settings.provider === "gpt2api") {
    const base = settings.provider === "lmstudio" ? settings.lmstudioBaseUrl : settings.gpt2apiBaseUrl;
    const key = settings.provider === "gpt2api" ? (settings.gpt2apiApiKey ?? "") : "";
    return embedOpenAI([text], model, key, base).then((r) => r[0]);
  }
  return embedOllama([text], model, settings.ollamaBaseUrl).then((r) => r[0]);
}

/**
 * Erzeugt Embeddings für mehrere Texte.
 * Batching in Blöcken, damit lange Indexläufe die Verbindung nicht überfahren.
 */
export async function embedBatch(
  texts: string[],
  settings: AppSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const model = embeddingModelFor(settings);
  const out: number[][] = [];
  const BATCH = settings.provider === "ollama" ? 1 : 16; // Ollama embeddings: 1 Text pro Request

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    let vecs: number[][];
    if (settings.provider === "openai") {
      vecs = await embedOpenAI(slice, model, settings.openaiApiKey ?? "", "https://api.openai.com/v1");
    } else if (settings.provider === "lmstudio") {
      vecs = await embedOpenAI(slice, model, "", settings.lmstudioBaseUrl);
    } else if (settings.provider === "gpt2api") {
      vecs = await embedOpenAI(slice, model, settings.gpt2apiApiKey ?? "", settings.gpt2apiBaseUrl);
    } else {
      vecs = await embedOllama(slice, model, settings.ollamaBaseUrl);
    }
    out.push(...vecs);
    onProgress?.(Math.min(i + BATCH, texts.length), texts.length);
  }
  return out;
}

/** Ollama /api/embeddings — ein Text pro Request. */
async function embedOllama(texts: string[], model: string, baseUrl: string): Promise<number[][]> {
  const base = baseUrl.replace(/\/+$/, "");
  const out: number[][] = [];
  for (const t of texts) {
    const { signal, cancel } = withTimeout(EMBED_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: t }),
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const vec = data?.embedding;
      if (!Array.isArray(vec)) throw new Error("Ollama lieferte kein embedding-Feld.");
      out.push(vec as number[]);
    } finally {
      cancel();
    }
  }
  return out;
}

/** OpenAI-kompatibles /v1/embeddings — Batch möglich. */
async function embedOpenAI(
  texts: string[],
  model: string,
  apiKey: string,
  baseUrl: string,
): Promise<number[][]> {
  const base = baseUrl.replace(/\/+$/, "");
  const { signal, cancel } = withTimeout(EMBED_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: texts }),
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const arr = data?.data;
    if (!Array.isArray(arr)) throw new Error("Antwort enthielt kein data-Array.");
    return arr.map((d: any) => d.embedding as number[]);
  } finally {
    cancel();
  }
}

/** Kosinus-Ähnlichkeit zweier Vektoren. Liefert 0 bei Dimensionskonflikt. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Serialisiert einen Vektor für die DB-Spalte. */
export function serializeEmbedding(vec: number[]): string {
  // Auf 6 Dezimalstellen runden — spart deutlich Speicher bei vernachlässigbarem Genauigkeitsverlust.
  return JSON.stringify(vec.map((v) => Math.round(v * 1e6) / 1e6));
}

/** Liest einen Vektor aus der DB-Spalte. Liefert null bei fehlerhaftem Inhalt. */
export function deserializeEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as number[]) : null;
  } catch {
    return null;
  }
}
