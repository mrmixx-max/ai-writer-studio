// KeyframePromptGeneratorModal (WP 66.2)
//
// Midjourney & Leonardo Keyframe-Prompt-Studio: Start- & Endframe-Paare
// für Bild-zu-Bild-Morphing.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateKeyframePair,
  generateKeyframePairs,
  formatKeyframePair,
  ENGINE_LABELS,
  type ImageEngine,
  type AspectRatio,
  type CameraProfile,
} from "@/services/ai/keyframePromptGenerator";

export interface KeyframePromptGeneratorModalProps {
  className?: string;
}

const ENGINES: ImageEngine[] = ["midjourney", "leonardo"];
const ASPECT_RATIOS: AspectRatio[] = ["16:9", "2.39:1", "1:1", "4:3", "9:16"];
const CAMERA_PROFILES: CameraProfile[] = [
  "arri-alexa-65",
  "imax-70mm",
  "panavision-70mm",
  "red-monstro",
  "sony-venice",
];

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

export function KeyframePromptGeneratorModal({ className }: KeyframePromptGeneratorModalProps) {
  const [startDesc, setStartDesc] = useState("A closed castle gate at night");
  const [endDesc, setEndDesc] = useState("The gate explodes open");
  const [engine, setEngine] = useState<ImageEngine>("midjourney");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [cameraProfile, setCameraProfile] = useState<CameraProfile>("arri-alexa-65");
  const [pairCount, setPairCount] = useState(1);

  const pair = useMemo(
    () => generateKeyframePair(startDesc, endDesc, engine, aspectRatio, cameraProfile),
    [startDesc, endDesc, engine, aspectRatio, cameraProfile],
  );

  const pairs = useMemo(
    () => generateKeyframePairs(startDesc, engine, aspectRatio, cameraProfile, pairCount),
    [startDesc, engine, aspectRatio, cameraProfile, pairCount],
  );

  return (
    <div
      className={className}
      data-testid="keyframe-prompt-generator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🖼️ Keyframe Prompt Studio
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {ENGINE_LABELS[engine]} · {aspectRatio} · {pairCount} Paar(e)
      </div>

      {/* Start- & Endframe */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Startframe
          <input
            data-testid="keyframe-start-input"
            value={startDesc}
            onChange={(e) => setStartDesc(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          Endframe
          <input
            data-testid="keyframe-end-input"
            value={endDesc}
            onChange={(e) => setEndDesc(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      {/* Engine, Seitenverhältnis, Kamera */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Engine
          <select
            data-testid="keyframe-engine-select"
            value={engine}
            onChange={(e) => setEngine(e.target.value as ImageEngine)}
            style={inputStyle}
          >
            {ENGINES.map((e) => (
              <option key={e} value={e}>
                {ENGINE_LABELS[e]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Seitenverhältnis
          <select
            data-testid="keyframe-aspect-select"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            style={inputStyle}
          >
            {ASPECT_RATIOS.map((ar) => (
              <option key={ar} value={ar}>
                {ar}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Kamera
          <select
            data-testid="keyframe-camera-select"
            value={cameraProfile}
            onChange={(e) => setCameraProfile(e.target.value as CameraProfile)}
            style={inputStyle}
          >
            {CAMERA_PROFILES.map((cam) => (
              <option key={cam} value={cam}>
                {cam}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Paar-Anzahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 14 }}>
        Paar-Anzahl: {pairCount}
        <input
          data-testid="keyframe-count-input"
          type="range"
          min={1}
          max={8}
          value={pairCount}
          onChange={(e) => setPairCount(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      {/* Keyframe-Paar */}
      <div
        data-testid="keyframe-pair"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          KEYFRAME-PAAR
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong style={{ color: "var(--accent)" }}>START:</strong> {pair.startPrompt}
        </div>
        <div>
          <strong style={{ color: "var(--accent)" }}>END:</strong> {pair.endPrompt}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
          Midjourney: {pair.midjourneyParams}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          Leonardo: {pair.leonardoParams}
        </div>
      </div>

      {/* Mehrere Paare */}
      {pairs.pairs.length > 1 && (
        <div data-testid="keyframe-pairs" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
            ALLE PARE ({pairs.pairCount})
          </div>
          {pairs.pairs.map((p, i) => (
            <div
              key={i}
              data-testid={`keyframe-pair-${i}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
                fontSize: 11,
              }}
            >
              <strong style={{ color: "var(--accent)" }}>Paar {i + 1}:</strong> {p.startPrompt.slice(0, 80)}...
            </div>
          ))}
        </div>
      )}

      {/* Vollständige Ausgabe */}
      <details data-testid="keyframe-full">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="keyframe-formatted"
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
          {formatKeyframePair(pair)}
        </pre>
      </details>
    </div>
  );
}
