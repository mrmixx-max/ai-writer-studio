// ComicPanelOrchestratorModal (WP 77.1)
//
// Interaktiver Comic- & Graphic-Novel-Seiten-Orchestrator.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  createComicScript,
  exportAsMarkdown,
  BALLOON_LABELS,
  type ComicScript,
} from "@/services/screenplay/comicPanelOrchestrator";

export interface ComicPanelOrchestratorModalProps {
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

export function ComicPanelOrchestratorModal({ className }: ComicPanelOrchestratorModalProps) {
  const [title, setTitle] = useState("Die Chroniken der Aetherie");
  const [text, setText] = useState(
    "Der Held stand auf dem Dach. Die Stadt brannte unter ihm. Er dachte an seine Familie. Er musste handeln. Der Feind kam näher. Ein letzter Kampf begann. Die Sonne ging auf. Die Rettung kam.",
  );
  const [format, setFormat] = useState<ComicScript["format"]>("dark-horse");

  const script = useMemo(
    () => createComicScript(title, text, format),
    [title, text, format],
  );

  return (
    <div
      className={className}
      data-testid="comic-panel-orchestrator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎨 Comic- & Graphic-Novel-Seiten-Orchestrator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {script.pages.length} Seiten · {script.totalPanels} Panels · {script.format}
      </div>

      {/* Titel */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Titel
        <input
          data-testid="comic-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Text */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Prosa
        <textarea
          data-testid="comic-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Format */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["dark-horse", "image", "manga"] as const).map((f) => (
          <button
            key={f}
            data-testid={`comic-format-${f}`}
            onClick={() => setFormat(f)}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
              background: format === f ? "var(--accent)" : "var(--panel)",
              color: format === f ? "var(--bg)" : "var(--fg)",
              border: "1px solid var(--border)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Seiten-Vorschau */}
      <div
        data-testid="comic-pages"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SEITEN</div>
        {script.pages.map((page) => (
          <div key={page.page} data-testid={`comic-page-${page.page}`} style={{ marginBottom: 8 }}>
            <div style={{ color: "var(--accent)", fontWeight: 700 }}>Seite {page.page}</div>
            {page.panels.map((panel) => (
              <div key={panel.id} data-testid={`comic-panel-${panel.id}`} style={{ marginLeft: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: "var(--muted)" }}>
                  Panel {panel.panel} ({panel.type})
                </span>
                {panel.balloon && (
                  <span style={{ fontSize: 9, color: "var(--accent)" }}>
                    {" "}[{BALLOON_LABELS[panel.balloon]}]
                  </span>
                )}
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{panel.description}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Export */}
      <details data-testid="comic-export">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Markdown-Export
        </summary>
        <pre
          data-testid="comic-markdown"
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
          {exportAsMarkdown(script)}
        </pre>
      </details>
    </div>
  );
}
