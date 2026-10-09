// PsychologicalGaslightingWeaverModal (Meilenstein 63.0 / v7.5.0)
//
// UI für den Gaslighting- & Manipulations-Weaver: vier Taktiken,
// Subtext-Dialog-Generator und Manipulations-Verlauf. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  MANIPULATION_TACTICS,
  weaveManipulativeDialogue,
  buildManipulationArc,
} from "@/services/ai/psychologicalGaslightingWeaver";

export interface PsychologicalGaslightingWeaverModalProps {
  className?: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

export function PsychologicalGaslightingWeaverModal({
  className,
}: PsychologicalGaslightingWeaverModalProps) {
  const [seed, setSeed] = useState(42);
  const [manipulatorName, setManipulatorName] = useState("Der Hausherr");
  const [victimName, setVictimName] = useState("Marlene");
  const [tacticId, setTacticId] = useState(MANIPULATION_TACTICS[0].id);
  const [sceneCount, setSceneCount] = useState(6);

  const dialogue = useMemo(
    () => weaveManipulativeDialogue({ tacticId, manipulatorName, victimName }, seed),
    [tacticId, manipulatorName, victimName, seed],
  );

  const arc = useMemo(() => buildManipulationArc({ tacticId, sceneCount }, seed), [tacticId, sceneCount, seed]);

  return (
    <div
      data-testid="gaslighting-modal"
      className={className}
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>🕯️ Gaslighting- &amp; Manipulations-Weaver</h2>

      <section style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>
          Seed{" "}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Manipulator{" "}
          <input
            type="text"
            value={manipulatorName}
            onChange={(e) => setManipulatorName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Opfer{" "}
          <input
            type="text"
            value={victimName}
            onChange={(e) => setVictimName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ marginRight: 12 }}>
          Taktik{" "}
          <select value={tacticId} onChange={(e) => setTacticId(e.target.value)} style={inputStyle}>
            {MANIPULATION_TACTICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Szenen{" "}
          <input
            type="number"
            value={sceneCount}
            onChange={(e) => setSceneCount(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>TAKTIKEN</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {MANIPULATION_TACTICS.map((t) => (
            <li key={t.id} style={{ border: "1px solid var(--border)", padding: 8, marginBottom: 6 }}>
              <strong>{t.name}</strong>
              <div style={{ color: "var(--muted)" }}>{t.description}</div>
              <div style={{ color: "var(--muted)" }}>Ziel: {t.targetEffect}</div>
              <div style={{ color: "var(--muted)" }}>Warnzeichen: {t.warningSign}</div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>SUBTEXT-DIALOG</h3>
        <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
          {dialogue.tactic} · Eskalation {dialogue.escalationLevel}/10
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {dialogue.exchanges.map((x, i) => (
            <li key={i} style={{ border: "1px solid var(--border)", padding: 6, marginBottom: 4 }}>
              <strong>{x.speaker}:</strong> {x.line}
              <div style={{ color: "var(--muted)" }}>Subtext: {x.subtext}</div>
            </li>
          ))}
        </ul>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{dialogue.subtextSummary}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>MANIPULATIONS-VERLAUF</h3>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {arc.scenes.map((s) => (
              <tr key={s.sceneNumber}>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>Szene {s.sceneNumber}</td>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                  Opfer-Selbstvertrauen {s.victimConfidence}
                </td>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                  Kontrolle {s.manipulatorControl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "6px 0 0" }}>Bruchpunkt: Szene {arc.breakingPoint}</p>
        <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{arc.recoverySuggestion}</p>
      </section>
    </div>
  );
}
