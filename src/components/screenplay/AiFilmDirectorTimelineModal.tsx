// AiFilmDirectorTimelineModal (WP 67.2)
//
// Interaktive Regie-Timeline & Produktions-Dossier: Shot-Grid mit Timecodes,
// Kamera-Icons, Prompt-Vorschau und 1-Klick-Kopierbutton.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateShotGrid,
  generateTimeline,
  exportProductionDossier,
  formatTimeline,
} from "@/services/screenplay/aiFilmDirectorTimeline";

export interface AiFilmDirectorTimelineModalProps {
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

export function AiFilmDirectorTimelineModal({ className }: AiFilmDirectorTimelineModalProps) {
  const [scene, setScene] = useState("A dramatic confrontation in a dark alley");
  const [shotCount, setShotCount] = useState(6);
  const [title, setTitle] = useState("AI Film Director's Pitchbook");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const grid = useMemo(() => generateShotGrid(scene, shotCount), [scene, shotCount]);
  const timeline = useMemo(() => generateTimeline(scene, shotCount), [scene, shotCount]);
  const dossier = useMemo(() => exportProductionDossier(title, timeline), [title, timeline]);

  const copyPrompt = (index: number, prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div
      className={className}
      data-testid="ai-film-director-timeline-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 AI Film Director Timeline
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {grid.length} Shots · {timeline.length} Timeline-Einträge
      </div>

      {/* Szenenbeschreibung */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Szenenbeschreibung
        <input
          data-testid="timeline-scene-input"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Shot-Anzahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 14 }}>
        Shot-Anzahl: {shotCount}
        <input
          data-testid="timeline-count-input"
          type="range"
          min={1}
          max={12}
          value={shotCount}
          onChange={(e) => setShotCount(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      {/* Shot-Grid */}
      <div data-testid="timeline-grid" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SHOT-GRID
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {grid.map((cell) => (
            <div
              key={cell.index}
              data-testid={`timeline-shot-${cell.index}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                fontSize: 11,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                  Shot {String(cell.index).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 16 }}>{cell.cameraIcon}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{cell.timecode}</div>
              <div style={{ fontSize: 10, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cell.promptPreview}
              </div>
              <button
                data-testid={`timeline-copy-${cell.index}`}
                onClick={() => copyPrompt(cell.index, cell.promptPreview)}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 3,
                  cursor: "pointer",
                  background: copiedIndex === cell.index ? "var(--success)" : "var(--panel)",
                  color: copiedIndex === cell.index ? "var(--bg)" : "var(--fg)",
                  border: "1px solid var(--border)",
                }}
              >
                {copiedIndex === cell.index ? "✓ Kopiert" : "Kopieren"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline-Einträge */}
      <div data-testid="timeline-entries" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          TIMELINE-EINTRÄGE
        </div>
        {timeline.map((entry, i) => (
          <div
            key={i}
            data-testid={`timeline-entry-${i}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              marginBottom: 6,
              fontSize: 11,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong style={{ color: "var(--accent)" }}>Shot {String(entry.shot.index).padStart(2, "0")}</strong>
              <span style={{ color: "var(--muted)" }}>{entry.shot.timecode}</span>
            </div>
            <div style={{ fontSize: 10 }}>
              <strong>Dialog:</strong> {entry.dialogue}
            </div>
            <div style={{ fontSize: 10 }}>
              <strong>Foley:</strong> {entry.foley}
            </div>
            <div style={{ fontSize: 10 }}>
              <strong>Score:</strong> {entry.score}
            </div>
          </div>
        ))}
      </div>

      {/* Dossier-Export */}
      <div
        data-testid="timeline-dossier"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          PRODUKTIONS-DOSSIER
        </div>
        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>
          Titel
          <input
            data-testid="timeline-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <details data-testid="timeline-markdown" style={{ flex: 1, minWidth: 120 }}>
            <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>Markdown</summary>
            <pre
              data-testid="timeline-markdown-content"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                marginTop: 4,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              {dossier.markdown}
            </pre>
          </details>
          <details data-testid="timeline-json" style={{ flex: 1, minWidth: 120 }}>
            <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>JSON</summary>
            <pre
              data-testid="timeline-json-content"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                marginTop: 4,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              {dossier.json}
            </pre>
          </details>
          <details data-testid="timeline-csv" style={{ flex: 1, minWidth: 120 }}>
            <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>CSV</summary>
            <pre
              data-testid="timeline-csv-content"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                marginTop: 4,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              {dossier.csv}
            </pre>
          </details>
        </div>
      </div>

      {/* Vollständige Timeline */}
      <details data-testid="timeline-full">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Timeline
        </summary>
        <pre
          data-testid="timeline-formatted"
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
          {formatTimeline(timeline)}
        </pre>
      </details>
    </div>
  );
}
