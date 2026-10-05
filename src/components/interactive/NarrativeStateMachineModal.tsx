// NarrativeStateMachineModal (WP 68.2)
//
// Zustandsautomat & Inventar-Graph mit Sackgassen-Prüfer und Enden-Matrix.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  auditStoryGraph,
  buildEndingMatrix,
  simulatePath,
  type StoryGraph,
} from "@/services/interactive/narrativeStateMachine";

export interface NarrativeStateMachineModalProps {
  initialGraph?: StoryGraph;
  className?: string;
}

const SAMPLE_GRAPH: StoryGraph = {
  start: "start",
  initialFlags: { mut: 50, skrupel: 50 },
  nodes: [
    {
      id: "start",
      title: "Der Anfang",
      isEnding: false,
      endingConditions: [],
      transitions: [
        { label: "Kämpfen", target: "kampf", conditions: [], modifiers: { mut: 10 } },
        { label: "Fliehen", target: "flucht", conditions: [], modifiers: { skrupel: 10 } },
      ],
    },
    {
      id: "kampf",
      title: "Der Kampf",
      isEnding: false,
      endingConditions: [],
      transitions: [
        {
          label: "Sieg",
          target: "helden-ende",
          conditions: [{ key: "mut", operator: "gte", value: 60 }],
          modifiers: {},
          setsFlag: "hat_gesiegt",
        },
        { label: "Rückzug", target: "flucht", conditions: [], modifiers: {} },
      ],
    },
    {
      id: "flucht",
      title: "Die Flucht",
      isEnding: false,
      endingConditions: [],
      transitions: [{ label: "Weiter", target: "trauriges-ende", conditions: [], modifiers: {} }],
    },
    {
      id: "helden-ende",
      title: "Das Heldenende",
      isEnding: true,
      endingKind: "gutes-ende",
      endingConditions: [{ key: "hat_gesiegt", operator: "has" }],
      transitions: [],
    },
    {
      id: "trauriges-ende",
      title: "Das traurige Ende",
      isEnding: true,
      endingKind: "tragisches-ende",
      endingConditions: [],
      transitions: [],
    },
  ],
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

export function NarrativeStateMachineModal({
  initialGraph = SAMPLE_GRAPH,
  className,
}: NarrativeStateMachineModalProps) {
  const [graphJson, setGraphJson] = useState(() => JSON.stringify(initialGraph, null, 2));
  const [pathInput, setPathInput] = useState("Kämpfen, Sieg");

  const graph = useMemo<StoryGraph | null>(() => {
    try {
      const parsed = JSON.parse(graphJson);
      return parsed && typeof parsed === "object" ? (parsed as StoryGraph) : null;
    } catch {
      return null;
    }
  }, [graphJson]);

  const audit = useMemo(() => auditStoryGraph(graph), [graph]);
  const endings = useMemo(() => buildEndingMatrix(graph), [graph]);

  const pathLabels = useMemo(
    () => pathInput.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
    [pathInput],
  );

  const simulation = useMemo(() => simulatePath(graph, pathLabels), [graph, pathLabels]);

  return (
    <div
      className={className}
      data-testid="narrative-state-machine-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🕸️ Narrative State Machine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {graph?.nodes.length ?? 0} Knoten · {endings.length} Enden
      </div>

      {/* Graph-JSON */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Zustandsgraph (JSON)
        <textarea
          data-testid="nsm-graph-input"
          value={graphJson}
          onChange={(e) => setGraphJson(e.target.value)}
          rows={8}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 10 }}
        />
      </label>

      {/* Sackgassen-Prüfer */}
      <div
        data-testid="nsm-audit"
        style={{
          border: `1px solid ${audit.valid ? "var(--success)" : "var(--error)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          SACKGASSEN- & LOGIK-PRÜFER
        </div>
        <div
          data-testid="nsm-valid"
          style={{ fontWeight: 700, color: audit.valid ? "var(--success)" : "var(--error)" }}
        >
          {audit.valid ? "✓ Graph logisch konsistent" : "✗ Logikfehler gefunden"}
        </div>
        {audit.unreachableEndings.length > 0 && (
          <div data-testid="nsm-unreachable-endings" style={{ marginTop: 4, color: "var(--error)" }}>
            Unerreichbare Enden: {audit.unreachableEndings.join(", ")}
          </div>
        )}
        {audit.deadEnds.length > 0 && (
          <div data-testid="nsm-dead-ends" style={{ marginTop: 4, color: "var(--error)" }}>
            Sackgassen: {audit.deadEnds.join(", ")}
          </div>
        )}
        {audit.brokenTargets.length > 0 && (
          <div data-testid="nsm-broken-targets" style={{ marginTop: 4, color: "var(--error)" }}>
            Kaputte Ziele: {audit.brokenTargets.join(", ")}
          </div>
        )}
        {audit.orphanNodes.length > 0 && (
          <div data-testid="nsm-orphans" style={{ marginTop: 4, color: "var(--warn)" }}>
            Nicht erreichbar: {audit.orphanNodes.join(", ")}
          </div>
        )}
      </div>

      {/* Enden-Matrix */}
      <div
        data-testid="nsm-endings"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>ENDEN-MATRIX</div>
        {endings.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>(keine Enden definiert)</div>
        ) : (
          endings.map((e) => (
            <div
              key={e.nodeId}
              data-testid={`nsm-ending-${e.nodeId}`}
              style={{
                borderLeft: `3px solid ${e.reachable ? "var(--success)" : "var(--error)"}`,
                paddingLeft: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ fontWeight: 700, color: e.reachable ? "var(--success)" : "var(--error)" }}>
                {e.reachable ? "✓" : "✗"} {e.title}{" "}
                <span style={{ fontWeight: 400, color: "var(--muted)" }}>({e.endingKind})</span>
              </div>
              {e.requirements.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  Bedingungen: {e.requirements.join(", ")}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pfad-Simulation */}
      <div
        data-testid="nsm-simulation"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>PFAD-SIMULATION</div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          Optionen (kommagetrennt)
          <input
            data-testid="nsm-path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div data-testid="nsm-visited" style={{ fontSize: 11 }}>
          Pfad: {simulation.visited.join(" → ") || "—"}
        </div>
        <div
          data-testid="nsm-simulation-status"
          style={{
            marginTop: 4,
            fontWeight: 700,
            color: simulation.completed ? "var(--success)" : "var(--warn)",
          }}
        >
          {simulation.completed ? "✓ Ende erreicht" : `⚠ ${simulation.failure ?? "abgebrochen"}`}
        </div>
        {Object.keys(simulation.finalValues).length > 0 && (
          <div data-testid="nsm-final-values" style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
            Endwerte: {Object.entries(simulation.finalValues).map(([k, v]) => `${k}=${v}`).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
