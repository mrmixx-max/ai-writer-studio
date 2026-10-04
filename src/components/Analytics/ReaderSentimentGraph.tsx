// ReaderSentimentGraph (WP 47.1): Leser-Empathie & Sympathiekurve.
//
// Bewertet Figuren je Kapitel nach Verletzlichkeit, Tatkraft und moralischem
// Kompass, stellt Protagonist und Antagonist gegenüber und berechnet den
// Verräter-Schock-Index.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  calculateEmpathyMetrics,
  compareProtagonistAntagonist,
  calculateBetrayalShockIndex,
  generateSympathyCurve,
  type ChapterEmpathyData,
} from "@/services/analytics/readerSentimentGraph";

export interface ReaderSentimentGraphProps {
  protagonistData: ChapterEmpathyData[];
  antagonistData: ChapterEmpathyData[];
  className?: string;
  onSelectChapter?: (chapter: number) => void;
}

export function ReaderSentimentGraph({
  protagonistData,
  antagonistData,
  className,
  onSelectChapter,
}: ReaderSentimentGraphProps) {
  const [betrayalChapter, setBetrayalChapter] = useState(
    Math.max(1, Math.floor(protagonistData.length * 0.7)),
  );

  const protagonistMetrics = useMemo(
    () => protagonistData.map((d) => calculateEmpathyMetrics(d)),
    [protagonistData],
  );
  const antagonistMetrics = useMemo(
    () => antagonistData.map((d) => calculateEmpathyMetrics(d)),
    [antagonistData],
  );
  const comparison = useMemo(
    () => compareProtagonistAntagonist(protagonistMetrics, antagonistMetrics),
    [protagonistMetrics, antagonistMetrics],
  );
  const curve = useMemo(
    () => generateSympathyCurve(protagonistMetrics),
    [protagonistMetrics],
  );

  const empathyBefore = protagonistMetrics[betrayalChapter - 1]?.overall ?? 0;
  const shockIndex = useMemo(
    () =>
      calculateBetrayalShockIndex(
        empathyBefore,
        betrayalChapter,
        protagonistData.length,
      ),
    [empathyBefore, betrayalChapter, protagonistData.length],
  );

  const handleSelect = useCallback(
    (chapter: number) => {
      onSelectChapter?.(chapter);
    },
    [onSelectChapter],
  );

  return (
    <div
      className={className}
      data-testid="reader-sentiment-graph"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ❤️ Leser-Empathie
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {protagonistData.length} Kapitel · Trend: {curve.trend} · Peak: {curve.peak.toFixed(0)} ·
        Valley: {curve.valley.toFixed(0)}
      </div>

      {protagonistData.length === 0 && (
        <div data-testid="sentiment-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Keine Kapiteldaten vorhanden.
        </div>
      )}

      {/* Empathie-Metriken */}
      {protagonistMetrics.length > 0 && (
        <div data-testid="sentiment-metrics" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            EMPATHIE-METRIKEN (Protagonist)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Kap", "Vuln", "Agent", "Warm", "Overall"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "3px 8px",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted)",
                        textAlign: "right",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {protagonistMetrics.map((m) => (
                  <tr
                    key={m.chapter}
                    data-testid={`sentiment-row-${m.chapter}`}
                    onClick={() => handleSelect(m.chapter)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{m.chapter}</td>
                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{m.vulnerability}</td>
                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{m.agency}</td>
                    <td style={{ padding: "3px 8px", textAlign: "right" }}>{m.warmth}</td>
                    <td
                      style={{
                        padding: "3px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {m.overall.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sympathie-Gegenüberstellung */}
      {comparison.divergence.length > 0 && (
        <div data-testid="sentiment-comparison" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            PROTAGONIST vs. ANTAGONIST
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.7 }}>
            <div data-testid="sentiment-max-divergence">
              Max. Divergenz: {comparison.maxDivergence.toFixed(0)} (Kapitel{" "}
              {comparison.maxDivergenceChapter})
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {comparison.divergence.map((d, i) => (
                <div
                  key={i}
                  data-testid={`sentiment-divergence-${i + 1}`}
                  title={`Kapitel ${i + 1}: ${d.toFixed(0)}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 3,
                    background: `color-mix(in srgb, var(--accent) ${Math.round(d)}%, var(--bg))`,
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    color: d > 50 ? "var(--bg)" : "var(--fg)",
                  }}
                >
                  {d.toFixed(0)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verräter-Schock-Index */}
      <div
        data-testid="sentiment-betrayal"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          VERRÄTER-SCHOCK-INDEX
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          Verrat in Kapitel
          <input
            data-testid="sentiment-betrayal-chapter"
            type="number"
            min={1}
            max={Math.max(1, protagonistData.length)}
            value={betrayalChapter}
            onChange={(e) => setBetrayalChapter(Number(e.target.value) || 1)}
            style={{
              width: 50,
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
        <div style={{ fontSize: 13 }}>
          Empathie vor Verrat: <strong>{empathyBefore.toFixed(0)}</strong>
        </div>
        <div
          data-testid="sentiment-shock-index"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: shockIndex > 50 ? "var(--error)" : shockIndex > 25 ? "var(--warn)" : "var(--success)",
            marginTop: 4,
          }}
        >
          {shockIndex.toFixed(0)} / 100
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
          {shockIndex > 50
            ? "Verheerender Plot-Twist!"
            : shockIndex > 25
              ? "Spannender Twist"
              : "Milder Twist"}
        </div>
      </div>

      {/* Sympathiekurve als SVG */}
      {curve.points.length > 0 && (
        <div data-testid="sentiment-curve" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SYMPATHIEKURVE</div>
          <svg
            viewBox={`0 0 ${Math.max(100, curve.points.length * 30)} 80`}
            style={{
              width: "100%",
              maxWidth: 520,
              height: 80,
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            <polyline
              points={curve.points
                .map(
                  (p) =>
                    `${(p.chapter - 1) * 30 + 15},${80 - (p.value / 100) * 70 - 5}`,
                )
                .join(" ")}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
            />
            {curve.points.map((p) => (
              <circle
                key={p.chapter}
                data-testid={`sentiment-point-${p.chapter}`}
                cx={(p.chapter - 1) * 30 + 15}
                cy={80 - (p.value / 100) * 70 - 5}
                r={3}
                fill="var(--accent)"
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
