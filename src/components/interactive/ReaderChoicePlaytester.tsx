// ReaderChoicePlaytester (WP 46.2): Gamebook Monte-Carlo Playtester.
//
// Schickt simulierte Leser durch den Verzweigungsbaum, findet Sackgassen,
// unfaire Schwellenwerte und Endlosschleifen, und erzeugt eine Heatmap.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  simulatePlaythroughs,
  detectDeadEnds,
  detectUnfairThresholds,
  detectInfiniteLoops,
  generateHeatmap,
  type Gamebook,
} from "@/services/interactive/readerChoicePlaytester";

export interface ReaderChoicePlaytesterProps {
  book: Gamebook;
  className?: string;
}

export function ReaderChoicePlaytester({ book, className }: ReaderChoicePlaytesterProps) {
  const [iterations, setIterations] = useState(1000);
  const [result, setResult] = useState<ReturnType<typeof simulatePlaythroughs> | null>(null);

  const deadEnds = useMemo(() => detectDeadEnds(book), [book]);
  const unfair = useMemo(() => detectUnfairThresholds(book), [book]);
  const loops = useMemo(() => detectInfiniteLoops(book), [book]);
  const heatmap = useMemo(
    () => (result ? generateHeatmap(book, result) : null),
    [book, result],
  );

  const run = useCallback(() => {
    setResult(simulatePlaythroughs(book, iterations));
  }, [book, iterations]);

  return (
    <div
      className={className}
      data-testid="reader-choice-playtester"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎮 Monte-Carlo Playtester
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {book.nodes.length} Knoten · {book.nodes.reduce((s, n) => s + n.choices.length, 0)} Verzweigungen
      </div>

      {book.nodes.length === 0 && (
        <div data-testid="playtester-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Kein Spielbuch vorhanden.
        </div>
      )}

      {/* Steuerung */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Iterationen
          <input
            data-testid="playtester-iterations"
            type="number"
            min={10}
            max={10000}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value) || 10)}
            style={{
              width: 70,
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
        <button
          data-testid="playtester-run"
          onClick={run}
          disabled={book.nodes.length === 0}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: book.nodes.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Simulation starten
        </button>
      </div>

      {/* Ergebnis */}
      {result && (
        <div data-testid="playtester-result" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ERGEBNIS</div>
          <div style={{ fontSize: 11, lineHeight: 1.7 }}>
            <div data-testid="playtester-iterations-run">{result.iterations} Simulationen</div>
            <div data-testid="playtester-avg-length">
              Ø Pfadlänge: {result.averagePathLength.toFixed(1)} Knoten
            </div>
            <div data-testid="playtester-endings">
              Enden: {Object.entries(result.endingCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* Sackgassen */}
      {deadEnds.length > 0 && (
        <div data-testid="playtester-dead-ends" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--error)", marginBottom: 4 }}>
            SACKGASSEN ({deadEnds.length})
          </div>
          {deadEnds.map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--fg)", marginBottom: 2 }}>
              ✗ {d.nodeId}: {d.reason}
            </div>
          ))}
        </div>
      )}

      {/* Unfaire Schwellen */}
      {unfair.length > 0 && (
        <div data-testid="playtester-unfair" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--warn)", marginBottom: 4 }}>
            UNFAIRE SCHWELLENWERTE ({unfair.length})
          </div>
          {unfair.map((u, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--fg)", marginBottom: 2 }}>
              ⚠ {u.nodeId}: {u.choiceText} (Schwelle {u.threshold}) — {u.reason}
            </div>
          ))}
        </div>
      )}

      {/* Endlosschleifen */}
      {loops.length > 0 && (
        <div data-testid="playtester-loops" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--error)", marginBottom: 4 }}>
            ENDLOOPS ({loops.length})
          </div>
          {loops.map((l, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--fg)", marginBottom: 2 }}>
              ↻ {l.nodeIds.join(" → ")} — {l.reason}
            </div>
          ))}
        </div>
      )}

      {/* Heatmap */}
      {heatmap && (
        <div data-testid="playtester-heatmap" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>HEATMAP</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {Object.entries(heatmap.nodeVisits).map(([nodeId, visits]) => {
              const maxVisits = Math.max(...Object.values(heatmap.nodeVisits));
              const intensity = maxVisits > 0 ? visits / maxVisits : 0;
              return (
                <div
                  key={nodeId}
                  data-testid={`playtester-heat-${nodeId}`}
                  title={`${nodeId}: ${visits} Besuche`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--bg))`,
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    color: intensity > 0.5 ? "var(--bg)" : "var(--fg)",
                  }}
                >
                  {visits}
                </div>
              );
            })}
          </div>
          {heatmap.coldPaths.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
              Vergessene Pfade: {heatmap.coldPaths.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
