// DopaminePacingSynthesizerModal (WP 72.1)
//
// Interaktive Visualisierung der Dopamin-Kurve, Curiosity-Loops und
// Cliffhanger-Positionen.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useState, useMemo } from "react";
import {
  analyzePacing,
  formatDopamineCurve,
  formatCuriosityLoops,
  formatCliffhangers,
} from "@/services/dramaturgy/dopaminePacingSynthesizer";

export interface DopaminePacingSynthesizerModalProps {
  initialText?: string;
  className?: string;
}

const SAMPLE = `Sie stand am Fenster und weinte. Der Verlust saß zu tief, und niemand konnte sie trösten.

Plötzlich zersplitterte das Glas. Eine Waffe, ein Schuss, keine Zeit mehr — sie rannte, die Angst im Nacken.

Wer war der Angreifer? Niemand wusste es. Das Geheimnis blieb verborgen.

Also, der Angreifer war ihr bester Freund. Die Wahrheit wurde enthüllt, eine Katharsis, die alle erlöste.

Er stolperte über den Teppich, ein alberner Patzer, und alle kicherten laut.`;

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

export function DopaminePacingSynthesizerModal({
  initialText = SAMPLE,
  className,
}: DopaminePacingSynthesizerModalProps) {
  const [text, setText] = useState(initialText);
  const [seed, setSeed] = useState(42);

  const report = useMemo(() => analyzePacing(text, seed), [text, seed]);

  return (
    <div
      className={className}
      data-testid="dopamine-pacing-modal"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        🧠 Dopamin-Pacing & Curiosity-Loops
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {report.dopamineCurve.length} Absätze · Ø {report.averageDopamine}% · Peak {report.peakDopamine}%
      </div>

      {/* Text-Eingabe */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Manuskript
        <textarea
          data-testid="dopamine-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11 }}
        />
      </label>

      {/* Seed */}
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 12 }}>
        Seed
        <input
          data-testid="dopamine-seed-input"
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </label>

      {/* Pacing-Verdict */}
      <div
        data-testid="dopamine-verdict"
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>PACING-BEWERTUNG</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>{report.pacingVerdict}</div>
      </div>

      {/* Dopamin-Kurve */}
      <div
        data-testid="dopamine-curve"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>DOPAMIN-KURVE</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, marginBottom: 6 }}>
          {report.dopamineCurve.map((d) => (
            <div
              key={d.paragraphIndex}
              data-testid={`dopamine-bar-${d.paragraphIndex}`}
              title={`§${d.paragraphIndex}: ${d.level}%`}
              style={{
                flex: 1,
                height: `${d.level}%`,
                background: "var(--accent)",
                borderRadius: "2px 2px 0 0",
                minWidth: 8,
              }}
            />
          ))}
        </div>
        <pre
          data-testid="dopamine-curve-text"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            maxHeight: 120,
            overflow: "auto",
          }}
        >
          {formatDopamineCurve(report)}
        </pre>
      </div>

      {/* Curiosity-Loops */}
      <div
        data-testid="dopamine-loops"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          marginBottom: 14,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>CURIOSITY-LOOPS</div>
        {report.curiosityLoops.length === 0 ? (
          <div data-testid="dopamine-no-loops" style={{ color: "var(--muted)" }}>
            Keine Curiosity-Loops gefunden.
          </div>
        ) : (
          <pre
            data-testid="dopamine-loops-text"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: 120,
              overflow: "auto",
            }}
          >
            {formatCuriosityLoops(report.curiosityLoops)}
          </pre>
        )}
      </div>

      {/* Cliffhangers */}
      <div
        data-testid="dopamine-cliffhangers"
        style={{
          border: `1px solid ${report.cliffhangers.length > 0 ? "var(--warn)" : "var(--border)"}`,
          borderRadius: 4,
          padding: 10,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>CLIFFHANGERS</div>
        {report.cliffhangers.length === 0 ? (
          <div data-testid="dopamine-no-cliffhangers" style={{ color: "var(--muted)" }}>
            Keine Cliffhanger gefunden.
          </div>
        ) : (
          <pre
            data-testid="dopamine-cliffhangers-text"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 8,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              maxHeight: 120,
              overflow: "auto",
            }}
          >
            {formatCliffhangers(report.cliffhangers)}
          </pre>
        )}
      </div>

      {/* Statistik */}
      <div
        data-testid="dopamine-stats"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 10,
          fontSize: 11,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>STATISTIK</div>
        <div data-testid="dopamine-avg">Durchschnitt: {report.averageDopamine}%</div>
        <div data-testid="dopamine-peak">Peak: {report.peakDopamine}% (§{report.peakParagraph})</div>
        <div data-testid="dopamine-loop-count">Curiosity-Loops: {report.curiosityLoops.length}</div>
        <div data-testid="dopamine-cliffhanger-count">Cliffhangers: {report.cliffhangers.length}</div>
      </div>
    </div>
  );
}
