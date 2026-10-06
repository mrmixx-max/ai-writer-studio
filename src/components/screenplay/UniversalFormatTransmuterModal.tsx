// UniversalFormatTransmuterModal (WP 80.2)
//
// Interaktiver omnidirektionaler Universal-Format-Transmuter.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  transmute,
  formatTransmuted,
  FORMAT_LABELS,
  type NarrativeFormat,
} from "@/services/screenplay/universalFormatTransmuter";

export interface UniversalFormatTransmuterModalProps {
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

export function UniversalFormatTransmuterModal({ className }: UniversalFormatTransmuterModalProps) {
  const [text, setText] = useState(
    'Der Held stand auf dem Dach. „Ich muss handeln", sagte er. Die Stadt brannte unter ihm.',
  );
  const [source, setSource] = useState<NarrativeFormat>("prose");
  const [target, setTarget] = useState<NarrativeFormat>("screenplay");

  const doc = useMemo(() => transmute(text, source, target), [text, source, target]);

  return (
    <div
      className={className}
      data-testid="universal-format-transmuter-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🔄 Omnidirektionaler Universal-Format-Transmuter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {FORMAT_LABELS[source]} → {FORMAT_LABELS[target]}
      </div>

      {/* Text-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Text
        <textarea
          data-testid="transmuter-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Format-Auswahl */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Quelle
          <select
            data-testid="transmuter-source-select"
            value={source}
            onChange={(e) => setSource(e.target.value as NarrativeFormat)}
            style={inputStyle}
          >
            {(Object.keys(FORMAT_LABELS) as NarrativeFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Ziel
          <select
            data-testid="transmuter-target-select"
            value={target}
            onChange={(e) => setTarget(e.target.value as NarrativeFormat)}
            style={inputStyle}
          >
            {(Object.keys(FORMAT_LABELS) as NarrativeFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Ergebnis */}
      <div
        data-testid="transmuter-output"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ERGEBNIS</div>
        <div style={{ fontFamily: "var(--font-mono)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {doc.content}
        </div>
        {doc.preservedElements.length > 0 && (
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            Erhaltene Elemente: {doc.preservedElements.join(", ")}
          </div>
        )}
        {doc.warnings.length > 0 && (
          <div style={{ fontSize: 10, color: "var(--warn)", marginTop: 4 }}>
            {doc.warnings.join("; ")}
          </div>
        )}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="transmuter-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="transmuter-text"
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
          {formatTransmuted(doc)}
        </pre>
      </details>
    </div>
  );
}
