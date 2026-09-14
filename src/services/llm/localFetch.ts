// Lokaler HTTP-Transport — läuft im Tauri-Kontext über das HTTP-Plugin
// (Rust-Seite, kein Browser-Origin → kein Ollama-CORS-Problem), im Browser/
// Test-Kontext über window.fetch. Das behebt den 403-Fehler der installierten
// App: Tauri v2 sendet Origin `https://tauri.localhost`, den Ollama ohne
// OLLAMA_ORIGINS mit 403 ablehnt — der Plugin-Request kommt dagegen vom
// nativen Client ohne blockierten Origin.
//
// API: getLocal(url, timeoutMs), postLocalJson(url, body) — beide liefern
// einen nativen Response, damit Aufrufer (.ok/.status/.json()/.text()/.body)
// unverändert weiterarbeiten.

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

declare const window: { __TAURI_INTERNALS__?: unknown } | undefined;

/** true, wenn die App im Tauri-Desktop-Kontext läuft. */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

/** GET gegen einen lokalen Server (Ollama/LM Studio). */
export async function getLocal(url: string, timeoutMs = 30000): Promise<Response> {
  if (!isTauriRuntime()) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { method: "GET", signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  return tauriFetch(url, { method: "GET", connectTimeout: Math.round(timeoutMs / 1000) });
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
  return tauriFetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
}
/** POST mit JSON-Body gegen einen lokalen Server. Liefert nativen Response. */
export async function postLocalJson(
  url: string,
  body: unknown,
  extra?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<Response> {
  const payload = JSON.stringify(body);
  if (!isTauriRuntime()) {
    const ms = extra?.timeoutMs;
    if (ms == null) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      if (extra?.signal && onAbort) extra.signal.removeEventListener("abort", onAbort);
    }
  }
  return tauriFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    ...(extra?.signal ? { signal: extra.signal } : {}),
  });
}
