// LiteraryToneShifter (WP 55.2)
//
// Überträgt einen Text in eine andere literarische Tonalität, ohne den
// Handlungsverlauf zu verändern — mit Inhaltsprüfung und Stilvergleich.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  transmuteStyle,
  verifyContentPreserved,
  compareStyles,
  STYLE_PRESETS,
  type StylePreset,
} from "@/services/ai/literaryToneShifter";

export interface LiteraryToneShifterProps {
  /** Vorbefüllter Originaltext. */
  initialText?: string;
  className?: string;
}

const SAMPLE_TEXT =
  "Miller ging durch den Regen zum Hafen. Er sah den Sheriff und sagte kein Wort. Es war dunkel und sehr kalt.";

export function LiteraryToneShifter({
  initialText = SAMPLE_TEXT,
  className,
}: LiteraryToneShifterProps) {
  const [source, setSource] = useState(initialText);
  const [style, setStyle] = useState<StylePreset>("hardboiled");

  const result = useMemo(() => transmuteStyle(source, style), [source, style]);
  const preservation = useMemo(
    () => verifyContentPreserved(source, result.text),
    [source, result.text],
  );
  const comparison = useMemo(
    () => compareStyles(source, result.text),
    [source, result.text],
  );

  const preset = STYLE_PRESETS.find((p) => p.id === style);

  return (
    <div
      className={className}
      data-testid="literary-tone-shifter"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Stil-Transmuter & Tonfall-Shifter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Inhalts-Garantie: Figuren, Aktionen und Dialogbedeutungen bleiben erhalten.
      </div>

      {/* Stil-Presets */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>STIL-PRESET</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              data-testid={`tone-preset-${p.id}`}
              onClick={() => setStyle(p.id)}
              aria-pressed={style === p.id}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: style === p.id ? "var(--accent)" : "var(--panel)",
                color: style === p.id ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset && (
          <div data-testid="tone-preset-description" style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            {preset.description}
          </div>
        )}
      </div>

      {/* Originaltext */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
        Originaltext
        <textarea
          data-testid="tone-source-input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={4}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            resize: "vertical",
          }}
        />
      </label>

      {/* Inhaltsprüfung */}
      <div
        data-testid="tone-preservation"
        style={{
          border: `1px solid ${preservation.preserved ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          margin: "12px 0",
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          INHALTS-GARANTIE
        </div>
        <div
          data-testid="tone-preserved-status"
          style={{ color: preservation.preserved ? "var(--success)" : "var(--error)", fontWeight: 700 }}
        >
          {preservation.preserved
            ? `✓ Inhalt erhalten (${Math.round(preservation.preservationRate * 100)}%)`
            : `✗ Inhalt verändert (${Math.round(preservation.preservationRate * 100)}%)`}
        </div>
        {preservation.names.length > 0 && (
          <div data-testid="tone-names" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Geschützt: {preservation.names.join(", ")}
          </div>
        )}
      </div>

      {/* Ergebnis */}
      <div data-testid="tone-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          {preset?.label.toUpperCase()} · {result.substitutions} Ersetzungen ·{" "}
          {result.rewrittenSentences} umgebaute Sätze
        </div>
        <div
          data-testid="tone-output-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {result.text || "—"}
        </div>
      </div>

      {/* Stilvergleich */}
      <div
        data-testid="tone-comparison"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>STILVERGLEICH</div>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "2px 8px", color: "var(--muted)" }}>
                Kennzahl
              </th>
              <th style={{ textAlign: "right", padding: "2px 8px", color: "var(--muted)" }}>
                Original
              </th>
              <th style={{ textAlign: "right", padding: "2px 8px", color: "var(--muted)" }}>
                {preset?.label}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr data-testid="tone-row-sentences">
              <td style={{ padding: "2px 8px" }}>Sätze</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.a.sentenceCount}</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.b.sentenceCount}</td>
            </tr>
            <tr data-testid="tone-row-avglen">
              <td style={{ padding: "2px 8px" }}>Ø Satzlänge</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.a.avgSentenceLength}</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.b.avgSentenceLength}</td>
            </tr>
            <tr data-testid="tone-row-adjectives">
              <td style={{ padding: "2px 8px" }}>Adjektive</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.a.adjectiveCount}</td>
              <td style={{ textAlign: "right", padding: "2px 8px" }}>{comparison.b.adjectiveCount}</td>
            </tr>
          </tbody>
        </table>
        <div
          data-testid="tone-divergence"
          style={{ marginTop: 8, color: "var(--accent)", fontWeight: 700 }}
        >
          Stil-Divergenz: {comparison.divergence.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
