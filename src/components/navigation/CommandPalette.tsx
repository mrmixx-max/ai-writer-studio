// CommandPalette (WP 40.2): Universelle Befehlspalette mit Strg+K / Cmd+K.
//
// Durchsucht alle Werkzeuge aus dem Werkzeuge-Panel per Fuzzy-Suche und
// führt sie direkt mit dem übergebenen Text aus. Rein lokal, kein LLM.
import { useEffect, useMemo, useRef, useState } from "react";
import { TOOLS, TOOL_CATEGORIES, type ToolDef } from "@/components/Werkzeuge/toolAdapters";

const BG = "#0d1117";
const PANEL = "#161b22";
const BORDER = "#30363d";
const AMBER = "#ffb000";
const CYAN = "#00e5ff";
const TEXT = "#d5dbe5";
const DIM = "#8a93a6";

/**
 * Fuzzy-Match: prüft, ob alle Zeichen des Query in der Reihenfolge
 * im Ziel vorkommen (case-insensitive). Liefert einen Score
 * (niedriger = besser) oder null bei keinem Treffer.
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Direkter Substring-Treffer wird stark bevorzugt
  const direct = t.indexOf(q);
  if (direct >= 0) return direct;

  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Abstand zwischen Treffern bestrafen
      if (lastMatch >= 0) score += ti - lastMatch - 1;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? 100 + score : null;
}

/** Durchsucht Werkzeuge nach Query, sortiert nach Score. */
export function searchTools(query: string, tools: ToolDef[] = TOOLS): ToolDef[] {
  if (!query.trim()) return tools;

  const scored: { tool: ToolDef; score: number }[] = [];
  for (const tool of tools) {
    const haystack = `${tool.label} ${tool.hint} ${tool.category} ${tool.wp} ${tool.id}`;
    const score = fuzzyScore(query, haystack);
    if (score !== null) scored.push({ tool, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.tool);
}

export interface CommandPaletteProps {
  /** Ist die Palette sichtbar? */
  open: boolean;
  /** Schließen (Escape, Klick außerhalb). */
  onClose: () => void;
  /** Text, mit dem das Werkzeug ausgeführt wird. */
  getText: () => string;
  /** Ergebnis-Callback (für Panel-Anzeige). */
  onResult?: (tool: ToolDef, result: string) => void;
}

export function CommandPalette({ open, onClose, getText, onResult }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchTools(query), [query]);

  // Fokus + Reset beim Öffnen
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Fokus verzögert, damit das DOM bereit ist (WP-Anforderung: Fokus
      // verzögerungsfrei zurückgeben bei Escape).
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Auswahl zurücksetzen, wenn sich Treffer ändern
  useEffect(() => {
    setSelected(0);
  }, [query]);

  const runTool = async (tool: ToolDef) => {
    setRunning(true);
    try {
      const result = await Promise.resolve(tool.run(getText()));
      onResult?.(tool, result);
      onClose();
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      void runTool(results[selected]);
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="command-palette-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 9999,
      }}
    >
      <div
        data-testid="command-palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          width: "min(640px, 92vw)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        <input
          ref={inputRef}
          data-testid="command-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Werkzeug suchen … (z. B. Reise, M4B, Drehbuch)"
          spellCheck={false}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${BORDER}`,
            color: TEXT,
            padding: "14px 16px",
            fontSize: 15,
            outline: "none",
          }}
        />

        <div style={{ fontSize: 10, color: DIM, padding: "6px 16px" }}>
          {results.length} Treffer von {TOOLS.length} Werkzeugen · ↑↓ wählen · Enter ausführen · Esc schließen
        </div>

        <div data-testid="command-palette-results" style={{ overflow: "auto", flex: 1 }}>
          {results.length === 0 && (
            <div style={{ padding: 16, color: DIM, fontSize: 13 }}>
              Kein Werkzeug gefunden.
            </div>
          )}
          {results.map((tool, i) => {
            const isSel = i === selected;
            return (
              <button
                key={tool.id}
                data-testid={`command-item-${tool.id}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => void runTool(tool)}
                disabled={running}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: isSel ? PANEL : "transparent",
                  border: "none",
                  borderLeft: `3px solid ${isSel ? CYAN : "transparent"}`,
                  color: isSel ? CYAN : TEXT,
                  padding: "8px 16px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {tool.icon} {tool.label}
                  <span style={{ color: AMBER, fontSize: 10, marginLeft: 8 }}>{tool.wp}</span>
                </div>
                <div style={{ fontSize: 11, color: DIM, marginTop: 1 }}>{tool.hint}</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "6px 16px",
            fontSize: 10,
            color: DIM,
          }}
        >
          {TOOL_CATEGORIES.length} Kategorien · rein lokal, kein LLM
        </div>
      </div>
    </div>
  );
}
