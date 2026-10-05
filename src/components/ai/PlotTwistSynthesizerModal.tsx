// PlotTwistSynthesizerModal (WP 58.1)
//
// Erzeugt Twist-Ideen je Archetyp samt Konfrontationsszene und bewertet die
// Wirksamkeit (Überraschung × Vorbereitung).
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  synthesizeTwist,
  generateConfrontation,
  scoreTwistImpact,
  ARCHETYPE_LABELS,
  type TwistArchetype,
} from "@/services/ai/plotTwistSynthesizer";

export interface PlotTwistSynthesizerModalProps {
  /** Vorbefüllter Held. */
  initialProtagonist?: string;
  className?: string;
}

const ARCHETYPES: { value: TwistArchetype; label: string }[] = [
  { value: "identity-reveal", label: "Identitäts-Enthüllung" },
  { value: "false-objective", label: "Scheinziel" },
  { value: "moral-reversal", label: "Moralische Umkehr" },
  { value: "sacrifice-choice", label: "Opfer-Wahl" },
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

export function PlotTwistSynthesizerModal({
  initialProtagonist = "Aron",
  className,
}: PlotTwistSynthesizerModalProps) {
  const [protagonist, setProtagonist] = useState(initialProtagonist);
  const [antagonist, setAntagonist] = useState("Meister Halden");
  const [artifact, setArtifact] = useState("das Sonnenrelikt");
  const [archetype, setArchetype] = useState<TwistArchetype | "">("");

  const options = useMemo(
    () => ({
      protagonist,
      antagonist,
      artifact,
      archetype: archetype || undefined,
    }),
    [protagonist, antagonist, artifact, archetype],
  );

  const twist = useMemo(() => synthesizeTwist(options), [options]);
  const scene = useMemo(() => generateConfrontation(options), [options]);
  const impact = useMemo(() => scoreTwistImpact(twist), [twist]);

  return (
    <div
      className={className}
      data-testid="plot-twist-synthesizer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💥 Plot-Twist-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Der Donnerschlag für die durchhängende Mitte — vorbereitet und dennoch überraschend.
      </div>

      {/* Figuren */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Held
          <input
            data-testid="twist-protagonist-input"
            type="text"
            value={protagonist}
            onChange={(e) => setProtagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Mentor / Gegner
          <input
            data-testid="twist-antagonist-input"
            type="text"
            value={antagonist}
            onChange={(e) => setAntagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Zentrales Objekt
        <input
          data-testid="twist-artifact-input"
          type="text"
          value={artifact}
          onChange={(e) => setArtifact(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Archetyp */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TWIST-ARCHETYP</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            data-testid="twist-archetype-auto"
            onClick={() => setArchetype("")}
            aria-pressed={archetype === ""}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 4,
              cursor: "pointer",
              background: archetype === "" ? "var(--accent)" : "var(--panel)",
              color: archetype === "" ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            Automatisch
          </button>
          {ARCHETYPES.map((a) => (
            <button
              key={a.value}
              data-testid={`twist-archetype-${a.value}`}
              onClick={() => setArchetype(a.value)}
              aria-pressed={archetype === a.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: archetype === a.value ? "var(--accent)" : "var(--panel)",
                color: archetype === a.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Twist */}
      <div
        data-testid="twist-output"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
          fontSize: 12,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          {twist.label.toUpperCase()}
        </div>
        <div data-testid="twist-reveal" style={{ fontWeight: 700, lineHeight: 1.6 }}>
          {twist.reveal}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          Wirkung: {twist.emotionalImpact}
        </div>
      </div>

      {/* Vorbereitung */}
      <div data-testid="twist-setup" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          LOGISCHE VORBEREITUNG ({twist.setup.length} Hinweise)
        </div>
        {twist.setup.map((s, i) => (
          <div
            key={i}
            data-testid={`twist-setup-${i + 1}`}
            style={{
              fontSize: 11,
              paddingLeft: 8,
              borderLeft: "2px solid var(--warn)",
              marginBottom: 4,
            }}
          >
            {s}
          </div>
        ))}
      </div>

      {/* Wirksamkeit */}
      <div
        data-testid="twist-impact"
        style={{
          border: `1px solid ${impact.impact >= 0.75 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          WIRKSAMKEIT
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>
            Überraschung:{" "}
            <strong data-testid="twist-surprise">{Math.round(impact.surprise * 100)}%</strong>
          </span>
          <span>
            Vorbereitung:{" "}
            <strong data-testid="twist-preparation">{Math.round(impact.preparation * 100)}%</strong>
          </span>
          <span>
            Wirkung:{" "}
            <strong data-testid="twist-impact-score">{Math.round(impact.impact * 100)}%</strong>
          </span>
        </div>
        <div
          data-testid="twist-recommendation"
          style={{
            marginTop: 6,
            color: impact.impact >= 0.75 ? "var(--success)" : "var(--warn)",
          }}
        >
          {impact.recommendation}
        </div>
      </div>

      {/* Konfrontationsszene */}
      <div data-testid="twist-scene" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KONFRONTATIONSSZENE ({scene.lineCount} Beiträge)
        </div>
        <div
          data-testid="twist-scene-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {scene.text}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--muted)" }}>
        Archetyp: {ARCHETYPE_LABELS[twist.archetype]} · {scene.wordCount} Wörter
      </div>
    </div>
  );
}
