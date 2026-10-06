// ProceduralVoiceTimbreModal (WP 70.1)
//
// Akustische Stimm-Charakterisierung mit WebAudio-Vorschau und
// Akzent-Transformation.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo, useRef, useCallback } from "react";
import {
  synthesizeVoiceTimbre,
  applyAccent,
  buildVoiceTestPhrase,
  voiceDistance,
  ACCENT_LABELS,
  DEFAULT_TEST_PHRASE,
  type AccentProfile,
  type VoiceProfileInput,
} from "@/services/audio/proceduralVoiceTimbre";

export interface ProceduralVoiceTimbreModalProps {
  className?: string;
}

const ACCENTS: AccentProfile[] = ["neutral", "scottish", "bavarian", "french", "berlin", "victorian"];

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--panel)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
} as const;

export function ProceduralVoiceTimbreModal({ className }: ProceduralVoiceTimbreModalProps) {
  const [name, setName] = useState("Mira");
  const [age, setAge] = useState(34);
  const [gender, setGender] = useState<VoiceProfileInput["gender"]>("female");
  const [build, setBuild] = useState<VoiceProfileInput["build"]>("average");
  const [mood, setMood] = useState<VoiceProfileInput["mood"]>("warm");
  const [accent, setAccent] = useState<AccentProfile>("neutral");
  const [testPhrase, setTestPhrase] = useState(DEFAULT_TEST_PHRASE);
  const [playing, setPlaying] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const profile: VoiceProfileInput = useMemo(
    () => ({ name, age, gender, build, mood }),
    [name, age, gender, build, mood],
  );

  const timbre = useMemo(() => synthesizeVoiceTimbre(profile), [profile]);
  const accentResult = useMemo(() => buildVoiceTestPhrase(testPhrase, accent), [testPhrase, accent]);
  const plainPhrase = useMemo(() => applyAccent(testPhrase, "neutral"), [testPhrase]);

  /** Spielt einen kurzen Synthese-Ton mit den Formanten-Parametern. */
  const playPreview = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = timbre.vocalFry > 25 ? "sawtooth" : "sine";
      osc.frequency.value = timbre.pitchHz;

      // Atemanteil als leichtes Rauschen über einen zweiten Oszillator.
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.95);

      setPlaying(true);
      window.setTimeout(() => setPlaying(false), 950);
    } catch {
      setPlaying(false);
    }
  }, [timbre]);

  return (
    <div
      className={className}
      data-testid="procedural-voice-timbre-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎙️ Stimmfarben- & Akzent-Synthesizer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {timbre.pitchHz} Hz · {timbre.character}
      </div>

      {/* Figurenprofil */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 2, minWidth: 120 }}>
          Figur
          <input
            data-testid="timbre-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 80 }}>
          Alter
          <input
            data-testid="timbre-age-input"
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={(e) => setAge(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Geschlecht
          <select
            data-testid="timbre-gender-select"
            value={gender}
            onChange={(e) => setGender(e.target.value as VoiceProfileInput["gender"])}
            style={inputStyle}
          >
            <option value="female">weiblich</option>
            <option value="male">männlich</option>
            <option value="neutral">neutral</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Statur
          <select
            data-testid="timbre-build-select"
            value={build}
            onChange={(e) => setBuild(e.target.value as VoiceProfileInput["build"])}
            style={inputStyle}
          >
            <option value="slight">zierlich</option>
            <option value="average">durchschnittlich</option>
            <option value="heavy">schwer</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 100 }}>
          Stimmung
          <select
            data-testid="timbre-mood-select"
            value={mood}
            onChange={(e) => setMood(e.target.value as VoiceProfileInput["mood"])}
            style={inputStyle}
          >
            <option value="warm">warm</option>
            <option value="calm">ruhig</option>
            <option value="anxious">ängstlich</option>
            <option value="authoritative">autoritär</option>
            <option value="cold">kalt</option>
          </select>
        </label>
      </div>

      {/* Formanten-Parameter */}
      <div
        data-testid="timbre-parameters"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          AKUSTISCHE FORMANTEN-PARAMETER
        </div>
        {[
          { id: "pitch", label: "Grundfrequenz", value: `${timbre.pitchHz} Hz`, pct: Math.min(100, (timbre.pitchHz / 400) * 100) },
          { id: "formant", label: "Formantenverschiebung", value: `${timbre.formantShift}%`, pct: Math.abs(timbre.formantShift) * 3 },
          { id: "fry", label: "Heiserkeit / Vocal Fry", value: `${timbre.vocalFry}%`, pct: (timbre.vocalFry / 60) * 100 },
          { id: "breath", label: "Atemanteil", value: `${timbre.breathiness}%`, pct: (timbre.breathiness / 70) * 100 },
          { id: "tremor", label: "Zitterfrequenz", value: `${timbre.tremorHz} Hz`, pct: (timbre.tremorHz / 12) * 100 },
          { id: "rate", label: "Sprechrate", value: `${timbre.speechRate} Silb/s`, pct: (timbre.speechRate / 8) * 100 },
        ].map((p) => (
          <div key={p.id} data-testid={`timbre-param-${p.id}`} style={{ marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--muted)" }}>{p.label}</span>
              <span style={{ color: "var(--accent)" }}>{p.value}</span>
            </div>
            <div style={{ height: 4, background: "var(--panel)", borderRadius: 2, marginTop: 2 }}>
              <div
                style={{
                  width: `${Math.max(2, Math.min(100, p.pct))}%`,
                  height: 4,
                  background: "var(--accent)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Akzent */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Dialekt / Akzent
        <select
          data-testid="timbre-accent-select"
          value={accent}
          onChange={(e) => setAccent(e.target.value as AccentProfile)}
          style={inputStyle}
        >
          {ACCENTS.map((a) => (
            <option key={a} value={a}>
              {ACCENT_LABELS[a]}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Sprechprobe
        <textarea
          data-testid="timbre-phrase-input"
          value={testPhrase}
          onChange={(e) => setTestPhrase(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Akzent-Ergebnis */}
      <div
        data-testid="timbre-accent-result"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 12,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          {accentResult.accentLabel} — {accentResult.appliedRules} Regel(n) angewendet
        </div>
        <div data-testid="timbre-transformed" style={{ marginBottom: 6 }}>
          „{accentResult.text}"
        </div>
        {accentResult.matchedRules.length > 0 && (
          <div data-testid="timbre-rules" style={{ fontSize: 10, color: "var(--muted)" }}>
            {accentResult.matchedRules.join(" · ")}
          </div>
        )}
      </div>

      {/* WebAudio-Vorschau */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button
          data-testid="timbre-play"
          onClick={playPreview}
          style={{
            fontSize: 11,
            padding: "6px 16px",
            borderRadius: 4,
            cursor: "pointer",
            background: playing ? "var(--success)" : "var(--accent)",
            color: "var(--bg)",
            border: "none",
          }}
        >
          {playing ? "▶ klingt…" : "▶ Stimmklang hören"}
        </button>
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          WebAudio-Synthese · {timbre.pitchHz} Hz
        </span>
      </div>

      {/* Vergleich mit anderer Figur */}
      <div
        data-testid="timbre-compare"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          STIMM-ABSTAND ZUR REFERENZ
        </div>
        <div data-testid="timbre-distance">
          {voiceDistance(timbre, synthesizeVoiceTimbre({ name: "Referenz", age: 34, gender: "female" }))}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Original (neutral): {plainPhrase.text.slice(0, 60)}…
        </div>
      </div>
    </div>
  );
}
