// Lokaler HTTP-Transport — läuft im Tauri-Kontext über Rust-Commands
// (ollama_get/ollama_post/ollama_delete in src-tauri/src/ollama_proxy.rs:
// nativer Client, kein Browser-Origin, kein CORS), im Browser/Test-Kontext
// über window.fetch.
//
// Warum kein fetch in der WebView: Die installierte App sendet Origin
// `https://tauri.localhost`, den Ollama ohne OLLAMA_ORIGINS mit 403 ablehnt —
// und WebView-fetch scheitert hier sogar mit Netzwerkfehler (Failed to fetch),
// obwohl der Server per curl antwortet. Der Rust-Proxy umgeht das vollständig.
//
// API: getLocal(url, timeoutMs, extra?), postLocalJson(url, body, extra?),
// deleteLocal(url, body) — alle liefern einen nativen Response, damit
// Aufrufer (.ok/.status/.json()/.text()/.body) unverändert weiterarbeiten.
// extra.headers erlaubt eigene Header (z. B. Authorization für Gateways).
//
// HINWEIS Streaming: Der Rust-Proxy liefert den VOLLEN Body (kein Stream).
// Für /api/chat-Streaming nutzt der OllamaProvider deshalb weiterhin fetch
// (siehe ollama.ts) — sobald Ollama erreichbar ist, greift dort der normale
// NDJSON-Stream. Health/List/Embed/Pull/Delete laufen über den Proxy.

import { invoke } from "@tauri-apps/api/core";

declare const window: { __TAURI_INTERNALS__?: unknown } | undefined;

/** true, wenn die App im Tauri-Desktop-Kontext läuft. */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

export interface LocalFetchExtra {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Baut einen Response aus Status + Body-String (Rust-Proxy-Pfad). */
function proxyResponse(status: number, bodyText: string): Response {
  return new Response(bodyText, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET gegen einen lokalen Server (Ollama/LM Studio). */
export async function getLocal(url: string, timeoutMs = 30000, extra?: LocalFetchExtra): Promise<Response> {
  const headers = extra?.headers;
  const signal = extra?.signal;
  if (!isTauriRuntime()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onAbort = signal ? () => ctrl.abort() : null;
    if (signal && onAbort) signal.addEventListener("abort", onAbort);
    try {
      return await fetch(url, {
        method: "GET",
        ...(headers ? { headers } : {}),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    }
  }
  // Tauri: über den Rust-Proxy (kein CORS, kein WebView-Netzwerkstack).
  if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
  const text = await invoke<string>("ollama_get", {
    url,
    timeoutSecs: Math.max(1, Math.round(timeoutMs / 1000)),
  });
  return proxyResponse(200, text);
}

/** DELETE gegen einen lokalen Server (z. B. Ollama /api/delete). */
export async function deleteLocal(url: string, body: unknown): Promise<Response> {
  const payload = JSON.stringify(body);
  if (!isTauriRuntime()) {
    return fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  }
  const text = await invoke<string>("ollama_delete", { url, body: payload });
  return proxyResponse(200, text);
}

/** POST mit JSON-Body gegen einen lokalen Server. Liefert nativen Response. */
export async function postLocalJson(
  url: string,
  body: unknown,
  extra?: LocalFetchExtra,
): Promise<Response> {
  const payload = JSON.stringify(body);
  const headers = { "Content-Type": "application/json", ...(extra?.headers ?? {}) };
  if (!isTauriRuntime()) {
    const ms = extra?.timeoutMs;
    if (ms == null) {
      return fetch(url, {
        method: "POST",
        headers,
        body: payload,
        ...(extra?.signal ? { signal: extra.signal } : {}),
      });
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const onAbort = extra?.signal ? () => ctrl.abort() : null;
    if (extra?.signal && onAbort) extra.signal.addEventListener("abort", onAbort);
    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      if (extra?.signal && onAbort) extra.signal.removeEventListener("abort", onAbort);
    }
  }
  // Tauri: über den Rust-Proxy. HINWEIS: kein Streaming — voller Body.
  // Für /api/chat nutzt der Provider weiterhin fetch (siehe ollama.ts).
  if (extra?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
  const text = await invoke<string>("ollama_post", {
    url,
    body: payload,
    timeoutSecs: Math.max(1, Math.round((extra?.timeoutMs ?? 600000) / 1000)),
  });
  return proxyResponse(200, text);
}
