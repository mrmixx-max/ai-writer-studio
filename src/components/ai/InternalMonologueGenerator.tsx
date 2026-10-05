// InternalMonologueGenerator (WP 57.1)
//
// Erzeugt erlebte Rede (Deep POV) in drei psychologischen Zuständen, mit
// POV-Tiefenanalyse und Deep-POV-Bereinigung distanzierender Marker.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateInternalMonologue,
  analyzeMonologueDepth,
  stripThoughtTags,
  STATE_LABELS,
  type MentalState,
} from "@/services/ai/internalMonologueGenerator";

export interface InternalMonologueGeneratorProps {
  /** Vorbefüllte Situation. */
  initialSituation?: string;
  className?: string;
}

const STATES: { value: MentalState; label: string }[] = [
  { value: "panic", label: "Rasende Panik" },
  { value: "calculation", label: "Kühle Berechnung" },
  { value: "grief", label: "Trauer & Betäubung" },
];

const SAMPLE_SHALLOW =
  "Er dachte, dass es zu spät war, und er fragte sich, ob es einen Ausweg gab.";

export function InternalMonologueGenerator({
  initialSituation = "",
  className,
}: InternalMonologueGeneratorProps) {
  const [state, setState] = useState<MentalState>("panic");
  const [situation, setSituation] = useState(initialSituation);
  const [fragments, setFragments] = useState(8);
  const [freeIndirect, setFreeIndirect] = useState(true);
  const [shallowText, setShallowText] = useState(SAMPLE_SHALLOW);

  const monologue = useMemo(
    () => generateInternalMonologue(state, { situation, fragments, freeIndirect }),
    [state, situation, fragments, freeIndirect],
  );
  const depth = useMemo(() => analyzeMonologueDepth(monologue.text), [monologue.text]);

  const cleaned = useMemo(() => stripThoughtTags(shallowText), [shallowText]);
  const shallowDepth = useMemo(() => analyzeMonologueDepth(shallowText), [shallowText]);
  const cleanedDepth = useMemo(() => analyzeMonologueDepth(cleaned.text), [cleaned.text]);

  return (
    <div
      className={className}
      data-testid="internal-monologue-generator"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🧠 Deep POV & Innerer Monolog
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Erlebte Rede — Gedankenstrom ohne distanziertes „dachte er bei sich“.
      </div>

      {/* Zustand */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          PSYCHOLOGISCHER ZUSTAND
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATES.map((s) => (
            <button
              key={s.value}
              data-testid={`monologue-state-${s.value}`}
              onClick={() => setState(s.value)}
              aria-pressed={state === s.value}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: state === s.value ? "var(--accent)" : "var(--panel)",
                color: state === s.value ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Situation + Regler */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 6 }}>
        Situation (optional)
        <input
          data-testid="monologue-situation-input"
          type="text"
          value={situation}
          placeholder="im brennenden Haus"
          onChange={(e) => setSituation(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 12,
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          Fragmente
          <input
            data-testid="monologue-fragments-input"
            type="number"
            min={3}
            max={14}
            value={fragments}
            onChange={(e) => setFragments(Number(e.target.value) || 7)}
            style={{
              width: 55,
              marginLeft: 6,
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 5px",
              fontSize: 11,
            }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>
          <input
            data-testid="monologue-freeindirect-toggle"
            type="checkbox"
            checked={freeIndirect}
            onChange={(e) => setFreeIndirect(e.target.checked)}
            style={{ marginRight: 5 }}
          />
          Erlebte Rede
        </label>
      </div>

      {/* Monolog */}
      <div data-testid="monologue-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          GEDANKENSTROM ({STATE_LABELS[state]})
        </div>
        <div
          data-testid="monologue-output-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {monologue.text || "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          {monologue.fragmentCount} Fragmente · Ø {monologue.avgFragmentLength} Wörter
        </div>
      </div>

      {/* POV-Tiefe */}
      <div
        data-testid="monologue-depth"
        style={{
          border: `1px solid ${depth.depth > 0.7 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>POV-TIEFE</div>
        <div
          data-testid="monologue-depth-value"
          style={{
            color: depth.depth > 0.7 ? "var(--success)" : "var(--warn)",
            fontWeight: 700,
          }}
        >
          {Math.round(depth.depth * 100)}% Tiefe
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Distanzierende Marker:{" "}
          <span data-testid="monologue-markers">{depth.distancingMarkers.length}</span> · Sensorik:{" "}
          <span data-testid="monologue-sensory">{depth.sensoryHits}</span>
        </div>
      </div>

      {/* Deep-POV-Bereinigung */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DEEP-POV-BEREINIGUNG
        </div>
        <textarea
          data-testid="monologue-clean-input"
          value={shallowText}
          onChange={(e) => setShallowText(e.target.value)}
          rows={3}
          style={{
            display: "block",
            width: "100%",
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
        <div
          data-testid="monologue-cleaned"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            marginTop: 8,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {cleaned.text || "—"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
          Entfernt: <span data-testid="monologue-removed">{cleaned.removed}</span> Marker · Tiefe{" "}
          <span data-testid="monologue-depth-before">{Math.round(shallowDepth.depth * 100)}%</span> →{" "}
          <span data-testid="monologue-depth-after" style={{ color: "var(--success)" }}>
            {Math.round(cleanedDepth.depth * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
