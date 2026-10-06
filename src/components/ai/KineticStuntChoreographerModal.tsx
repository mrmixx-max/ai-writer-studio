// KineticStuntChoreographerModal (WP 75.1)
//
// Interaktiver Stunt- & Action-Physik-Choreograf.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateStuntMontage,
  formatStuntMontage,
  FRICTION_COEFFS,
  type KineticParams,
} from "@/services/ai/kineticStuntChoreographer";

export interface KineticStuntChoreographerModalProps {
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

export function KineticStuntChoreographerModal({ className }: KineticStuntChoreographerModalProps) {
  const [title, setTitle] = useState("Verfolgungsjagd auf dem Zugdach");
  const [speed, setSpeed] = useState(120);
  const [fallHeight, setFallHeight] = useState(15);
  const [mass, setMass] = useState(75);
  const [friction, setFriction] = useState(0.35);
  const [brakingDist, setBrakingDist] = useState(2);
  const [ruleOfCool, setRuleOfCool] = useState(70);

  const params: KineticParams = useMemo(
    () => ({
      speedKmh: speed,
      fallHeightM: fallHeight,
      massKg: mass,
      frictionCoeff: friction,
      recoilForceN: 500,
      brakingDistanceM: brakingDist,
    }),
    [speed, fallHeight, mass, friction, brakingDist],
  );

  const montage = useMemo(
    () => generateStuntMontage(title, params, ruleOfCool),
    [title, params, ruleOfCool],
  );

  return (
    <div
      className={className}
      data-testid="kinetic-stunt-choreographer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        💥 Kinetischer Stunt- & Action-Physik-Choreograf
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        E: {montage.result.kineticEnergyKj} kJ · Aufprall: {montage.result.impactForceKn} kN ·{" "}
        {montage.result.isSurvivable ? "Überlebbar" : "Tödlich"}
      </div>

      {/* Titel */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Titel
        <input
          data-testid="stunt-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Parameter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          km/h
          <input
            data-testid="stunt-speed-input"
            type="number"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Fallhöhe (m)
          <input
            data-testid="stunt-height-input"
            type="number"
            value={fallHeight}
            onChange={(e) => setFallHeight(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Masse (kg)
          <input
            data-testid="stunt-mass-input"
            type="number"
            value={mass}
            onChange={(e) => setMass(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Reibung
          <select
            data-testid="stunt-friction-select"
            value={friction}
            onChange={(e) => setFriction(Number(e.target.value))}
            style={inputStyle}
          >
            {Object.entries(FRICTION_COEFFS).map(([name, val]) => (
              <option key={name} value={val}>
                {name.replace("_", " ")} ({val})
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Bremsweg (m)
          <input
            data-testid="stunt-braking-input"
            type="number"
            value={brakingDist}
            onChange={(e) => setBrakingDist(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Rule of Cool (%)
          <input
            data-testid="stunt-cool-input"
            type="number"
            min={0}
            max={100}
            value={ruleOfCool}
            onChange={(e) => setRuleOfCool(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Ergebnis */}
      <div
        data-testid="stunt-result"
        style={{
          border: `1px solid ${montage.result.isSurvivable ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>ERGEBNIS</div>
        <div
          data-testid="stunt-survivable"
          style={{
            fontWeight: 700,
            color: montage.result.isSurvivable ? "var(--success)" : "var(--error)",
          }}
        >
          {montage.result.isSurvivable ? "✓ Überlebbar" : "✗ Tödlich"}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>{montage.result.description}</div>
      </div>

      {/* Prosa */}
      <div
        data-testid="stunt-prose"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PROSA</div>
        <div style={{ lineHeight: 1.6 }}>{montage.prose}</div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="stunt-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="stunt-text"
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
          {formatStuntMontage(montage)}
        </pre>
      </details>
    </div>
  );
}
