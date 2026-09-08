// FormattingPanel: Markdown-Toolbar mit Kategorien + Shortcuts (Sprint 24, Agent 5).
// Bloomberg-Terminal-Thema: dunkler Hintergrund, Amber/Cyan-Akzente, Monospace.
// Standalone — braucht kein offenes Kapitel (Sidebar-Mode "formatting").
import { useMemo, useState } from "react";
import {
  applyFormat,
  getFormatCategories,
  getKeyboardShortcuts,
  stripFormatting,
} from "@/services/formatting/formatting";

export interface FormattingPanelProps {
  /** Starttext im Editor-Feld. */
  initialText?: string;
  /** Empfängt den Text nach jeder Format-Operation (Host kann ihn übernehmen). */
  onApply?: (text: string) => void;
}

const PANEL_STYLE: React.CSSProperties = {
  background: "#0a0e14",
  color: "#e6c87a",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  border: "1px solid #2a3340",
  borderRadius: 6,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  fontSize: 13,
};

const BUTTON_STYLE: React.CSSProperties = {
  background: "#141b26",
  color: "#7de3f4",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const DANGER_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  color: "#ff7b72",
  borderColor: "#5a2a28",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  background: "#06090f",
  color: "#e6edf3",
  border: "1px solid #2a3340",
  borderRadius: 4,
  minHeight: 120,
  padding: 8,
  fontFamily: "inherit",
  fontSize: 13,
  resize: "vertical",
};

const PREVIEW_STYLE: React.CSSProperties = {
  background: "#06090f",
  color: "#9fb3c8",
  border: "1px solid #2a3340",
  borderRadius: 4,
  padding: 8,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 200,
  overflowY: "auto",
  margin: 0,
  fontSize: 12,
};

export function FormattingPanel({ initialText = "", onApply }: FormattingPanelProps) {
  const [text, setText] = useState(initialText);
  const categories = useMemo(() => getFormatCategories(), []);
  const shortcuts = useMemo(() => getKeyboardShortcuts(), []);

  const update = (next: string) => {
    setText(next);
    onApply?.(next);
  };

  const handleAction = (actionId: string) => {
    update(applyFormat(actionId, text));
  };

  return (
    <div className="formatting-panel" style={PANEL_STYLE} data-testid="formatting-panel">
      <div style={{ color: "#7de3f4", fontWeight: 700, letterSpacing: 1 }}>
        ✨ FORMAT <span style={{ color: "#5a6b7d" }}>— Markdown-Toolbar + Shortcuts</span>
      </div>

      {categories.map((cat) => (
        <section key={cat.id} aria-label={cat.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#e6c87a", fontWeight: 700 }}>{cat.label}</span>
            <select
              aria-label={`${cat.label} auswählen`}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAction(e.target.value);
                  e.target.value = "";
                }
              }}
              style={{ ...BUTTON_STYLE, maxWidth: 180 }}
            >
              <option value="">{cat.label} …</option>
              {cat.actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.label}
                </option>
              ))}
            </select>
          </div>
          <div role="toolbar" aria-label={cat.label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {cat.actions.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.shortcut ? `${a.label} (${a.shortcut})` : a.label}
                onClick={() => handleAction(a.id)}
                style={BUTTON_STYLE}
              >
                <span aria-hidden="true">{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </section>
      ))}

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ color: "#5a6b7d" }}>Text</span>
        <textarea
          aria-label="Zu formatierender Text"
          value={text}
          onChange={(e) => update(e.target.value)}
          style={TEXTAREA_STYLE}
        />
      </label>

      <div>
        <div style={{ color: "#5a6b7d", marginBottom: 4 }}>Vorschau</div>
        <pre data-testid="formatting-preview" style={PREVIEW_STYLE}>
          {text}
        </pre>
      </div>

      <details>
        <summary style={{ cursor: "pointer", color: "#7de3f4" }}>⌨ Tastaturkürzel</summary>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#9fb3c8" }}>
          {shortcuts.map((s) => (
            <li key={s.action}>
              <kbd
                style={{
                  background: "#141b26",
                  border: "1px solid #2a3340",
                  borderRadius: 3,
                  padding: "0 4px",
                  color: "#e6c87a",
                }}
              >
                {s.key}
              </kbd>{" "}
              → {s.action}
            </li>
          ))}
        </ul>
      </details>

      <div>
        <button type="button" onClick={() => update(stripFormatting(text))} style={DANGER_BUTTON_STYLE}>
          ✕ Alle entfernen
        </button>
      </div>
    </div>
  );
}
