// WebSearch-Engine (Sprint 22, Agent 3).
//
// Multi-Provider-Recherche: SerpAPI + DuckDuckGo + Brave Search + Google CSE.
// Additiv — beruehrt news/websearch.ts nicht (andere Typen, anderer Scope).
//
// Grundsaetze:
// - fetch ist injizierbar (fetchFn-Option) — Tests brauchen kein Netz.
// - Timeout via AbortController (Default 10 s).
// - Fehler/Timeout/ungueltige Antwort → leeres Array + console.warn (kein Throw ins UI).

export type SearchProvider = "serpapi" | "duckduckgo" | "brave" | "google";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: SearchProvider;
  timestamp: number;
}

export interface SearchOptions {
  query: string;
  provider: SearchProvider;
  maxResults: number;
  language: "de" | "en";
  dateRange?: "day" | "week" | "month" | "year";
  /** Injizierbare fetch-Funktion (Default: globalThis.fetch). */
  fetchFn?: typeof fetch;
  /** Timeout in ms (Default 10_000). 0 = kein Timeout. */
  timeoutMs?: number;
  /** SerpAPI-Key (nur provider serpapi). */
  serpApiKey?: string;
  /** Brave-API-Key (nur provider brave). */
  braveApiKey?: string;
  /** Google-API-Key (nur provider google). */
  googleApiKey?: string;
  /** Google Custom-Search-Engine-ID (nur provider google). */
  googleCx?: string;
}

export const DEFAULT_WEBSEARCH_TIMEOUT_MS = 10_000;
export const DEFAULT_WEBSEARCH_LIMIT = 10;

const DDG_ENDPOINT = "https://api.duckduckgo.com/";
const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

const DDG_KL: Record<"de" | "en", string> = { de: "de-de", en: "us-en" };

function normLang(lang: SearchOptions["language"]): "de" | "en" {
  return lang === "de" ? "de" : "en";
}

function capLimit(n: unknown, fallback = DEFAULT_WEBSEARCH_LIMIT): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(v, 50);
}

function now(): number {
  return Date.now();
}

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Baut die DDG-Instant-Answer-URL (exportiert fuer Tests). */
export function buildDuckDuckGoUrl(query: string, language: "de" | "en" = "en"): string {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    no_html: "1",
    skip_disambig: "1",
    kl: DDG_KL[normLang(language)],
  });
  return `${DDG_ENDPOINT}?${params.toString()}`;
}

interface DdgTopic {
  Text?: unknown;
  FirstURL?: unknown;
  Topics?: unknown;
}

function ddgTopicToResult(t: Record<string, unknown>, limit_ts: number): SearchResult | null {
  const url = cleanStr(t["FirstURL"]);
  const raw = cleanStr(t["Text"]);
  if (!url || !raw) return null;
  const splitAt = raw.search(/\s+[—–-]\s+/);
  const title = (splitAt > 0 ? raw.slice(0, splitAt) : raw).trim().slice(0, 200) || url;
  return { title, url, snippet: raw.slice(0, 500), source: "duckduckgo", timestamp: limit_ts };
}

/** Parst eine DDG-Instant-Answer-Antwort (exportiert fuer Tests). */
export function parseDuckDuckGoResponse(data: unknown, maxResults = DEFAULT_WEBSEARCH_LIMIT): SearchResult[] {
  const ts = now();
  if (!data || typeof data !== "object") return [];
  const d = data as { Results?: unknown; AbstractURL?: unknown; AbstractText?: unknown; RelatedTopics?: unknown };
  const limit = capLimit(maxResults);
  const out: SearchResult[] = [];
  if (Array.isArray(d.Results)) {
    for (const r of d.Results) {
      if (out.length >= limit) break;
      if (r && typeof r === "object") {
        const res = ddgTopicToResult(r as Record<string, unknown>, ts);
        if (res) out.push(res);
      }
    }
  }
  const abstractUrl = cleanStr(d.AbstractURL);
  if (out.length < limit && abstractUrl) {
    const abstractText = cleanStr(d.AbstractText);
    out.push({
      title: abstractText.slice(0, 200) || abstractUrl,
      url: abstractUrl,
      snippet: abstractText.slice(0, 500),
      source: "duckduckgo",
      timestamp: ts,
    });
  }
  const walk = (topics: unknown): void => {
    if (!Array.isArray(topics)) return;
    for (const t of topics) {
      if (out.length >= limit) return;
      if (!t || typeof t !== "object") continue;
      const rec = t as DdgTopic & Record<string, unknown>;
      if (Array.isArray(rec.Topics)) {
        walk(rec.Topics);
        continue;
      }
      const res = ddgTopicToResult(rec, ts);
      if (res) out.push(res);
    }
  };
  walk(d.RelatedTopics);
  return out.slice(0, limit);
}

