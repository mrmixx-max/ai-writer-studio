// SeriesUniverseMatrix (WP 44.2): Multi-Book Serien-Universums-Matrix.
//
// Zeigt mehrere Bände einer Reihe nebeneinander, verfolgt Figuren-Status
// (lebendig/tot, Verletzungen, Rang) über Buchgrenzen und listet Widersprüche.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  createSeriesUniverse,
  auditCharacterAcrossBooks,
  diffUniverse,
  detectContradictions,
  type SeriesBook,
} from "@/services/worldbuilding/multiBookSeriesMatrix";

export interface SeriesUniverseMatrixProps {
  books: SeriesBook[];
  className?: string;
  onSelectBook?: (bookNumber: number) => void;
}

export function SeriesUniverseMatrix({
  books,
  className,
  onSelectBook,
}: SeriesUniverseMatrixProps) {
  const universe = useMemo(() => createSeriesUniverse(books), [books]);
  const contradictions = useMemo(() => detectContradictions(universe), [universe]);

  const allCharacters = useMemo(() => {
    const names = new Set<string>();
    for (const b of books) for (const c of b.characters) names.add(c.name);
    return Array.from(names).sort();
  }, [books]);

  const [selected, setSelected] = useState<string | null>(allCharacters[0] ?? null);
  const [diffFrom, setDiffFrom] = useState(1);
  const [diffTo, setDiffTo] = useState(books.length);

  const audit = useMemo(
    () => (selected ? auditCharacterAcrossBooks(selected, universe) : null),
    [selected, universe],
  );

  const diff = useMemo(
    () => diffUniverse(universe, diffFrom, diffTo),
    [universe, diffFrom, diffTo],
  );

  const handleSelect = useCallback(
    (name: string) => {
      setSelected(name);
    },
    [],
  );

  return (
    <div
      className={className}
      data-testid="series-universe-matrix"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌌 Serien-Universum
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {books.length} Bände · {allCharacters.length} Figuren · {contradictions.length} Widersprüche
      </div>

      {books.length === 0 && (
        <div data-testid="series-matrix-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Keine Bände vorhanden.
        </div>
      )}

      {/* Widersprüche */}
      {contradictions.length > 0 && (
        <div data-testid="series-contradictions" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            WIDERSPRÜCHE ({contradictions.length})
          </div>
          {contradictions.map((c, i) => (
            <div
              key={`c-${i}`}
              data-testid={`series-contradiction-${i}`}
              style={{
                borderLeft: "3px solid var(--error)",
                paddingLeft: 8,
                marginBottom: 5,
                fontSize: 11,
              }}
            >
              <strong style={{ color: "var(--error)" }}>{c.character}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>
                (Band {c.fromBook} → {c.toBook})
              </span>
              : {c.message}
            </div>
          ))}
        </div>
      )}

      {contradictions.length === 0 && books.length > 0 && (
        <div
          data-testid="series-no-contradictions"
          style={{ fontSize: 12, color: "var(--success)", marginBottom: 16 }}
        >
          ✓ Keine Widersprüche über Buchgrenzen gefunden.
        </div>
      )}

      {/* Matrix: Figuren × Bände */}
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
        FIGUREN-MATRIX (Klick für Details)
      </div>
      <div data-testid="series-matrix" style={{ overflowX: "auto", marginBottom: 16 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                Figur
              </th>
              {books.map((b) => (
                <th
                  key={b.id}
                  data-testid={`series-col-${b.bookNumber}`}
                  style={{
                    padding: "4px 8px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Bd. {b.bookNumber}
                  {b.yearsAfterPrevious > 0 && (
                    <span style={{ fontSize: 9, display: "block", opacity: 0.7 }}>
                      +{b.yearsAfterPrevious} J.
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allCharacters.map((name) => (
              <tr
                key={name}
                data-testid={`series-row-${name}`}
                onClick={() => handleSelect(name)}
                style={{
                  cursor: "pointer",
                  background: selected === name ? "var(--card, transparent)" : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "4px 8px",
                    borderBottom: "1px solid var(--border)",
                    color: selected === name ? "var(--accent)" : "var(--fg)",
                    fontWeight: selected === name ? 700 : 400,
                  }}
                >
                  {name}
                </td>
                {books.map((b) => {
                  const c = b.characters.find((x) => x.name === name);
                  return (
                    <td
                      key={`${name}-${b.bookNumber}`}
                      data-testid={`series-cell-${name}-${b.bookNumber}`}
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid var(--border)",
                        textAlign: "center",
                        color: !c ? "var(--muted)" : c.alive ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {!c ? "—" : c.alive ? "●" : "✝"}
                      {c && c.injuries.length > 0 && (
                        <span style={{ fontSize: 9, color: "var(--warn)" }}> ⚠</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Figuren-Audit */}
      {audit && (
        <div data-testid="series-character-audit" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            STATUS-AUDIT: {audit.character}
          </div>
          {audit.appearances.map((a) => (
            <div
              key={a.bookNumber}
              data-testid={`series-audit-${a.bookNumber}`}
              style={{ fontSize: 11, color: "var(--fg)", marginBottom: 3 }}
            >
              Band {a.bookNumber}:{" "}
              <span style={{ color: a.alive ? "var(--success)" : "var(--error)" }}>
                {a.alive ? "lebendig" : "tot"}
              </span>
              {a.rank && <span style={{ color: "var(--muted)" }}> · {a.rank}</span>}
              {a.injuries.length > 0 && (
                <span style={{ color: "var(--warn)" }}> · {a.injuries.join(", ")}</span>
              )}
            </div>
          ))}
          {audit.contradictions.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--error)", marginTop: 5 }}>
              {audit.contradictions.map((c, i) => (
                <div key={i}>✗ {c}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Universums-Diff */}
      <div data-testid="series-diff" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>UNIVERSUMS-DIFF</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            von Band
            <input
              data-testid="series-diff-from"
              type="number"
              min={1}
              max={Math.max(1, books.length)}
              value={diffFrom}
              onChange={(e) => setDiffFrom(Number(e.target.value) || 1)}
              style={{
                width: 48,
                marginLeft: 5,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "2px 5px",
                fontSize: 11,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>
            bis
            <input
              data-testid="series-diff-to"
              type="number"
              min={1}
              max={Math.max(1, books.length)}
              value={diffTo}
              onChange={(e) => setDiffTo(Number(e.target.value) || 1)}
              style={{
                width: 48,
                marginLeft: 5,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "2px 5px",
                fontSize: 11,
              }}
            />
          </label>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {diff.yearsElapsed} Jahre vergangen
          </span>
        </div>
        {diff.characterChanges.length > 0 && (
          <div data-testid="series-diff-chars" style={{ fontSize: 11, color: "var(--fg)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Figuren</div>
            {diff.characterChanges.map((c, i) => (
              <div key={i}>· {c}</div>
            ))}
          </div>
        )}
        {diff.factionChanges.length > 0 && (
          <div data-testid="series-diff-factions" style={{ fontSize: 11, color: "var(--fg)", marginTop: 6 }}>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Fraktionen</div>
            {diff.factionChanges.map((f, i) => (
              <div key={i}>· {f}</div>
            ))}
          </div>
        )}
      </div>

      {/* Band-Auswahl */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {books.map((b) => (
          <button
            key={b.id}
            data-testid={`series-open-${b.bookNumber}`}
            onClick={() => onSelectBook?.(b.bookNumber)}
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Bd. {b.bookNumber}: {b.title}
          </button>
        ))}
      </div>
    </div>
  );
}
