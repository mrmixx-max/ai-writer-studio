// OpticalMarginAlignmentModal (WP 83.1)
//
// Interaktiver optischer Randausgleich (Hängende Interpunktion).
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  computeAllAlignments,
  generateHangingPunctuationCSS,
  generateSVGFallback,
  formatAlignments,
  GLYPH_LABELS,
  type GlyphType,
} from "@/services/typography/opticalMarginAlignment";

export interface OpticalMarginAlignmentModalProps {
  className?: string;
}

export function OpticalMarginAlignmentModal({ className }: OpticalMarginAlignmentModalProps) {
  const [selectedGlyph, setSelectedGlyph] = useState<GlyphType>("hyphen");

  const alignments = useMemo(() => computeAllAlignments(), []);
  const css = useMemo(() => generateHangingPunctuationCSS(), []);
  const svg = useMemo(() => generateSVGFallback(selectedGlyph), [selectedGlyph]);

  return (
    <div
      className={className}
      data-testid="optical-margin-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📐 Optischer Randausgleich (Hängende Interpunktion)
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {alignments.length} Glyphen · {alignments.reduce((sum, a) => sum + a.protrusionPercent, 0) / alignments.length}% Ø Überhang
      </div>

      {/* Glyphen-Auswahl */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {(Object.keys(GLYPH_LABELS) as GlyphType[]).map((glyph) => (
          <button
            key={glyph}
            data-testid={`margin-glyph-${glyph}`}
            onClick={() => setSelectedGlyph(glyph)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: selectedGlyph === glyph ? "var(--accent)" : "var(--panel)",
              color: selectedGlyph === glyph ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {GLYPH_LABELS[glyph]}
          </button>
        ))}
      </div>

      {/* Ausgleiche */}
      <div
        data-testid="margin-alignments"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>AUSGLEICHE</div>
        {alignments.map((a) => (
          <div key={a.glyph} data-testid={`margin-alignment-${a.glyph}`} style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent)" }}>●</span> {GLYPH_LABELS[a.glyph]}: {a.protrusionPercent}% Überhang
          </div>
        ))}
      </div>

      {/* CSS */}
      <div
        data-testid="margin-css"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>CSS</div>
        <pre
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
          }}
        >
          {css}
        </pre>
      </div>

      {/* SVG-Vorschau */}
      <div
        data-testid="margin-svg"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SVG-FALLBACK</div>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="margin-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="margin-text"
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
          {formatAlignments(alignments)}
        </pre>
      </details>
    </div>
  );
}
