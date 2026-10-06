// NarrativeVoiceprintClonerModal (WP 81.1)
//
// Interaktiver neuraler Autoren-Stimmabdruck & Voiceprint-Kloner.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  extractVoiceprint,
  scoreTextAgainstProfile,
  formatVoiceprint,
  createPseudonymProfile,
} from "@/services/ai/narrativeVoiceprintCloner";

export interface NarrativeVoiceprintClonerModalProps {
  className?: string;
}

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

export function NarrativeVoiceprintClonerModal({ className }: NarrativeVoiceprintClonerModalProps) {
  const [text, setText] = useState(
    "Der Wind trägt Worte durch die Nacht. Die Sterne flüstern leise. Im Herzen brennt ein helles Feuer.",
  );
  const voiceprint = useMemo(() => extractVoiceprint(text), [text]);
  const profile = useMemo(() => createPseudonymProfile("Dark-Fantasy-Pseudonym", "Düsterer, epischer Tonfall"), []);
  const score = useMemo(() => scoreTextAgainstProfile(text, profile.voiceprint), [text, profile]);

  return (
    <div
      className={className}
      data-testid="voiceprint-cloner-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎭 Neuraler Autoren-Stimmabdruck & Voiceprint-Kloner
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Stiltreue: {score}%
      </div>

      {/* Text-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Text
        <textarea
          data-testid="voiceprint-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Stimmabdruck */}
      <div
        data-testid="voiceprint-profile"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>STIMMABDRUCK</div>
        <div data-testid="voiceprint-score" style={{ color: "var(--accent)", fontWeight: 700 }}>
          Gesamt: {voiceprint.overallScore}%
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Satzmelodie: {voiceprint.sentenceMelody}%</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Metaphern-Dichte: {voiceprint.metaphorDensity}%</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Adjektiv-Präferenz: {voiceprint.adjectivePreference}%</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Satzzeichen-Rhythmus: {voiceprint.punctuationRhythm}%</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Vokabular-Seltenheit: {voiceprint.vocabularyRarity}%</div>
      </div>

      {/* Stiltreue */}
      <div
        data-testid="voiceprint-match"
        style={{
          border: `1px solid ${score >= 70 ? "var(--success)" : "var(--warn)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>STILTREUE</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: score >= 70 ? "var(--success)" : "var(--warn)",
          }}
        >
          {score}%
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>Profil: {profile.name}</div>
      </div>

      {/* Text-Ausgabe */}
      <details data-testid="voiceprint-text-output">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständige Ausgabe
        </summary>
        <pre
          data-testid="voiceprint-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 10,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {formatVoiceprint(voiceprint)}
        </pre>
      </details>
    </div>
  );
}
