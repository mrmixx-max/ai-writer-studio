// ConcordanceIndexMatrixModal (WP 79.2)
//
// Interaktiver Master-Konkordanz- & Sachregister-Index.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createConcordanceIndex,
  formatConcordanceIndex,
  TYPE_LABELS,
  type IndexEntryType,
} from "@/services/publishing/concordanceIndexMatrix";

export interface ConcordanceIndexMatrixModalProps {
  className?: string;
}

const TYPE_COLORS: Record<IndexEntryType, string> = {
  person: "var(--accent)",
  place: "var(--success)",
  battle: "var(--error)",
  artifact: "var(--warn)",
  term: "var(--muted)",
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

export function ConcordanceIndexMatrixModal({ className }: ConcordanceIndexMatrixModalProps) {
  const [title, setTitle] = useState("Die Chroniken der Aetherie");
  const [text, setText] = useState(
    "Der Held Falkenstein zog in die Schlacht von Düsterwald. Er trug das Schwert „Klinge des Lichts\". Die Schlacht von Düsterwald war blutig.",
  );

  const index = useMemo(() => createConcordanceIndex(title, text), [title, text]);

  return (
    <div
      className={className}
      data-testid="concordance-index-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📖 Master-Konkordanz- & Sachregister-Index
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {index.totalEntries} Einträge · {index.title}
      </div>

      {/* Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Titel
        <input
          data-testid="concordance-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Manuskript
        <textarea
          data-testid="concordance-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Index-Einträge */}
      <div
        data-testid="concordance-entries"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>INDEX-EINTRÄGE</div>
        {index.entries.length === 0 ? (
          <div data-testid="concordance-no-entries" style={{ color: "var(--muted)" }}>
            Keine Einträge gefunden.
          </div>
        ) : (
          index.entries.map((entry, i) => (
            <div key={i} data-testid={`concordance-entry-${i}`} style={{ marginBottom: 6 }}>
              <div style={{ color: TYPE_COLORS[entry.type], fontWeight: 700 }}>
                {entry.term} <span style={{ fontSize: 9, color: "var(--muted)" }}>[{TYPE_LABELS[entry.type]}]</span>
              </div>
              {entry.pageRefs.length > 0 && (
                <div style={{ fontSize: 9, color: "var(--muted)" }}>Seiten: {entry.pageRefs.join(", ")}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="concordance-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="concordance-text"
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
          {formatConcordanceIndex(index)}
        </pre>
      </details>
    </div>
  );
}
