// MusicalScoreComposer (WP 48.2): Thematischer Soundtrack- & MIDI-Composer.
//
// Emotion-zu-Harmonie-Engine, Figuren-Leitmotive und Standard-MIDI-Export.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  composeForEmotion,
  assignLeitmotif,
  exportAsMidi,
  getScaleForEmotion,
  type SceneEmotion,
} from "@/services/audio/musicalScoreComposer";

export interface MusicalScoreComposerProps {
  className?: string;
}

const EMOTIONS: { id: SceneEmotion; label: string; icon: string }[] = [
  { id: "melancholy", label: "Melancholie", icon: "🌧️" },
  { id: "triumph", label: "Triumph", icon: "🏆" },
  { id: "dread", label: "Schleichendes Grauen", icon: "👻" },
  { id: "playful", label: "Verspielte Magie", icon: "✨" },
  { id: "romantic", label: "Romantik", icon: "💕" },
  { id: "mystery", label: "Mysterium", icon: "🔮" },
];

export function MusicalScoreComposer({ className }: MusicalScoreComposerProps) {
  const [emotion, setEmotion] = useState<SceneEmotion>("melancholy");
  const [character, setCharacter] = useState("");
  const [midi, setMidi] = useState("");

  const score = useMemo(() => composeForEmotion(emotion), [emotion]);
  const scale = useMemo(() => getScaleForEmotion(emotion), [emotion]);
  const leitmotif = useMemo(
    () => (character.trim() ? assignLeitmotif(character.trim(), emotion) : null),
    [character, emotion],
  );

  const handleExport = useCallback(() => {
    setMidi(exportAsMidi(score));
  }, [score]);

  return (
    <div
      className={className}
      data-testid="musical-score-composer"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎵 Soundtrack-Composer
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {score.key} · {score.tempo} BPM · {score.chords.length} Akkorde · {score.melody.length} Noten
      </div>

      {/* Emotion-Auswahl */}
      <div data-testid="score-emotions" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>EMOTION</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              data-testid={`score-emotion-${e.id}`}
              onClick={() => setEmotion(e.id)}
              style={{
                background: emotion === e.id ? "var(--accent)" : "transparent",
                color: emotion === e.id ? "var(--bg)" : "var(--fg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {e.icon} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Skala-Info */}
      <div
        data-testid="score-scale"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>SKALA</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{scale.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Root: {scale.root} · Modus: {scale.mode} · Intervalle: {scale.intervals.join(", ")}
        </div>
      </div>

      {/* Akkorde */}
      <div data-testid="score-chords" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>AKKORDE</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {score.chords.map((c, i) => (
            <div
              key={i}
              data-testid={`score-chord-${i}`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 3,
                padding: "4px 8px",
                fontSize: 10,
              }}
            >
              <strong style={{ color: "var(--accent)" }}>{c.name}</strong>
              <span style={{ color: "var(--muted)" }}> [{c.notes.join(" ")}]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leitmotiv */}
      <div data-testid="score-leitmotif" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>FIGUREN-LEITMOTIV</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            data-testid="score-character"
            placeholder="Figurenname..."
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "5px 7px",
              fontSize: 11,
            }}
          />
        </div>
        {leitmotif && (
          <div
            data-testid="score-leitmotif-result"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              fontSize: 11,
            }}
          >
            <strong style={{ color: "var(--accent)" }}>{leitmotif.characterName}</strong>
            <span style={{ color: "var(--muted)" }}> · Kontur: {leitmotif.contour}</span>
            <div style={{ marginTop: 4, color: "var(--muted)" }}>
              {leitmotif.notes.map((n) => n.pitch).join(" → ")}
            </div>
          </div>
        )}
      </div>

      {/* MIDI-Export */}
      <button
        data-testid="score-export-midi"
        onClick={handleExport}
        style={{
          background: "var(--accent)",
          color: "var(--bg)",
          border: "none",
          borderRadius: 4,
          padding: "6px 14px",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        MIDI exportieren
      </button>

      {midi && (
        <pre
          data-testid="score-midi-output"
          style={{
            marginTop: 8,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            maxHeight: 120,
            overflow: "auto",
            wordBreak: "break-all",
          }}
        >
          {midi}
        </pre>
      )}
    </div>
  );
}
