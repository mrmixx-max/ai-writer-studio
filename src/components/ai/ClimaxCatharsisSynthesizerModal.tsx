// ClimaxCatharsisSynthesizerModal (WP 59.2)
//
// Verknüpft äußere Gefahr mit innerer Wandlung: erzeugt Klimax und Katharsis,
// zeigt die Intensitätskurve und erkennt die fatale Charakterschwäche.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  synthesizeClimax,
  analyzeCatharsis,
  extractCharacterFlaw,
  FLAW_LABELS,
  type CharacterFlaw,
} from "@/services/ai/climaxCatharsisSynthesizer";

export interface ClimaxCatharsisSynthesizerModalProps {
  /** Vorbefüllter Held. */
  initialProtagonist?: string;
  className?: string;
}

const FLAWS: { value: CharacterFlaw; label: string }[] = [
  { value: "pride", label: "Hochmut" },
  { value: "fear", label: "Angst" },
  { value: "guilt", label: "Schuld" },
  { value: "isolation", label: "Selbstisolation" },
  { value: "revenge", label: "Rachsucht" },
];

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

export function ClimaxCatharsisSynthesizerModal({
  initialProtagonist = "Mira",
  className,
}: ClimaxCatharsisSynthesizerModalProps) {
  const [protagonist, setProtagonist] = useState(initialProtagonist);
  const [antagonist, setAntagonist] = useState("Der Wächter");
  const [location, setLocation] = useState("auf der Brücke");
  const [danger, setDanger] = useState("Das Seil begann zu reißen");
  const [flaw, setFlaw] = useState<CharacterFlaw | "">("");
  const [analysisText, setAnalysisText] = useState(
    "Er war zu stolz, um Hilfe zu bitten, und die Angst ließ ihn fliehen.",
  );

  const options = useMemo(
    () => ({
      protagonist,
      antagonist,
      location,
      danger,
      flaw: flaw || undefined,
    }),
    [protagonist, antagonist, location, danger, flaw],
  );

  const scene = useMemo(() => synthesizeClimax(options), [options]);
  const analysis = useMemo(() => analyzeCatharsis(scene.text), [scene.text]);
  const flawFinding = useMemo(() => extractCharacterFlaw(analysisText), [analysisText]);

  return (
    <div
      className={className}
      data-testid="climax-catharsis-synthesizer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔥 Klimax- & Katharsis-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Äußere Gefahr trifft innere Wandlung — und danach die Stille.
      </div>

      {/* Figuren und Ort */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Held
          <input
            data-testid="climax-protagonist-input"
            type="text"
            value={protagonist}
            onChange={(e) => setProtagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Gegner
          <input
            data-testid="climax-antagonist-input"
            type="text"
            value={antagonist}
            onChange={(e) => setAntagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Ort des Finales
        <input
          data-testid="climax-location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Äußere Lebensgefahr
        <input
          data-testid="climax-danger-input"
          type="text"
          value={danger}
          onChange={(e) => setDanger(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Charakterschwäche */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          FATALE CHARAKTERSCHWÄCHE
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            data-testid="climax-flaw-auto"
            onClick={() => setFlaw("")}
            aria-pressed={flaw === ""}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 4,
              cursor: "pointer",
              background: flaw === "" ? "var(--accent)" : "var(--panel)",
              color: flaw === "" ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            Automatisch
          </button>
          {FLAWS.map((f) => (
            <button
              key={f.value}
              data-testid={`climax-flaw-${f.value}`}
              onClick={() => setFlaw(f.value)}
              aria-pressed={flaw === f.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: flaw === f.value ? "var(--accent)" : "var(--panel)",
                color: flaw === f.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Klimax */}
      <div data-testid="climax-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KLIMAX · {scene.flawLabel.toUpperCase()}
        </div>
        <div
          data-testid="climax-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {scene.climax}
        </div>
        <div
          data-testid="climax-transformation"
          style={{ fontSize: 11, color: "var(--success)", marginTop: 6, fontStyle: "italic" }}
        >
          Wandlung: {scene.transformation}
        </div>
      </div>

      {/* Katharsis */}
      <div data-testid="catharsis-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>KATHARSIS</div>
        <div
          data-testid="catharsis-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {scene.catharsis}
        </div>
      </div>

      {/* Intensitätskurve */}
      <div
        data-testid="climax-curve"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          INTENSITÄTSKURVE
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
          {scene.intensityCurve.map((v, i) => (
            <div
              key={i}
              data-testid={`climax-curve-bar-${i}`}
              title={`${Math.round(v * 100)}%`}
              style={{
                flex: 1,
                height: `${Math.max(4, v * 100)}%`,
                background: v > 0.6 ? "var(--error)" : v > 0.35 ? "var(--warn)" : "var(--success)",
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div
          data-testid="climax-analysis"
          style={{ fontSize: 11, marginTop: 8 }}
        >
          Spitze: <strong data-testid="climax-peak">{Math.round(analysis.peak * 100)}%</strong> ·
          Ende: <strong data-testid="climax-ending">{Math.round(analysis.ending * 100)}%</strong> ·
          Abfall:{" "}
          <strong data-testid="climax-drop">{Math.round(analysis.resolutionDrop * 100)}%</strong>
        </div>
        <div
          data-testid="climax-wellformed"
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: analysis.wellFormed ? "var(--success)" : "var(--warn)",
          }}
        >
          {analysis.wellFormed
            ? "✓ Wohlgeformt: Spitze und Abfall sind ausgeprägt"
            : "⚠ Katharsis noch nicht ausgeprägt genug"}
        </div>
      </div>

      {/* Schwächen-Erkennung */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SCHWÄCHEN-ERKENNUNG IM TEXT
        </div>
        <textarea
          data-testid="climax-flaw-text-input"
          value={analysisText}
          onChange={(e) => setAnalysisText(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div
          data-testid="climax-flaw-result"
          style={{
            marginTop: 8,
            border: `1px solid ${flawFinding.flaw ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
          }}
        >
          {flawFinding.flaw
            ? `Erkannt: ${flawFinding.label} (${flawFinding.signals.join(", ")})`
            : "Keine Charakterschwäche erkannt"}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>
        {scene.wordCount} Wörter · Schwäche: {FLAW_LABELS[scene.flaw]}
      </div>
    </div>
  );
}
