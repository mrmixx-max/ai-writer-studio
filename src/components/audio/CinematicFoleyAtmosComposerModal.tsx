// CinematicFoleyAtmosComposerModal (WP 121.1 UI — Meilenstein 58.0 / v7.0.0)
import { useState, useMemo } from "react";
import {
  FOLEY_LAYERS,
  syncSceneToAtmosphere,
  buildMixerPatch,
  createSampleScene,
  createSampleMixerPatch,
  type MixerLayerInput,
} from "@/services/audio/cinematicFoleyAtmosComposer";

export interface CinematicFoleyAtmosComposerModalProps {
  className?: string;
}

export function CinematicFoleyAtmosComposerModal({
  className,
}: CinematicFoleyAtmosComposerModalProps) {
  const [seed, setSeed] = useState(42);
  const [text, setText] = useState(
    "Schnee fiel auf den Marmor der Kathedrale, während Wind durch die " +
      "Gänge heulte und eine Fackel flackerte; ferne Rüstung klirrte.",
  );

  const scene = useMemo(() => syncSceneToAtmosphere(text, seed), [text, seed]);

  const mixer = useMemo(() => {
    const ids = scene.matchedLayers.length > 0
      ? scene.matchedLayers
      : FOLEY_LAYERS.map((l) => l.id);
    const layers: MixerLayerInput[] = ids.map((id) => {
      const profile = FOLEY_LAYERS.find((l) => l.id === id);
      return { id, gain: profile ? profile.gain : 0.3 };
    });
    return buildMixerPatch(layers, scene.durationSeconds);
  }, [scene]);

  const sampleScene = useMemo(() => createSampleScene(), []);
  const samplePatch = useMemo(() => createSampleMixerPatch(), []);

  const loadSample = () => {
    setSeed(42);
    setText(
      "Schnee fiel auf den Marmor der Kathedrale, während Wind durch die " +
        "Gänge heulte und eine Fackel flackerte; ferne Rüstung klirrte.",
    );
  };

  const panelStyle = {
    padding: 8,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--panel)",
  } as const;

  return (
    <div
      className={className}
      data-testid="cinematic-foley-modal"
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
        🎬 Kinematische Foley- & Raum-Atmos-Engine
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Schichten: {FOLEY_LAYERS.length} · Cues: {scene.cues.length} ·
        Dauer: {scene.durationSeconds}s
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <button
          onClick={loadSample}
          style={{
            alignSelf: "flex-end",
            padding: "8px 16px",
            fontSize: 11,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          ↺ Beispiel-Szene laden
        </button>
      </div>

      <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Szenen-Text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "6px 8px",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </label>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎚️ FOLEY-SCHICHTEN ({FOLEY_LAYERS.length})
        </summary>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11,
          }}
        >
          {FOLEY_LAYERS.map((layer) => {
            const active = scene.matchedLayers.includes(layer.id);
            return (
              <div
                key={layer.id}
                style={{
                  padding: 6,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  background: active ? "var(--panel)" : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: active ? "var(--accent)" : "var(--fg)" }}>
                    {layer.name}
                  </strong>
                  <span style={{ color: "var(--muted)" }}>{layer.layerType}</span>
                </div>
                <div style={{ color: "var(--muted)" }}>{layer.description}</div>
                <div style={{ color: "var(--muted)" }}>
                  id: {layer.id} · {layer.baseFrequency} Hz · Mod {layer.modulationRate} Hz ·
                  Gain {layer.gain}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔗 SZENEN-SYNCHRONISATION
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div style={{ marginBottom: 6 }}>
            <strong>syncSceneToAtmosphere(text, {seed})</strong>
          </div>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>
            Dauer: {scene.durationSeconds}s · Treffer: {scene.matchedLayers.length}/
            {FOLEY_LAYERS.length}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {scene.matchedLayers.length === 0 ? (
              <span style={{ color: "var(--muted)" }}>Keine Signalwörter erkannt.</span>
            ) : (
              scene.matchedLayers.map((id) => (
                <span
                  key={id}
                  style={{
                    padding: "2px 8px",
                    border: "1px solid var(--accent)",
                    borderRadius: 999,
                    color: "var(--accent)",
                    fontSize: 10,
                  }}
                >
                  {id}
                </span>
              ))
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {scene.cues.map((cue, i) => (
              <div
                key={`${cue.layerId}-${i}`}
                style={{
                  padding: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--bg)",
                }}
              >
                <div>
                  <strong>{cue.trigger}</strong> → {cue.layerId}
                </div>
                <div style={{ color: "var(--muted)" }}>
                  Intensität: {cue.intensity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎛️ WEB-AUDIO-MIXER
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div style={{ marginBottom: 6 }}>
            <strong>buildMixerPatch(layers, {scene.durationSeconds})</strong>
          </div>
          <div style={{ color: "var(--muted)", marginBottom: 8 }}>
            Master-Gain: {mixer.masterGain} · Oszillatoren: {mixer.oscillators.length}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {mixer.oscillators.map((osc, i) => (
              <div
                key={i}
                style={{
                  padding: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--bg)",
                }}
              >
                <div style={{ color: "var(--muted)" }}>Oszillator {i + 1}</div>
                <div style={{ fontWeight: 700 }}>
                  {osc.type} @ {osc.frequency} Hz
                </div>
                <div style={{ color: "var(--muted)" }}>Gain {osc.gain}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              padding: 8,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--bg)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {mixer.instruction}
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🧪 BEISPIEL-FABRIKEN (Referenz)
        </summary>
        <div style={{ marginTop: 8, ...panelStyle }}>
          <div style={{ marginBottom: 6 }}>
            <strong>createSampleScene()</strong> · Dauer {sampleScene.durationSeconds}s ·{" "}
            {sampleScene.cues.length} Cues
          </div>
          <div style={{ color: "var(--muted)", marginBottom: 8 }}>
            {sampleScene.cues.map((c) => c.trigger).join(" · ") || "keine Cues"}
          </div>
          <div style={{ marginBottom: 6 }}>
            <strong>createSampleMixerPatch()</strong> · Master-Gain {samplePatch.masterGain} ·{" "}
            {samplePatch.oscillators.length} Oszillatoren
          </div>
          <div style={{ color: "var(--muted)" }}>{samplePatch.instruction}</div>
        </div>
      </details>
    </div>
  );
}
