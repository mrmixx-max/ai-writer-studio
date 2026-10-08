// TonalIllusionSynthesizerModal (WP 107.1 UI)
import { useState, useMemo } from "react";
import {
  analyzeIllusion,
  PAREIDOLIA_SOURCES,
  SHEPARD_CENTER_HZ,
  type PareidoliaSourceId,
} from "@/services/audio/tonalIllusionSynthesizer";

export interface TonalIllusionSynthesizerModalProps {
  className?: string;
}

export function TonalIllusionSynthesizerModal({ className }: TonalIllusionSynthesizerModalProps) {
  const [steps, setSteps] = useState(12);
  const [source, setSource] = useState<PareidoliaSourceId>("rain");
  const [seed, setSeed] = useState(42);

  const report = useMemo(() => analyzeIllusion(steps, source, seed), [steps, source, seed]);
  const player = report.player;

  return (
    <div
      className={className}
      data-testid="tonal-illusion-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🌀 Shepard-Tone- &amp; Akustik-Illusionen-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Illusion {player.id} · {player.shepardTones.length} Schritte · {player.loopSeconds}s Umlauf · Zentrale {SHEPARD_CENTER_HZ} Hz
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", minWidth: 90 }}>
          Schritte
          <input
            type="number"
            min={1}
            max={24}
            value={steps}
            onChange={(e) => setSteps(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 160 }}>
          Pareidolie-Quelle
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as PareidoliaSourceId)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          >
            {PAREIDOLIA_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
          🎵 SHEPARD-TON-LEITER (ENDLOS)
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
            {player.shepardTones.map((t, i) => (
              <div
                key={i}
                title={`Schritt ${i + 1}: ${t.partialCount} Partialtöne, Energie ${t.energy}`}
                style={{ flex: 1, height: `${Math.max(6, (t.energy / 7) * 100)}%`, background: "var(--accent)", borderRadius: 2 }}
              />
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
            Ø Energie {report.averageEnergy} · volle 7-Oktaven-Deckung bei {report.fullCoverageSteps} Schritten · Pitch-Class-Abdeckung {report.pitchClassCoverage}%
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔬 GAUSSSCHE AMPLITUDEN-HÜLLKURVE (Beispielschritt)
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {player.shepardTones[0]?.partials.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
              <span style={{ width: 60, color: "var(--muted)" }}>Oktave {p.octave > 0 ? `+${p.octave}` : p.octave}</span>
              <span style={{ width: 80 }}>{p.frequencyHz} Hz</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg)", overflow: "hidden" }}>
                <div style={{ width: `${p.amplitude * 100}%`, height: "100%", background: "var(--accent)" }} />
              </div>
              <span style={{ width: 45, color: "var(--muted)" }}>{p.amplitude}</span>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          👂 AKUSTISCHE PAREIDOLIE — FLÜSTERNDE SILBEN
        </summary>
        <div style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div style={{ color: "var(--accent)", fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>
            {player.pareidolia.whisperedSyllables.join(" … ")}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7 }}>
            <div>Quelle: {player.pareidolia.source.name} · Modulation {player.pareidolia.modulationRateHz} Hz · Formant-Gain {player.pareidolia.formantGain}</div>
            <div style={{ fontStyle: "italic", marginTop: 4 }}>{player.pareidolia.instruction}</div>
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ▶️ ECHTZEIT-PLAYER-PARAMETER
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div>Master-Gain: {player.masterGain}</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)" }}>{player.instruction}</div>
        </div>
      </details>
    </div>
  );
}
