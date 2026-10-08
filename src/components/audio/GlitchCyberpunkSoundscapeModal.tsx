// GlitchCyberpunkSoundscapeModal (WP 113.1 UI)
import { useState, useMemo } from "react";
import {
  generateSoundscapePreset,
  buildWebAudioPatch,
  createInitialPlayerState,
  SOUNDSCAPE_LAYERS,
  NETRUNNING_EFFECTS,
  type SoundscapeLayerId,
} from "@/services/audio/glitchCyberpunkSoundscape";

export interface GlitchCyberpunkSoundscapeModalProps {
  className?: string;
}

export function GlitchCyberpunkSoundscapeModal({ className }: GlitchCyberpunkSoundscapeModalProps) {
  const [activeLayers, setActiveLayers] = useState<SoundscapeLayerId[]>(["bassDrone", "serverHum", "glitchImpulse"]);
  const [duration, setDuration] = useState(30);
  const [seed, setSeed] = useState(42);

  const preset = useMemo(
    () => generateSoundscapePreset("Neon Rain", activeLayers, duration, seed),
    [activeLayers, duration, seed]
  );
  const patch = useMemo(() => buildWebAudioPatch(preset), [preset]);
  const playerState = useMemo(() => createInitialPlayerState(), []);

  const toggleLayer = (id: SoundscapeLayerId) => {
    setActiveLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  return (
    <div
      className={className}
      data-testid="glitch-cyberpunk-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎛️ Glitch-Cyberpunk- &amp; Netrunning-Soundscape
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {preset.layers.length} Schichten · {preset.durationSeconds}s · {patch.masterGain} Master-Gain
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Dauer (s)
          <input
            type="number"
            min={5}
            max={300}
            value={duration}
            onChange={(e) => setDuration(Math.max(5, Math.min(300, Number(e.target.value) || 5)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎚️ MULTI-OSZILLATOR-SCHICHTEN
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {SOUNDSCAPE_LAYERS.map((layer) => (
            <label
              key={layer.id}
              style={{
                padding: 8,
                border: `1px solid ${activeLayers.includes(layer.id) ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 4,
                background: "var(--panel)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={activeLayers.includes(layer.id)}
                onChange={() => toggleLayer(layer.id)}
                style={{ accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontWeight: 700, color: activeLayers.includes(layer.id) ? "var(--accent)" : "var(--fg)" }}>
                  {layer.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{layer.description}</div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                  {layer.baseFrequency} Hz · Modulation {layer.modulationRate} Hz · Gain {layer.gain}
                </div>
              </div>
            </label>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔊 WEBAUDIO-PATCH
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Oszillatoren:</strong> {patch.oscillators.length}</div>
          <div><strong>Master-Gain:</strong> {patch.masterGain}</div>
          <div><strong>Sample-Rate:</strong> {patch.sampleRate} Hz</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{patch.instruction}</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌐 NETRUNNING-EFFEKTE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {NETRUNNING_EFFECTS.map((effect) => (
            <div key={effect.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--accent)" }}>{effect.name}</strong>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{effect.frequency} Hz · {effect.durationMs} ms</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{effect.description}</div>
            </div>
          ))}
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ▶️ STUDIO-PLAYER
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div><strong>Status:</strong> {playerState.isPlaying ? "Wiedergabe läuft" : "Gestoppt"}</div>
          <div><strong>Aktuelle Schicht:</strong> {playerState.currentLayer || "Keine"}</div>
          <div><strong>Abspielzeit:</strong> {playerState.elapsedSeconds}s / {playerState.totalSeconds}s</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            WebAudio API — direktes Abspielen im Modal während des Schreibens.
          </div>
        </div>
      </details>
    </div>
  );
}
