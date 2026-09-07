// Bildgenerierung-Service (Sprint 14, Agent 3).
//
// Lokale Bildgenerierung mit zwei Backends:
// - "ollama": Ollama Vision (/api/generate). Ollama erzeugt keine Pixelbilder;
//   der Prompt wird an ein Vision-/Text-Modell geschickt und die Antwort wird
//   deterministisch in ein SVG-Data-URL gerendert (Offline-Demo ohne GPU).
//   describeImage() nutzt /api/generate mit `images` (beschreiben/editieren).
// - "sd-webui": Stable Diffusion WebUI API (http://127.0.0.1:7860,
//   POST /sdapi/v1/txt2img -> { images: [base64] } -> PNG-Data-URL).
//
// Grundsaetze (Ollama-Konvention aus src/services/ollama/):
// - Additiv, kein Breaking Change. Reine fetch-Wrapper, keine UI-Abhaengigkeit.
// - fetch ist injizierbar (fetchFn) — Tests brauchen kein Netz, keine GPU.
// - Alle Fehler als ImageGenError mit kind (maschinenlesbar) + deutscher Nachricht.
// - ASCII-only (shell-safe), keine Umlaute in Strings.

/** Standard-Adresse des lokalen Ollama-Servers. */
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

/** Standard-Adresse der lokalen SD WebUI API. */
export const DEFAULT_SD_WEBUI_BASE_URL = "http://127.0.0.1:7860";

/** Default-Modell fuer den Ollama-Pfad (Vision-faehig, bei Bedarf tauschbar). */
export const DEFAULT_OLLAMA_VISION_MODEL = "llava";

/** Default-Request-Timeout (SD auf CPU ist langsam — 120 s). */
export const DEFAULT_IMAGE_TIMEOUT_MS = 120_000;

/** Kurzer Timeout fuer Verfügbarkeits-Probes. */
export const DEFAULT_PROBE_TIMEOUT_MS = 3_000;

/** Verfuegbares Bild-Backend. */
export type ImageBackend = "ollama" | "sd-webui";

/** Injizierbarer Fetch-Typ (Tests uebergeben einen Mock). */
export type ImageFetchFn = typeof fetch;

/** Fehlerarten des Bildgenerierung-Service (maschinenlesbar). */
export type ImageGenErrorKind =
  | "bad-request"
  | "offline"
  | "timeout"
  | "aborted"
  | "server"
  | "no-backend";

/** Fehler des Bildgenerierung-Service (deutsche Nachricht + kind + cause). */
export class ImageGenError extends Error {
  readonly kind: ImageGenErrorKind;
  readonly cause?: unknown;
  constructor(kind: ImageGenErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ImageGenError";
    this.kind = kind;
    this.cause = cause;
  }
}

/** Optionen fuer generateImage(). Alle Felder ausser prompt optional. */
export interface GenerateImageOptions {
  /** Backend-Wahl. Default: "ollama" (ohne GPU sofort nutzbar). */
  backend?: ImageBackend;
  /** Ollama-Basis-URL (Default http://127.0.0.1:11434). */
  ollamaBaseUrl?: string;
  /** SD-WebUI-Basis-URL (Default http://127.0.0.1:7860). */
  sdWebuiBaseUrl?: string;
  /** Modellname (Ollama: Vision-Modell; SD: Checkpoint-Name, optional). */
  model?: string;
  /** Bildbreite in px (nur SD, Default 512). */
  width?: number;
  /** Bildhoehe in px (nur SD, Default 512). */
  height?: number;
  /** Sampling-Schritte (nur SD, Default 20). */
  steps?: number;
  /** Request-Timeout in ms (Default 120 s). */
  timeoutMs?: number;
  /** Injizierbarer fetch (Default globalThis.fetch). */
  fetchFn?: ImageFetchFn;
  /** Externes Abort-Signal (optional, bricht den Request ab). */
  signal?: AbortSignal;
}

