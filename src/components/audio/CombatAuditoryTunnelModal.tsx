// CombatAuditoryTunnelModal (WP 87.1 UI)
import { useState, useMemo, useEffect, useRef } from "react";
import {
  createShockProfile,
  simulateAuditoryState,
  generateShockProse,
  playShockDemo,
  type ShockSource,
} from "@/services/audio/combatAuditoryTunnel";

export interface CombatAuditoryTunnelModalProps {
  className?: string;
}

const SHOCK_SOURCES: ShockSource[] = ["explosion", "naher_schuss", "schwert_auf_helm", "kanonendonner", "magischer_knall", "donner", "granate", "schallwand"];

export function CombatAuditoryTunnelModal({ className }: CombatAuditoryTunnelModalProps) {
  const [source, setSource] = useState<ShockSource>("explosion");
  const [seed, setSeed] = useState(42);
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [language, setLanguage] = useState<"de" | "en" | "es" | "fr">("de");
  const animationRef = useRef<number>();

  const profile = useMemo(() => createShockProfile(source, seed), [source, seed]);
  const state = useMemo(() => simulateAuditoryState(profile, timeMs), [profile, timeMs]);
  const prose = useMemo(() => generateShockProse(profile, language), [profile, language]);

  const startAnimation = () => {
    setPlaying(true);
    setTimeMs(0);
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      setTimeMs(elapsed);
      if (elapsed < profile.recoveryTimeS * 1000 + 2000) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setPlaying(false);
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setPlaying(false);
    setTimeMs(0);
  };

  useEffect(() => {
    if (playing) startAnimation();
    else stopAnimation();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [playing, profile.recoveryTimeS]);

  const handlePlayDemo = async () => {
    await playShockDemo(profile, 3000);
  };

  return (
    <div
      className={className}
      data-testid="combat-auditory-modal"
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
        💥 Kampf-Tinnitus & Hör-Tunnel-Simulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Quelle: {source} · Seed: {seed} · Zeit: {timeMs}ms / {(profile.recoveryTimeS * 1000).toFixed(0)}ms
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 150 }}>
          Schock-Quelle
          <select value={source} onChange={e => setSource(e.target.value as ShockSource)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            {SHOCK_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Seed
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }} />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Sprache
          <select value={language} onChange={e => setLanguage(e.target.value as "de" | "en" | "es" | "fr")} style={{ width: "100%", marginTop: 4, padding: "4px 8px", fontSize: 11 }}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => { setPlaying(true); startAnimation(); }}
          disabled={playing}
          style={{ padding: "8px 16px", fontSize: 11, background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: playing ? "not-allowed" : "pointer", opacity: playing ? 0.6 : 1 }}
        >
          ▶ Animation starten ({Math.round(profile.recoveryTimeS)}s)
        </button>
        <button
          onClick={stopAnimation}
          disabled={!playing}
          style={{ padding: "8px 16px", fontSize: 11, background: "var(--warn)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: playing ? "pointer" : "not-allowed", opacity: playing ? 1 : 0.6 }}
        >
          ■ Stop
        </button>
        <button
          onClick={handlePlayDemo}
          style={{ padding: "8px 16px", fontSize: 11, background: "var(--success)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          🔊 WebAudio Demo (3s)
        </button>
        <div style={{ marginLeft: "auto", padding: "8px 12px", fontSize: 11, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 4 }}>
          Fortschritt: {Math.round((timeMs / (profile.recoveryTimeS * 1000)) * 100)}%
        </div>
      </div>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📊 SHOCK-PROFIL
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Peak dB</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.peakDb} dB</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Dauer</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.durationMs} ms</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Tinnitus-Freq</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.tinnitusFreqHz} Hz</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Tinnitus-dB</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.tinnitusDb} dB</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Tiefpass</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.lowPassCutoffHz} Hz (Q={profile.lowPassQ})</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Erholung</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.recoveryTimeS} s</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Herzfrequenz</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.heartRateBpm} bpm</div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📈 AKTUELLER AUDITORY STATE (t={timeMs}ms)
        </summary>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 11 }}>
          <div style={{ padding: 6, border: `1px solid ${state.ringing ? "var(--warn)" : "var(--border)"}`, borderRadius: 4, background: state.ringing ? "rgba(255,165,0,0.1)" : "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Umgebungs-dB</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{state.ambientDb} dB</div>
          </div>
          <div style={{ padding: 6, border: `1px solid ${state.ringing ? "var(--warn)" : "var(--border)"}`, borderRadius: 4, background: state.ringing ? "rgba(255,165,0,0.1)" : "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Tinnitus-dB</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: state.ringing ? "var(--warn)" : "var(--fg)" }}>{state.tinnitusDb} dB</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Tiefpass-Freq</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{state.lowPassFreq} Hz</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Herzfrequenz</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{state.heartRateBpm} bpm</div>
          </div>
          <div style={{ padding: 6, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)" }}>
            <div style={{ color: "var(--muted)" }}>Gedämpft</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round(state.muffledFactor * 100)}%</div>
          </div>
          <div style={{ padding: 6, border: `1px solid ${state.ringing ? "var(--warn)" : "var(--success)"}`, borderRadius: 4, background: state.ringing ? "rgba(255,165,0,0.1)" : "rgba(0,255,0,0.1)" }}>
            <div style={{ color: "var(--muted)" }}>Tinnitus</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: state.ringing ? "var(--warn)" : "var(--success)" }}>
              {state.ringing ? "AKTIV" : "RUHE"}
            </div>
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 12 }} open>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          ✍️ VISZERALE SCHOCK-PROSA ({language.toUpperCase()})
        </summary>
        <div style={{ marginTop: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {language === "de" && prose.german}
          {language === "en" && prose.english}
          {language === "es" && prose.spanish}
          {language === "fr" && prose.french}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)" }}>
          <strong>Intensität:</strong> {prose.intensity} |
          <strong>Sensorische Details:</strong> {prose.sensoryDetails.join(", ")}
        </div>
      </details>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          🔧 WEBAUDIO API (Demo)
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <div>Oszillator: Sinus @ {profile.tinnitusFreqHz} Hz</div>
          <div>Gain: {profile.tinnitusDb} dB (Tinnitus)</div>
          <div>Filter: Tiefpass @ {profile.lowPassCutoffHz} Hz (Q={profile.lowPassQ})</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={handlePlayDemo} style={{ padding: "6px 12px", fontSize: 11, background: "var(--accent)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: "pointer" }}>
              🔊 Tinnitus + Filter Demo (3 Sekunden)
            </button>
          </div>
        </div>
      </details>

      <details>
        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}>
          📋 ALLE QUELLEN IM VERGLEICH
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
          {SHOCK_SOURCES.map(s => {
            const p = createShockProfile(s, seed);
            return (
              <div key={s} style={{ padding: 6, border: `1px solid ${s === source ? "var(--accent)" : "var(--border)"}`, borderRadius: 4, background: s === source ? "var(--panel)" : "transparent" }}>
                <strong>{s.toUpperCase()}</strong>: {p.peakDb}dB / {p.durationMs}ms / Tinnitus {p.tinnitusFreqHz}Hz / Tiefpass {p.lowPassCutoffHz}Hz / Erholung {p.recoveryTimeS}s / Puls {p.heartRateBpm}bpm
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}