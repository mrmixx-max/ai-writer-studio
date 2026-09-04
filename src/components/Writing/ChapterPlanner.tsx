// ChapterPlanner: UI-Komponente für Kapitelplanung mit Zielwortzahlen.
import { useState } from "react";
import type { Chapter, ChapterStatus } from "@/types/project";
import { computeWordStats, deriveMinMax, validateChapterPlan } from "@/services/writing/chapterPlan";

interface ChapterPlannerProps {
  chapters: Chapter[];
  onAddChapter: (title: string, targetWordCount: number, purpose?: string, synopsis?: string) => void;
  onUpdateChapter: (id: string, updates: Partial<Chapter>) => void;
  onDeleteChapter: (id: string) => void;
  onReorderChapters: (from: number, to: number) => void;
}

const STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: "Geplant",
  generating: "Generierung läuft",
  draft: "Entwurf",
  needs_revision: "Überarbeitung nötig",
  completed: "Abgeschlossen",
};

const STATUS_COLORS: Record<ChapterStatus, string> = {
  planned: "#6b7280",
  generating: "#f59e0b",
  draft: "#3b82f6",
  needs_revision: "#ef4444",
  completed: "#10b981",
};

const PURPOSE_OPTIONS = [
  "Einleitung",
  "Szene",
  "Sachkapitel",
  "Dialog",
  "Spannungsriss",
  "Höhepunkt",
  "Auflösung",
  "Schluss",
];

export function ChapterPlanner({
  chapters,
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onReorderChapters,
}: ChapterPlannerProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState(2000);
  const [newPurpose, setNewPurpose] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");

  const totalTarget = chapters.reduce((sum, ch) => sum + ch.targetWordCount, 0);
  const totalCurrent = chapters.reduce((sum, ch) => sum + ch.currentWordCount, 0);
  const totalProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddChapter(newTitle.trim(), newTarget, newPurpose || undefined, newSynopsis || undefined);
    setNewTitle("");
    setNewTarget(2000);
    setNewPurpose("");
    setNewSynopsis("");
  };

  const validationErrors = validateChapterPlan({ targetWordCount: newTarget });

  return (
    <div className="chapter-planner">
      {/* Gesamtfortschritt */}
      <div className="cp-overview">
        <div className="cp-overview-stats">
          <span>{chapters.length} Kapitel</span>
          <span>{totalCurrent.toLocaleString("de-DE")} / {totalTarget.toLocaleString("de-DE")} Wörter</span>
        </div>
        <div className="cp-progress-bar">
          <div className="cp-progress-fill" style={{ width: `${Math.min(100, totalProgress)}%` }} />
        </div>
        <span className="cp-progress-text">{totalProgress}%</span>
      </div>

      {/* Neues Kapitel */}
      <div className="cp-add-form">
        <h4>Neues Kapitel</h4>
        <div className="cp-form-row">
          <input
            type="text"
            placeholder="Kapiteltitel"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="cp-input"
          />
          <div className="cp-target-input">
            <label>Zielwörter:</label>
            <input
              type="number"
              min={100}
              max={50000}
              step={100}
              value={newTarget}
              onChange={(e) => setNewTarget(Number(e.target.value))}
              className="cp-number"
            />
          </div>
        </div>
        <div className="cp-form-row">
          <select value={newPurpose} onChange={(e) => setNewPurpose(e.target.value)} className="cp-select">
            <option value="">Kapiteltyp (optional)</option>
            {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="text"
            placeholder="Synopsis (optional)"
            value={newSynopsis}
            onChange={(e) => setNewSynopsis(e.target.value)}
            className="cp-input cp-flex"
          />
        </div>
        {validationErrors.length > 0 && (
          <div className="cp-warnings">
            {validationErrors.map((err, i) => <span key={i} className="cp-warning">⚠ {err}</span>)}
          </div>
        )}
        <button onClick={handleAdd} disabled={!newTitle.trim()} className="cp-add-btn">
          + Kapitel hinzufügen
        </button>
      </div>

      {/* Kapitelliste */}
      <div className="cp-chapters">
        {chapters.map((ch, index) => {
          const stats = computeWordStats(ch);
          return (
            <div key={ch.id} className="cp-chapter">
              <div className="cp-chapter-header">
                <span className="cp-chapter-number">{index + 1}.</span>
                <input
                  type="text"
                  value={ch.title}
                  onChange={(e) => onUpdateChapter(ch.id, { title: e.target.value })}
                  className="cp-chapter-title"
                />
                <span
                  className="cp-status-badge"
                  style={{ background: STATUS_COLORS[ch.status] }}
                >
                  {STATUS_LABELS[ch.status]}
                </span>
                <button onClick={() => onDeleteChapter(ch.id)} className="cp-delete-btn" title="Löschen">✕</button>
              </div>

              <div className="cp-chapter-body">
                <div className="cp-word-stats">
                  <span>{stats.current.toLocaleString("de-DE")} / {stats.target.toLocaleString("de-DE")} Wörter</span>
                  <span className="cp-remaining">({stats.remaining.toLocaleString("de-DE")} übrig)</span>
                </div>
                <div className="cp-progress-bar cp-small">
                  <div
                    className="cp-progress-fill"
                    style={{
                      width: `${Math.min(100, stats.progressPercent)}%`,
                      background: stats.isOverMaximum ? "#ef4444" : stats.isUnderMinimum ? "#f59e0b" : "#10b981",
                    }}
                  />
                </div>
                <span className="cp-progress-text">{stats.progressPercent}%</span>
              </div>

              {ch.purpose && <div className="cp-purpose">Typ: {ch.purpose}</div>}
              {ch.synopsis && <div className="cp-synopsis">{ch.synopsis}</div>}
              {/* Inline-Fehler im Kapitel-Row (C3) statt generischem Abbruch. */}
              {ch.lastError && (
                <div className="cp-chapter-error" data-testid={`cp-error-${ch.id}`}>
                  Kapitel {index + 1}: {ch.lastError} —{" "}
                  <button
                    className="cp-retry-btn"
                    onClick={() => onUpdateChapter(ch.id, { lastError: undefined, status: "planned" })}
                  >
                    erneut versuchen?
                  </button>
                </div>
              )}

              <div className="cp-chapter-actions">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={ch.targetWordCount}
                  onChange={(e) => {
                    const target = Number(e.target.value);
                    const { min, max } = deriveMinMax(target);
                    onUpdateChapter(ch.id, { targetWordCount: target, minimumWordCount: min, maximumWordCount: max });
                  }}
                  className="cp-number cp-small"
                  title="Zielwortzahl ändern"
                />
                {index > 0 && (
                  <button onClick={() => onReorderChapters(index, index - 1)} className="cp-move-btn" title="Nach oben">↑</button>
                )}
                {index < chapters.length - 1 && (
                  <button onClick={() => onReorderChapters(index, index + 1)} className="cp-move-btn" title="Nach unten">↓</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
