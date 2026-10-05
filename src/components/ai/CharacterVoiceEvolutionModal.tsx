// CharacterVoiceEvolutionModal (WP 64.2)
//
// Vorher/Nachher-Gegenüberstellung: Zeigt den dramaturgischen Wandel
// einer Figur im direkten Dialog-Vergleich.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  evolveCharacterVoice,
  compareVoices,
  analyzeVoiceShift,
  TRAUMA_LABELS,
  type TraumaMark,
  type TraumaType,
} from "@/services/ai/characterVoiceEvolution";

export interface CharacterVoiceEvolutionModalProps {
  className?: string;
}

const TRAUMA_TYPES: TraumaType[] = [
  "betrayal",
  "loss",
  "battle",
  "humiliation",
  "revelation",
  "growth",
];

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

export function CharacterVoiceEvolutionModal({ className }: CharacterVoiceEvolutionModalProps) {
  const [character, setCharacter] = useState("Mira");
  const [traumas, setTraumas] = useState<TraumaMark[]>([
    { chapter: 8, type: "betrayal", label: "Hinrichtung des Mentors" },
    { chapter: 16, type: "loss", label: "Verlust des linken Armes" },
    { chapter: 22, type: "battle", label: "Schlacht am Schwarzen Fluss" },
  ]);

  const evolution = useMemo(
    () => evolveCharacterVoice(character, traumas),
    [character, traumas],
  );

  const analysis = useMemo(() => analyzeVoiceShift(evolution), [evolution]);
  const comparison = useMemo(() => compareVoices(evolution), [evolution]);

  const addTrauma = () => {
    setTraumas((prev) => [
      ...prev,
      { chapter: prev.length > 0 ? prev[prev.length - 1].chapter + 1 : 1, type: "betrayal", label: "Neue Zäsur" },
    ]);
  };

  const removeTrauma = (index: number) => {
    setTraumas((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTrauma = (index: number, field: keyof TraumaMark, value: string | number) => {
    setTraumas((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  return (
    <div
      className={className}
      data-testid="character-voice-evolution-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎙️ Figurenstimmen-Evolutions-Modulator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {evolution.character} · {traumas.length} Zäsuren · Wandel{" "}
        {Math.round(evolution.shiftMagnitude * 100)}%
      </div>

      {/* Figurenname */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Figur
        <input
          data-testid="voice-character-input"
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Trauma-Marken */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          TRAUMA- & WACHSTUMS-MARKEN
        </div>
        {traumas.map((trauma, i) => (
          <div
            key={i}
            data-testid={`voice-trauma-${i}`}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <input
              data-testid={`voice-trauma-chapter-${i}`}
              type="number"
              min={1}
              value={trauma.chapter}
              onChange={(e) => updateTrauma(i, "chapter", Number(e.target.value) || 1)}
              style={{ ...inputStyle, width: 60, marginTop: 0 }}
            />
            <select
              data-testid={`voice-trauma-type-${i}`}
              value={trauma.type}
              onChange={(e) => updateTrauma(i, "type", e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 120, marginTop: 0 }}
            >
              {TRAUMA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TRAUMA_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              data-testid={`voice-trauma-label-${i}`}
              value={trauma.label}
              onChange={(e) => updateTrauma(i, "label", e.target.value)}
              style={{ ...inputStyle, flex: 2, minWidth: 140, marginTop: 0 }}
            />
            <button
              data-testid={`voice-trauma-remove-${i}`}
              onClick={() => removeTrauma(i)}
              style={{
                fontSize: 10,
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                background: "var(--panel)",
                color: "var(--error)",
                border: "1px solid var(--border)",
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          data-testid="voice-add-trauma"
          onClick={addTrauma}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            borderRadius: 4,
            cursor: "pointer",
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
          }}
        >
          + Zäsur hinzufügen
        </button>
      </div>

      {/* Vorher/Nachher-Vergleich */}
      <div
        data-testid="voice-comparison"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          VORHER / NACHHER
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
              VORHER (Kapitel 1)
            </div>
            <div data-testid="voice-before-verbosity">
              Gesprächigkeit: {Math.round(evolution.before.verbosity * 100)}%
            </div>
            <div data-testid="voice-before-cynicism">
              Zynismus: {Math.round(evolution.before.cynicism * 100)}%
            </div>
            <div data-testid="voice-before-sarcasm">
              Sarkasmus: {Math.round(evolution.before.sarcasm * 100)}%
            </div>
            <div data-testid="voice-before-naivety">
              Naivität: {Math.round(evolution.before.naivety * 100)}%
            </div>
            <div data-testid="voice-before-sentence-length">
              Ø Satzlänge: {evolution.before.avgSentenceLength} Wörter
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
              NACHHER (Kapitel {traumas.length > 0 ? traumas[traumas.length - 1].chapter : 1})
            </div>
            <div data-testid="voice-after-verbosity">
              Gesprächigkeit: {Math.round(evolution.after.verbosity * 100)}%
            </div>
            <div data-testid="voice-after-cynismus">
              Zynismus: {Math.round(evolution.after.cynicism * 100)}%
            </div>
            <div data-testid="voice-after-sarcasm">
              Sarkasmus: {Math.round(evolution.after.sarcasm * 100)}%
            </div>
            <div data-testid="voice-after-naivety">
              Naivität: {Math.round(evolution.after.naivety * 100)}%
            </div>
            <div data-testid="voice-after-sentence-length">
              Ø Satzlänge: {evolution.after.avgSentenceLength} Wörter
            </div>
          </div>
        </div>
      </div>

      {/* Wandels-Analyse */}
      <div
        data-testid="voice-shift-analysis"
        style={{
          border: `1px solid ${analysis.significantlyChanged ? "var(--error)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          WANDELS-ANALYSE
        </div>
        <div>
          Gesamtwandel:{" "}
          <strong data-testid="voice-total-shift">
            {Math.round(analysis.totalShift * 100)}%
          </strong>
        </div>
        <div
          data-testid="voice-significantly-changed"
          style={{
            marginTop: 4,
            fontWeight: 700,
            color: analysis.significantlyChanged ? "var(--error)" : "var(--success)",
          }}
        >
          {analysis.significantlyChanged
            ? "⚠ Deutlicher Wandel — die Figur ist nicht mehr dieselbe"
            : "✓ Kein deutlicher Wandel — die Figur bleibt konsistent"}
        </div>
      </div>

      {/* Vollständiger Vergleich */}
      <details data-testid="voice-full-comparison">
        <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
          Vollständiger Vergleich
        </summary>
        <pre
          data-testid="voice-comparison-text"
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
          {comparison}
        </pre>
      </details>
    </div>
  );
}