/** Sucht via DuckDuckGo Instant Answer (kein API-Key noetig). */
export async function searchDuckDuckGo(
  query: string,
  opts: { language?: "de" | "en"; maxResults?: number; fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<SearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  const fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    console.warn("[websearch] kein fetch verfuegbar — leeres Ergebnis.");
    return [];
  }
  const limit = capLimit(opts.maxResults);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_WEBSEARCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = (await fetchFn(buildDuckDuckGoUrl(q, normLang(opts.language ?? "en")), {
      signal: controller.signal,
    })) as Response;
    if (!res.ok) {
      console.warn(`[websearch] DuckDuckGo HTTP ${res.status} — leeres Ergebnis.`);
      return [];
    }
    return parseDuckDuckGoResponse(await res.json(), limit);
  } catch (err) {
    console.warn(`[websearch] DuckDuckGo fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — leeres Ergebnis.`);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parst eine SerpAPI-Antwort (organic_results) — exportiert fuer Tests. */
export function parseSerpApiResponse(data: unknown, maxResults = DEFAULT_WEBSEARCH_LIMIT): SearchResult[] {
  const ts = now();
  if (!data || typeof data !== "object") return [];
  const list = (data as { organic_results?: unknown }).organic_results;
  if (!Array.isArray(list)) return [];
  const limit = capLimit(maxResults);
  const out: SearchResult[] = [];
  for (const item of list) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = cleanStr(rec["link"]);
    const title = cleanStr(rec["title"]);
    if (!url || !title) continue;
    out.push({
      title: title.slice(0, 200),
      url,
      snippet: cleanStr(rec["snippet"]).slice(0, 500),
      source: "serpapi",
      timestamp: ts,
    });
  }
  return out;
}

/** Sucht via SerpAPI (braucht apiKey). Ohne Key → [] + warn. */
export async function searchSerpApi(
  query: string,
  apiKey: string,
  opts: { language?: "de" | "en"; maxResults?: number; fetchFn?: typeof fetch; timeoutMs?: number; dateRange?: SearchOptions["dateRange"] } = {},
): Promise<SearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  if (!apiKey?.trim()) {
    console.warn("[websearch] SerpAPI ohne API-Key — leeres Ergebnis.");
    return [];
  }
  const fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    console.warn("[websearch] kein fetch verfuegbar — leeres Ergebnis.");
    return [];
  }
  const limit = capLimit(opts.maxResults);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_WEBSEARCH_TIMEOUT_MS;
  const params = new URLSearchParams({
    q,
    api_key: apiKey.trim(),
    engine: "google",
    num: String(Math.min(limit, 20)),
    hl: normLang(opts.language ?? "en"),
  });
  if (opts.dateRange) params.set("tbs", `qdr:${opts.dateRange === "day" ? "d" : opts.dateRange === "week" ? "w" : opts.dateRange === "month" ? "m" : "y"}`);
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = (await fetchFn(`${SERPAPI_ENDPOINT}?${params.toString()}`, { signal: controller.signal })) as Response;
    if (!res.ok) {
      console.warn(`[websearch] SerpAPI HTTP ${res.status} — leeres Ergebnis.`);
      return [];
    }
    return parseSerpApiResponse(await res.json(), limit);
  } catch (err) {
    console.warn(`[websearch] SerpAPI fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — leeres Ergebnis.`);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parst eine Brave-Search-Antwort (web.results) — exportiert fuer Tests. */
export function parseBraveResponse(data: unknown, maxResults = DEFAULT_WEBSEARCH_LIMIT): SearchResult[] {
  const ts = now();
  if (!data || typeof data !== "object") return [];
  const web = (data as { web?: unknown }).web;
  const list = web && typeof web === "object" ? (web as { results?: unknown }).results : undefined;
  if (!Array.isArray(list)) return [];
  const limit = capLimit(maxResults);
  const out: SearchResult[] = [];
  for (const item of list) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = cleanStr(rec["url"]);
    const title = cleanStr(rec["title"]);
    if (!url || !title) continue;
    out.push({
      title: title.slice(0, 200),
      url,
      snippet: cleanStr(rec["description"]).slice(0, 500),
      source: "brave",
      timestamp: ts,
    });
  }
  return out;
}

