// WhatIfScenarioPlannerModal (WP 62.2)
//
// Simuliert die Kaskade einer alternativen Entscheidung und stellt sie der
// Kanon-Timeline gegenüber.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  planWhatIfScenario,
  compareTimelines,
  analyzeCascade,
  formatCascadeReport,
} from "@/services/ai/whatIfScenarioPlanner";

export interface WhatIfScenarioPlannerModalProps {
  /** Vorbefüllte Divergenz. */
  initialDivergence?: string;
  className?: string;
}

const SAMPLE = "Der Mentor überlebt Kapitel 4";

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function WhatIfScenarioPlannerModal({
  initialDivergence = SAMPLE,
  className,
}: WhatIfScenarioPlannerModalProps) {
  const [divergence, setDivergence] = useState(initialDivergence);
  const [chapter, setChapter] = useState(4);
  const [totalChapters, setTotalChapters] = useState(20);

  const scenario = useMemo(
    () =>
      planWhatIfScenario({
        divergence,
        chapter,
        totalChapters,
        characters: ["Halden", "Mira"],
      }),
    [divergence, chapter, totalChapters],
  );

  const comparison = useMemo(() => compareTimelines(scenario, totalChapters), [scenario, totalChapters]);
  const cascade = useMemo(() => analyzeCascade(scenario, totalChapters), [scenario, totalChapters]);
  const report = useMemo(() => formatCascadeReport(scenario), [scenario]);

  return (
    <div
      className={className}
      data-testid="what-if-scenario-planner-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔀 Was-wäre-wenn-Szenarienplaner
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {scenario.affectedChapters} Folgekapitel betroffen · Divergenz ab Kapitel {scenario.chapter}
      </div>

      {/* Divergenz */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Divergenz-Punkt (die geänderte Entscheidung)
        <textarea
          data-testid="whatif-divergence-input"
          value={divergence}
          onChange={(e) => setDivergence(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Ab Kapitel
          <input
            data-testid="whatif-chapter-input"
            type="number"
            min={1}
            value={chapter}
            onChange={(e) => setChapter(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Gesamtkapitel
          <input
            data-testid="whatif-total-input"
            type="number"
            min={1}
            value={totalChapters}
            onChange={(e) => setTotalChapters(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Alternative Szene */}
      <div
        data-testid="whatif-scene"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          ALTERNATIVE SCHLÜSSELSZENE
        </div>
        {scenario.alternativeScene}
      </div>

      {/* Kaskade */}
      <div data-testid="whatif-cascade" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KASKADEN-SIMULATION
        </div>
        {scenario.cascade.map((c, i) => (
          <div
            key={i}
            data-testid={`whatif-step-${i}`}
            style={{
              display: "flex",
              gap: 8,
              fontSize: 11,
              paddingLeft: 8,
              borderLeft: `2px solid ${c.severity > 0.7 ? "var(--error)" : c.severity > 0.5 ? "var(--warn)" : "var(--accent)"}`,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "var(--muted)", minWidth: 62 }}>Kap. {c.chapter}</span>
            <span>
              <strong style={{ color: "var(--accent)" }}>{c.effectLabel}:</strong> {c.description}
            </span>
          </div>
        ))}
      </div>

      {/* Diff */}
      <div
        data-testid="whatif-diff"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DIFF: KANON vs. ALTERNATIVE
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
          {comparison.diffs.map((d) => (
            <span
              key={d.chapter}
              data-testid={`whatif-diff-chapter-${d.chapter}`}
              title={`Kapitel ${d.chapter}: ${d.changed ? "verändert" : "unverändert"}`}
              style={{
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                borderRadius: 3,
                background: d.changed ? "var(--warn)" : "var(--panel)",
                color: d.changed ? "var(--bg)" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              {d.chapter}
            </span>
          ))}
        </div>
        <div>
          Abweichende Kapitel:{" "}
          <strong data-testid="whatif-changed-count">{comparison.changedCount}</strong> von{" "}
          {comparison.diffs.length} ({Math.round(comparison.divergenceRate * 100)}%)
        </div>
      </div>

      {/* Kaskaden-Bewertung */}
      <div
        data-testid="whatif-analysis"
        style={{
          border: `1px solid ${cascade.reachesFinale ? "var(--error)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          KASKADEN-BEWERTUNG
        </div>
        <div>
          Schwere:{" "}
          <strong data-testid="whatif-severity">{Math.round(cascade.severity * 100)}%</strong> ·
          Reichweite:{" "}
          <strong data-testid="whatif-reach">{Math.round(cascade.reach * 100)}%</strong>
        </div>
        <div
          data-testid="whatif-reaches-finale"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: cascade.reachesFinale ? "var(--error)" : "var(--success)",
          }}
        >
          {cascade.reachesFinale
            ? "⚠ Kaskade erreicht das Finale — dritter Akt neu planen"
            : "✓ Kaskade bleibt lokal — sicher auszuprobieren"}
        </div>
        <div data-testid="whatif-recommendation" style={{ marginTop: 4, color: "var(--muted)" }}>
          {cascade.recommendation}
        </div>
      </div>

      <details data-testid="whatif-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Kaskaden-Bericht
        </summary>
        <pre
          data-testid="whatif-report-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {report}
        </pre>
      </details>
    </div>
  );
}
