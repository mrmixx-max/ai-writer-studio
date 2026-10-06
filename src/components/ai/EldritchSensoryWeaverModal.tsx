// EldritchSensoryWeaverModal (WP 73.1)
//
// Interaktive Darstellung der sensorischen Szenen mit Intensitäts-Balken.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateSensoryScene,
  formatSensoryScene,
  computeAverageIntensity,
  findMostIntenseEntry,
  isDreadful,
  CATEGORY_LABELS,
  type SenseCategory,
} from "@/services/ai/eldritchSensoryWeaver";

export interface EldritchSensoryWeaverModalProps {
  className?: string;
}

const CATEGORY_COLORS: Record<SenseCategory, string> = {
  sound: "var(--accent)",
  smell: "var(--warn)",
  touch: "var(--success)",
  sight: "var(--error)",
  taste: "var(--muted)",
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

export function EldritchSensoryWeaverModal({ className }: EldritchSensoryWeaverModalProps) {
  const [title, setTitle] = useState("Die Kammer der Ahnungslosen");
  const [seed, setSeed] = useState(42);

  const scene = useMemo(() => generateSensoryScene(title, seed), [title, seed]);
  const avgIntensity = useMemo(() => computeAverageIntensity(scene), [scene]);
  const mostIntense = useMemo(() => findMostIntenseEntry(scene), [scene]);
  const dreadful = useMemo(() => isDreadful(scene), [scene]);

  return (
    <div
      className={className}
      data-testid="eldritch-sensory-weaver-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🐙 Eldritch- & Alien-Sensorik-Weaver
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {scene.entries.length} Sinne · Ø Intensität {avgIntensity}% · Schrecken {scene.overallDread}%
      </div>

      {/* Titel-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Szenen-Titel
        <input
          data-testid="eldritch-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Seed */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Seed
        <input
          data-testid="eldritch-seed-input"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      {/* Schrecken-Anzeige */}
      <div
        data-testid="eldritch-dread"
        style={{
          border: `1px solid ${dreadful ? "var(--error)" : "var(--border)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SCHRECKENS-INDEX</div>
        <div
          data-testid="eldritch-dread-value"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: dreadful ? "var(--error)" : "var(--accent)",
          }}
        >
          {scene.overallDread}%
        </div>
        <div data-testid="eldritch-dread-label" style={{ fontSize: 10, color: "var(--muted)" }}>
          {dreadful ? "⚠ Beängstigend" : "✓ Erträglich"}
        </div>
      </div>

      {/* Sensorische Einträge */}
      <div
        data-testid="eldritch-entries"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SENSORISCHE EINTRÄGE</div>
        {scene.entries.map((entry, i) => (
          <div key={i} data-testid={`eldritch-entry-${entry.category}`} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: CATEGORY_COLORS[entry.category], fontWeight: 700 }}>
                {CATEGORY_LABELS[entry.category]}
              </span>
              <span style={{ color: "var(--muted)" }}>{entry.intensity}%</span>
            </div>
            <div style={{ height: 4, background: "var(--panel)", borderRadius: 2, marginBottom: 4 }}>
              <div
                style={{
                  width: `${entry.intensity}%`,
                  height: 4,
                  background: CATEGORY_COLORS[entry.category],
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>{entry.description}</div>
          </div>
        ))}
      </div>

      {/* Intensivster Eintrag */}
      {mostIntense && (
        <div
          data-testid="eldritch-most-intense"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>INTENSIVSTER EINTRAG</div>
          <div style={{ color: "var(--accent)", fontWeight: 700 }}>
            {CATEGORY_LABELS[mostIntense.category]} ({mostIntense.intensity}%)
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{mostIntense.description}</div>
        </div>
      )}

      {/* Text-Ausgabe */}
      <details data-testid="eldritch-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Text-Ausgabe
        </summary>
        <pre
          data-testid="eldritch-text"
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
          {formatSensoryScene(scene)}
        </pre>
      </details>
    </div>
  );
}
