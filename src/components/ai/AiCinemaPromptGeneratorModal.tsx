// AiCinemaPromptGeneratorModal (WP 66.1)
//
// Shot-by-Shot Video-Prompt-Synthesizer für Sora, Runway, Kling und Luma.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  deconstructScene,
  generateConsistencyTags,
  formatShotList,
  type VideoEngine,
  type ConsistencyProfile,
} from "@/services/ai/aiCinemaPromptGenerator";

export interface AiCinemaPromptGeneratorModalProps {
  className?: string;
}

const ENGINES: VideoEngine[] = ["sora", "runway", "kling", "luma"];

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

export function AiCinemaPromptGeneratorModal({ className }: AiCinemaPromptGeneratorModalProps) {
  const [scene, setScene] = useState("A lone figure stands at the edge of a cliff, looking out over a vast landscape");
  const [engine, setEngine] = useState<VideoEngine>("sora");
  const [hairColor, setHairColor] = useState("dark brown");
  const [clothing, setClothing] = useState("leather jacket");
  const [age, setAge] = useState("mid-30s");
  const [lighting, setLighting] = useState("golden hour");

  const profile: ConsistencyProfile = useMemo(
    () => ({ hairColor, clothing, age, lighting }),
    [hairColor, clothing, age, lighting],
  );

  const deconstruction = useMemo(
    () => deconstructScene(scene, engine, profile),
    [scene, engine, profile],
  );

  const consistencyTags = useMemo(
    () => generateConsistencyTags(profile),
    [profile],
  );

  return (
    <div
      className={className}
      data-testid="ai-cinema-prompt-generator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎬 AI Cinema Prompt Director
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {deconstruction.shotCount} Shots · {deconstruction.globalConsistencyTags.length} Konsistenz-Tags
      </div>

      {/* Szenenbeschreibung */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Szenenbeschreibung
        <textarea
          data-testid="cinema-scene-input"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Engine-Auswahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Video-Engine
        <select
          data-testid="cinema-engine-select"
          value={engine}
          onChange={(e) => setEngine(e.target.value as VideoEngine)}
          style={inputStyle}
        >
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </select>
      </label>

      {/* Konsistenz-Profil */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Haarfarbe
          <input
            data-testid="cinema-hair-input"
            value={hairColor}
            onChange={(e) => setHairColor(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Kleidung
          <input
            data-testid="cinema-clothing-input"
            value={clothing}
            onChange={(e) => setClothing(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Alter
          <input
            data-testid="cinema-age-input"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Beleuchtung
          <input
            data-testid="cinema-lighting-input"
            value={lighting}
            onChange={(e) => setLighting(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Konsistenz-Tags */}
      <div
        data-testid="cinema-consistency-tags"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          KONSISTENZ-TAGS
        </div>
        {consistencyTags.map((tag) => (
          <span
            key={tag}
            data-testid={`cinema-tag-${tag.split(":")[0]}`}
            style={{
              display: "inline-block",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "2px 6px",
              margin: "2px",
              fontSize: 10,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Shot-Liste */}
      <div data-testid="cinema-shot-list" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SHOT-BY-SHOT PROMPTS
        </div>
        {deconstruction.shots.map((shot) => (
          <div
            key={shot.index}
            data-testid={`cinema-shot-${shot.index}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
              Shot {String(shot.index).padStart(2, "0")}: {shot.typeLabel}
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{shot.prompt}</div>
            {shot.cameraCommand && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                Camera: {shot.cameraCommand}
              </div>
            )}
            {shot.realismAnchor && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                Realism: {shot.realismAnchor}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vollständige Shot-Liste */}
      <details data-testid="cinema-full-list">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Shot-Liste
        </summary>
        <pre
          data-testid="cinema-formatted"
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
          {formatShotList(deconstruction)}
        </pre>
      </details>
    </div>
  );
}
