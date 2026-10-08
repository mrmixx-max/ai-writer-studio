// AudioDramaMasterDirectorModal (WP 101.1 UI)
import { useState, useMemo } from "react";
import {
  createAudioDramaPlan,
  createSampleAudioDramaPlan,
} from "@/services/audio/audioDramaMasterDirector";

export interface AudioDramaMasterDirectorModalProps {
  className?: string;
}

export function AudioDramaMasterDirectorModal({ className }: AudioDramaMasterDirectorModalProps) {
  const [title, setTitle] = useState("Die Schenke am Nebelpass");
  const [seed, setSeed] = useState(42);

  const plan = useMemo(() => createAudioDramaPlan(title, seed), [title, seed]);

  const trackColor = (type: string) =>
    type === "voice" ? "var(--accent)" : type === "foley" ? "var(--warn)" : type === "ambient" ? "var(--muted)" : "var(--success)";

  return (
    <div
      className={className}
      data-testid="audio-drama-director-modal"
      style={{ background: "var(--bg)", color: "var(--fg)", padding: 16, height: "100%", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 12 }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎙️ Full-Cast Hörspiel-Master-Regiepult
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Plan {plan.id} · {plan.report.cueCount} Cues · Gesamtdauer {plan.report.totalDurationMs} ms
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Szenen-Titel
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11, background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
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
          🎭 CAST &amp; STIMMPROFILE ({plan.scene.cast.length})
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {plan.scene.cast.map((c) => (
            <div key={c.id} style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{c.characterName}</strong>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{c.role}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>Stimmprofil: {c.voiceProfile}</div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎚️ 4-SPUR-MASTER-ZEITLEISTE
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {plan.scene.tracks.map((t) => (
            <div key={t.id} style={{ padding: 8, border: `1px solid ${trackColor(t.type)}`, borderRadius: 4, background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <strong style={{ color: trackColor(t.type) }}>{t.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>Gain {t.gainDb} dB · {t.cues.length} Cues</span>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {t.cues.map((c) => (
                  <span key={c.id} style={{ padding: "2px 6px", fontSize: 9, border: "1px solid var(--border)", borderRadius: 3, background: "var(--bg)" }}>
                    {c.label} @ {c.startMs}ms{c.castRole ? ` (${c.castRole})` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎧 WEB-AUDIO-VORHÖREN (MIXDOWN)
        </summary>
        <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 11 }}>
          <div>Spitzenwert: {plan.preview.peakDb} dB (Limiter −0.5 dB)</div>
          <div>Ducking angewandt: {plan.preview.duckingApplied ? "ja" : "nein"}</div>
          <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 2 }}>{plan.preview.sampleCount} Sample-Fenster @ 50 ms</div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎬 DAW-EXPORT — CUESHEET (CSV)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 200, overflow: "auto" }}>
          {plan.cueSheetCsv}
        </pre>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🎞️ DAW-EXPORT — EDL (PRO TOOLS / REAPER)
        </summary>
        <pre style={{ marginTop: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--panel)", maxHeight: 200, overflow: "auto" }}>
          {plan.edl}
        </pre>
        <button
          onClick={() => {
            const s = createSampleAudioDramaPlan();
            setTitle(s.scene.title);
            setSeed(42);
          }}
          style={{ marginTop: 8, padding: "6px 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          🎲 BEISPIEL LADEN
        </button>
      </details>
    </div>
  );
}
