// TactileHapticsExpanderModal (WP 78.2)
//
// Interaktive taktile Haptik- & Oberflächen-Matrix.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  analyzeTexture,
  expandDescription,
  formatHapticAnalysis,
  DIMENSION_LABELS,
  type TextureDimension,
} from "@/services/linguistics/tactileHapticsExpander";

export interface TactileHapticsExpanderModalProps {
  className?: string;
}

const DIMENSION_COLORS: Record<TextureDimension, string> = {
  friction: "var(--accent)",
  thermal: "var(--warn)",
  viscosity: "var(--success)",
  topography: "var(--error)",
  pressure: "var(--muted)",
};

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

export function TactileHapticsExpanderModal({ className }: TactileHapticsExpanderModalProps) {
  const [object, setObject] = useState("eine alte Eichentür");
  const [description, setDescription] = useState("Die Tür war alt und schwer.");
  const [seed] = useState(42);

  const analysis = useMemo(() => analyzeTexture(object, seed), [object, seed]);
  const expanded = useMemo(() => expandDescription(description, seed), [description, seed]);

  return (
    <div
      className={className}
      data-testid="tactile-haptics-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🖐️ Taktile Haptik- & Oberflächen-Matrix
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {analysis.profiles.length} Dimensionen · Intensität {analysis.overallIntensity}%
      </div>

      {/* Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Gegenstand
        <input
          data-testid="haptics-object-input"
          value={object}
          onChange={(e) => setObject(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Beschreibung
        <textarea
          data-testid="haptics-description-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Analyse */}
      <div
        data-testid="haptics-analysis"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ANALYSE</div>
        {analysis.profiles.map((p) => (
          <div key={p.dimension} data-testid={`haptics-${p.dimension}`} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: DIMENSION_COLORS[p.dimension], fontWeight: 700 }}>
                {DIMENSION_LABELS[p.dimension]}
              </span>
              <span style={{ color: "var(--muted)" }}>{p.intensity}%</span>
            </div>
            <div style={{ height: 4, background: "var(--panel)", borderRadius: 2, marginBottom: 4 }}>
              <div
                style={{
                  width: `${p.intensity}%`,
                  height: 4,
                  background: DIMENSION_COLORS[p.dimension],
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.value}</div>
          </div>
        ))}
      </div>

      {/* Erweiterte Beschreibung */}
      <div
        data-testid="haptics-expanded"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ERWEITERTE BESCHREIBUNG</div>
        <div style={{ lineHeight: 1.6 }}>{expanded}</div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="haptics-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="haptics-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatHapticAnalysis(analysis)}
        </pre>
      </details>
    </div>
  );
}
