// WritersRoomPanel: Multi-Agent Writer's Room (WP 7.1) — UI.
//
// Zeigt die vier Agenten-Personas (Dramaturg, Psychologe, Worldbuilder,
// Teufelsadvokat) als Karten mit Name, Rolle und Icon. Der Kontext wird über
// `buildPersonaPrompt` je Persona zu einem vollständigen Prompt zusammengesetzt.
//
// Rein präsentational + lokal, kein LLM-Aufruf, deterministisch.
// Dark Theme: bg #0a0e14, panel #11161f, border #232b3a,
// amber #ffb000, cyan #00e5ff, text #d5dbe5, dim #8a93a6.

import { useMemo, useState } from "react";
import {
  buildPersonaPrompt,
  getWriterPersonas,
} from "@/services/dialogue/writersRoom";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

export interface WritersRoomPanelProps {
  /** Kontext (Kapitelauszug, Idee, Szene), der allen Personas vorgelegt wird. */
  context?: string;
  className?: string;
}

export function WritersRoomPanel({ context = "", className }: WritersRoomPanelProps) {
  const personas = useMemo(() => getWriterPersonas(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const prompts = useMemo(
    () => personas.map((p) => ({ id: p.id, prompt: buildPersonaPrompt(p, context) })),
    [personas, context],
  );

  const promptById = useMemo(() => {
    const map = new Map<string, string>();
    for (const { id, prompt } of prompts) map.set(id, prompt);
    return map;
  }, [prompts]);

  const hasContext = context.trim().length > 0;

  return (
    <div
      className={className ?? "writers-room-panel"}
      data-testid="writers-room-panel"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        padding: 16,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
      }}
    >
      <h3
        data-testid="writers-room-title"
        style={{ color: AMBER, margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}
      >
        🎬 Writer&apos;s Room
      </h3>
      <p
        data-testid="writers-room-subtitle"
        style={{ color: DIM, margin: "0 0 12px 0", fontSize: 12 }}
      >
        Vier Agenten-Perspektiven auf denselben Kontext.
      </p>

      {!hasContext && (
        <p
          data-testid="writers-room-context-empty"
          style={{ color: DIM, fontSize: 12, margin: "0 0 12px 0" }}
        >
          Kein Kontext angegeben — die Prompts nutzen den Platzhalter
          „(Kein Kontext angegeben)“.
        </p>
      )}

      <div
        data-testid="writers-room-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {personas.map((persona) => {
          const selected = selectedId === persona.id;
          const prompt = promptById.get(persona.id) ?? "";
          return (
            <div
              key={persona.id}
              data-testid={`writers-room-card-${persona.id}`}
              data-selected={selected ? "true" : "false"}
              style={{
                background: PANEL,
                border: `1px solid ${selected ? AMBER : BORDER}`,
                borderRadius: 4,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  data-testid={`writers-room-icon-${persona.id}`}
                  aria-hidden="true"
                  style={{ fontSize: 20, lineHeight: 1 }}
                >
                  {persona.icon}
                </span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    data-testid={`writers-room-name-${persona.id}`}
                    style={{ color: CYAN, fontSize: 14, fontWeight: 700 }}
                  >
                    {persona.name}
                  </span>
                  <span
                    data-testid={`writers-room-role-${persona.id}`}
                    style={{ color: DIM, fontSize: 11 }}
                  >
                    {persona.role}
                  </span>
                </div>
              </div>

              <button
                type="button"
                data-testid={`writers-room-select-${persona.id}`}
                aria-pressed={selected}
                onClick={() => setSelectedId(selected ? null : persona.id)}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  color: selected ? AMBER : DIM,
                  border: `1px solid ${selected ? AMBER : BORDER}`,
                  borderRadius: 3,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {selected ? "Ausgewählt" : "Auswählen"}
              </button>

              <details>
                <summary
                  data-testid={`writers-room-prompt-toggle-${persona.id}`}
                  style={{ color: DIM, fontSize: 11, cursor: "pointer" }}
                >
                  Prompt anzeigen
                </summary>
                <pre
                  data-testid={`writers-room-prompt-${persona.id}`}
                  style={{
                    color: TEXT,
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    margin: "6px 0 0 0",
                    padding: 8,
                    background: BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 3,
                  }}
                >
                  {prompt}
                </pre>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WritersRoomPanel;
