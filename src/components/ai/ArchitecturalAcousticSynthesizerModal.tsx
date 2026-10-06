// ArchitecturalAcousticSynthesizerModal (WP 79.1)
//
// Interaktiver Raum-Architektur- & Akustik-Synthesizer.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  computeAcoustics,
  formatAcousticResult,
  MATERIAL_LABELS,
  LIGHT_LABELS,
  type RoomMaterial,
} from "@/services/ai/architecturalAcousticSynthesizer";

export interface ArchitecturalAcousticSynthesizerModalProps {
  className?: string;
}

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

export function ArchitecturalAcousticSynthesizerModal({ className }: ArchitecturalAcousticSynthesizerModalProps) {
  const [ceilingHeight, setCeilingHeight] = useState(8);
  const [volume, setVolume] = useState(500);
  const [material, setMaterial] = useState<RoomMaterial>("limestone");
  const [lightSource, setLightSource] = useState<"candle" | "torch" | "window" | "chandelier" | "none">("candle");

  const result = useMemo(
    () =>
      computeAcoustics({
        ceilingHeightM: ceilingHeight,
        volumeM3: volume,
        material,
        lightSource,
      }),
    [ceilingHeight, volume, material, lightSource],
  );

  return (
    <div
      className={className}
      data-testid="architectural-acoustic-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🏛️ Raum-Architektur- & Akustik-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        RT60: {result.reverbTimeSec}s · Flutterecho: {result.flutterEcho}% · Klarheit: {result.speechClarity}%
      </div>

      {/* Parameter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Deckenhöhe (m)
          <input
            data-testid="acoustic-height-input"
            type="number"
            value={ceilingHeight}
            onChange={(e) => setCeilingHeight(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Volumen (m³)
          <input
            data-testid="acoustic-volume-input"
            type="number"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Material
          <select
            data-testid="acoustic-material-select"
            value={material}
            onChange={(e) => setMaterial(e.target.value as RoomMaterial)}
            style={inputStyle}
          >
            {(Object.keys(MATERIAL_LABELS) as RoomMaterial[]).map((m) => (
              <option key={m} value={m}>
                {MATERIAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Licht
          <select
            data-testid="acoustic-light-select"
            value={lightSource}
            onChange={(e) => setLightSource(e.target.value as "candle" | "torch" | "window" | "chandelier" | "none")}
            style={inputStyle}
          >
            {(Object.keys(LIGHT_LABELS) as Array<"candle" | "torch" | "window" | "chandelier" | "none">).map((l) => (
              <option key={l} value={l}>
                {LIGHT_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Ergebnis */}
      <div
        data-testid="acoustic-result"
        style={{
          border: `1px solid ${result.speechClarity >= 70 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ERGEBNIS</div>
        <div
          data-testid="acoustic-clarity"
          style={{
            fontWeight: 700,
            color: result.speechClarity >= 70 ? "var(--success)" : "var(--warn)",
          }}
        >
          Sprachverständlichkeit: {result.speechClarity}%
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>{result.description}</div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="acoustic-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="acoustic-text"
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
          {formatAcousticResult(result, { ceilingHeightM: ceilingHeight, volumeM3: volume, material, lightSource })}
        </pre>
      </details>
    </div>
  );
}
