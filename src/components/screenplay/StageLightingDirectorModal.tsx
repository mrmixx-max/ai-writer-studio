// StageLightingDirectorModal (WP 88.2 UI)
import { useState, useMemo } from "react";
import {
  createLightingScene,
  generateLightingScript,
  getKelvinMood,
  createSampleScene as _createSampleScene,
  createSampleScript as _createSampleScript,
  type LightingScene as _LightingScene,
} from "@/services/screenplay/stageLightingDirector";

export interface StageLightingDirectorModalProps {
  className?: string;
}

export function StageLightingDirectorModal({ className }: StageLightingDirectorModalProps) {
  const [sceneName, setSceneName] = useState("Akt 1, Szene 1 - Schlosshof bei Nacht");
  const [seed, setSeed] = useState(42);
  const [cueCount, setCueCount] = useState(4);

  const scene = useMemo(() => createLightingScene(sceneName, seed, cueCount), [sceneName, seed, cueCount]);
  const script = useMemo(() => generateLightingScript(scene), [scene]);

  return (
    <div
      className={className}
      data-testid="stage-lighting-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Bühnen-Lichtregie & Farbtemperatur-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · ID: {scene.id} · {scene.cues.length} Cues · {scene.cues.flatMap(c => c.lights).length} Scheinwerfer
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Szenenname
          <input value={sceneName} onChange={e => setSceneName(e.target.value)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Cues
          <input type="number" value={cueCount} onChange={e => setCueCount(clamp(Number(e.target.value), 1, 10))} min="1" max="10" style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎬 SZENEN-ÜBERSICHT
        </summary>
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>Stimmung:</strong> {scene.overallMood}
            <span style={{ marginLeft: 10, color: "var(--muted)" }}>({scene.dominantKelvin} K)</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>Beschreibung:</strong> {scene.description}
          </div>
        </div>
      </details>

      {scene.cues.map((cue, cueIndex) => (
        <details key={cue.id} style={{ marginBottom: 12 }} open={cueIndex === 0}>
          <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
            🎪 {cue.timecode} {cue.name} — Fade {cue.duration}s — {cue.lights.length} Lichter
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
            <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
              <strong>Regie-Anweisung:</strong><br />
              <code>{cue.script}</code>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {cue.lights.map((light, _lightIndex) => (
                <div key={light.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 10 }}>
                    <span style={{ fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>
                      {light.type}
                    </span>
                    <span>🌡 {light.kelvin} K ({getKelvinMood(light.kelvin).mood})</span>
                    <span>💡 {light.intensity}%</span>
                    <span>🔍 Fokus {light.focus}%</span>
                    <span>📐 {light.angle}°</span>
                    <span>📍 Pos({light.position.x}, {light.position.y}, {light.position.z})</span>
                    <span style={{ color: "var(--muted)" }}>
                      Gel: {light.colorFilter} {light.gelName}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: `hsl(${light.kelvin / 100}, 80%, 50%)` }} />
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 VOLLSTÄNDIGES REGIE-SKRIPT
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 300, overflow: "auto" }}>
          {script}
        </pre>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🌡 KELVIN-STIMMUNGS-MATRIX
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 10 }}>
          <div style={{ display: "flex", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
            <span style={{ flex: 1 }}>Kelvin</span>
            <span style={{ flex: 2 }}>Stimmung</span>
            <span style={{ flex: 3 }}>Beschreibung</span>
          </div>
          {[
            { min: 1800, max: 2200, mood: "Intim, romantisch", desc: "Kerzenlicht, offenes Feuer" },
            { min: 2200, max: 2700, mood: "Warm, gemütlich", desc: "Glühbirne, warmes Wohnzimmerlicht" },
            { min: 2700, max: 3200, mood: "Einladend, behaglich", desc: "Halogen, warmes Weiß" },
            { min: 3200, max: 4000, mood: "Neutral, natürlich", desc: "Morgen/Abendlicht, Fotolicht" },
            { min: 4000, max: 5000, mood: "Klar, aktiv", desc: "Tageslicht, Bürobeleuchtung" },
            { min: 5000, max: 6500, mood: "Kühl, steril", desc: "Mittagssonne, Operationslicht" },
            { min: 6500, max: 10000, mood: "Extrem kühl, surreal", desc: "Nordlicht, Überbelichtung" },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ flex: 1, fontFamily: "var(--font-mono)" }}>{m.min}–{m.max} K</span>
              <span style={{ flex: 2 }}>{m.mood}</span>
              <span style={{ flex: 3, color: "var(--muted)" }}>{m.desc}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}