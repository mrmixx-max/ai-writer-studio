// BookWriter-Dashboard + Job-Recovery-Dialog (Sprint 6, Agent 5).
//
// - BookWriterDashboardPanel: Dashboard-Anzeige aller Bookwriter-Läufe mit
//   Live-Fortschritt (Polling über den Job-Store in bookwriter_jobs — dort
//   committen CLI und Panel ihren Fortschritt pro Kapitel), Steuerung
//   (Im Panel fortsetzen / markieren / verwerfen) und dem eingebetteten
//   Recovery-Dialog beim ersten Öffnen.
// - BookWriterRecoveryDialog: zeigt abgebrochene Jobs und bietet Fortsetzung
//   an — beim App-Start in App.tsx gemountet und panel-intern.
// - OPEN_BOOKWRITER_MODE_EVENT: window-Event, auf das die Sidebar hört, um in
//   den BookWriter-Modus zu schalten (Sidebar darf das Dashboard nicht
//   importieren — das Event hält die Abhängigkeitsrichtung sauber).

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import "./bookwriter.css";
import {
  findInterruptedJobs,
  type InterruptedJobInfo,
} from "@/services/cli/jobRecovery";
import { setBookJobStatus, deleteBookJob } from "@/services/bookwriter/jobs";
import {
  PROGRESS_POLL_INTERVAL_MS,
  deriveJobProgressState,
  formatProgressPercent,
  formatRelativeTime,
  JOB_STATE_LABELS,
  JOB_STATE_COLORS,
  type JobProgressState,
} from "@/services/bookwriter/progress";
import { useProjectStore } from "@/store/projectStore";
import { logger } from "@/services/logger";

/** Lazy-Link auf das klassische Generierungs-Panel (Vollautomatik-Steuerung). */
const ClassicBookWriterPanel = lazy(() =>
  import("@/components/Writing/BookWriterPanel").then((m) => ({ default: m.BookWriterPanel }))
);

/** Fenster-Event: Sidebar soll in den BookWriter-Modus wechseln. */
export const OPEN_BOOKWRITER_MODE_EVENT = "bookwriter:open-mode";

/** Fordert die Sidebar auf, in den BookWriter-Modus zu wechseln. */
export function requestOpenBookWriterMode(): void {
  window.dispatchEvent(new CustomEvent(OPEN_BOOKWRITER_MODE_EVENT, { detail: "bookwriter" }));
}

