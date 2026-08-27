// Suche im Projektwissen: semantisch, exakt, hybrid.
//
// Jedes Ergebnis zeigt an, ob es vollwertig ist. Läuft kein Einbettungsmodell,
// wird das ausdrücklich gesagt statt stillschweigend lexikalisch gesucht.

import type { RetrievalResult, SearchMode } from "@/types/knowledge";
import { SOURCE_TYPE_LABELS } from "@/types/knowledge";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  result: RetrievalResult | null;
  busy: boolean;
  onSearch: () => void;
  hasIndex: boolean;
}

const MODES: Array<{ id: SearchMode; label: string; hint: string }> = [
  { id: "hybrid", label: "Hybrid", hint: "Bedeutung und Wortlaut zusammen" },
  { id: "semantic", label: "Bedeutung", hint: "findet sinnverwandte Stellen, braucht ein Einbettungsmodell" },
  { id: "exact", label: "Wortlaut", hint: "findet nur genaue Übereinstimmungen, funktioniert immer" },
];

export function SearchPanel({
  query,
  onQueryChange,
  mode,
  onModeChange,
  result,
  busy,
  onSearch,
  hasIndex,
}: Props) {
  return (
    <div className="kw-section">
      <div className="kw-h">Suche</div>

      <div className="kw-searchbar">
        <input
          className="kw-input"
          type="text"
          value={query}
          placeholder="Wonach suchst du im Projekt?"
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy && query.trim()) onSearch();
          }}
          disabled={!hasIndex}
        />
        <button
          className="kw-btn primary"
          onClick={onSearch}
          disabled={busy || !query.trim() || !hasIndex}
        >
          {busy ? "…" : "Suchen"}
        </button>
      </div>

      <div className="kw-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`kw-mode${mode === m.id ? " active" : ""}`}
            onClick={() => onModeChange(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>

      {!hasIndex && (
        <div className="kw-notice warn">
          Der Wissensindex ist leer. Lies zuerst die Quellen ein und aktualisiere
          das Projektwissen — ohne Index gibt es nichts zu durchsuchen.
        </div>
      )}

      {result && (
        <>
          {/* Einschränkungen niemals verschweigen. */}
          {result.degraded && result.notice && (
            <div className="kw-notice warn">{result.notice}</div>
          )}

          {result.hits.length === 0 ? (
            <div className="kw-notice">
              Keine Treffer. Bei der Suche nach Wortlaut hilft ein anderer
              Begriff; bei der Bedeutungssuche kann auch eine ganze Frage
              besser wirken als ein einzelnes Wort.
            </div>
          ) : (
            <>
              <div className="kw-notice ok">
                {result.hits.length}{" "}
                {result.hits.length === 1 ? "Fundstelle" : "Fundstellen"}
                {result.strategyUsed === "hybrid"
                  ? " (Bedeutung und Wortlaut)"
                  : result.strategyUsed === "embedding"
                    ? " (Bedeutung)"
                    : " (Wortlaut)"}
              </div>

              <div className="kw-hits">
                {result.hits.map((h, i) => (
                  <div className="kw-hit" key={h.chunkId ?? i}>
                    <div className="kw-hit-head">
                      <span className="kw-hit-src" title={h.sourceTitle}>
                        [{i + 1}] {h.sourceTitle}
                      </span>
                      <span className="kw-hit-score">
                        {SOURCE_TYPE_LABELS[h.sourceType]} · {h.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="kw-hit-text">{h.text}</div>
                    {h.headingPath && <div className="kw-hit-path">{h.headingPath}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
