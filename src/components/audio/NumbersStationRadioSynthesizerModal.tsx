// NumbersStationRadioSynthesizerModal (Meilenstein 57.0 / v6.9.0 UI)
import { useState, useMemo } from "react";
import {
  buildRadioAtmosphere,
  generateNumbersTransmission,
  createRadioPlayerState,
  buildRadioPlayerPatch,
  createSampleTransmission,
  createSampleRadioPlayerState,
} from "@/services/audio/numbersStationRadioSynthesizer";

export interface NumbersStationRadioSynthesizerModalProps {
  className?: string;
}

export function NumbersStationRadioSynthesizerModal({ className }: NumbersStationRadioSynthesizerModalProps) {
  const [seed, setSeed] = useState(42);
  const [blockCount, setBlockCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);

  const atmosphere = useMemo(() => buildRadioAtmosphere(), []);
  const transmission = useMemo(
    () => generateNumbersTransmission(seed, blockCount),
    [seed, blockCount],
  );

  const playerState = useMemo(() => {
    const base = createRadioPlayerState();
    return { ...base, isPlaying, totalBlocks: blockCount };
  }, [isPlaying, blockCount]);

  const playerPatch = useMemo(() => buildRadioPlayerPatch(playerState), [playerState]);

  const sampleTransmission = useMemo(() => createSampleTransmission(), []);
  const samplePlayerState = useMemo(() => createSampleRadioPlayerState(), []);

  return (
    <div
      className={className}
      data-testid="numbers-station-modal"
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
        📻 Kurzwellen-Zahlensender-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Seed: {seed} · Blöcke: {blockCount} · Frequenz: {transmission.frequency} · Stimme: {transmission.voiceType}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Seed
          <input
            data-testid="input-seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 120 }}>
          Blöcke (blockCount)
          <input
            data-testid="input-block-count"
            type="number"
            min={1}
            value={blockCount}
            onChange={(e) => setBlockCount(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}
          />
        </label>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary
          data-testid="summary-kurzwellen-atmosphaere"
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          📡 KURZWELLEN-ATMOSPHÄRE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Beschreibung:</strong> {atmosphere.description}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Rauschpegel:</strong> {atmosphere.noiseLevel} · <strong>Fading-Rate:</strong> {atmosphere.fadingRate}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Oszillatoren:</strong>
            <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 10 }}>
              {atmosphere.oscillators.map((osc, i) => (
                <div key={i} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)" }}>
                  <div style={{ fontWeight: 700, color: "var(--accent)" }}>{osc.type}</div>
                  <div style={{ fontSize: 9, color: "var(--muted)" }}>
                    {osc.frequency} Hz · gain {osc.gain}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary
          data-testid="summary-zahlensender"
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          🔢 ZAHLENSENDER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Intro:</strong> {transmission.intro}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Blöcke:</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {transmission.blocks.map((block, i) => (
                <li key={i} data-testid={`transmission-block-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                  {block}
                </li>
              ))}
            </ol>
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Outro:</strong> {transmission.outro}
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary
          data-testid="summary-radio-player"
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          ▶️ RADIO-PLAYER
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Status:</strong> {playerState.isPlaying ? "▶️ Spielt" : "⏸️ Gestoppt"} ·{" "}
            <strong>Block:</strong> {playerState.currentBlock}/{playerState.totalBlocks} ·{" "}
            <strong>Frequenz:</strong> {playerState.frequency}
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>Zeit:</strong> {playerState.elapsedSeconds}s / {playerState.totalSeconds}s
          </div>
          <button
            data-testid="button-toggle-play"
            onClick={() => setIsPlaying((p) => !p)}
            style={{
              padding: "6px 10px",
              textAlign: "left",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              width: "fit-content",
            }}
          >
            {isPlaying ? "⏸️ Stoppen" : "▶️ Abspielen"}
          </button>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>WebAudio-Patch:</strong>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
              <div>Oszillatoren: {playerPatch.oscillators.length}</div>
              <div>Rauschpegel: {playerPatch.noiseLevel}</div>
              <div>Gain-Nodes: {playerPatch.gainNodes.map((g) => `${g.id}=${g.gain.toFixed(2)}`).join(", ")}</div>
              <div>
                Verbindungen:{" "}
                {playerPatch.connections.length > 0
                  ? playerPatch.connections.map((c) => `${c.from}→${c.to}`).join(", ")
                  : "— (inaktiv)"}
              </div>
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary
          data-testid="summary-beispiel-uebertragung"
          style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          🎲 BEISPIEL-ÜBERTRAGUNG
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 10 }}>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <strong>{sampleTransmission.frequency}</strong> · {sampleTransmission.voiceType} ·{" "}
            {sampleTransmission.blocks.length} Blöcke
          </div>
          <div style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            Player: {samplePlayerState.isPlaying ? "▶️ Spielt" : "⏸️ Gestoppt"} · Block{" "}
            {samplePlayerState.currentBlock}/{samplePlayerState.totalBlocks} · {samplePlayerState.elapsedSeconds}s/
            {samplePlayerState.totalSeconds}s
          </div>
          <div style={{ fontSize: 9, color: "var(--muted)" }}>
            Beispiel-Fanfare: {sampleTransmission.intro}
          </div>
        </div>
      </details>
    </div>
  );
}

export default NumbersStationRadioSynthesizerModal;