/** Sucht via Brave Search API (braucht apiKey). Ohne Key → [] + warn. */
export async function searchBrave(
  query: string,
  apiKey: string,
  opts: { language?: "de" | "en"; maxResults?: number; fetchFn?: typeof fetch; timeoutMs?: number; dateRange?: SearchOptions["dateRange"] } = {},
): Promise<SearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  if (!apiKey?.trim()) {
    console.warn("[websearch] Brave ohne API-Key — leeres Ergebnis.");
    return [];
  }
  const fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    console.warn("[websearch] kein fetch verfuegbar — leeres Ergebnis.");
    return [];
  }
  const limit = capLimit(opts.maxResults);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_WEBSEARCH_TIMEOUT_MS;
  const freshness =
    opts.dateRange === "day" ? "pd" : opts.dateRange === "week" ? "pw" : opts.dateRange === "month" ? "pm" : opts.dateRange === "year" ? "py" : undefined;
  const params = new URLSearchParams({
    q,
    count: String(Math.min(limit, 20)),
    search_lang: normLang(opts.language ?? "en"),
  });
  if (freshness) params.set("freshness", freshness);
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = (await fetchFn(`${BRAVE_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { "X-Subscription-Token": apiKey.trim(), Accept: "application/json" },
    })) as Response;
    if (!res.ok) {
      console.warn(`[websearch] Brave HTTP ${res.status} — leeres Ergebnis.`);
      return [];
    }
    return parseBraveResponse(await res.json(), limit);
  } catch (err) {
    console.warn(`[websearch] Brave fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — leeres Ergebnis.`);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parst eine Google-Custom-Search-Antwort (items) — exportiert fuer Tests. */
export function parseGoogleResponse(data: unknown, maxResults = DEFAULT_WEBSEARCH_LIMIT): SearchResult[] {
  const ts = now();
  if (!data || typeof data !== "object") return [];
  const list = (data as { items?: unknown }).items;
  if (!Array.isArray(list)) return [];
  const limit = capLimit(maxResults);
  const out: SearchResult[] = [];
  for (const item of list) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = cleanStr(rec["link"]);
    const title = cleanStr(rec["title"]);
    if (!url || !title) continue;
    out.push({
      title: title.slice(0, 200),
      url,
      snippet: cleanStr(rec["snippet"]).slice(0, 500),
      source: "google",
      timestamp: ts,
    });
  }
  return out;
}

/** Sucht via Google Custom Search (braucht apiKey + cx). Ohne → [] + warn. */
export async function searchGoogle(
  query: string,
  apiKey: string,
  cx: string,
  opts: { language?: "de" | "en"; maxResults?: number; fetchFn?: typeof fetch; timeoutMs?: number; dateRange?: SearchOptions["dateRange"] } = {},
): Promise<SearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  if (!apiKey?.trim() || !cx?.trim()) {
    console.warn("[websearch] Google ohne API-Key/CX — leeres Ergebnis.");
    return [];
  }
  const fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    console.warn("[websearch] kein fetch verfuegbar — leeres Ergebnis.");
    return [];
  }
  const limit = capLimit(opts.maxResults);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_WEBSEARCH_TIMEOUT_MS;
  const dateRestrict =
    opts.dateRange === "day" ? "d1" : opts.dateRange === "week" ? "w1" : opts.dateRange === "month" ? "m1" : opts.dateRange === "year" ? "y1" : undefined;
  const params = new URLSearchParams({
    q,
    key: apiKey.trim(),
    cx: cx.trim(),
    num: String(Math.min(limit, 10)),
    lr: normLang(opts.language ?? "en") === "de" ? "lang_de" : "lang_en",
  });
  if (dateRestrict) params.set("dateRestrict", dateRestrict);
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = (await fetchFn(`${GOOGLE_ENDPOINT}?${params.toString()}`, { signal: controller.signal })) as Response;
    if (!res.ok) {
      console.warn(`[websearch] Google HTTP ${res.status} — leeres Ergebnis.`);
      return [];
    }
    return parseGoogleResponse(await res.json(), limit);
  } catch (err) {
    console.warn(`[websearch] Google fehlgeschlagen (${err instanceof Error ? err.message : String(err)}) — leeres Ergebnis.`);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fuehrt eine Suche mit dem gewaehlten Provider aus.
 * Unbekannter Provider oder fehlende Keys → [] + warn (kein Throw).
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const q = (options?.query ?? "").trim();
  if (!q) return [];
  const base = {
    language: normLang(options.language),
    maxResults: capLimit(options.maxResults),
    fetchFn: options.fetchFn,
    timeoutMs: options.timeoutMs,
    dateRange: options.dateRange,
  };
  switch (options.provider) {
    case "duckduckgo":
      return searchDuckDuckGo(q, base);
    case "serpapi":
      return searchSerpApi(q, options.serpApiKey ?? "", base);
    case "brave":
      return searchBrave(q, options.braveApiKey ?? "", base);
    case "google":
      return searchGoogle(q, options.googleApiKey ?? "", options.googleCx ?? "", base);
    default:
      console.warn(`[websearch] unbekannter Provider "${String((options as { provider?: unknown }).provider)}" — leeres Ergebnis.`);
      return [];
  }
}
