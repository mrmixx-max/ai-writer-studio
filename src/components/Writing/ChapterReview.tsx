// ChapterReview: Redaktions-Loop-UI — Kapitel-Liste mit Status + Metrik-Badges.
//
// Aktionen je Kapitel: Straffen / Vertiefen / Stil / completed.
// needs_revision → draft per Revisions-Aktion, → completed per Freigabe.
// Revisionshistorie pro Kapitel aufklappbar.
//
// Budget-Warnung (Agent 2): Der Service-Schicht (revise.ts) ist es egal —
// hier konsumieren wir eine optionale budgetWarning-Prop, die das Panel
// aus dem Router/Budget-Kontext (Agent 2) befüllt. Ist sie gesetzt, sind
// alle LLM-Aktionen deaktiviert und die Warnung sichtbar.

import { useState } from "react";
import type { Chapter, ChapterStatus } from "@/types/project";
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
import { metricBadges, computeReadability } from "@/services/writing/readability";
import type { MetricBadge, ReadabilityThresholds } from "@/services/writing/readability";
import type { RevisionMode, RevisionRecord } from "@/services/writing/revise";
import { getBudgetWarning } from "@/services/writing/revise";
import type { StyleProfile } from "@/services/writing/styleProfiles";

interface ChapterReviewProps {
  chapters: Chapter[];
  styleProfiles: StyleProfile[];
  /** Schwellenwerte (konfigurierbar; Default = DEFAULT_THRESHOLDS). */
  thresholds?: Partial<ReadabilityThresholds>;
  /** Budget-Warnung von Agent 2 (Router/Budget). Nicht-null → Aktionen gesperrt. */
  budgetWarning?: string | null;
  busyChapterId?: string | null;
  onRevise: (chapterId: string, mode: RevisionMode, profile: StyleProfile | null) => void;
  onComplete: (chapterId: string) => void;
  /** Revisionshistorie je Kapitel-ID (vom Panel geladen). */
  revisionsByChapter?: Record<string, RevisionRecord[]>;
  onShowHistory?: (chapterId: string) => void;
}

