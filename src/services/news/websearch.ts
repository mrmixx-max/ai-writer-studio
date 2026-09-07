// Websearch-Service fuer Nachrichten (Sprint 16, Agent 1).
//
// Sucht Nachrichten-Themen ueber die DuckDuckGo Instant Answer API
// (kein API-Key noetig). Reine Recherche-Hilfsfunktion fuer den
// Zeitungsgenerator: liefert Titel + URL + Snippet + Quelle.
//
// Grundsaetze (Ollama-Konvention aus src/services/ollama/):
// - Additiv, kein Breaking Change: neues Modul unter src/services/news/.
// - fetch ist injizierbar (fetchFn-Option) — Tests brauchen kein Netz.
// - Timeout via AbortController (Default 10 s).
// - Fallback: kein Netz / Timeout / ungültige Antwort → leeres Array +
//   console.warn (kein Throw ins UI).

/** Ein einzelnes Suchergebnis. */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

/** Unterstuetzte Suchsprachen (steuert DDG-Region via kl-Parameter). */
export type NewsSearchLang = "de" | "en";

/** Optionen fuer searchNews(). Alle Felder optional. */
export interface SearchNewsOptions {
  /** Injizierbare fetch-Funktion (Default: globalThis.fetch). Signatur wie fetch. */
  fetchFn?: typeof fetch;
  /** Timeout in ms (Default 10_000). 0 = kein Timeout. */
  timeoutMs?: number;
  /** Max. Anzahl Ergebnisse (Default 10). */
  limit?: number;
}

export const DEFAULT_SEARCH_TIMEOUT_MS = 10_000;
export const DEFAULT_SEARCH_LIMIT = 10;
const DDG_ENDPOINT = "https://api.duckduckgo.com/";

const KL_BY_LANG: Record<NewsSearchLang, string> = {
  de: "de-de",
  en: "us-en",
};

function normalizeLang(lang: string | undefined): NewsSearchLang {
  return lang?.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Baut die DDG-Instant-Answer-URL (exportiert, damit Tests den lang-Param pruefen koennen). */
export function buildSearchUrl(query: string, lang?: string): string {
  const kl = KL_BY_LANG[normalizeLang(lang)];
  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    no_html: "1",
    skip_disambig: "1",
    kl,
  });
  return `${DDG_ENDPOINT}?${params.toString()}`;
}

interface DdgTopic {
  Text?: unknown;
  FirstURL?: unknown;
  Result?: unknown;
  Topics?: unknown;
}

interface DdgResponse {
  Abstract?: unknown;
  AbstractText?: unknown;
  AbstractURL?: unknown;
  AbstractSource?: unknown;
  Results?: unknown;
  RelatedTopics?: unknown;
}

function topicToResult(t: Record<string, unknown>): SearchResult | null {
  const url = typeof t["FirstURL"] === "string" ? t["FirstURL"].trim() : "";
  const rawText = typeof t["Text"] === "string" ? t["Text"] : "";
  if (!url || !rawText.trim()) return null;
  const text = rawText.trim();
  // DDG-Text hat Form "Titel — Beschreibung"; Titel = Teil vor erstem " - "/" — ".
  const splitAt = text.search(/\s+[—–-]\s+/);
  const title = (splitAt > 0 ? text.slice(0, splitAt) : text).trim().slice(0, 200) || url;
  return { title, url, snippet: text.slice(0, 500), source: "DuckDuckGo" };
}

/** Parst eine DDG-Instant-Answer-Antwort in SearchResult[] (exportiert fuer Tests). */
export function parseInstantAnswer(data: unknown, limit: number = DEFAULT_SEARCH_LIMIT): SearchResult[] {
  if (!data || typeof data !== "object") return [];
  const d = data as DdgResponse;
  const out: SearchResult[] = [];

  // 1) Direkt-Ergebnisse (Results)
  if (Array.isArray(d.Results)) {
    for (const r of d.Results) {
      if (out.length >= limit) break;
      if (r && typeof r === "object") {
        const res = topicToResult(r as Record<string, unknown>);
        if (res) out.push(res);
      }
    }
  }

  // 2) Abstract (wenn mit URL)
  if (out.length < limit && typeof d.AbstractURL === "string" && d.AbstractURL.trim()) {
    const abstractText = typeof d.AbstractText === "string" ? d.AbstractText.trim() : "";
    const sourceName =
      typeof d.AbstractSource === "string" && d.AbstractSource.trim() ? d.AbstractSource.trim() : "DuckDuckGo";
    out.push({
      title: abstractText.slice(0, 200) || d.AbstractURL.trim(),
      url: d.AbstractURL.trim(),
      snippet: abstractText.slice(0, 500),
      source: sourceName,
    });
  }

  // 3) RelatedTopics (flach + gruppiert via Topics)
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
      const res = topicToResult(rec);
      if (res) out.push(res);
    }
  };
  walk(d.RelatedTopics);

  return out.slice(0, Math.max(0, limit));
}

/**
 * Sucht Nachrichten-Themen. Fallback: leeres Array + console.warn
 * (kein Throw — UI bleibt benutzbar ohne Netz).
 */
export async function searchNews(
  query: string,
  lang?: string,
  options: SearchNewsOptions = {},
): Promise<SearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];

  const fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== "function") {
    console.warn("[websearch] kein fetch verfuegbar — leeres Ergebnis.");
    return [];
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_SEARCH_LIMIT));
  const url = buildSearchUrl(q, lang);

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    let res: Response;
    try {
      res = await fetchFn(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && /abort/i.test(e.message));
      console.warn(
        aborted
          ? `[websearch] Timeout nach ${timeoutMs} ms fuer "${q}" — leeres Ergebnis.`
          : `[websearch] Netzwerkfehler fuer "${q}": ${e instanceof Error ? e.message : String(e)} — leeres Ergebnis.`,
      );
      return [];
    }
    if (!res.ok) {
      console.warn(`[websearch] HTTP ${res.status} fuer "${q}" — leeres Ergebnis.`);
      return [];
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.warn(`[websearch] Ungueltiges JSON fuer "${q}" — leeres Ergebnis.`);
      return [];
    }
    return parseInstantAnswer(data, limit);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
