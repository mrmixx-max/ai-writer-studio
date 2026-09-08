// Volltextsuche-Panel (Sprint 24, Agent 2): Suchfeld mit Enter-Suche,
// Optionen (Case/Regex/WholeWord), Scope-Auswahl, Projekt-Filter,
// Ergebnisliste mit Match-Highlighting, Ersetzen/Alle-Ersetzen,
// Recent-Searches-Dropdown. Bloomberg-Terminal-Stil (Inline-Styles).
// Service-Funktionen sind per Prop injizierbar (Tests/Storybook).
import { useEffect, useState } from "react";
import {
  search as defaultSearch,
  replace as defaultReplace,
  replaceAll as defaultReplaceAll,
  getRecentSearches as defaultGetRecent,
  clearRecentSearches as defaultClearRecent,
  type SearchQuery,
  type SearchResult,
  type SearchStats,
} from "@/services/search/search";
import { listProjects } from "@/services/project";

const TERM: React.CSSProperties = {
  background: "#0a0e14",
  color: "#ffb000",
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: 13,
  padding: 12,
  borderRadius: 6,
  border: "1px solid #2a3340",
};

const INPUT: React.CSSProperties = {
  background: "#11161f",
  color: "#ffb000",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const BTN: React.CSSProperties = {
  background: "#1a2230",
  color: "#ffb000",
  border: "1px solid #ffb000",
  borderRadius: 4,
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
};

const SCOPES: { id: SearchQuery["scope"]; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "title", label: "Titel" },
  { id: "content", label: "Inhalt" },
  { id: "notes", label: "Notizen" },
];

export interface SearchPanelProps {
  onSearch?: typeof defaultSearch;
  onReplace?: typeof defaultReplace;
  onReplaceAll?: typeof defaultReplaceAll;
  onGetRecent?: typeof defaultGetRecent;
  onClearRecent?: typeof defaultClearRecent;
}

function Highlighted({ text, start, end }: { text: string; start: number; end: number }) {
  if (start < 0 || end <= start || start >= text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark style={{ background: "#ffb000", color: "#0a0e14" }}>
        {text.slice(start, Math.min(end, text.length))}
      </mark>
      {text.slice(Math.min(end, text.length))}
    </>
  );
}

export function SearchPanel({
  onSearch = defaultSearch,
  onReplace = defaultReplace,
  onReplaceAll = defaultReplaceAll,
  onGetRecent = defaultGetRecent,
  onClearRecent = defaultClearRecent,
}: SearchPanelProps) {
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [scope, setScope] = useState<SearchQuery["scope"]>("all");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [projectNames, setProjectNames] = useState<{ id: string; name: string }[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<number | null>(null);

  useEffect(() => {
    try {
      setProjectNames(listProjects().map((p) => ({ id: p.id, name: p.name })));
    } catch {
      setProjectNames([]);
    }
    onGetRecent()
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [onGetRecent]);

  const buildQuery = (): SearchQuery => ({
    text,
    projects: projectFilter ? [projectFilter] : [],
    caseSensitive,
    regex,
    wholeWord,
    scope,
  });

  const runSearch = async () => {
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setReplaced(null);
    try {
      const { results: r, stats: s } = await onSearch(buildQuery());
      setResults(r);
      setStats(s);
      try {
        setRecent(await onGetRecent());
      } catch {
        // Verlauf ist Beiwerk — Treffer bleiben sichtbar.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suche fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const runReplace = async (all: boolean) => {
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const n = all ? await onReplaceAll(buildQuery(), replacement) : await onReplace(buildQuery(), replacement);
      setReplaced(n);
      await runSearchRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ersetzen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const runSearchRefresh = async () => {
    try {
      const { results: r, stats: s } = await onSearch(buildQuery());
      setResults(r);
      setStats(s);
    } catch {
      // Nach dem Ersetzen ist die alte Trefferliste bereits weg;
      // ein Refresh-Fehler soll den Erfolgszähler nicht verdecken.
    }
  };

  return (
    <div style={TERM} data-testid="search-panel">
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>🔎 VOLLTEXTSUCHE</div>

      <input
        data-testid="search-input"
        style={INPUT}
        placeholder="Suchbegriff… (Enter = suchen)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void runSearch();
        }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <label>
          <input
            data-testid="search-option-case"
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />{" "}
          Case
        </label>
        <label>
          <input
            data-testid="search-option-regex"
            type="checkbox"
            checked={regex}
            onChange={(e) => setRegex(e.target.checked)}
          />{" "}
          Regex
        </label>
        <label>
          <input
            data-testid="search-option-word"
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />{" "}
          Ganzes Wort
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select
          data-testid="search-scope-select"
          style={{ ...INPUT, width: "auto" }}
          value={scope}
          onChange={(e) => setScope(e.target.value as SearchQuery["scope"])}
          aria-label="Scope"
        >
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          data-testid="search-project-filter"
          style={{ ...INPUT, flex: 1 }}
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Projekt-Filter"
        >
          <option value="">Alle Projekte</option>
          {projectNames.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button data-testid="search-button" style={BTN} onClick={() => void runSearch()} disabled={busy || !text}>
          {busy ? "…" : "Suchen"}
        </button>
        <select
          data-testid="search-recent-select"
          style={{ ...INPUT, flex: 1 }}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              setText(e.target.value);
            }
          }}
          aria-label="Letzte Suchen"
        >
          <option value="">Verlauf…</option>
          {recent.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          data-testid="search-clear-recent"
          style={BTN}
          onClick={() => {
            void onClearRecent().then(() => setRecent([]));
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          data-testid="search-replace-input"
          style={{ ...INPUT, flex: 1 }}
          placeholder="Ersetzen durch…"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button data-testid="search-replace-button" style={BTN} onClick={() => void runReplace(false)} disabled={busy || !text}>
          Ersetzen
        </button>
        <button data-testid="search-replace-all-button" style={BTN} onClick={() => void runReplace(true)} disabled={busy || !text}>
          Alle
        </button>
      </div>

      {error && (
        <div data-testid="search-error" style={{ color: "#ff5555", marginTop: 8 }}>
          {error}
        </div>
      )}
      {stats && (
        <div data-testid="search-stats" style={{ marginTop: 8, color: "#5fff87" }}>
          {stats.totalResults} Treffer · {stats.projectCount} Projekte · {stats.duration} ms
        </div>
      )}
      {replaced !== null && (
        <div data-testid="search-replaced" style={{ marginTop: 4, color: "#5fff87" }}>
          {replaced}× ersetzt
        </div>
      )}

      {results.length > 0 ? (
        <ul data-testid="search-results" style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {results.map((r, i) => (
            <li
              key={`${r.projectId}-${r.chapterId ?? "prj"}-${r.line}-${r.column}-${i}`}
              data-testid={`search-result-${i}`}
              style={{ borderTop: "1px solid #2a3340", padding: "4px 0" }}
            >
              <div style={{ color: "#7aa2f7" }}>
                {r.projectTitle}
                {r.chapterTitle ? ` › ${r.chapterTitle}` : ""} <span style={{ color: "#666" }}>Z.{r.line}:S.{r.column}</span>
              </div>
              <div>
                <Highlighted text={r.text} start={r.matchStart} end={r.matchEnd} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        stats && (
          <div data-testid="search-empty" style={{ marginTop: 8, color: "#666" }}>
            Keine Treffer.
          </div>
        )
      )}
    </div>
  );
}
