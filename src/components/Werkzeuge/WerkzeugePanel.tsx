// WerkzeugePanel: Bündelt alle Services aus Meilenstein 5–17 in einem
// Panel mit Unter-Tabs (Kategorien). Jedes Werkzeug ist ein reiner
// Text-zu-Text-Transformator — kein LLM, kein Netzwerk.
//
// Bloomberg-Terminal-Stil (Inline-Styles, keine neuen Dependencies).
import { useMemo, useState } from "react";
import {
  TOOLS,
  TOOL_CATEGORIES,
  toolsByCategory,
  type ToolDef,
} from "./toolAdapters";

const BG = "#0a0e14";
const PANEL = "#11161f";
const BORDER = "#232b3a";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";
const GREEN = "#00e676";
const RED = "#ff5252";

const SAMPLE = `Der Algorithmus implementierte eine komplexe Datenbank-Schnittstelle.
Es wurde beschlossen, dass die Middleware angepasst werden muss.

--- 

Anna: „Hallo, wie geht es dir?“
Bert: „Mir geht es bestens“, sagte er, während seine Hände zitterten.

[ambience: regensturm volume=40%]
[sfx: tuerschlag pan=-0.7]

KRAKK — die Tür flog auf.`;

export interface WerkzeugePanelProps {
  /** Optionaler Starttext (z. B. aus dem Editor). */
  initialText?: string;
  className?: string;
}

export function WerkzeugePanel({ initialText, className }: WerkzeugePanelProps) {
  const [category, setCategory] = useState<string>(TOOL_CATEGORIES[0]);
  const [activeToolId, setActiveToolId] = useState<string>(TOOLS[0].id);
  const [input, setInput] = useState<string>(initialText ?? SAMPLE);
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>("");

  const activeTool: ToolDef | undefined = useMemo(
    () => TOOLS.find((t) => t.id === activeToolId),
    [activeToolId],
  );

  const visibleTools = useMemo(() => toolsByCategory(category), [category]);

  const handleRun = async () => {
    if (!activeTool) return;
    setRunning(true);
    setError("");
    setOutput("");
    try {
      const result = await activeTool.run(input);
      setOutput(typeof result === "string" ? result : String(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className={className}
      data-testid="werkzeuge-panel"
      style={{ background: BG, color: TEXT, padding: 16, minHeight: "100%", fontFamily: "system-ui, sans-serif" }}
    >
      {/* Kopf */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: AMBER, letterSpacing: 1 }}>
          🧰 WERKZEUGE
        </h2>
        <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
          {TOOLS.length} Werkzeuge aus Meilenstein 5–17 · lokal & deterministisch
        </div>
      </div>

      {/* Kategorie-Tabs */}
      <div
        data-testid="werkzeuge-tabs"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
          borderBottom: `1px solid ${BORDER}`,
          paddingBottom: 8,
        }}
      >
        {TOOL_CATEGORIES.map((cat) => {
          const isActive = cat === category;
          return (
            <button
              key={cat}
              data-testid={`werkzeuge-tab-${cat}`}
              onClick={() => {
                setCategory(cat);
                const first = toolsByCategory(cat)[0];
                if (first) setActiveToolId(first.id);
              }}
              style={{
                background: isActive ? PANEL : "transparent",
                color: isActive ? AMBER : DIM,
                border: `1px solid ${isActive ? AMBER : BORDER}`,
                borderRadius: 3,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Werkzeug-Liste */}
        <div
          data-testid="werkzeuge-list"
          style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {visibleTools.map((tool) => {
            const isActive = tool.id === activeToolId;
            return (
              <button
                key={tool.id}
                data-testid={`werkzeug-${tool.id}`}
                onClick={() => setActiveToolId(tool.id)}
                style={{
                  textAlign: "left",
                  background: isActive ? PANEL : "transparent",
                  color: isActive ? CYAN : TEXT,
                  border: `1px solid ${isActive ? CYAN : BORDER}`,
                  borderRadius: 3,
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {tool.icon} {tool.label}
                </div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{tool.hint}</div>
                <div style={{ fontSize: 9, color: AMBER, marginTop: 2 }}>{tool.wp}</div>
              </button>
            );
          })}
        </div>

        {/* Arbeitsbereich */}
        <div style={{ flex: "1 1 420px", minWidth: 320 }}>
          {activeTool && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, color: CYAN, fontWeight: 600 }}>
                {activeTool.icon} {activeTool.label}
              </div>
              <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
                {activeTool.hint} · {activeTool.wp}
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: 10, color: DIM, marginBottom: 4 }}>
            EINGABETEXT (Kapitel mit --- trennen)
          </label>
          <textarea
            data-testid="werkzeuge-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 160,
              background: PANEL,
              color: TEXT,
              border: `1px solid ${BORDER}`,
              borderRadius: 3,
              padding: 8,
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
            <button
              data-testid="werkzeuge-run"
              onClick={handleRun}
              disabled={running}
              style={{
                background: running ? BORDER : AMBER,
                color: running ? DIM : BG,
                border: "none",
                borderRadius: 3,
                padding: "7px 18px",
                fontSize: 12,
                fontWeight: 700,
                cursor: running ? "wait" : "pointer",
              }}
            >
              {running ? "… läuft" : "▶ Ausführen"}
            </button>
            <button
              data-testid="werkzeuge-clear"
              onClick={() => {
                setOutput("");
                setError("");
              }}
              style={{
                background: "transparent",
                color: DIM,
                border: `1px solid ${BORDER}`,
                borderRadius: 3,
                padding: "7px 14px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Leeren
            </button>
          </div>

          {error && (
            <div
              data-testid="werkzeuge-error"
              style={{
                background: "#2a1113",
                border: `1px solid ${RED}`,
                color: RED,
                borderRadius: 3,
                padding: 10,
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              ✗ {error}
            </div>
          )}

          <label style={{ display: "block", fontSize: 10, color: DIM, marginBottom: 4 }}>
            ERGEBNIS
          </label>
          <pre
            data-testid="werkzeuge-output"
            style={{
              background: PANEL,
              color: output ? GREEN : DIM,
              border: `1px solid ${BORDER}`,
              borderRadius: 3,
              padding: 10,
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: 120,
              maxHeight: 460,
              overflow: "auto",
              margin: 0,
            }}
          >
            {output || "Noch kein Ergebnis — auf „Ausführen“ klicken."}
          </pre>
        </div>
      </div>
    </div>
  );
}
