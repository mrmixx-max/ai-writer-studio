// ChapterSceneSynthesizerModal (WP 60.1)
//
// Weht aus Szenen-Beats ein vollständiges Kapitel mit vier dramaturgischen
// Rollen, Szenen-Brücken und Kadenz-Kurve.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  synthesizeChapter,
  buildSceneBridge,
  analyzeChapterCadence,
  ROLE_LABELS,
  type SceneRole,
} from "@/services/ai/chapterSceneSynthesizer";

export interface ChapterSceneSynthesizerModalProps {
  /** Vorbefüllte Beats (eine Zeile je Beat). */
  initialBeats?: string;
  className?: string;
}

const SAMPLE_BEATS = [
  "Mira wacht im kalten Zimmer auf",
  "Der Wirt stellt die falsche Frage",
  "Die Tür fliegt auf und der Wächter steht darin",
  "Mira bleibt allein zurück",
].join("\n");

const CADENCE_COLORS: Record<string, string> = {
  slow: "var(--success)",
  medium: "var(--warn)",
  fast: "var(--error)",
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

export function ChapterSceneSynthesizerModal({
  initialBeats = SAMPLE_BEATS,
  className,
}: ChapterSceneSynthesizerModalProps) {
  const [beatsText, setBeatsText] = useState(initialBeats);
  const [title, setTitle] = useState("Der Morgen danach");
  const [location, setLocation] = useState("Im Gasthaus am Kai");
  const [protagonist, setProtagonist] = useState("Mira");
  const [antagonist, setAntagonist] = useState("Der Wächter");
  const [bridgeKind, setBridgeKind] = useState<"time" | "place" | "mood">("time");

  const beats = useMemo(
    () =>
      beatsText
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter((l) => l.length > 0),
    [beatsText],
  );

  const chapter = useMemo(
    () =>
      synthesizeChapter({
        number: 7,
        title,
        beats,
        location,
        protagonist,
        antagonist,
      }),
    [title, beats, location, protagonist, antagonist],
  );

  const cadence = useMemo(() => analyzeChapterCadence(chapter.text), [chapter.text]);
  const bridge = useMemo(() => buildSceneBridge("Szene 1", "Szene 2", bridgeKind), [bridgeKind]);

  return (
    <div
      className={className}
      data-testid="chapter-scene-synthesizer-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📖 Gesamt-Kapitel-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {chapter.sceneCount} Szenen · {chapter.wordCount} Wörter · dramaturgisch geschlossen
      </div>

      {/* Beats */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Szenen-Beats (eine Zeile je Szene)
        <textarea
          data-testid="chapter-beats-input"
          value={beatsText}
          onChange={(e) => setBeatsText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)" }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Titel
          <input
            data-testid="chapter-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Ort
          <input
            data-testid="chapter-location-input"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Protagonist
          <input
            data-testid="chapter-protagonist-input"
            type="text"
            value={protagonist}
            onChange={(e) => setProtagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
          Antagonist
          <input
            data-testid="chapter-antagonist-input"
            type="text"
            value={antagonist}
            onChange={(e) => setAntagonist(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Szenen */}
      <div data-testid="chapter-scenes" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SZENEN-ORCHESTRIERUNG
        </div>
        {chapter.scenes.map((scene) => (
          <div
            key={scene.role}
            data-testid={`chapter-scene-${scene.role}`}
            style={{
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${CADENCE_COLORS[scene.cadence]}`,
              borderRadius: 4,
              padding: 10,
              marginBottom: 6,
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 4 }}>
              {scene.roleLabel.toUpperCase()} · {scene.cadence.toUpperCase()} · {scene.wordCount} Wörter
            </div>
            {scene.prose}
          </div>
        ))}
      </div>

      {/* Kadenz */}
      <div
        data-testid="chapter-cadence"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          NARRATIVE KADENZ
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 44 }}>
          {cadence.values.map((v, i) => (
            <div
              key={i}
              data-testid={`chapter-cadence-bar-${i}`}
              title={`Szene ${i + 1}: ${cadence.perScene[i]}`}
              style={{
                flex: 1,
                height: `${Math.max(6, v * 100)}%`,
                background: CADENCE_COLORS[cadence.perScene[i]] ?? "var(--border)",
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div
          data-testid="chapter-pacing-verdict"
          style={{
            marginTop: 8,
            fontSize: 11,
            color: cadence.wellPaced ? "var(--success)" : "var(--warn)",
            fontWeight: 700,
          }}
        >
          {cadence.wellPaced
            ? "✓ Wohlgepaced: Aufbau mit Spitze und Auflösung"
            : "⚠ Kadenz-Spitze liegt am Anfang"}
        </div>
      </div>

      {/* Szenen-Brücke */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SZENEN-BRÜCKE
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {(["time", "place", "mood"] as const).map((k) => (
            <button
              key={k}
              data-testid={`chapter-bridge-${k}`}
              onClick={() => setBridgeKind(k)}
              aria-pressed={bridgeKind === k}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                background: bridgeKind === k ? "var(--accent)" : "var(--panel)",
                color: bridgeKind === k ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {k === "time" ? "Zeitsprung" : k === "place" ? "Ortswechsel" : "Stimmung"}
            </button>
          ))}
        </div>
        <div
          data-testid="chapter-bridge-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 12,
            fontStyle: "italic",
          }}
        >
          {bridge.text}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>
        Rollen: {chapter.scenes.map((s) => ROLE_LABELS[s.role as SceneRole]).join(" → ")}
      </div>
    </div>
  );
}
