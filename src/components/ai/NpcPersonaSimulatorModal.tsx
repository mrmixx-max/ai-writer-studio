// NpcPersonaSimulatorModal (WP 69.1)
//
// Live-Verhör einer Figur mit psychologischen Schutzschilden und
// Spielleiter-Dossier-Export.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  startInterrogation,
  applyMove,
  buildGameMasterDossier,
  type NpcPersona,
  type InterrogationState,
  type InterrogationMove,
} from "@/services/ai/npcPersonaSimulator";

export interface NpcPersonaSimulatorModalProps {
  initialPersona?: NpcPersona;
  className?: string;
}

const SAMPLE_PERSONA: NpcPersona = {
  name: "Der Wirt",
  alignment: "neutral",
  motivation: "Er will seine Schänke und seinen Ruf schützen.",
  baseResistance: 40,
  secrets: [
    {
      id: "geheim-1",
      content: "Er hat den Brandstifter gesehen — es war der Bürgermeister.",
      pressureThreshold: 70,
      sympathyThreshold: 75,
      requiresEvidence: "brandbeschleuniger",
      emotionalLevers: ["tochter", "familie"],
    },
    {
      id: "geheim-2",
      content: "Er hat Schweigegeld genommen.",
      pressureThreshold: 90,
      sympathyThreshold: 95,
    },
  ],
  deflection: "Ich weiß von nichts. Wirklich nicht.",
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

const MOVE_KINDS: Array<{ kind: InterrogationMove["kind"]; label: string }> = [
  { kind: "question", label: "Frage" },
  { kind: "pressure", label: "Druck" },
  { kind: "empathy", label: "Empathie" },
  { kind: "evidence", label: "Beweis" },
];

export function NpcPersonaSimulatorModal({
  initialPersona = SAMPLE_PERSONA,
  className,
}: NpcPersonaSimulatorModalProps) {
  const [personaJson, setPersonaJson] = useState(() => JSON.stringify(initialPersona, null, 2));
  const [moveKind, setMoveKind] = useState<InterrogationMove["kind"]>("question");
  const [moveValue, setMoveValue] = useState("Was hast du gesehen?");
  const [state, setState] = useState<InterrogationState>(() => startInterrogation(initialPersona));
  const [log, setLog] = useState<string[]>([]);

  const persona = useMemo<NpcPersona | null>(() => {
    try {
      const parsed = JSON.parse(personaJson);
      return parsed && typeof parsed === "object" ? (parsed as NpcPersona) : null;
    } catch {
      return null;
    }
  }, [personaJson]);

  const dossier = useMemo(() => buildGameMasterDossier(persona), [persona]);

  const submit = () => {
    const move: InterrogationMove = { kind: moveKind, value: moveValue };
    const { state: next, response } = applyMove(persona, state, move);
    setState(next);
    const tag = response.kind === "confession" ? "!!" : response.kind === "partial" ? "~" : "·";
    setLog((prev) => [...prev, `[${tag}] ${moveKind}: ${moveValue} → ${response.text}`]);
  };

  const reset = () => {
    setState(startInterrogation(persona));
    setLog([]);
  };

  return (
    <div
      className={className}
      data-testid="npc-persona-simulator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🗣️ NPC-Verhör-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {dossier.name} · {dossier.alignment} · {state.revealed.length} von {dossier.secrets.length} Geheimnissen
      </div>

      {/* Zustands-Anzeige */}
      <div
        data-testid="npc-state"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>VERHÖR-ZUSTAND</div>
        <div style={{ marginBottom: 4 }}>
          Druck:{" "}
          <strong data-testid="npc-pressure">{state.pressure}</strong>/100
          <span
            style={{
              display: "inline-block",
              width: 120,
              height: 6,
              background: "var(--panel)",
              borderRadius: 3,
              marginLeft: 8,
              verticalAlign: "middle",
            }}
          >
            <span
              data-testid="npc-pressure-bar"
              style={{
                display: "block",
                width: `${state.pressure}%`,
                height: 6,
                background: "var(--error)",
                borderRadius: 3,
              }}
            />
          </span>
        </div>
        <div>
          Sympathie:{" "}
          <strong data-testid="npc-sympathy">{state.sympathy}</strong>/100
          <span
            style={{
              display: "inline-block",
              width: 120,
              height: 6,
              background: "var(--panel)",
              borderRadius: 3,
              marginLeft: 8,
              verticalAlign: "middle",
            }}
          >
            <span
              data-testid="npc-sympathy-bar"
              style={{
                display: "block",
                width: `${state.sympathy}%`,
                height: 6,
                background: "var(--success)",
                borderRadius: 3,
              }}
            />
          </span>
        </div>
        {state.evidence.length > 0 && (
          <div data-testid="npc-evidence" style={{ marginTop: 6, color: "var(--accent)" }}>
            Beweise: {state.evidence.join(", ")}
          </div>
        )}
      </div>

      {/* Zug-Steuerung */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {MOVE_KINDS.map((m) => (
            <button
              key={m.kind}
              data-testid={`npc-kind-${m.kind}`}
              onClick={() => setMoveKind(m.kind)}
              aria-pressed={moveKind === m.kind}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 4,
                cursor: "pointer",
                background: moveKind === m.kind ? "var(--accent)" : "var(--panel)",
                color: moveKind === m.kind ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          {moveKind === "evidence" ? "Beweis-ID" : moveKind === "empathy" ? "Emotionaler Hebel" : "Text"}
          <input
            data-testid="npc-move-input"
            value={moveValue}
            onChange={(e) => setMoveValue(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            data-testid="npc-submit"
            onClick={submit}
            style={{
              fontSize: 11,
              padding: "5px 16px",
              borderRadius: 4,
              cursor: "pointer",
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
            }}
          >
            Zug ausführen
          </button>
          <button
            data-testid="npc-reset"
            onClick={reset}
            style={{
              fontSize: 11,
              padding: "5px 16px",
              borderRadius: 4,
              cursor: "pointer",
              background: "var(--panel)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            ↺ Neu
          </button>
        </div>
      </div>

      {/* Protokoll */}
      <div
        data-testid="npc-log"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>PROTOKOLL</div>
        {log.length === 0 ? (
          <div data-testid="npc-log-empty" style={{ color: "var(--muted)" }}>
            Noch keine Züge.
          </div>
        ) : (
          log.map((entry, i) => (
            <div key={i} data-testid={`npc-log-${i}`} style={{ marginBottom: 4, lineHeight: 1.5 }}>
              {entry}
            </div>
          ))
        )}
      </div>

      {/* Persona-JSON */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Figur (JSON)
        <textarea
          data-testid="npc-persona-input"
          value={personaJson}
          onChange={(e) => setPersonaJson(e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 10 }}
        />
      </label>

      {/* Spielleiter-Dossier */}
      <details data-testid="npc-dossier" open>
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Spielleiter-Dossier
        </summary>
        <pre
          data-testid="npc-dossier-text"
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
          {dossier.formatted}
        </pre>
      </details>
    </div>
  );
}
