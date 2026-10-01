// PacingCurvePanel: Interaktive SVG-Kurven-Visualisierung der Pacing-Analyse.
//
// Zeigt die Pacing-Scores aller Kapitel als smooth Bezier-Kurve mit klickbaren
// Datenpunkten. Climax (höchster Score) wird amber, tiefster Punkt dunkelgrau
// hervorgehoben. Klick auf einen Punkt ruft onChapterClick mit der Kapitelnummer.
//
// Lokal, kein LLM nötig, deterministisch. Defensive Fallbacks bei fehlenden Daten.

import { useMemo } from "react";
import {
  analyzePacing,
  generatePacingSvgPath,
  generatePacingDots,
} from "@/services/plot/pacingAnalysis";
import type { BookChapterInput } from "@/services/bookwriter/export/types";

export interface PacingCurvePanelProps {
  /** Kapitel (gelesen, nicht verändert). */
  chapters: BookChapterInput[];
  /** Callback bei Klick auf einen Datenpunkt (optional). */
  onChapterClick?: (chapterNumber: number) => void;
  className?: string;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 200;
const PADDING = 20;

const COLORS = {
  bg: "#0a0e14",
  panel: "#11161f",
  border: "#232b3a",
  amber: "#ffb000",
  cyan: "#00e5ff",
  text: "#d5dbe5",
  dim: "#8a93a6",
  lowest: "#4a5060",
};

export function PacingCurvePanel({
  chapters,
  onChapterClick,
  className,
}: PacingCurvePanelProps) {
  const analysis = useMemo(() => analyzePacing(chapters), [chapters]);

  const pathD = useMemo(
    () => generatePacingSvgPath(analysis.points, SVG_WIDTH, SVG_HEIGHT, PADDING),
    [analysis.points],
  );

  const dots = useMemo(
    () => generatePacingDots(analysis.points, SVG_WIDTH, SVG_HEIGHT, PADDING),
    [analysis.points],
  );

  const handleDotClick = (chapterNumber: number) => {
    onChapterClick?.(chapterNumber);
  };

  if (chapters.length === 0) {
    return (
      <div
        className={className ?? "pacing-curve-panel"}
        data-testid="pacing-curve-panel"
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 16,
          color: COLORS.text,
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>📈 Pacing-Kurve</h3>
        <p style={{ color: COLORS.dim, margin: 0 }}>
          Keine Kapitel vorhanden — füge Kapitel hinzu, um die Pacing-Analyse zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div
      className={className ?? "pacing-curve-panel"}
      data-testid="pacing-curve-panel"
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 16,
        color: COLORS.text,
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>📈 Pacing-Kurve</h3>
      <p style={{ color: COLORS.dim, margin: "0 0 12px", fontSize: 13 }}>
        Ø Pacing: {analysis.averagePacing.toFixed(2)}
        {analysis.climaxChapter !== null && (
          <> · Climax: Kapitel {analysis.climaxChapter}</>
        )}
        {analysis.lowestChapter !== null && (
          <> · Tiefster Punkt: Kapitel {analysis.lowestChapter}</>
        )}
      </p>

      <svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ display: "block", width: "100%", height: "auto" }}
        role="img"
        aria-label="Pacing-Kurve"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = PADDING + ratio * (SVG_HEIGHT - 2 * PADDING);
          return (
            <line
              key={ratio}
              x1={PADDING}
              y1={y}
              x2={SVG_WIDTH - PADDING}
              y2={y}
              stroke={COLORS.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Smooth bezier curve */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Clickable dots */}
        {dots.map((dot) => {
          const isClimax = dot.chapter === analysis.climaxChapter;
          const isLowest = dot.chapter === analysis.lowestChapter;
          const fill = isClimax ? COLORS.amber : isLowest ? COLORS.lowest : COLORS.cyan;
          const radius = isClimax || isLowest ? 7 : 5;

          return (
            <g
              key={dot.chapter}
              onClick={() => handleDotClick(dot.chapter)}
              style={{ cursor: "pointer" }}
              data-testid={`pacing-dot-${dot.chapter}`}
              role="button"
              aria-label={`Kapitel ${dot.chapter}: ${dot.title}`}
            >
              {/* Larger invisible hit area */}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={14}
                fill="transparent"
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r={radius}
                fill={fill}
                stroke={COLORS.bg}
                strokeWidth={2}
              />
              {/* Title below dot */}
              <text
                x={dot.x}
                y={SVG_HEIGHT - 4}
                textAnchor="middle"
                fontSize={10}
                fill={isClimax ? COLORS.amber : isLowest ? COLORS.dim : COLORS.text}
              >
                {dot.title.length > 12 ? dot.title.slice(0, 11) + "…" : dot.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          fontSize: 12,
          color: COLORS.dim,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: COLORS.amber,
              display: "inline-block",
            }}
          />
          Climax
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: COLORS.lowest,
              display: "inline-block",
            }}
          />
          Tiefster Punkt
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: COLORS.cyan,
              display: "inline-block",
            }}
          />
          Normal
        </span>
      </div>
    </div>
  );
}
