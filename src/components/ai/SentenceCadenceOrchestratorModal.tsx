// SentenceCadenceOrchestratorModal (WP 63.1)
//
// Visualisiert die Satzlängen-Wellenform, warnt vor monotonen Ketten und
// poliert den Rhythmus in einem Klick.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  analyzeCadence,
  polishCadence,
  countCategories,
} from "@/services/ai/sentenceCadenceOrchestrator";

export interface SentenceCadenceOrchestratorModalProps {
  /** Vorbefüllter Text. */
  initialText?: string;
  className?: string;
}

const SAMPLE =
  "Ich ging zum Fluss. Der Morgen war kalt und klar, und über dem Wasser lag ein Nebel, der die Konturen der Bäume weichzeichnete, sodass niemand die Grenze zwischen Himmel und Erde mehr finden konnte. Ich blieb stehen.";

const CATEGORY_COLORS: Record<string, string> = {
  staccato: "var(--error)",
  medium: "var(--accent)",
  wave: "var(--success)",
};

export function SentenceCadenceOrchestratorModal({
  initialText = SAMPLE,
  className,
}: SentenceCadenceOrchestratorModalProps) {
  const [text, setText] = useState(initialText);
  const [showPolished, setShowPolished] = useState(false);

  const analysis = useMemo(() => analyzeCadence(text), [text]);
  const polish = useMemo(() => polishCadence(text), [text]);
  const categories = useMemo(() => countCategories(text), [text]);

  const displayed = showPolished ? polish.text : text;
  const displayedAnalysis = showPolished ? analyzeCadence(polish.text) : analysis;

  const maxWords = Math.max(1, ...displayedAnalysis.waveform);

  return (
    <div
      className={className}
      data-testid="sentence-cadence-orchestrator-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🎼 Kadenz- & Satzrhythmus-Orchestrator
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {displayedAnalysis.sentenceCount} Sätze · Ø {displayedAnalysis.averageWords} Wörter · Rhythmus{" "}
        {Math.round(displayedAnalysis.rhythmScore * 100)}%
      </div>

      {/* Text */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 10 }}>
        Text
        <textarea
          data-testid="cadence-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            background: "var(--panel)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
      </label>

      {/* Politur-Umschalter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button
          data-testid="cadence-toggle-polish"
          onClick={() => setShowPolished((v) => !v)}
          aria-pressed={showPolished}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            borderRadius: 4,
            cursor: "pointer",
            background: showPolished ? "var(--accent)" : "var(--panel)",
            color: showPolished ? "var(--bg)" : "var(--fg)",
            border: "1px solid var(--border)",
          }}
        >
          {showPolished ? "Original zeigen" : "1-Klick-Kadenz-Politur"}
        </button>
        <span data-testid="cadence-polish-stats" style={{ fontSize: 11, color: "var(--muted)" }}>
          {polish.splitCount} zerlegt · {polish.mergedCount} verbunden
        </span>
      </div>

      {/* Wellenform */}
      <div
        data-testid="cadence-waveform"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          SATZLÄNGEN-WELLENFORM (WORDS PER SENTENCE)
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
          {displayedAnalysis.waveform.map((w, i) => {
            const cat = displayedAnalysis.sentences[i]?.category ?? "medium";
            return (
              <div
                key={i}
                data-testid={`cadence-bar-${i}`}
                title={`Satz ${i + 1}: ${w} Wörter (${cat})`}
                style={{
                  flex: 1,
                  minWidth: 4,
                  height: `${Math.max(6, (w / maxWords) * 100)}%`,
                  background: CATEGORY_COLORS[cat] ?? "var(--border)",
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10 }}>
          {(["staccato", "medium", "wave"] as const).map((c) => (
            <span key={c} data-testid={`cadence-count-${c}`} style={{ color: CATEGORY_COLORS[c] }}>
              {c}: {showPolished ? displayedAnalysis.sentences.filter((s) => s.category === c).length : categories[c]}
            </span>
          ))}
        </div>
      </div>

      {/* Monotonie-Alarm */}
      <div
        data-testid="cadence-monotony"
        style={{
          border: `1px solid ${displayedAnalysis.warnings.length > 0 ? "var(--error)" : "var(--success)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          MONOTONIE-ALARM
        </div>
        {displayedAnalysis.warnings.length === 0 ? (
          <div data-testid="cadence-no-warnings" style={{ color: "var(--success)", fontWeight: 700 }}>
            ✓ Kein Monotonie-Problem — der Rhythmus atmet
          </div>
        ) : (
          displayedAnalysis.warnings.map((w, i) => (
            <div
              key={i}
              data-testid={`cadence-warning-${i}`}
              style={{ color: "var(--error)", marginBottom: 3 }}
            >
              ⚠ {w.message}
            </div>
          ))
        )}
      </div>

      {/* Rhythmus-Score */}
      <div
        data-testid="cadence-score"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div>
          Rhythmus-Score:{" "}
          <strong data-testid="cadence-score-value">
            {Math.round(displayedAnalysis.rhythmScore * 100)}%
          </strong>
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Streuung (σ): {displayedAnalysis.stdDeviation} Wörter
        </div>
        {polish.improved && (
          <div
            data-testid="cadence-improvement"
            style={{ marginTop: 6, color: "var(--success)", fontWeight: 700 }}
          >
            Politur verbessert: {Math.round(polish.scoreBefore * 100)}% →{" "}
            {Math.round(polish.scoreAfter * 100)}%
          </div>
        )}
      </div>

      {/* Text-Vorschau */}
      <div data-testid="cadence-preview">
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>
          {showPolished ? "POLIERTER TEXT" : "ORIGINALTEXT"}
        </div>
        <div
          data-testid="cadence-preview-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {displayed || "—"}
        </div>
      </div>
    </div>
  );
}
