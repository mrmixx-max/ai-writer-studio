// ProseExpanderModal (WP 54.1): Beat-zu-Prosa-Expander („Show, Don't Tell")
//
// Wandelt Stichpunkte in ausformulierte Szenenprosa um, zeigt Pacing-Regler,
// Kennzahlen und verbleibende Tell-Stellen.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  expandBeats,
  analyzeTelling,
  type Pacing,
} from "@/services/ai/proseExpander";

export interface ProseExpanderModalProps {
  /** Optionale Start-Beats (eine Zeile je Beat). */
  initialBeats?: string;
  className?: string;
}

const PACING_OPTIONS: { value: Pacing; label: string }[] = [
  { value: "atmospheric", label: "Atmosphärisch (Zeitlupe)" },
  { value: "balanced", label: "Ausgewogen" },
  { value: "staccato", label: "Stakkato (Action)" },
];

export function ProseExpanderModal({
  initialBeats = "",
  className,
}: ProseExpanderModalProps) {
  const [beatsText, setBeatsText] = useState(initialBeats);
  const [pacing, setPacing] = useState<Pacing>("balanced");

  const beats = useMemo(
    () =>
      beatsText
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter((l) => l.length > 0),
    [beatsText],
  );

  const result = useMemo(() => expandBeats(beats, { pacing }), [beats, pacing]);
  const telling = useMemo(() => analyzeTelling(result.text), [result.text]);

  return (
    <div
      className={className}
      data-testid="prose-expander-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ✍️ Beat-zu-Prosa-Expander
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Aus Stichpunkten wird ausformulierte Szene — mit „Show, Don&apos;t Tell“.
      </div>

      {/* Beat-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
        Handlungsstriche (eine Zeile je Beat)
        <textarea
          data-testid="prose-beats-input"
          value={beatsText}
          onChange={(e) => setBeatsText(e.target.value)}
          rows={5}
          placeholder={"Miller betritt den Saloon\nEr trinkt Whisky\nSchießerei bricht aus"}
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

      {/* Pacing-Regler */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", margin: "10px 0" }}>
        Pacing
        <select
          data-testid="prose-pacing-select"
          value={pacing}
          onChange={(e) => setPacing(e.target.value as Pacing)}
          style={{
            marginLeft: 8,
            padding: "2px 6px",
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 3,
          }}
        >
          {PACING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {/* Kennzahlen */}
      <div
        data-testid="prose-stats"
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 11,
          padding: "8px 0",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          marginBottom: 12,
        }}
      >
        <span>
          Beats: <strong data-testid="prose-beat-count">{result.beatCount}</strong>
        </span>
        <span>
          Wörter: <strong data-testid="prose-word-count">{result.wordCount}</strong>
        </span>
        <span>
          Sinnesanker: <strong data-testid="prose-sensory-count">{result.sensoryAnchors}</strong>
        </span>
        <span>
          Tell→Show: <strong data-testid="prose-shown-count">{result.shownCount}</strong>
        </span>
      </div>

      {beats.length === 0 && (
        <div data-testid="prose-empty" style={{ color: "var(--muted)", fontSize: 12 }}>
          Noch keine Beats eingegeben.
        </div>
      )}

      {/* Ergebnis */}
      {result.paragraphs.length > 0 && (
        <div data-testid="prose-output" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            ERZEUGTE PROSA ({result.paragraphs.length} Absätze)
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            {result.paragraphs.map((p, i) => (
              <p
                key={i}
                data-testid={`prose-paragraph-${i + 1}`}
                style={{ margin: "0 0 10px" }}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tell-Analyse */}
      {result.text.length > 0 && (
        <div
          data-testid="prose-telling-analysis"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
            TELL-KONTROLLE
          </div>
          <div>
            Verbleibende Tell-Stellen:{" "}
            <strong
              data-testid="prose-tell-count"
              style={{ color: telling.tellCount > 0 ? "var(--warn)" : "var(--success)" }}
            >
              {telling.tellCount}
            </strong>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            {telling.tellCount === 0
              ? "Vollständig gezeigt — kein abstraktes Gefühl im Text."
              : `Noch abstrakt benannt: ${telling.tells.join(", ")}`}
          </div>
        </div>
      )}
    </div>
  );
}
