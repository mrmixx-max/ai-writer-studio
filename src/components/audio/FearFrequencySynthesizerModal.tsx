// FearFrequencySynthesizerModal (WP 117.1 UI, Meilenstein 56.0 / v6.8.0)
import { useState, useMemo } from "react";
import {
  buildInfrasoundPatch,
  generateEVP,
  createFearPlayerState,
  buildFearPlayerPatch,
  createSampleInfrasoundPatch,
  createSampleEVP,
  FEAR_FREQUENCY_HZ,
  HEARING_THRESHOLD_HZ,
} from "@/services/audio/fearFrequencySynthesizer";

export interface FearFrequencySynthesizerModalProps {
  className?: string;
}

export function FearFrequencySynthesizerModal({ className }: FearFrequencySynthesizerModalProps) {
  const [seed, setSeed] = useState(42);

  const infrasoundPatch = useMemo(() => buildInfrasoundPatch(), []);
  const sampleInfrasound = useMemo(() => createSampleInfrasoundPatch(), []);
  const evp = useMemo(() => generateEVP(seed), [seed]);
  const sampleEvp = useMemo(() => createSampleEVP(), []);
  const playerState = useMemo(() => createFearPlayerState(), []);
  const playerPatch = useMemo(() => buildFearPlayerPatch(playerState), [playerState]);

  return (
    <div
      className={className}
      data-testid="fear-frequency-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎵 Infraschall- &amp; Angst-Frequenz (18,9 Hz)
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Urangst-Frequenz {FEAR_FREQUENCY_HZ} Hz · unter der Hörschwelle von {HEARING_THRESHOLD_HZ} Hz
      </div>

      <div
        style={{
          padding: 10,
          border: "1px solid var(--border)",
          borderRadius: 4,
          background: "var(--panel)",
          fontSize: 11,
          lineHeight: 1.7,
          marginBottom: 12,
        }}
      >
        <div>
          <strong>Angst-Frequenz:</strong> {FEAR_FREQUENCY_HZ} Hz
        </div>
        <div>
          <strong>Hörschwelle:</strong> {HEARING_THRESHOLD_HZ} Hz
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          {FEAR_FREQUENCY_HZ} Hz liegt {Math.round((HEARING_THRESHOLD_HZ - FEAR_FREQUENCY_HZ) * 100) / 100} Hz unter der
          Hörschwelle — nicht hörbar, aber als körperliche Beklemmung spürbar.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 100 }}>
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
          🔊 INFRASCHALL-SYNTHESIZER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div>
            <strong>Oszillatoren:</strong> {infrasoundPatch.oscillators.length}
          </div>
          {infrasoundPatch.oscillators.map((osc, i) => (
            <div key={i} style={{ fontSize: 10, color: "var(--muted)" }}>
              {osc.type} · {osc.frequency} Hz · Gain {osc.gain}
            </div>
          ))}
          <div>
            <strong>Master-Gain:</strong> {infrasoundPatch.masterGain}
          </div>
          <div>
            <strong>Dauer:</strong> {infrasoundPatch.durationSeconds}s
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{infrasoundPatch.instruction}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            Beispiel-Patch: {sampleInfrasound.oscillators.length} Oszillatoren · Master-Gain {sampleInfrasound.masterGain}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👻 EVP
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div>
            <strong>Geflüstert:</strong> „{evp.whisper}“
          </div>
          <div>
            <strong>Hintergrund:</strong> {evp.backgroundNoise}
          </div>
          <div>
            <strong>Klarheit:</strong> {Math.round(evp.clarity * 100)}%
          </div>
          <div>
            <strong>Dauer:</strong> {evp.durationMs} ms
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{evp.description}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            Beispiel-EVP (Seed 42): „{sampleEvp.whisper}“ · {sampleEvp.durationMs} ms
          </div>
        </div>
      </details>

      <details open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ▶️ GRUSEL-PLAYER
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11, lineHeight: 1.7 }}>
          <div>
            <strong>Status:</strong> {playerState.isPlaying ? "Wiedergabe läuft" : "Gestoppt"}
          </div>
          <div>
            <strong>Frequenz:</strong> {playerState.currentFrequency} Hz
          </div>
          <div>
            <strong>Abspielzeit:</strong> {playerState.elapsedSeconds}s / {playerState.totalSeconds}s
          </div>
          <div>
            <strong>Intensität:</strong> {Math.round(playerState.intensity * 100)}%
          </div>
          <div>
            <strong>Fortschritt:</strong> {Math.round(playerPatch.progress * 100)}% · Rest {playerPatch.remainingSeconds}s
          </div>
          <div>
            <strong>Binaural:</strong> {playerPatch.binauralFrequency} Hz · Master-Gain {playerPatch.masterGain}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{playerPatch.instruction}</div>
        </div>
      </details>
    </div>
  );
}
