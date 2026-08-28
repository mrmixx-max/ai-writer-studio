// Hilfsfunktionen zum Parsen von LLM-Streams.
// Ollama liefert NDJSON (ein JSON-Objekt pro Zeile).
// OpenAI / LM Studio liefern SSE (data: {...}\n\n, abschließend data: [DONE]).

import { ProviderError } from "@/types/llm";

/** Fetch mit Timeout — verhindert hängende Requests bei totem Server. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = 30000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // Externes Signal mit Timeout-Signal kombinieren
  let signal = ctrl.signal;
  let onAbort: (() => void) | null = null;
  if (init.signal) {
    const combined = new AbortController();
    onAbort = () => combined.abort();
    init.signal.addEventListener("abort", onAbort);
    ctrl.signal.addEventListener("abort", onAbort);
    signal = combined.signal;
  }
  // finally räumt den Timer UND die Listener ab — sonst bleiben die
  // Abort-Listener für die Lebensdauer des externen Signals hängen.
  return fetch(url, { ...init, signal }).finally(() => {
    clearTimeout(timer);
    if (onAbort) {
      ctrl.signal.removeEventListener("abort", onAbort);
      init.signal?.removeEventListener("abort", onAbort);
    }
  });
}

/** Parst einen ReadableStream von NDJSON-Zeilen und yield das Feld `path` (dot-notation). */
export async function* parseNdjson(
  body: ReadableStream<Uint8Array>,
  fieldPath: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) { await reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        yield* emitField(line, fieldPath);
      }
    }
    if (buffer.trim()) yield* emitField(buffer.trim(), fieldPath);
  } catch (e) {
    if (signal?.aborted) return;
    throw new ProviderError("Stream unterbrochen", e);
  } finally {
    reader.releaseLock();
  }
}

/** Parst einen ReadableStream von SSE-Events und yield das Feld `path` aus dem JSON-Payload. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  fieldPath: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) { await reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        yield* emitField(data, fieldPath);
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    throw new ProviderError("Stream unterbrochen", e);
  } finally {
    reader.releaseLock();
  }
}

/** Holt ein verschachteltes Feld per dot-notation (z.B. "message.content"). */
function* emitField(jsonStr: string, fieldPath: string): Generator<string, void, unknown> {
  let obj: any;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    return; // Zeile ist kein valides JSON → überspringen
  }
  const val = fieldPath.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  if (typeof val === "string" && val.length > 0) yield val;
}

/** Wirft eine deutsche ProviderError bei nicht-2xx. */
export async function assertOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new ProviderError(
      `${context} fehlgeschlagen (HTTP ${res.status}). ${detail.slice(0, 200)}`,
    );
  }
}
