// AiFilmAudioPromptGeneratorModal (WP 67.1)
//
// 3-Spur Audio- & Sprach-Prompt-Director für ElevenLabs, Suno und Foley FX.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  generateDialogue,
  generateFoley,
  generateScore,
  generateAudioPrompts,
  formatAudioPrompts,
  AUDIO_ENGINE_LABELS,
  type AudioEngine,
} from "@/services/ai/aiFilmAudioPromptGenerator";

export interface AiFilmAudioPromptGeneratorModalProps {
  className?: string;
}

const ENGINES: AudioEngine[] = ["elevenlabs", "suno", "udio"];

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

export function AiFilmAudioPromptGeneratorModal({ className }: AiFilmAudioPromptGeneratorModalProps) {
  const [engine, setEngine] = useState<AudioEngine>("elevenlabs");
  const [dialogueInput, setDialogueInput] = useState("I know what you did\nWe need to leave now");
  const [foleyInput, setFoleyInput] = useState("Door creaks open\nGlass shatters");
  const [scoreInput, setScoreInput] = useState("Tense strings\nEpic brass");

  const dialogueLines = useMemo(
    () => dialogueInput.split("\n").filter((l) => l.trim().length > 0),
    [dialogueInput],
  );
  const foleyEvents = useMemo(
    () => foleyInput.split("\n").filter((l) => l.trim().length > 0),
    [foleyInput],
  );
  const scoreSections = useMemo(
    () => scoreInput.split("\n").filter((l) => l.trim().length > 0),
    [scoreInput],
  );

  const dialogue = useMemo(
    () => generateDialogue(dialogueLines, engine),
    [dialogueLines, engine],
  );
  const foley = useMemo(
    () => generateFoley(foleyEvents, engine),
    [foleyEvents, engine],
  );
  const score = useMemo(
    () => generateScore(scoreSections, engine),
    [scoreSections, engine],
  );
  const result = useMemo(
    () => generateAudioPrompts(engine, dialogueLines, foleyEvents, scoreSections),
    [engine, dialogueLines, foleyEvents, scoreSections],
  );

  return (
    <div
      className={className}
      data-testid="ai-film-audio-prompt-generator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎵 AI Film Audio Prompt Director
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {AUDIO_ENGINE_LABELS[engine]} · {dialogue.length} Dialoge · {foley.length} Foley · {score.length} Score
      </div>

      {/* Engine-Auswahl */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Audio-Engine
        <select
          data-testid="audio-engine-select"
          value={engine}
          onChange={(e) => setEngine(e.target.value as AudioEngine)}
          style={inputStyle}
        >
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {AUDIO_ENGINE_LABELS[e]}
            </option>
          ))}
        </select>
      </label>

      {/* Dialog-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Dialogzeilen (eine Zeile je Satz)
        <textarea
          data-testid="audio-dialogue-input"
          value={dialogueInput}
          onChange={(e) => setDialogueInput(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Foley-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Foley-Ereignisse (eine Zeile je Ereignis)
        <textarea
          data-testid="audio-foley-input"
          value={foleyInput}
          onChange={(e) => setFoleyInput(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Score-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 14 }}>
        Score-Sektionen (eine Zeile je Sektion)
        <textarea
          data-testid="audio-score-input"
          value={scoreInput}
          onChange={(e) => setScoreInput(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {/* Spur 1: Voice & Dialog */}
      <div
        data-testid="audio-dialogue"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SPUR 1: VOICE & DIALOG
        </div>
        {dialogue.map((d, i) => (
          <div key={i} data-testid={`audio-dialogue-${i}`} style={{ marginBottom: 6 }}>
            <div>
              <strong style={{ color: "var(--accent)" }}>[{d.timecode}s] {d.speaker}:</strong> "{d.text}"
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>SSML: {d.ssml}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Cue: {d.voiceCue}</div>
          </div>
        ))}
      </div>

      {/* Spur 2: Foley & Sound FX */}
      <div
        data-testid="audio-foley"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SPUR 2: FOLEY & SOUND FX
        </div>
        {foley.map((f, i) => (
          <div key={i} data-testid={`audio-foley-${i}`} style={{ marginBottom: 4 }}>
            <div>
              <strong style={{ color: "var(--accent)" }}>[{f.timecode}s]</strong> {f.description}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Prompt: {f.prompt}</div>
          </div>
        ))}
      </div>

      {/* Spur 3: Soundtrack & Score */}
      <div
        data-testid="audio-score"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SPUR 3: SOUNDTRACK & SCORE
        </div>
        {score.map((s, i) => (
          <div key={i} data-testid={`audio-score-${i}`} style={{ marginBottom: 4 }}>
            <div>
              <strong style={{ color: "var(--accent)" }}>[{s.timecode}s]</strong> {s.tag}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{s.description}</div>
          </div>
        ))}
      </div>

      {/* Vollständige Ausgabe */}
      <details data-testid="audio-full">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="audio-formatted"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
          }}
        >
          {formatAudioPrompts(result)}
        </pre>
      </details>
    </div>
  );
}