/** Ergebnis von generateImage(). */
export interface GenerateImageResult {
  /** Fertige Bild-URL ("data:image/...;base64,..."), direkt in <img> nutzbar. */
  dataUrl: string;
  /** Tatsaechlich genutztes Modell. */
  model: string;
  /** Tatsaechlich genutztes Backend. */
  backend: ImageBackend;
  /** MIME-Typ der Data-URL ("image/svg+xml" bei Ollama, "image/png" bei SD). */
  mimeType: string;
}

/** Verfuegbarkeit der lokalen Backends (Probes, kein Throw). */
export interface BackendAvailability {
  ollama: boolean;
  sdWebui: boolean;
}

/** Optionen fuer checkAvailability()/listAvailableModels(). */
export interface AvailabilityOptions {
  ollamaBaseUrl?: string;
  sdWebuiBaseUrl?: string;
  timeoutMs?: number;
  fetchFn?: ImageFetchFn;
}

/** Optionen fuer describeImage(). */
export interface DescribeImageOptions {
  ollamaBaseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: ImageFetchFn;
}

const OLLAMA_OFFLINE_HINT =
  "Ollama ist nicht erreichbar. Server starten: `ollama serve` (Standard-Port 11434).";
const SD_OFFLINE_HINT =
  "SD WebUI ist nicht erreichbar. WebUI starten mit `--api` (Standard-Port 7860).";

function stripTrailingSlash(base: string): string {
  return base.replace(/\/+$/, "");
}

function ollamaBase(options: Pick<GenerateImageOptions, "ollamaBaseUrl"> | AvailabilityOptions | DescribeImageOptions): string {
  const raw =
    ("ollamaBaseUrl" in options && options.ollamaBaseUrl) || DEFAULT_OLLAMA_BASE_URL;
  return stripTrailingSlash(raw.trim() || DEFAULT_OLLAMA_BASE_URL);
}

function sdBase(options: Pick<GenerateImageOptions, "sdWebuiBaseUrl"> | AvailabilityOptions): string {
  const raw =
    ("sdWebuiBaseUrl" in options && options.sdWebuiBaseUrl) || DEFAULT_SD_WEBUI_BASE_URL;
  return stripTrailingSlash(raw.trim() || DEFAULT_SD_WEBUI_BASE_URL);
}

function requirePrompt(prompt: string): string {
  const p = (prompt ?? "").trim();
  if (!p) {
    throw new ImageGenError(
      "bad-request",
      "Kein Bild-Prompt angegeben — bitte eine Bildbeschreibung eingeben.",
    );
  }
  return p;
}

/** True bei Netzwerk-Fehlern (refused, DNS, fetch failed). */
function isNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const text =
    typeof e === "string"
      ? e
      : e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
        ? String((e as { message: string }).message)
        : "";
  return /fetch failed|failed to fetch|econnrefused|enotfound|network error|load failed|socket hang up/i.test(
    text,
  );
}

/**
 * fetch mit Timeout-Guard (AbortController). Pattern aus
 * src/services/ollama/resilience.ts (requestWithTimeout).
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: ImageFetchFn,
  offlineHint: string,
): Promise<Response> {
  const ms = Math.max(1, Math.floor(timeoutMs));
  const external = init.signal;
  if (external?.aborted) {
    throw new ImageGenError("aborted", "Bild-Request wurde abgebrochen (Signal war bereits abgebrochen).");
  }
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  const onExternalAbort = (): void => ctrl.abort();
  external?.addEventListener("abort", onExternalAbort);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (external?.aborted && !timedOut) {
      throw new ImageGenError("aborted", "Bild-Request wurde abgebrochen.", e);
    }
    if (timedOut || (e && typeof e === "object" && (e as { name?: unknown }).name === "AbortError")) {
      throw new ImageGenError(
        "timeout",
        `Bild-Request hat das Zeitlimit von ${ms} ms ueberschritten.`,
        e,
      );
    }
    if (isNetworkFailure(e)) {
      throw new ImageGenError("offline", offlineHint, e);
    }
    throw new ImageGenError("server", "Bild-Request fehlgeschlagen (unerwarteter Netzwerkfehler).", e);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (e) {
    throw new ImageGenError("server", "Server-Antwort ist kein gueltiges JSON.", e);
  }
}

/** Escaped Text fuer das SVG-Placeholder (Ollama-Pfad). */
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Rendert einen Beschreibungstext deterministisch als SVG-Data-URL.
 * Darstellung, keine KI-Pixel — Platzhalter bis SD WebUI laeuft.
 */
