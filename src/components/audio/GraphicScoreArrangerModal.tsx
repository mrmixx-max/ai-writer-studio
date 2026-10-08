// GraphicScoreArrangerModal (WP 105.1 UI)
import { useState, useMemo } from "react";
import {
  arrangeGraphicScore,
  renderScoreSvg,
  buildScoreAudioPatch,
  createSampleSceneTensions,
  SOUND_SCULPTURES,
} from "@/services/audio/graphicScoreArranger";

export interface GraphicScoreArrangerModalProps {
  className?: string;
}

export function GraphicScoreArrangerModal({ className }: GraphicScoreArrangerModalProps) {
  const [title, setTitle] = useState("Die Schenke am Nebelpass");
  const [seed, setSeed] = useState(42);

  const scenes = useMemo(() => createSampleSceneTensions(), []);
  const score = useMemo(() => arrangeGraphicScore(title, scenes, seed), [title, scenes, seed]);
  const scoreExport = useMemo(() => renderScoreSvg(score), [score]);
  const patch = useMemo(() => buildScoreAudioPatch(score), [score]);

  return (
    <div
      className={className}
      data-testid="graphic-score-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎼 Grafische Partitur &amp; Avantgarde-Soundtrack
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Partitur {score.id} · {score.bands.length} Klangbänder · {score.totalSeconds}s · Spitze {score.peakTension}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          📈 DRUCKFERTIGE PARTITUR (VEKTOR)
        </summary>
        <div
          style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", overflow: "auto" }}
          dangerouslySetInnerHTML={{ __html: scoreExport.svg }}
        />
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
          {scoreExport.bandCount} Bänder · {scoreExport.width}×{scoreExport.height} px · exportierbar als Vektor-PDF
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎚️ SPANNUNGS-ZU-KLANG-MATRIX
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {score.bands.map((band) => (
            <div key={band.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{band.sculpture.graphicMark} {band.sculpture.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{band.startSeconds}s–{band.startSeconds + band.durationSeconds}s</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{band.sculpture.description}</div>
              <div style={{ fontSize: 10, marginTop: 2 }}>
                Intensität {(band.intensity * 100).toFixed(0)}% · {band.baseFrequencyHz} Hz · Rauheit {(band.roughness * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔊 WEBAUDIO-SYNTHESE-PATCH
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div style={{ marginBottom: 6, fontStyle: "italic", color: "var(--muted)" }}>{patch.instruction}</div>
          {patch.bands.map((b, i) => (
            <div key={i} style={{ fontSize: 10, padding: "2px 0" }}>
              <span style={{ color: "var(--accent)" }}>{b.sculptureId}</span>: {b.oscillator} @ {b.frequencyHz} Hz · detune {b.detuneCents}¢ · gain {b.gain} · filter {b.filterHz} Hz
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎨 KLANGSKULPTUREN-VOKABULAR ({SOUND_SCULPTURES.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SOUND_SCULPTURES.map((s) => (
            <div key={s.id} style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 10 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>{s.graphicMark}</span> {s.name}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
