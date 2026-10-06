// PsychoacousticSoundscapeModal
import { useState, useMemo } from "react";
import {
  createSoundscape,
  BINAURAL_PRESETS,
} from "@/services/audio/psychoacousticSoundscape";

export interface PsychoacousticSoundscapeModalProps {
  className?: string;
}

export function PsychoacousticSoundscapeModal({ className }: PsychoacousticSoundscapeModalProps) {
  const [name, setName] = useState("Tiefes Schreiben");
  const [binauralFreq, setBinauralFreq] = useState<"gamma" | "alpha" | "theta" | "delta" | "beta">("alpha");
  const [natureSounds] = useState<("fire" | "rain" | "ocean" | "library" | "forest" | "wind")[]>(["fire", "rain"]);
  const [duration] = useState(45);

  const soundscape = useMemo(
    () => createSoundscape(name, binauralFreq, natureSounds, duration),
    [name, binauralFreq, natureSounds, duration],
  );

  return (
    <div
      className={className}
      data-testid="psychoacoustic-soundscape-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎧 Psychoakustischer Flow-State-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {BINAURAL_PRESETS[soundscape.binauralFreq].label} · {soundscape.durationMinutes} Min
      </div>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Name
        <input
          data-testid="soundscape-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
        />
      </label>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Binaural
          <select
            data-testid="soundscape-binaural-select"
            value={binauralFreq}
            onChange={(e) => setBinauralFreq(e.target.value as "gamma" | "alpha" | "theta" | "delta" | "beta")}
            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
          >
            {["gamma", "alpha", "theta", "delta", "beta"].map((f) => (
              <option key={f} value={f}>
                {["Gamma (40 Hz)", "Alpha (10 Hz)", "Theta (6 Hz)", "Delta (2 Hz)", "Beta (15 Hz)"][["gamma", "alpha", "theta", "delta", "beta"].indexOf(f)]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>NATURGERÄUSCHE</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["fire", "rain", "ocean", "library", "forest", "wind"].map((ns) => (
            <label
              key={ns}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={["fire", "rain"].includes(ns)}
                onChange={() => {}}
                style={{ accentColor: "var(--accent)" }}
              />
              {["Kaminfeuer", "Regen", "Meeresbrandung", "Bibliothek", "Wald", "Wind"][["fire", "rain", "ocean", "library", "forest", "wind"].indexOf(ns)]}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Dauer (Min)
          <input
            data-testid="soundscape-duration-input"
            type="number"
            value={45}
            onChange={() => {}}
            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Fade-in (s)
          <input
            data-testid="soundscape-fadein-input"
            type="number"
            value={10}
            onChange={() => {}}
            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Fade-out (s)
          <input
            data-testid="soundscape-fadeout-input"
            type="number"
            value={20}
            onChange={() => {}}
            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
          />
        </label>
      </div>

      <div
        data-testid="soundscape-output"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>KLANGLANDSCHAFT</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>Tiefes Schreiben</div>
      </div>

      <details data-testid="soundscape-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="soundscape-text"
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
          KLANG LANDSCHAFT
        </pre>
      </details>
    </div>
  );
}