export function renderTextAsSvgDataUrl(text: string, label: string): string {
  const safe = escapeXml(text.length > 400 ? text.slice(0, 397) + "..." : text);
  const safeLabel = escapeXml(label);
  const words = safe.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 52) {
      lines.push(current.trim());
      current = w;
      if (lines.length >= 7) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < 8) lines.push(current);
  const textEls = lines
    .map((l, i) => `<text x="24" y="${118 + i * 26}" font-family="sans-serif" font-size="15" fill="#e8e6e1">${l}</text>`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="360" viewBox="0 0 512 360">` +
    `<rect width="512" height="360" fill="#1b1d24"/>` +
    `<rect x="0" y="0" width="512" height="64" fill="#262932"/>` +
    `<text x="24" y="40" font-family="sans-serif" font-size="18" font-weight="bold" fill="#f5c518">${safeLabel}</text>` +
    `${textEls}` +
    `<text x="24" y="336" font-family="sans-serif" font-size="12" fill="#8a8f9e">Ollama-Platzhalter — SD WebUI (--api) fuer echte Pixelbilder starten.</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

async function generateViaOllama(prompt: string, options: GenerateImageOptions): Promise<GenerateImageResult> {
  const base = ollamaBase(options);
  const model = (options.model ?? "").trim() || DEFAULT_OLLAMA_VISION_MODEL;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
  const res = await fetchWithTimeout(
    `${base}/api/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `Beschreibe in 3-4 Saetzen ein Bild zu dieser Vorgabe (Bildbeschreibung, kein Code): ${prompt}`,
        stream: false,
      }),
      signal: options.signal,
    },
    timeoutMs,
    fetchFn,
    OLLAMA_OFFLINE_HINT,
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new ImageGenError(
        "server",
        `Ollama-Modell "${model}" nicht gefunden — Modell installieren: \`ollama pull ${model}\`.`,
      );
    }
    throw new ImageGenError("server", `Ollama-Anfrage fehlgeschlagen (HTTP-Status ${res.status}).`);
  }
  const data = (await readJsonSafe(res)) as { response?: unknown };
  const text = typeof data.response === "string" && data.response.trim() ? data.response.trim() : prompt;
  const dataUrl = renderTextAsSvgDataUrl(text, `Ollama: ${model}`);
  return { dataUrl, model, backend: "ollama", mimeType: "image/svg+xml" };
}

async function generateViaSdWebui(prompt: string, options: GenerateImageOptions): Promise<GenerateImageResult> {
  const base = sdBase(options);
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
  const width = Math.max(64, Math.min(2048, Math.floor(options.width ?? 512)));
  const height = Math.max(64, Math.min(2048, Math.floor(options.height ?? 512)));
  const steps = Math.max(1, Math.min(150, Math.floor(options.steps ?? 20)));
  const body: Record<string, unknown> = { prompt, width, height, steps };
  if ((options.model ?? "").trim()) body["sd_model_checkpoint"] = (options.model ?? "").trim();
  const res = await fetchWithTimeout(
    `${base}/sdapi/v1/txt2img`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    },
    timeoutMs,
    fetchFn,
    SD_OFFLINE_HINT,
  );
  if (!res.ok) {
    if (res.status === 400) {
      throw new ImageGenError("bad-request", "SD WebUI hat den Prompt abgelehnt (HTTP 400) — Prompt kuerzen oder prüfen.");
    }
    throw new ImageGenError("server", `SD-WebUI-Anfrage fehlgeschlagen (HTTP-Status ${res.status}).`);
  }
  const data = (await readJsonSafe(res)) as { images?: unknown };
  if (!Array.isArray(data.images) || typeof data.images[0] !== "string" || !data.images[0]) {
    throw new ImageGenError("server", "SD WebUI hat kein Bild geliefert (leeres images-Feld).");
  }
  const b64 = (data.images[0] as string).trim();
  return {
    dataUrl: `data:image/png;base64,${b64}`,
    model: (options.model ?? "").trim() || "sd-webui-default",
    backend: "sd-webui",
    mimeType: "image/png",
  };
}

