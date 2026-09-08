// SearchPanel: Volltextsuche ueber alle Projekte + Ersetzen (Sprint 24, Agent 2).
//
// - Suchfeld (Enter = Suche) + Optionen: Case Sensitive, Regex, Whole Word
// - Scope-Auswahl (Title, Content, Notes, All) + Projekt-Filter
// - Ergebnisliste (Projekt, Kapitel, Zeile, Text-Match) mit Match-Highlighting
// - Ersetzen (erstes Vorkommen) + Alle ersetzen (mit Ersetzungstext-Feld)
// - Recent-Searches-Dropdown (aus getRecentSearches)
// - Keine LLM-Abhaengigkeit — nur Text-Matching via search-Service
// - Bloomberg-Terminal-Stil (bg #000, accent #ffa028, border #333, monospace)
import { useEffect, useState } from "react";
import {
  search,
  replace,
  replaceAll,
  getRecentSearches,
  type SearchQuery,
  type SearchResult,
  type SearchStats,
} from "@/services/search/search";

export interface SearchProject {
  id: string;
  name: string;
}

interface SearchPanelProps {
  /** Injizierbar fuer Tests (Default: echte search-Funktion). */
  searchFn?: (query: SearchQuery) => Promise<{ results: SearchResult[]; stats: SearchStats }>;
  /** Injizierbar fuer Tests (Default: echte replace-Funktion). */
  replaceFn?: (query: SearchQuery, replacement: string) => Promise<number>;
  /** Injizierbar fuer Tests (Default: echte replaceAll-Funktion). */
  replaceAllFn?: (query: SearchQuery, replacement: string) => Promise<number>;
  /** Projektliste fuer den Filter (Default: aus Projekt-Service geladen). */
  projects?: SearchProject[];
  /** Start-Ergebnisse (nur fuer Tests). */
  initialResults?: SearchResult[];
}

const SCOPES: { id: SearchQuery["scope"]; label: string }[] = [
  { id: "all", label: "Alles" },
  { id: "title", label: "Titel" },
  { id: "content", label: "Inhalt" },
  { id: "notes", label: "Notizen" },
];

const ACCENT = "#ffa028";

const panelStyle: React.CSSProperties = {
  background: "#000",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 4,
  padding: 12,
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#e8e8e8",
  border: "1px solid #333",
  borderRadius: 3,
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  borderRadius: 3,
  padding: "6px 12px",
  fontFamily: "inherit",
  fontSize: 13,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#b0b0b0",
  cursor: "pointer",
};

/** Rendert eine Ergebniszeile mit <mark>-Highlight des Treffers. */
export function HighlightedLine({ text, start, end }: { text: string; start: number; end: number }) {
  const before = text.slice(0, start);
  const match = text.slice(start, end);
  const after = text.slice(end);
  return (
    <span>
      {before}
      <mark style={{ background: ACCENT, color: "#000" }}>{match}</mark>
      {after}
    </span>
  );
}

