// WebsearchPanel: Web-Recherche mit Provider-Auswahl (Sprint 22, Agent 3).
//
// - Suchfeld + Provider-Auswahl (SerpAPI / DuckDuckGo / Brave / Google)
// - Filter: Sprache (de/en), Zeitraum (alle/Tag/Woche/Monat/Jahr)
// - Ergebnisliste (Titel, URL, Snippet) + „Im Browser öffnen“ + „Als Quelle speichern“
// - Suchverlauf (letzte 10, localStorage „websearch-history“)
// - API-Keys liegen in localStorage („websearch-keys“) — kein SettingsPanel-Eingriff
// - Bloomberg-Terminal-Stil: Klasse „websearch-panel“ (Stile inline/minimal, kein neues CSS-File)
import { useState } from "react";
import {
  search,
  type SearchOptions,
  type SearchProvider,
  type SearchResult,
} from "@/services/websearch/websearch";

export interface SavedSource {
  title: string;
  url: string;
  snippet: string;
  savedAt: number;
}

interface WebsearchPanelProps {
  /** Injizierbar fuer Tests (Default: echte search-Funktion). */
  searchFn?: (options: SearchOptions) => Promise<SearchResult[]>;
  /** Wird bei „Als Quelle speichern“ aufgerufen (zus. zu localStorage). */
  onSaveSource?: (result: SearchResult) => void;
  /** Start-Ergebnisse (nur fuer Tests). */
  initialResults?: SearchResult[];
}

const HISTORY_KEY = "websearch-history";
const SAVED_KEY = "websearch-sources";
const KEYS_KEY = "websearch-keys";

const PROVIDERS: { id: SearchProvider; label: string }[] = [
  { id: "duckduckgo", label: "DuckDuckGo (frei)" },
  { id: "serpapi", label: "SerpAPI" },
  { id: "brave", label: "Brave Search" },
  { id: "google", label: "Google CSE" },
];

export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

function pushHistory(query: string): string[] {
  const next = [query, ...loadHistory().filter((h) => h !== query)].slice(0, 10);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadSavedSources(): SavedSource[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as SavedSource[]) : [];
  } catch {
    return [];
  }
}

export function saveSourceToStore(result: SearchResult): void {
  const entry: SavedSource = {
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([entry, ...loadSavedSources()].slice(0, 200)));
  } catch {
    /* ignore */
  }
}

function loadKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function WebsearchPanel({ searchFn, onSaveSource, initialResults }: WebsearchPanelProps) {
  const runSearch = searchFn ?? search;
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<SearchProvider>("duckduckgo");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [dateRange, setDateRange] = useState<"" | NonNullable<SearchOptions["dateRange"]>>("");
  const [results, setResults] = useState<SearchResult[]>(initialResults ?? []);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [keys, setKeys] = useState<Record<string, string>>(() => loadKeys());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  function updateKey(k: string, v: string) {
    setKeys((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(KEYS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function doSearch(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({
        query: q,
        provider,
        maxResults: 10,
        language,
        ...(dateRange ? { dateRange } : {}),
        serpApiKey: keys["serpapi"] ?? "",
        braveApiKey: keys["brave"] ?? "",
        googleApiKey: keys["google"] ?? "",
        googleCx: keys["googleCx"] ?? "",
      });
      setResults(res);
      setHistory(pushHistory(q));
      if (res.length === 0) setError("Keine Ergebnisse (Provider/Key/Netz prüfen).");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function openInBrowser(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveAsSource(r: SearchResult) {
    saveSourceToStore(r);
    setSavedCount((c) => c + 1);
    onSaveSource?.(r);
  }

  const needsKey = provider === "serpapi" || provider === "brave" || provider === "google";

  return (
    <div className="websearch-panel" data-testid="websearch-panel">
      <form onSubmit={doSearch} role="search" aria-label="Web-Recherche">
        <label htmlFor="websearch-query">Suche</label>
        <input
          id="websearch-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchbegriff …"
          autoComplete="off"
        />
        <label htmlFor="websearch-provider">Provider</label>
        <select
          id="websearch-provider"
          aria-label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as SearchProvider)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label htmlFor="websearch-lang">Sprache</label>
        <select
          id="websearch-lang"
          aria-label="Sprache"
          value={language}
          onChange={(e) => setLanguage(e.target.value as "de" | "en")}
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
        <label htmlFor="websearch-range">Zeitraum</label>
        <select
          id="websearch-range"
          aria-label="Zeitraum"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
        >
          <option value="">Alle</option>
          <option value="day">Tag</option>
          <option value="week">Woche</option>
          <option value="month">Monat</option>
          <option value="year">Jahr</option>
        </select>
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Sucht …" : "🔍 Suchen"}
        </button>
      </form>

      {needsKey && (
        <details>
          <summary>API-Keys (lokal gespeichert)</summary>
          {provider === "serpapi" && (
            <label>
              SerpAPI-Key
              <input
                type="password"
                aria-label="SerpAPI-Key"
                value={keys["serpapi"] ?? ""}
                onChange={(e) => updateKey("serpapi", e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          {provider === "brave" && (
            <label>
              Brave-API-Key
              <input
                type="password"
                aria-label="Brave-API-Key"
                value={keys["brave"] ?? ""}
                onChange={(e) => updateKey("brave", e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          {provider === "google" && (
            <>
              <label>
                Google-API-Key
                <input
                  type="password"
                  aria-label="Google-API-Key"
                  value={keys["google"] ?? ""}
                  onChange={(e) => updateKey("google", e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label>
                Google-CX (Suchmaschinen-ID)
                <input
                  aria-label="Google-CX"
                  value={keys["googleCx"] ?? ""}
                  onChange={(e) => updateKey("googleCx", e.target.value)}
                  autoComplete="off"
                />
              </label>
            </>
          )}
        </details>
      )}

      {error && (
        <div role="alert" className="websearch-error">
          {error}
        </div>
      )}

      <section aria-label="Suchergebnisse">
        <h3>
          Ergebnisse ({results.length}){savedCount > 0 && ` · ${savedCount} gespeichert`}
        </h3>
        {results.length === 0 ? (
          <p>Noch keine Ergebnisse.</p>
        ) : (
          <ul>
            {results.map((r) => (
              <li key={`${r.source}:${r.url}`}>
                <strong>{r.title}</strong>
                <br />
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.url}
                </a>
                <p>{r.snippet}</p>
                <button onClick={() => openInBrowser(r.url)}>Im Browser öffnen</button>{" "}
                <button onClick={() => saveAsSource(r)}>Als Quelle speichern</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Suchverlauf">
        <h3>Verlauf</h3>
        {history.length === 0 ? (
          <p>Noch keine Suchen.</p>
        ) : (
          <ul>
            {history.map((h) => (
              <li key={h}>
                <button
                  onClick={() => {
                    setQuery(h);
                  }}
                >
                  {h}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