/**
 * Erzeugt ein Bild zum Prompt.
 * - backend "ollama" (Default): Ollama-Vision (/api/generate) -> SVG-Data-URL.
 * - backend "sd-webui": SD WebUI API (/sdapi/v1/txt2img) -> PNG-Data-URL.
 */
export async function generateImage(prompt: string, options: GenerateImageOptions = {}): Promise<GenerateImageResult> {
  const clean = requirePrompt(prompt);
  const backend: ImageBackend = options.backend ?? "ollama";
  if (backend !== "ollama" && backend !== "sd-webui") {
    throw new ImageGenError("bad-request", `Unbekanntes Backend "${backend}" — erlaubt: "ollama", "sd-webui".`);
  }
  if (backend === "sd-webui") return generateViaSdWebui(clean, options);
  return generateViaOllama(clean, options);
}

async function probe(
  url: string,
  timeoutMs: number,
  fetchFn: ImageFetchFn,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, Math.floor(timeoutMs)));
  try {
    const res = await fetchFn(url, { method: "GET", signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prueft die Erreichbarkeit beider Backends (parallele GET-Probes).
 * Wirft nie — nicht erreichbar heisst false.
 */
export async function checkAvailability(options: AvailabilityOptions = {}): Promise<BackendAvailability> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const [ollama, sdWebui] = await Promise.all([
    probe(`${ollamaBase(options)}/api/tags`, timeoutMs, fetchFn),
    probe(`${sdBase(options)}/sdapi/v1/sd-models`, timeoutMs, fetchFn),
  ]);
  return { ollama, sdWebui };
}

/**
 * Alias gemaess Sprint-14-Interface: listAvailableModels() ->
 * { ollama: boolean, sdWebui: boolean }.
 */
export async function listAvailableModels(options: AvailabilityOptions = {}): Promise<BackendAvailability> {
  return checkAvailability(options);
}

/**
 * Beschreibt ein Bild (Ollama Vision: /api/generate mit `images`).
 * imageDataUrl: "data:image/...;base64,..." oder rohes Base64.
 */
export async function describeImage(
  imageDataUrl: string,
  question: string,
  options: DescribeImageOptions = {},
): Promise<string> {
  const q = (question ?? "").trim();
  if (!q) throw new ImageGenError("bad-request", "Keine Frage angegeben — bitte eine Frage zum Bild eingeben.");
  const raw = (imageDataUrl ?? "").trim();
  if (!raw) throw new ImageGenError("bad-request", "Kein Bild angegeben — bitte ein Bild (Data-URL oder Base64) uebergeben.");
  const b64 = raw.includes(",") ? (raw.split(",").slice(1).join(",").trim()) : raw;
  if (!b64) throw new ImageGenError("bad-request", "Bild enthaelt keine Daten (leerer Base64-Teil).");
  const base = ollamaBase(options);
  const model = (options.model ?? "").trim() || DEFAULT_OLLAMA_VISION_MODEL;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const res = await fetchWithTimeout(
    `${base}/api/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: q, images: [b64], stream: false }),
    },
    options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS,
    fetchFn,
    OLLAMA_OFFLINE_HINT,
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new ImageGenError(
        "server",
        `Ollama-Modell "${model}" nicht gefunden — Modell installieren: \`ollama pull ${model}\`.`,
      );
    }
    throw new ImageGenError("server", `Bildbeschreibung fehlgeschlagen (HTTP-Status ${res.status}).`);
  }
  const data = (await readJsonSafe(res)) as { response?: unknown };
  if (typeof data.response !== "string" || !data.response.trim()) {
    throw new ImageGenError("server", "Ollama hat keine Bildbeschreibung geliefert (leere Antwort).");
  }
  return data.response.trim();
}
