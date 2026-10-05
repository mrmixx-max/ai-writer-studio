// PovRetellerModal (WP 61.1)
//
// Erzählt eine Szene aus der Perspektive einer anderen Figur neu — mit
// archetyp-spezifischem Wahrnehmungsfilter, Fehldeutung und Sinnesfokus.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  retellFromPov,
  buildPerceptionProfile,
  comparePerceptions,
  ARCHETYPE_LABELS,
  type ObserverArchetype,
} from "@/services/ai/povReteller";

export interface PovRetellerModalProps {
  /** Vorbefüllte Szene. */
  initialScene?: string;
  className?: string;
}

const SAMPLE_SCENE =
  "Lady Isolde trat vor und sagte kein Wort. Ihre Hand lag auf dem Tisch, und sie sah zweimal zur Tür.";

const ARCHETYPES: { value: ObserverArchetype; label: string }[] = [
  { value: "warrior", label: "Krieger" },
  { value: "diplomat", label: "Diplomatin" },
  { value: "scholar", label: "Gelehrter" },
  { value: "thief", label: "Diebin" },
  { value: "healer", label: "Heilerin" },
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

export function PovRetellerModal({
  initialScene = SAMPLE_SCENE,
  className,
}: PovRetellerModalProps) {
  const [scene, setScene] = useState(initialScene);
  const [observer, setObserver] = useState("Raven");
  const [subject, setSubject] = useState("Lady Isolde");
  const [archetype, setArchetype] = useState<ObserverArchetype>("warrior");
  const [compareArchetype, setCompareArchetype] = useState<ObserverArchetype>("diplomat");

  const retold = useMemo(
    () => retellFromPov({ observer, archetype, subject, scene }),
    [observer, archetype, subject, scene],
  );

  const otherProfile = useMemo(
    () => buildPerceptionProfile(subject, compareArchetype),
    [subject, compareArchetype],
  );

  const comparison = useMemo(
    () => comparePerceptions(retold.profile, otherProfile),
    [retold.profile, otherProfile],
  );

  return (
    <div
      className={className}
      data-testid="pov-reteller-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        👁️ POV-Perspektiven-Wechsler
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {observer} ({retold.profile.archetypeLabel}) beobachtet {subject}
      </div>

      {/* Archetyp */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          WAHRNEHMUNGS-FILTER
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ARCHETYPES.map((a) => (
            <button
              key={a.value}
              data-testid={`pov-archetype-${a.value}`}
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

      {/* Figuren */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Beobachter
          <input
            data-testid="pov-observer-input"
            type="text"
            value={observer}
            onChange={(e) => setObserver(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Beobachtete Figur
          <input
            data-testid="pov-subject-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Szene */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Originalszene
        <textarea
          data-testid="pov-scene-input"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Wahrnehmungsprofil */}
      <div
        data-testid="pov-profile"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          WAHRNEHMUNGSPROFIL ({retold.profile.archetypeLabel.toUpperCase()})
        </div>
        <div data-testid="pov-focus" style={{ marginBottom: 4 }}>
          Achtet zuerst auf: {retold.profile.focus[0]}
        </div>
        <div data-testid="pov-senses">
          Sinnes-Priorität: {retold.profile.sensePriority.join(" → ")}
        </div>
      </div>

      {/* Neuerzählung */}
      <div data-testid="pov-output" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          NEUERZÄHLUNG ({retold.sections.length} Abschnitte)
        </div>
        {retold.sections.map((s, i) => (
          <div
            key={i}
            data-testid={`pov-section-${s.kind}`}
            style={{
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${s.kind === "misreading" ? "var(--warn)" : "var(--accent)"}`,
              borderRadius: 4,
              padding: 10,
              marginBottom: 6,
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
              {s.kind === "observation"
                ? "BEOBACHTUNG"
                : s.kind === "misreading"
                  ? "FEHLDEUTUNG"
                  : "INNERER KOMMENTAR"}
            </div>
            {s.text}
          </div>
        ))}
      </div>

      {/* Vergleich */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          WAHRNEHMUNGSVERGLEICH
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {ARCHETYPES.map((a) => (
            <button
              key={a.value}
              data-testid={`pov-compare-${a.value}`}
              onClick={() => setCompareArchetype(a.value)}
              aria-pressed={compareArchetype === a.value}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 10,
                cursor: "pointer",
                background: "var(--panel)",
                color: compareArchetype === a.value ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${compareArchetype === a.value ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div
          data-testid="pov-comparison"
          style={{ fontSize: 11, color: "var(--muted)" }}
        >
          <div>
            {comparison.a.character} ({ARCHETYPE_LABELS[comparison.a.archetype]}) vs.{" "}
            {comparison.b.character} ({ARCHETYPE_LABELS[comparison.b.archetype]})
          </div>
          <div style={{ marginTop: 4 }}>
            Gemeinsame Foki: <strong data-testid="pov-shared-focus">{comparison.sharedFocus.length}</strong>
          </div>
          <div
            data-testid="pov-divergence"
            style={{ marginTop: 6, color: "var(--accent)", fontWeight: 700 }}
          >
            Wahrnehmungs-Divergenz: {Math.round(comparison.divergence * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
