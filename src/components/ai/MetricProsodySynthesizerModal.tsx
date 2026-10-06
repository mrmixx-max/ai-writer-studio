// MetricProsodySynthesizerModal (WP 76.1)
//
// Interaktive Darstellung metrischer Analyse und Gedichtgenerierung.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateShakespeareSonnet,
  generatePetrarchSonnet,
  generateBalladStrophe,
  formatPoem,
  analyzeLine,
  ratePoemQuality,
  METER_FEET,
  type GeneratedPoem,
} from "@/services/ai/metricProsodySynthesizer";

export interface MetricProsodySynthesizerModalProps {
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

export function MetricProsodySynthesizerModal({ className }: MetricProsodySynthesizerModalProps) {
  const [title, setTitle] = useState("Der Wind trägt Worte");
  const [form, setForm] = useState<GeneratedPoem["form"]>("shakespeare");
  const [analysisLine, setAnalysisLine] = useState("Der Wind trägt Worte durch die Nacht");

  const poem = useMemo(() => {
    if (form === "shakespeare") return generateShakespeareSonnet(title);
    if (form === "petrarch") return generatePetrarchSonnet(title);
    return generateBalladStrophe(title);
  }, [title, form]);

  const analysis = useMemo(() => analyzeLine(analysisLine), [analysisLine]);

  return (
    <div
      className={className}
      data-testid="metric-prosody-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📜 Metrik-, Sonett- & Balladen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {poem.lines.length} Zeilen · {poem.rhymeScheme} · Qualität {poem.quality}%
      </div>

      {/* Titel */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Titel
        <input
          data-testid="poem-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Form-Auswahl */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["shakespeare", "petrarch", "ballad"] as const).map((f) => (
          <button
            key={f}
            data-testid={`poem-form-${f}`}
            onClick={() => setForm(f)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: form === f ? "var(--accent)" : "var(--panel)",
              color: form === f ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "shakespeare" ? "Shakespeare" : f === "petrarch" ? "Petrarca" : "Ballade"}
          </button>
        ))}
      </div>

      {/* Gedicht */}
      <div
        data-testid="poem-output"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>GEDICHT</div>
        <div style={{ fontFamily: "var(--font-mono)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {poem.lines.join("\n")}
        </div>
        <div
          data-testid="poem-quality"
          style={{
            marginTop: 6,
            fontSize: 10,
            color: poem.quality >= 75 ? "var(--success)" : "var(--warn)",
          }}
        >
          {ratePoemQuality(poem)} ({poem.quality}%)
        </div>
      </div>

      {/* Zeilen-Analyse */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Zeilen-Analyse
        <input
          data-testid="poem-analysis-input"
          value={analysisLine}
          onChange={(e) => setAnalysisLine(e.target.value)}
          style={inputStyle}
        />
      </label>

      <div
        data-testid="poem-analysis"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ANALYSE</div>
        <div data-testid="poem-analysis-meter">
          Metrum: {analysis.meter === "unknown" ? "Unbekannt" : METER_FEET[analysis.meter as keyof typeof METER_FEET]?.label ?? analysis.meter}
        </div>
        <div data-testid="poem-analysis-syllables">Silben: {analysis.syllableCount}</div>
        <div data-testid="poem-analysis-pattern">Hebung: {analysis.stressPattern}</div>
        <div
          data-testid="poem-analysis-valid"
          style={{
            fontSize: 10,
            color: analysis.isValid ? "var(--success)" : "var(--error)",
            marginTop: 4,
          }}
        >
          {analysis.isValid ? "✓ Gültiges Metrum" : "✗ Ungültiges Metrum"}
        </div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="poem-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="poem-text"
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
          {formatPoem(poem)}
        </pre>
      </details>
    </div>
  );
}
