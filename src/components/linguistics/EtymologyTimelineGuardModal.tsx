// EtymologyTimelineGuardModal (WP 76.2)
//
// Interaktiver Etymologie- & Epochen-Wächter.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  scanForAnachronisms,
  formatAnachronismReport,
  suggestSynonym,
  EPOCH_LABELS,
  type Epoch,
} from "@/services/linguistics/etymologyTimelineGuard";

export interface EtymologyTimelineGuardModalProps {
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

export function EtymologyTimelineGuardModal({ className }: EtymologyTimelineGuardModalProps) {
  const [text, setText] = useState("Der Ritter nahm das Telefon und fuhr mit dem Auto zum Schloss.");
  const [epoch, setEpoch] = useState<Epoch>("medieval");

  const anachronisms = useMemo(() => scanForAnachronisms(text, epoch), [text, epoch]);

  return (
    <div
      className={className}
      data-testid="etymology-timeline-guard-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📚 Historischer Etymologie- & Epochen-Wächter
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {anachronisms.length} Anachronismen · {EPOCH_LABELS[epoch]}
      </div>

      {/* Epochen-Auswahl */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {(Object.keys(EPOCH_LABELS) as Epoch[]).map((ep) => (
          <button
            key={ep}
            data-testid={`etymology-epoch-${ep}`}
            onClick={() => setEpoch(ep)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: epoch === ep ? "var(--accent)" : "var(--panel)",
              color: epoch === ep ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {EPOCH_LABELS[ep]}
          </button>
        ))}
      </div>

      {/* Text-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Text
        <textarea
          data-testid="etymology-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Anachronismen */}
      <div
        data-testid="etymology-anachronisms"
        style={{
          border: `1px solid ${anachronisms.length > 0 ? "var(--warn)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          ANACHRONISMEN ({anachronisms.length})
        </div>
        {anachronisms.length === 0 ? (
          <div data-testid="etymology-no-anachronisms" style={{ color: "var(--success)" }}>
            ✓ Keine Anachronismen gefunden
          </div>
        ) : (
          anachronisms.map((a, i) => (
            <div key={i} data-testid={`etymology-anachronism-${i}`} style={{ marginBottom: 6 }}>
              <div style={{ color: "var(--warn)", fontWeight: 700 }}>
                "{a.word}" (erstmals belegt: {a.firstAttested})
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Vorschlag: {suggestSynonym(a.word)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bericht */}
      <details data-testid="etymology-report">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Bericht
        </summary>
        <pre
          data-testid="etymology-report-text"
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
          {formatAnachronismReport(anachronisms, epoch)}
        </pre>
      </details>
    </div>
  );
}
