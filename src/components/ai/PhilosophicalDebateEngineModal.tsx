// PhilosophicalDebateEngineModal (WP 74.1)
//
// Interaktive Darstellung philosophischer Debatten und moralischer Dilemmata.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateDebate,
  formatDebate,
} from "@/services/ai/philosophicalDebateEngine";

export interface PhilosophicalDebateEngineModalProps {
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

export function PhilosophicalDebateEngineModal({ className }: PhilosophicalDebateEngineModalProps) {
  const [topic, setTopic] = useState("Das Wohl vieler gegen das Leben eines Einzelnen");
  const [seed, setSeed] = useState(42);

  const debate = useMemo(() => generateDebate(topic, seed), [topic, seed]);

  return (
    <div
      className={className}
      data-testid="philosophical-debate-engine-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        ⚖️ Philosophische Dialektik & Moral-Dilemma-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {debate.participants.length} Positionen · {debate.arguments.length} Argumente · 1 Dilemma
      </div>

      {/* Thema-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Thema
        <input
          data-testid="debate-topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Seed */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Seed
        <input
          data-testid="debate-seed-input"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      {/* Positionen */}
      <div
        data-testid="debate-positions"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>POSITIONEN</div>
        {debate.participants.map((pos) => (
          <div key={pos.id} data-testid={`debate-position-${pos.id}`} style={{ marginBottom: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{pos.name}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{pos.description}</div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>
              Prinzipien: {pos.keyPrinciples.join(", ")}
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>
              Wunde: {pos.emotionalWound}
            </div>
          </div>
        ))}
      </div>

      {/* Argumente */}
      <div
        data-testid="debate-arguments"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ARGUMENTE</div>
        {debate.arguments.map((arg, i) => (
          <div key={i} data-testid={`debate-argument-${i}`} style={{ marginBottom: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>{arg.speaker}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{arg.claim}</div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>Begründung: {arg.reasoning}</div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>Einsatz: {arg.emotionalStake}</div>
          </div>
        ))}
      </div>

      {/* Dilemma */}
      <div
        data-testid="debate-dilemma"
        style={{
          border: "1px solid var(--warn)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>DILEMMA</div>
        <div style={{ color: "var(--warn)", fontWeight: 700 }}>{debate.dilemma.title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{debate.dilemma.description}</div>
        {debate.dilemma.options.map((opt) => (
          <div key={opt.id} data-testid={`debate-option-${opt.id}`} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: "var(--fg)" }}>
              [{opt.id}] {opt.label}
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>{opt.consequence}</div>
            <div style={{ fontSize: 9, color: "var(--muted)" }}>({opt.moralFramework})</div>
          </div>
        ))}
      </div>

      {/* Synthesis */}
      <div
        data-testid="debate-synthesis"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SYNTHESIS</div>
        <div style={{ color: "var(--accent)" }}>{debate.synthesis}</div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="debate-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Text-Ausgabe
        </summary>
        <pre
          data-testid="debate-text"
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
          {formatDebate(debate)}
        </pre>
      </details>
    </div>
  );
}