/** Kann via App-Start ohne Projekt gemountet werden (kein Projekt nötig). */
export function BookWriterDashboardPanel() {
  const openProject = useProjectStore((s) => s.openProject);
  const [jobs, setJobs] = useState<InterruptedJobInfo[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const refreshJobs = useCallback(() => {
    try {
      setJobs(findInterruptedJobs());
    } catch (e) {
      logger.warn(`Bookwriter-Dashboard: Abfrage fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "BookWriterDashboard");
      setJobs([]);
    }
    setLoadedOnce(true);
  }, []);

  // Live-Fortschritt: Polling über den persistenten Job-Store. CLI- und
  // Panel-Läufe committen dort pro Kapitel — das Dashboard sieht jeden
  // Fortschrittssprung innerhalb von PROGRESS_POLL_INTERVAL_MS.
  useEffect(() => {
    refreshJobs();
    const timer = window.setInterval(refreshJobs, PROGRESS_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  const handleResumeInPanel = useCallback(
    (info: InterruptedJobInfo) => {
      if (useProjectStore.getState().activeProjectId !== info.projectId) {
        openProject(info.projectId);
      }
      requestOpenBookWriterMode();
      logger.info(`Bookwriter-Recovery: Fortsetzen im Panel (${info.jobId}, Kapitel ${info.resumeAtChapter})`, "BookWriterDashboard");
    },
    [openProject],
  );

  const handleMarkInterrupted = useCallback(async (info: InterruptedJobInfo) => {
    await setBookJobStatus(info.jobId, "interrupted", "Im Dashboard als unterbrochen markiert");
    refreshJobs();
  }, [refreshJobs]);

  const handleDiscard = useCallback(async (info: InterruptedJobInfo) => {
    await deleteBookJob(info.jobId);
    refreshJobs();
  }, [refreshJobs]);

  return (
    <div className="bookwriter-dashboard" data-testid="bw-dash">
      <h3>📖 BookWriter</h3>
      <p className="bw-dash-hint">
        Zentrale Übersicht laufender und unterbrochener Buchgenerierungen —
        App und CLI committen ihren Fortschritt hierher.
      </p>

      <ClassicBookWriterSection />

      {/* Recovery-Dialog auch panel-intern anbieten (z.B. direkter Tab-Sprung). */}
      <BookWriterRecoveryDialog />

      {loadedOnce && jobs.length === 0 && (
        <div className="bw-dash-empty" data-testid="bw-dash-empty">
          Keine aktiven oder unterbrochenen Läufe.
        </div>
      )}

      <div className="bw-dash-rows">
        {jobs.map((info) => (
          <DashboardRow
            key={info.jobId}
            info={info}
            onResume={() => handleResumeInPanel(info)}
            onMarkInterrupted={() => void handleMarkInterrupted(info)}
            onDiscard={() => void handleDiscard(info)}
          />
        ))}
      </div>
    </div>
  );
}


/** Einklappbarer Abschnitt mit dem klassischen Vollautomatik-Panel. */
function ClassicBookWriterSection() {
  const [showClassic, setShowClassic] = useState(false);
  return (
    <div className="bw-dash-classic">
      <button
        className="bw-dash-btn"
        onClick={() => setShowClassic((v) => !v)}
        aria-expanded={showClassic}
      >
        {showClassic ? "▾" : "▸"} Buchgenerierung starten / steuern
      </button>
      {showClassic && (
        <Suspense fallback={<div className="mode-placeholder">Lädt…</div>}>
          <ClassicBookWriterPanel />
        </Suspense>
      )}
    </div>
  );
}

/** Eine Dashboard-Zeile: Titel, Status-Badge, Fortschrittsbalken, Steuerung. */
function DashboardRow({
  info, onResume, onMarkInterrupted, onDiscard,
}: {
  info: InterruptedJobInfo;
  onResume: () => void;
  onMarkInterrupted: () => void;
  onDiscard: () => void;
}) {
  const state: JobProgressState = deriveJobProgressState(info.job);
  const percent = formatProgressPercent(info.currentChapter, info.totalChapters);
  return (
    <div className="bw-dash-row" data-testid={`bw-dash-row-${info.jobId}`}>
      <div className="bw-dash-row-head">
        <strong>{info.projectTitle}</strong>
        <span
          className="bw-dash-state"
          data-testid={`bw-dash-state-${info.jobId}`}
          style={{ background: JOB_STATE_COLORS[state] }}
        >
          {JOB_STATE_LABELS[state]}
        </span>
        <span className="bw-dash-ago">{formatRelativeTime(info.updatedAt)}</span>
      </div>
      <div className="bw-progress" data-testid={`bw-dash-progress-${info.jobId}`}>
        <div className="bw-progress-bar">
          <div className="bw-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="bw-progress-text">
          Kapitel {info.currentChapter} / {info.totalChapters} · {percent} %
          {info.resumeAtChapter <= info.totalChapters ? ` · fortsetzbar ab Kapitel ${info.resumeAtChapter}` : ""}
        </span>
      </div>
      <div className="bw-dash-actions">
        <button className="bw-dash-btn" onClick={onResume} title="Projekt öffnen und im BookWriter-Panel fortsetzen">
          ▶ Im Panel fortsetzen
        </button>
        {state === "running" && (
          <button className="bw-dash-btn" onClick={onMarkInterrupted} title="Laufenden CLI-Job als unterbrochen markieren">
            ⏸ Als unterbrochen markieren
          </button>
        )}
        <button className="bw-dash-btn bw-dash-danger" onClick={onDiscard} title="Job verwerfen — bereits gespeicherte Kapitel bleiben erhalten">
          🗑 Verwerfen
        </button>
      </div>
    </div>
  );
}

/**
 * Job-Recovery-Dialog: erscheint, wenn abgebrochene/unterbrochene Jobs in der
 * DB liegen (App-Start in App.tsx gemountet, zusätzlich panel-intern).
 */
export function BookWriterRecoveryDialog() {
  const openProject = useProjectStore((s) => s.openProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [jobs, setJobs] = useState<InterruptedJobInfo[] | null>(null);

  // Einmalig beim Mount prüfen — der Dialog soll NICHT in einem Polling-Loop
  // wieder aufploppen, nachdem der Nutzer ihn bewusst geschlossen hat.
  useEffect(() => {
    try {
      setJobs(findInterruptedJobs());
    } catch {
      setJobs([]);
    }
  }, []);

  const visible = useMemo(() => (jobs ?? []).length > 0, [jobs]);

  const handleResume = useCallback(
    (info: InterruptedJobInfo) => {
      if (activeProjectId !== info.projectId) {
        openProject(info.projectId);
      }
      requestOpenBookWriterMode();
      logger.info(`Bookwriter-Recovery: Fortsetzung gewählt (${info.jobId}, ab Kapitel ${info.resumeAtChapter})`, "BookWriterRecoveryDialog");
      setJobs([]);
    },
    [activeProjectId, openProject],
  );

  const handleDiscard = useCallback(
    async (info: InterruptedJobInfo) => {
      await deleteBookJob(info.jobId);
      logger.info(`Bookwriter-Recovery: Job verworfen (${info.jobId})`, "BookWriterRecoveryDialog");
      setJobs((prev) => (prev ?? []).filter((j) => j.jobId !== info.jobId));
    },
    [],
  );

  if (!visible) return null;

  return (
    <div className="modal-backdrop" onClick={() => setJobs([])}>
      <div
        className="bw-recovery-dialog"
        role="dialog"
        aria-label="Unterbrochene Buchgenerierung fortsetzen?"
        onClick={(e) => e.stopPropagation()}
      >
        <h4>Unterbrochene Buchgenerierung</h4>
        <p>
          Es wurden {jobs!.length === 1 ? "ein unterbrochener Lauf" : `${jobs!.length} unterbrochene Läufe`} gefunden.
          Bereits gespeicherte Kapitel bleiben erhalten.
        </p>
        <ul className="bw-recovery-list">
          {jobs!.map((info) => (
            <li key={info.jobId} data-testid={`bw-recovery-item-${info.jobId}`}>
              <div className="bw-recovery-item-head">
                <strong>{info.projectTitle}</strong>
                <span className="bw-recovery-item-meta">
                  Kapitel {info.currentChapter} von {info.totalChapters} gespeichert · fortsetzbar ab Kapitel {info.resumeAtChapter}
                </span>
              </div>
              <div className="bw-recovery-item-actions">
                <button className="bw-start" onClick={() => handleResume(info)}>▶ Fortsetzen</button>
                <button className="bw-stop" onClick={() => void handleDiscard(info)}>🗑 Verwerfen</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="bw-recovery-footer">
          <button onClick={() => setJobs([])}>Später</button>
        </div>
      </div>
    </div>
  );
}
