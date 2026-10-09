// MoralCorruptionLedgerModal (Meilenstein 63.0 / v7.5.0)
//
// UI für das 7-Stufen-Hauptbuch des moralischen Verfalls: Stufenkatalog,
// Abstiegskurve und Point-of-No-Return-Erkennung. Nur Design-Tokens.

import { useMemo, useState } from "react";
import {
  CORRUPTION_STAGES,
  buildCorruptionCurve,
  detectPointOfNoReturn,
} from "@/services/dramaturgy/moralCorruptionLedger";

export interface MoralCorruptionLedgerModalProps {
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

export function MoralCorruptionLedgerModal({ className }: MoralCorruptionLedgerModalProps) {
  const [seed, setSeed] = useState(42);
  const [characterName, setCharacterName] = useState("Walter Weiß");
  const [chapters, setChapters] = useState(35);

  const curve = useMemo(
    () => buildCorruptionCurve({ characterName, chapters }, seed),
    [characterName, chapters, seed],
  );

  const pointOfNoReturn = useMemo(() => detectPointOfNoReturn(curve, seed), [curve, seed]);

  return (
    <div
      data-testid="moral-corruption-modal"
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
      <h2 style={{ margin: "0 0 12px" }}>📉 7-Stufen-Hauptbuch des moralischen Verfalls</h2>

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
          Figur{" "}
          <input
            type="text"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          Kapitel{" "}
          <input
            type="number"
            value={chapters}
            onChange={(e) => setChapters(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>DIE 7 STUFEN</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {CORRUPTION_STAGES.map((s) => (
            <li key={s.id} style={{ marginBottom: 6 }}>
              <strong>
                {s.stage}. {s.name}
              </strong>
              <div style={{ color: "var(--muted)" }}>{s.description}</div>
              <div style={{ color: "var(--muted)" }}>Beispiel: {s.example}</div>
              <div style={{ color: "var(--muted)" }}>Kennzeichen: {s.psychologicalMarker}</div>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>ABSTIEGSKURVE</h3>
        <p style={{ margin: "0 0 6px" }}>
          {curve.characterName} — Menschlichkeit am Ende: {curve.humanityAtEnd}
        </p>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {curve.stages.map((s) => (
              <tr key={s.stage}>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>{s.stage}</td>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>{s.stageName}</td>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>Kap. {s.chapter}</td>
                <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                  Menschlichkeit {s.humanityLevel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{curve.curveDescription}</p>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", color: "var(--accent)" }}>POINT OF NO RETURN</h3>
        <p style={{ margin: "0 0 6px" }}>
          Stufe {pointOfNoReturn.stage} · Kapitel {pointOfNoReturn.chapter} ·{" "}
          {pointOfNoReturn.irreversible ? "unumkehrbar" : "noch umkehrbar"}
        </p>
        <p style={{ margin: "0 0 6px" }}>{pointOfNoReturn.rationale}</p>
        <p style={{ margin: 0, color: "var(--muted)" }}>{pointOfNoReturn.sceneSuggestion}</p>
      </section>
    </div>
  );
}