export function SearchPanel({
  searchFn,
  replaceFn,
  replaceAllFn,
  projects: projectsProp,
  initialResults,
}: SearchPanelProps) {
  const runSearch = searchFn ?? search;
  const runReplace = replaceFn ?? replace;
  const runReplaceAll = replaceAllFn ?? replaceAll;

  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [scope, setScope] = useState<SearchQuery["scope"]>("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [projectList, setProjectList] = useState<SearchProject[]>(projectsProp ?? []);
  const [results, setResults] = useState<SearchResult[]>(initialResults ?? []);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacedCount, setReplacedCount] = useState<number | null>(null);

  // Projektliste lazy laden (nur wenn nicht per Prop injiziert — z. B. Tests).
  useEffect(() => {
    if (projectsProp) return;
    let cancelled = false;
    (async () => {
      try {
        const { listProjects } = await import("@/services/project");
        const list = listProjects();
        if (!cancelled) setProjectList(list.map((p) => ({ id: p.id, name: p.name })));
      } catch {
        if (!cancelled) setProjectList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectsProp]);

  // Verlauf beim Mount laden.
  useEffect(() => {
    let cancelled = false;
    getRecentSearches()
      .then((r) => {
        if (!cancelled) setRecent(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function buildQuery(overrideText?: string): SearchQuery {
    return {
      text: overrideText ?? text,
      projects: projectFilter ? [projectFilter] : [],
      caseSensitive,
      regex,
      wholeWord,
      scope,
    };
  }

  async function doSearch(overrideText?: string) {
    const query = buildQuery(overrideText);
    if (overrideText !== undefined) setText(overrideText);
    setLoading(true);
    setError(null);
    setReplacedCount(null);
    try {
      const { results: r, stats: s } = await runSearch(query);
      setResults(r);
      setStats(s);
      setRecent(await getRecentSearches());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suche fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function doReplace(all: boolean) {
    const query = buildQuery();
    setLoading(true);
    setError(null);
    setReplacedCount(null);
    try {
      const n = all ? await runReplaceAll(query, replacement) : await runReplace(query, replacement);
      setReplacedCount(n);
      // Liste nach Ersetzen aktualisieren.
      const { results: r, stats: s } = await runSearch(query);
      setResults(r);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ersetzen fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-panel" style={panelStyle}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doSearch();
        }}
      >
        <label htmlFor="search-input" style={{ ...labelStyle, marginBottom: 4 }}>
          Suche
        </label>
        <input
          id="search-input"
          aria-label="Suche"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Volltextsuche über alle Projekte…"
          style={inputStyle}
        />
        <button type="submit" aria-label="Suchen" style={{ ...buttonStyle, marginTop: 8 }} disabled={loading}>
          {loading ? "Sucht…" : "Suchen"}
        </button>
      </form>

      {recent.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="search-recent" style={{ ...labelStyle, marginBottom: 4 }}>
            Zuletzt gesucht
          </label>
          <select
            id="search-recent"
            aria-label="Zuletzt gesucht"
            value=""
            onChange={(e) => {
              if (e.target.value) void doSearch(e.target.value);
            }}
            style={inputStyle}
          >
            <option value="">— Verlauf wählen —</option>
            {recent.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset style={{ border: "1px solid #333", borderRadius: 3, marginTop: 8, padding: 8 }}>
        <legend style={{ color: ACCENT, fontSize: 12 }}>Optionen</legend>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={labelStyle}>
            <input
              type="checkbox"
              aria-label="Groß-/Kleinschreibung"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Aa
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              aria-label="Regulärer Ausdruck"
              checked={regex}
              onChange={(e) => setRegex(e.target.checked)}
            />
            .*
          </label>
          <label style={labelStyle}>
            <input
              type="checkbox"
              aria-label="Ganzes Wort"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
            />
            |ab|
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="search-scope" style={{ ...labelStyle, marginBottom: 4 }}>
              Bereich
            </label>
            <select
              id="search-scope"
              aria-label="Bereich"
              value={scope}
              onChange={(e) => setScope(e.target.value as SearchQuery["scope"])}
              style={inputStyle}
            >
              {SCOPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="search-project" style={{ ...labelStyle, marginBottom: 4 }}>
              Projekt
            </label>
            <select
              id="search-project"
              aria-label="Projekt"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">Alle Projekte</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <div style={{ marginTop: 8 }}>
        <label htmlFor="search-replacement" style={{ ...labelStyle, marginBottom: 4 }}>
          Ersetzen durch
        </label>
        <input
          id="search-replacement"
          aria-label="Ersetzen durch"
          type="text"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="Ersatztext…"
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => void doReplace(false)} disabled={loading} style={buttonStyle}>
            Ersetzen
          </button>
          <button type="button" onClick={() => void doReplace(true)} disabled={loading} style={buttonStyle}>
            Alle ersetzen
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ color: "#ff5555", marginTop: 8 }}>
          {error}
        </div>
      )}
      {replacedCount !== null && (
        <div style={{ color: ACCENT, marginTop: 8 }}>{replacedCount} Ersetzung(en) durchgeführt.</div>
      )}
      {stats && (
        <div style={{ color: "#b0b0b0", marginTop: 8, fontSize: 12 }}>
          {stats.totalResults} Treffer in {stats.projectCount} Projekt(en) ({stats.duration} ms)
        </div>
      )}

      <ul aria-label="Suchergebnisse" style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
        {results.map((r, i) => (
          <li
            key={`${r.projectId}-${r.chapterId ?? "p"}-${r.line}-${r.column}-${i}`}
            style={{ borderTop: "1px solid #333", padding: "6px 0" }}
          >
            <div style={{ color: ACCENT, fontSize: 12 }}>
              {r.projectTitle}
              {r.chapterTitle ? ` / ${r.chapterTitle}` : ""} — Zeile {r.line}, Spalte {r.column}
            </div>
            <div style={{ marginTop: 2, wordBreak: "break-word" }}>
              <HighlightedLine text={r.text} start={r.matchStart} end={r.matchEnd} />
            </div>
          </li>
        ))}
      </ul>
      {stats && results.length === 0 && (
        <div style={{ color: "#b0b0b0", marginTop: 8 }}>Keine Treffer.</div>
      )}
    </div>
  );
}
