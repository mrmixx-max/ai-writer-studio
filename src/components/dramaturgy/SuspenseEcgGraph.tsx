// SuspenseEcgGraph (WP 50.2): Szenen-Spannungs-EKG & Cliffhanger-Index.
//
// Satz-für-Satz Puls-Messung, Flatline-Warnung und Cliffhanger-Score.
//
// Design-Token-only — keine Hardcoded-Farben.
import { useCallback, useMemo, useState } from "react";
import {
  analyzeSceneTension,
  detectFlatline,
  calculateCliffhangerScore,
} from "@/services/dramaturgy/suspenseEcgGraph";

export interface SuspenseEcgGraphProps {
  className?: string;
  defaultScene?: string;
}

const DEFAULT_SCENE = `Der Wind heulte durch die Gassen. Sie rannte, so schnell sie konnte. Plötzlich hielt sie an. Eine Gestalt stand vor ihr. "Wer bist du?", flüsterte sie. Die Gestalt antwortete nicht. Dann lächelte sie. Doch das Lächeln war falsch. Jetzt wusste sie: Es gab kein Entkommen.`;

export function SuspenseEcgGraph({
  className,
  defaultScene = DEFAULT_SCENE,
}: SuspenseEcgGraphProps) {
  const [scene, setScene] = useState(defaultScene);
  const [readings, setReadings] = useState(() => analyzeSceneTension(defaultScene));
  const [cliffhangerScore, setCliffhangerScore] = useState(() => calculateCliffhangerScore(defaultScene));

  const flatline = useMemo(() => detectFlatline(readings), [readings]);

  const handleAnalyze = useCallback(() => {
    setReadings(analyzeSceneTension(scene));
    setCliffhangerScore(calculateCliffhangerScore(scene));
  }, [scene]);

  const maxPulse = Math.max(...readings.map((r) => r.pulse), 1);

  return (
    <div
      className={className}
      data-testid="suspense-ecg-graph"
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        padding: 16,
        height: "100%",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--accent)" }}>
        📈 Spannungs-EKG
      </h3>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        {readings.length} Sätze · Cliffhanger: {cliffhangerScore}/100
      </div>

      {/* Text-Eingabe */}
      <div style={{ marginBottom: 14 }}>
        <textarea
          data-testid="ecg-scene"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          rows={5}
          style={{
            width: "100%",
            background: "var(--bg)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          data-testid="ecg-analyze"
          onClick={handleAnalyze}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 4,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Analysieren
        </button>
      </div>

      {/* EKG-Kurve */}
      <div data-testid="ecg-curve" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>EKG-KURVE</div>
        <svg
          viewBox={`0 0 ${Math.max(100, readings.length * 30)} 80`}
          style={{
            width: "100%",
            maxWidth: 520,
            height: 80,
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <polyline
            points={readings
              .map((r) => `${r.index * 30 + 15},${80 - (r.pulse / maxPulse) * 70 - 5}`)
              .join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
          {readings.map((r) => (
            <circle
              key={r.index}
              data-testid={`ecg-point-${r.index}`}
              cx={r.index * 30 + 15}
              cy={80 - (r.pulse / maxPulse) * 70 - 5}
              r={3}
              fill="var(--accent)"
            />
          ))}
        </svg>
      </div>

      {/* Satz-für-Satz */}
      <div data-testid="ecg-readings" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>SATZ-FÜR-SATZ</div>
        <div style={{ maxHeight: 200, overflow: "auto" }}>
          {readings.map((r) => (
            <div
              key={r.index}
              data-testid={`ecg-reading-${r.index}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "3px 8px",
                borderBottom: "1px solid var(--border)",
                fontSize: 10,
              }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.sentence.slice(0, 40)}...
              </span>
              <span style={{ color: "var(--accent)", fontWeight: 700, marginLeft: 8 }}>
                {r.pulse}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Flatline-Warnung */}
      {flatline && (
        <div
          data-testid="ecg-flatline"
          style={{
            border: "1px solid var(--error)",
            borderRadius: 4,
            padding: 10,
            marginBottom: 14,
            fontSize: 11,
            color: "var(--error)",
          }}
        >
          ⚠ Flatline-Warnung: Sätze {flatline.startIndex + 1}–{flatline.endIndex + 1}: {flatline.reason}
        </div>
      )}

      {/* Cliffhanger-Score */}
      <div
        data-testid="ecg-cliffhanger"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>CLIFFHANGER-SCORE</div>
        <div
          data-testid="ecg-cliffhanger-score"
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: cliffhangerScore > 70 ? "var(--success)" : cliffhangerScore > 40 ? "var(--warn)" : "var(--muted)",
          }}
        >
          {cliffhangerScore}/100
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
          {cliffhangerScore > 70
            ? "Starker Sog!"
            : cliffhangerScore > 40
              ? "Mittlerer Sog"
              : "Schwacher Sog"}
        </div>
      </div>
    </div>
  );
}
