// QualityDashboard: Gesamt-Qualitätsübersicht für den BookWriter (Sprint 17, Agent 2).
//
// Standalone-Panel — bewusst KEINE Abhängigkeit zu LektoratPanel,
// BookWriterPanel oder ContinuityPanel (weder Import noch Änderung dort).
// Rein präsentational: alle Daten kommen über Props, Berechnung des
// Gesamt-Scores ist deterministisch und offline (Mittelwert der Metriken).
// Klick auf "Übernehmen" markiert einen Vorschlag als erledigt (lokaler
// State) und meldet ihn zusätzlich über `onApplySuggestion` nach außen.

import { useMemo, useState } from "react";
import "./bookwriter.css";

export interface QualityMetric {
  /** Stabile ID, z.B. "stil", "kohärenz". */
  id: string;
  /** Anzeigename, z.B. "Stil". */
  label: string;
  /** 0–100 (wird defensiv geclampet). */
  score: number;
}

export interface QualitySuggestion {
  id: string;
  chapterId: string;
  text: string;
  metricId?: string;
}

export interface ChapterQualityPoint {
  chapterId: string;
  title: string;
  /** 0–100 (wird defensiv geclampet). */
  score: number;
}

export interface QualityDashboardProps {
  metrics?: QualityMetric[];
  suggestions?: QualitySuggestion[];
  chapters?: ChapterQualityPoint[];
  onApplySuggestion?: (id: string) => void;
  className?: string;
}

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeOverallScore(
  metrics: QualityMetric[],
  chapters: ChapterQualityPoint[],
): number {
  if (metrics.length > 0) {
    const sum = metrics.reduce((a, m) => a + clampScore(m.score), 0);
    return Math.round(sum / metrics.length);
  }
  if (chapters.length > 0) {
    const sum = chapters.reduce((a, c) => a + clampScore(c.score), 0);
    return Math.round(sum / chapters.length);
  }
  return 0;
}

function barColor(score: number): string {
  if (score >= 75) return "#2e7d32";
  if (score >= 50) return "#f9a825";
  return "#c62828";
}

export function QualityDashboard({
  metrics = [],
  suggestions = [],
  chapters = [],
  onApplySuggestion,
  className,
}: QualityDashboardProps) {
  const [fixed, setFixed] = useState<string[]>([]);
  const overall = useMemo(
    () => computeOverallScore(metrics, chapters),
    [metrics, chapters],
  );
  const open = useMemo(
    () => suggestions.filter((s) => !fixed.includes(s.id)),
    [suggestions, fixed],
  );
  const isEmpty =
    metrics.length === 0 && suggestions.length === 0 && chapters.length === 0;

  const handleFix = (id: string) => {
    setFixed((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onApplySuggestion?.(id);
  };

  return (
    <div className={className ?? "quality-dashboard"} data-testid="quality-dashboard">
      <h3>Qualität</h3>

      {isEmpty ? (
        <p className="ws-muted" data-testid="quality-empty">
          Keine Qualitätsdaten — noch keine Analyse durchgeführt.
        </p>
      ) : (
        <>
          <p data-testid="quality-score">
            Gesamt-Score: <strong>{overall}</strong>/100
          </p>

          {metrics.length > 0 && (
            <ul data-testid="quality-metrics">
              {metrics.map((m) => {
                const score = clampScore(m.score);
                return (
                  <li key={m.id} data-testid="quality-metric" data-metric={m.id}>
                    <span>
                      {m.label}: {score}/100
                    </span>
                    <div
                      data-testid="quality-metric-bar"
                      data-score={score}
                      style={{
                        width: `${score}%`,
                        height: 8,
                        background: barColor(score),
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {chapters.length > 0 && (
            <div data-testid="quality-trend">
              {chapters.map((c) => (
                <div
                  key={c.chapterId}
                  data-testid="quality-trend-point"
                  data-chapter={c.chapterId}
                  data-score={clampScore(c.score)}
                  title={`${c.title}: ${clampScore(c.score)}/100`}
                >
                  {c.title}: {clampScore(c.score)}
                </div>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <ul data-testid="quality-suggestions">
              {open.map((s) => (
                <li
                  key={s.id}
                  data-testid="quality-suggestion"
                  data-suggestion={s.id}
                >
                  <span className="ws-muted">({s.chapterId})</span> {s.text}
                  <button
                    className="ws-btn"
                    data-testid="quality-suggestion-fix"
                    onClick={() => handleFix(s.id)}
                  >
                    Übernehmen
                  </button>
                </li>
              ))}
              {open.length === 0 && (
                <li data-testid="quality-suggestions-done">
                  Alle Vorschläge übernommen.
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
