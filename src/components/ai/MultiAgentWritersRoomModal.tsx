// MultiAgentWritersRoomModal (WP 62.1)
//
// Vier KI-Personas debattieren ein Szenen-Problem; das Ergebnis ist ein
// abgestimmter Szenen-Vorschlag.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  runWritersRoom,
  getAllPersonas,
  analyzeConsensus,
  formatRoomProtocol,
  type PersonaId,
} from "@/services/ai/multiAgentWritersRoom";

export interface MultiAgentWritersRoomModalProps {
  /** Vorbefülltes Problem. */
  initialProblem?: string;
  className?: string;
}

const SAMPLE_PROBLEM = "Die Konfrontation im dritten Akt fühlt sich zu zahm an";

const CONCERN_COLORS: Record<string, string> = {
  pacing: "var(--accent)",
  dialogue: "var(--warn)",
  consistency: "var(--success)",
  emotion: "var(--error)",
};

export function MultiAgentWritersRoomModal({
  initialProblem = SAMPLE_PROBLEM,
  className,
}: MultiAgentWritersRoomModalProps) {
  const [problem, setProblem] = useState(initialProblem);
  const [selected, setSelected] = useState<PersonaId | null>(null);

  const session = useMemo(() => runWritersRoom(problem), [problem]);
  const consensus = useMemo(() => analyzeConsensus(session), [session]);
  const personas = useMemo(() => getAllPersonas(), []);
  const protocol = useMemo(() => formatRoomProtocol(session), [session]);

  const activePersona = selected ? personas.find((p) => p.id === selected) : null;

  return (
    <div
      className={className}
      data-testid="multi-agent-writers-room-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 Multi-Agent Writer&apos;s Room
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {session.statementCount} Agenten · Konsens {Math.round(session.consensusLevel * 100)}%
      </div>

      {/* Problem */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Szenen-Problem
        <textarea
          data-testid="room-problem-input"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={2}
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
            resize: "vertical",
          }}
        />
      </label>

      {/* Personas */}
      <div data-testid="room-personas" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          DIE VIER AGENTEN
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {personas.map((p) => (
            <button
              key={p.id}
              data-testid={`room-persona-${p.id}`}
              onClick={() => setSelected(selected === p.id ? null : p.id)}
              aria-pressed={selected === p.id}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: selected === p.id ? "var(--accent)" : "var(--panel)",
                color: selected === p.id ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persona-Detail */}
      {activePersona && (
        <div
          data-testid="room-persona-detail"
          style={{
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
            {activePersona.label}
          </div>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>{activePersona.role}</div>
          <div data-testid="room-persona-objection">
            Typischer Einwand: „{activePersona.typicalObjection}"
          </div>
        </div>
      )}

      {/* Protokoll */}
      <div data-testid="room-protocol" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          LIVE-PROTOKOLL
        </div>
        {session.protocol.map((s) => (
          <div
            key={s.persona}
            data-testid={`room-statement-${s.persona}`}
            style={{
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${CONCERN_COLORS[s.concern] ?? "var(--border)"}`,
              borderRadius: 4,
              padding: 10,
              marginBottom: 6,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 10, color: CONCERN_COLORS[s.concern], marginBottom: 3 }}>
              {s.personaLabel.toUpperCase()} · {s.concern}
            </div>
            {s.statement}
            <div
              data-testid={`room-agreement-${s.persona}`}
              style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}
            >
              Zustimmung: {Math.round(s.agreement * 100)}%
            </div>
          </div>
        ))}
      </div>

      {/* Konsens */}
      <div
        data-testid="room-consensus"
        style={{
          border: `1px solid ${consensus.reached ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KONSENS-SYNTHESE
        </div>
        <div data-testid="room-consensus-text">{session.consensus}</div>
        <div
          data-testid="room-consensus-verdict"
          style={{
            marginTop: 8,
            fontWeight: 700,
            color: consensus.reached ? "var(--success)" : "var(--warn)",
          }}
        >
          {consensus.recommendation}
        </div>
        {consensus.dissenters.length > 0 && (
          <div
            data-testid="room-dissenters"
            style={{ fontSize: 10, color: "var(--warn)", marginTop: 4 }}
          >
            Einwände von: {consensus.dissenters.join(", ")}
          </div>
        )}
      </div>

      <details data-testid="room-raw-protocol">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiges Protokoll
        </summary>
        <pre
          data-testid="room-raw-protocol-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {protocol}
        </pre>
      </details>
    </div>
  );
}