export function ChapterReview({
  chapters,
  styleProfiles,
  thresholds,
  budgetWarning,
  busyChapterId,
  onRevise,
  onComplete,
  revisionsByChapter = {},
  onShowHistory,
}: ChapterReviewProps) {
  const [profileId, setProfileId] = useState<string>("");
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  const selectedProfile = styleProfiles.find((p) => p.id === profileId) ?? null;
  // Budget-Warnung: Prop (Agent 2/Panel) hat Vorrang, sonst Service-Event-Status.
  const activeBudgetWarning = budgetWarning ?? getBudgetWarning();
  const needsRevisionCount = chapters.filter((c) => c.status === "needs_revision").length;

  const revise = (id: string, mode: RevisionMode) => {
    if (activeBudgetWarning) return;
    onRevise(id, mode, mode === "stil" ? selectedProfile : null);
  };

  return (
    <div className="cr-review" data-testid="chapter-review">
      <div className="cr-head">
        <h3>Redaktion — {chapters.length} Kapitel, {needsRevisionCount} überarbeitungswürdig</h3>
        <div className="cr-style-picker">
          <label htmlFor="cr-profile-select">Stilprofil:</label>
          <select
            id="cr-profile-select"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="cp-select"
          >
            <option value="">— wählen —</option>
            {styleProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.isPreset ? " (Preset)" : ""}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setThresholdsOpen((v) => !v)}
          className="cp-retry-btn"
          title="Schwellenwerte der Metriken umschalten"
        >
          Metriken ⚙
        </button>
      </div>

      {activeBudgetWarning && (
        <div className="cr-budget-warning" role="alert" data-testid="budget-warning">
          ⚠ {activeBudgetWarning} — Revisions-Aktionen sind gesperrt.
        </div>
      )}

      {thresholdsOpen && (
        <div className="cr-thresholds" data-testid="thresholds-panel">
          Schwellenwerte: Ø Satzlänge &gt; {thresholds?.avgSentenceLength ?? 18} W/S ·
          Füllwörter &gt; {Math.round((thresholds?.fillerRatio ?? 0.08) * 1000) / 10} % ·
          Passiv &gt; {Math.round((thresholds?.passiveRatio ?? 0.2) * 1000) / 10} % ·
          Flesch &lt; {thresholds?.fleschReadingEase ?? 50}
          (konfigurierbar via ProjectStore)
        </div>
      )}

      <div className="cr-chapters">
        {chapters.map((ch) => {
          const badges: MetricBadge[] = metricBadges(chapterContent(ch), thresholds);
          const m = computeReadability(chapterContent(ch).content);
          const busy = busyChapterId === ch.id;
          const revisions = revisionsByChapter[ch.id] ?? [];
          return (
            <div key={ch.id} className="cr-chapter-row" data-testid={`cr-row-${ch.id}`}>
              <div className="cr-row-main">
                <span className="cp-status-badge" style={{ color: STATUS_COLORS[ch.status] }}>
                  {STATUS_LABELS[ch.status]}
                </span>
                <span className="cr-title">{ch.title}</span>
                <span className="cr-words">{m.words} Wörter</span>
                {badges.map((b) => (
                  <span
                    key={b.key}
                    className={`cr-metric-badge${b.warn ? " cr-metric-warn" : ""}`}
                    title={`${b.label}: ${b.formatted} (Schwelle ${b.threshold})`}
                    data-testid={`metric-${b.key}-${b.warn ? "warn" : "ok"}`}
                  >
                    {b.label}: {b.formatted}{b.warn ? " ⚠" : ""}
                  </span>
                ))}
              </div>
              <div className="cr-row-actions">
                <button
                  disabled={busy || !!activeBudgetWarning || (!ch.content && !ch.generatedContent)}
                  onClick={() => revise(ch.id, "straffen")}
                  className="cp-retry-btn"
                  title="−10 % Wortzahl, Füllwörter entfernen"
                >
                  Straffen
                </button>
                <button
                  disabled={busy || !!activeBudgetWarning || (!ch.content && !ch.generatedContent)}
                  onClick={() => revise(ch.id, "vertiefen")}
                  className="cp-retry-btn"
                  title="+15 % Wortzahl, Beispiele ergänzen"
                >
                  Vertiefen
                </button>
                <button
                  disabled={busy || !!activeBudgetWarning || !profileId || (!ch.content && !ch.generatedContent)}
                  onClick={() => revise(ch.id, "stil")}
                  className="cp-retry-btn"
                  title={selectedProfile ? `Stilprofil anwenden: ${selectedProfile.name}` : "Zuerst Stilprofil wählen"}
                >
                  Stil
                </button>
                <button
                  disabled={busy}
                  onClick={() => onComplete(ch.id)}
                  className="cp-add-btn cr-complete-btn"
                  title="Kapitel als abgeschlossen markieren"
                >
                  ✓ completed
                </button>
                <button
                  onClick={() => {
                    const next = historyOpenFor === ch.id ? null : ch.id;
                    setHistoryOpenFor(next);
                    if (next) onShowHistory?.(ch.id);
                  }}
                  className="cp-move-btn"
                  title="Revisionshistorie ein-/ausklappen"
                >
                  {historyOpenFor === ch.id ? "▲ Historie" : "▼ Historie"}
                </button>
              </div>
              {busy && <span className="cr-busy" role="status">Revision läuft…</span>}
              {historyOpenFor === ch.id && (
                <div className="cr-history" data-testid={`history-${ch.id}`}>
                  {revisions.length === 0 ? (
                    <em>Keine Revisionen.</em>
                  ) : (
                    revisions.map((r) => (
                      <div key={r.id} className="cr-history-row">
                        <span>{new Date(r.createdAt).toLocaleString("de-DE")}</span>
                        <span className="cr-history-mode">{r.mode}</span>
                        <span>
                          {r.beforeWords} → {r.afterWords} Wörter ·
                          Füllwörter {Math.round(r.beforeFiller * 1000) / 10} % →{" "}
                          {Math.round(r.afterFiller * 1000) / 10} %
                        </span>
                        <span className="cr-history-note">{r.note ?? ""}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Kapitel mit content-Fallback auf generatedContent (für Metriken). */
function chapterContent(ch: Chapter): Chapter {
  return ch.content?.trim() ? ch : { ...ch, content: ch.generatedContent ?? "" };
}
