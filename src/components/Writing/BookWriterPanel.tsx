// BookWriterPanel: vollautomatische Buchgenerierung mit Kapitelplanung.
// Crash-sicher: jedes fertig generierte Kapitel wird SOFORT per updateChapter
// in SQLite geschrieben (Status draft). Job-Status liegt in bookwriter_jobs
// und überlebt App-Neustart → Resume-Dialog beim Panel-Start.
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { generateOutline, generateChapter, type BookOutline, type BookChapter } from "@/services/writing/bookwriter";
import { generateChapterChunked, type BookContext } from "@/services/writing/chapterEngine";
import { withRetry } from "@/services/resilience/retry";
import {
  createBookJob, setBookJobOutline, updateBookJobProgress, setBookJobStatus,
  getResumableBookJob, completeBookJob, deleteBookJob, type BookJob,
} from "@/services/bookwriter/jobs";
import { useActiveModel } from "@/components/KIPanel/useActiveModel";
import { useProjectStore } from "@/store/projectStore";
import { markdownToTipTap } from "@/services/editor/markdown";
import { countWords } from "@/services/writing/chapterPlan";
import {
  exportBook, checkExportGate, formatNeedsRevisionWarning, saveExportBlob,
  type ExportFormat,
} from "@/services/bookwriter/export";
import { logger } from "@/services/logger";
import { ChapterPlanner } from "./ChapterPlanner";
import type { Chapter, ChapterStatus } from "@/types/project";

// Status-Badge-Labels/Farben — gleiche Quelle wie ChapterPlanner (C3).
export const STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: "Geplant",
  generating: "Generierung läuft",
  draft: "Entwurf",
  needs_revision: "Überarbeitung nötig",
  completed: "Abgeschlossen",
};

export const STATUS_COLORS: Record<ChapterStatus, string> = {
  planned: "#6b7280",
  generating: "#f59e0b",
  draft: "#3b82f6",
  needs_revision: "#ef4444",
  completed: "#10b981",
};

/** Retry-Zähler je Kapitelnummer (aus Agent-1-Retry via withRetry). */
type RetryCounts = Record<number, number>;

export function BookWriterPanel() {
  const { settings } = useActiveModel();
  const newChapter = useProjectStore((s) => s.newChapter);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const storeChapters = useProjectStore((s) => s.chapters);
  const updateChapter = useProjectStore((s) => s.updateChapter);
  const reconcileOutline = useProjectStore((s) => s.reconcileOutline);
  const newPlannedChapter = useProjectStore((s) => s.newPlannedChapter);
  const reorderChapters = useProjectStore((s) => s.reorderChapters);
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("Sachbuch");
  const [targetAudience, setTargetAudience] = useState("Erwachsene");
  const [chapterCount, setChapterCount] = useState(8);
  const [language] = useState("Deutsch");
  const [viewMode, setViewMode] = useState<"classic" | "planner">("planner");
  const [premise, setPremise] = useState("");
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCounts, setRetryCounts] = useState<RetryCounts>({});
  // Gleitender Durchschnitt der Kapitel-Generierungszeiten (ms) → Restzeit.
  const chapterDurationsRef = useRef<number[]>([]);
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState<number | null>(null);
  // Inline-Fehler je Kapitelnummer (statt generischem Abbruch, C3).
  const [chapterErrors, setChapterErrors] = useState<Record<number, string>>({});
  // Resume-Dialog (C2).
  const [resumeJob, setResumeJob] = useState<BookJob | null>(null);
  // Export-UI (C3): Format-Auswahl, Fortschritt, Erfolgs-/Warn-Meldung.
  const [exportFormat, setExportFormat] = useState<ExportFormat>("epub");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // Beim Panel-Start/Mount: fortsetzbaren Job prüfen → Dialog zeigen (C2).
  useEffect(() => {
    if (!activeProjectId || isGenerating) return;
    const job = getResumableBookJob(activeProjectId);
    if (job && job.currentChapter > 0) setResumeJob(job);
  }, [activeProjectId, isGenerating]);

  /** Gleitender Durchschnitt + Restzeit-Schätzung aktualisieren (C3). */
  const recordChapterDuration = useCallback((durationMs: number, totalChapters: number, doneChapters: number) => {
    const durations = chapterDurationsRef.current;
    durations.push(durationMs);
    // Fenster der letzten 3 Kapitel (gleitender Durchschnitt).
    const window = durations.slice(-3);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    const remaining = Math.max(0, totalChapters - doneChapters);
    setEstimatedRemainingMs(avg * remaining);
  }, []);

  const configFor = useCallback(() => ({
    topic: topic.trim(),
    genre,
    targetAudience,
    chapterCount,
    model: settings.model,
    baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
    language,
  }), [topic, genre, targetAudience, chapterCount, language, settings]);

  // ---------------------------------------------------------------------------
  // Kernschleife: Kapitel generieren, SOFORT speichern, Job-Fortschritt
  // committen (C1). Wird für Neustart und Resume gleichermaßen genutzt.
  // ---------------------------------------------------------------------------
  const runGeneration = useCallback(async (
    cfg: { topic: string; genre: string; targetAudience: string; chapterCount: number; model: string; baseUrl: string; language: string },
    bookOutline: BookOutline,
    startAt: number,
    written: BookChapter[],
    job: BookJob,
  ) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    for (let i = startAt; i <= bookOutline.chapters.length; i++) {
      if (ctrl.signal.aborted) break;
      setCurrentChapter(i);
      setLiveText((prev) => prev + `✍️ Schreibe Kapitel ${i}: ${bookOutline.chapters[i - 1].title}...\n`);
      const startedAt = Date.now();

      try {
        // Agent-1-Retry: JSON-/Netzwerkfehler werden bis zu 3× wiederholt;
        // der Versuchszähler landet im UI (Retry-Badge).
        const chapter = await withRetry(
          () => generateChapter(cfg, bookOutline, i, written, ctrl.signal),
          {
            attempts: 3,
            baseDelayMs: 1000,
            signal: ctrl.signal,
            onRetry: (attempt) => {
              setRetryCounts((prev) => ({ ...prev, [i]: attempt }));
              setLiveText((prev) => prev + `⚠️ Kapitel ${i}: Versuch ${attempt + 1} nach Fehler\n`);
            },
          },
        );
        const elapsed = Date.now() - startedAt;

        // C1: SOFORT in den Store + SQLite (Status draft).
        setChapters((prev) => [...prev, chapter]);
        recordChapterDuration(elapsed, bookOutline.chapters.length, written.length + 1);
        setLiveText((prev) => prev + `✅ Kapitel ${i} fertig (${chapter.content.length} Zeichen)\n\n`);

        // Job-Fortschritt committed (persistNow) → Prozess-Kill-sicher.
        await updateBookJobProgress(job.id, i);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") break;
        // Inline-Fehler im Kapitel-Row statt generischem Abbruch (C3).
        const msg = e instanceof Error ? e.message : String(e);
        setChapterErrors((prev) => ({ ...prev, [i]: msg }));
        setLiveText((prev) => prev + `❌ Kapitel ${i}: ${msg}\n`);
        await setBookJobStatus(job.id, "interrupted", `Kapitel ${i}: ${msg}`);
        continue;
      }
    }
  }, [recordChapterDuration]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim() || !activeProjectId) return;
    setIsGenerating(true);
    setError(null);
    setOutline(null);
    setChapters([]);
    setCurrentChapter(0);
    setLiveText("");
    setRetryCounts({});
    setChapterErrors({});
    setEstimatedRemainingMs(null);
    chapterDurationsRef.current = [];
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Job anlegen VOR der Outline — crash-sicher ab hier (C1).
    const cfg = {
      topic: topic.trim(), genre, targetAudience, chapterCount,
      model: settings.model, baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434", language,
    };
    const job = createBookJob(activeProjectId, cfg);
    activeJobIdRef.current = job.id;

    try {
      // Schritt 1: Outline
      setLiveText("📋 Erstelle Gliederung...\n");
      const bookOutline = await generateOutline(cfg, ctrl.signal);
      setOutline(bookOutline);
      // Outline am Job persistieren → Resume kennt Titel/Struktur.
      await setBookJobOutline(job.id, bookOutline);
      setLiveText((prev) => prev + `✅ Gliederung erstellt: ${bookOutline.chapters.length} Kapitel\n\n`);

      // Schritt 2: Kapitel einzeln generieren mit Live-Text
      const writtenChapters: BookChapter[] = [];
      await runGeneration(cfg, bookOutline, 1, writtenChapters, job);

      setLiveText((prev) => prev + "🎉 Buch fertig!");
      await completeBookJob(job.id);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
        await setBookJobStatus(job.id, "interrupted", e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [topic, genre, targetAudience, chapterCount, language, settings, activeProjectId, runGeneration]);

  // Resume (C2): startet bei current_chapter + 1; bereits gespeicherte Kapitel
  // kommen aus dem Store (kompatibel zu Rolling Context).
  const handleResume = useCallback(async () => {
    const job = resumeJob;
    setResumeJob(null);
    if (!job || !job.outline) return;
    setIsGenerating(true);
    setError(null);
    setOutline(job.outline);
    setChapters([]);
    setRetryCounts({});
    setChapterErrors({});
    setLiveText(`⏩ Fortsetzung ab Kapitel ${job.currentChapter + 1}...\n`);
    const cfg = { ...job.config, model: settings.model, baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434" };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    activeJobIdRef.current = job.id;
    await setBookJobStatus(job.id, "running", null);

    try {
      const writtenChapters: BookChapter[] = [];
      await runGeneration(cfg, job.outline, job.currentChapter + 1, writtenChapters, job);
      setLiveText((prev) => prev + "🎉 Buch fertig!");
      await completeBookJob(job.id);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
        await setBookJobStatus(job.id, "interrupted", e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [resumeJob, settings, runGeneration]);

  /** Resume ablehnen: Job verwerfen, Kapitel bleiben erhalten. */
  const handleDiscardJob = useCallback(async () => {
    if (resumeJob) await deleteBookJob(resumeJob.id);
    setResumeJob(null);
  }, [resumeJob]);

  // -------------------------------------------------------------------------
  // Export (C3): Nur Kapitel mit draft/completed erlauben; needs_revision
  // warnt mit Kapitelliste; planned/generating blockieren. TipTap-JSON der
  // Store-Kapitel → exportBook → Tauri-Save-Dialog (Fallback: Download).
  // -------------------------------------------------------------------------
  const handleExport = useCallback(async () => {
    if (!activeProjectId) return;
    const exportable = storeChapters.filter(
      (ch) => ch.status === "draft" || ch.status === "completed" || ch.status === "needs_revision",
    );
    if (exportable.length === 0) {
      setExportError("Keine exportierbaren Kapitel (nur draft/completed).");
      return;
    }

    const gate = checkExportGate(
      exportable.map((ch, i) => ({
        number: i + 1,
        title: ch.title,
        content: ch.content,
        status: ch.status,
      })),
    );
    if (!gate.allowed) {
      setExportError(
        `Export blockiert: ${gate.blocking.map((c) => `Kapitel ${c.number} (${c.status})`).join(", ")}`,
      );
      return;
    }
    if (gate.needsRevision.length > 0) {
      logger.warn(formatNeedsRevisionWarning(gate.needsRevision), "BookWriterPanel.export");
    }

    setIsExporting(true);
    setExportError(null);
    setExportStatus("Export wird vorbereitet…");
    setExportProgress(0);
    try {
      const result = await exportBook(
        {
          title: topic.trim() || "Unbenanntes Buch",
          author: "Autor",
          language: "de",
          chapters: exportable.map((ch, i) => ({
            number: i + 1,
            title: ch.title,
            content: ch.content,
            status: ch.status,
          })),
        },
        exportFormat,
        (pct, label) => {
          setExportProgress(pct);
          setExportStatus(label);
        },
      );
      const save = await saveExportBlob(
        result.blob,
        result.filename,
        exportFormat === "markdown" ? "md" : exportFormat,
        (pct, label) => {
          setExportProgress(pct);
          setExportStatus(label);
        },
      );
      if (save.cancelled) {
        setExportStatus("Export abgebrochen.");
      } else if (save.error) {
        setExportError(`Speichern fehlgeschlagen: ${save.error}`);
        logger.error(`Export-Speichern fehlgeschlagen: ${save.error}`, "BookWriterPanel.export");
      } else {
        const warn = gate.needsRevision.length > 0
          ? ` ${formatNeedsRevisionWarning(gate.needsRevision)}`
          : "";
        setExportStatus(
          `✅ Export fertig: ${save.path ?? result.filename}${warn}`,
        );
        logger.info(
          `Book-Export ${exportFormat} → ${save.path ?? result.filename}`,
          "BookWriterPanel.export",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExportError(msg);
      logger.error("Export fehlgeschlagen", "BookWriterPanel.export", e);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [activeProjectId, storeChapters, topic, exportFormat]);

  const handleDeleteChapter = useCallback((_chapterId: string) => {
    // Nur aus Store entfernen — DB-Delete kommt später
    const pid = activeProjectId;
    if (!pid) return;
    // TODO: DB-Delete implementieren
  }, [activeProjectId]);

  // Abbruch NUR nach Bestätigung — bereits generierte Kapitel bleiben
  // erhalten (C3).
  const handleStop = useCallback(() => {
    if (!window.confirm("Generierung wirklich abbrechen? Bereits generierte Kapitel bleiben erhalten.")) return;
    abortRef.current?.abort();
    setIsGenerating(false);
    const jobId = activeJobIdRef.current;
    if (jobId) void setBookJobStatus(jobId, "interrupted", "Vom Nutzer abgebrochen");
  }, []);

  // C4: Nur die Gliederung neu generieren — fertige Kapitel (draft/completed)
  // bleiben erhalten, betroffene werden auf needs_revision gesetzt.
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const handleRegenerateOutline = useCallback(async () => {
    if (!topic.trim()) return;
    setIsRegeneratingOutline(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const bookOutline = await generateOutline(
        {
          topic: topic.trim(), genre, targetAudience, chapterCount,
          model: settings.model, baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434", language,
        },
        ctrl.signal,
      );
      setOutline(bookOutline);
      // Store-Reconcile: fertige Kapitel behalten, betroffene markieren.
      reconcileOutline(bookOutline.chapters.map((c) => ({ title: c.title, summary: c.summary })));
      setLiveText((prev) => prev + `🔄 Gliederung neu generiert (${bookOutline.chapters.length} Kapitel) — fertige Kapitel blieben erhalten.\n`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError(e.message);
    } finally {
      setIsRegeneratingOutline(false);
    }
  }, [topic, genre, targetAudience, chapterCount, language, settings, reconcileOutline]);

  const handleGeneratePlannedChapter = useCallback(async (chapter: Chapter) => {
    if (!activeProjectId) return;
    setIsGenerating(true);
    updateChapter(chapter.id, { status: "generating" });

    const bookCtx: BookContext = {
      title: topic || "Unbenanntes Buch",
      genre,
      targetAudience,
      language,
      premise,
    };

    const result = await generateChapterChunked(
      chapter,
      bookCtx,
      { model: settings.model, baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434" },
      (chunk, total, words) => {
        setCurrentChapter(chunk);
        setLiveText(`✍️ Kapitel "${chapter.title}" — Chunk ${chunk}/${total} (${words} Wörter)`);
      },
      undefined,
    );

    updateChapter(chapter.id, {
      content: result.chapter.content,
      currentWordCount: result.totalWordCount,
      status: result.chapter.status,
    });

    setIsGenerating(false);
    setLiveText((prev) => prev + `\n✅ Kapitel "${chapter.title}" fertig (${result.totalWordCount} Wörter)`);
  }, [activeProjectId, topic, genre, targetAudience, language, premise, settings, updateChapter]);

  const fullText = outline
    ? `# ${outline.title}\n\n${chapters.map((c) => `## Kapitel ${c.number}: ${c.title}\n\n${c.content}`).join("\n\n---\n\n")}`
    : "";

  // Restzeit formatiert (C3).
  const remainingLabel = useMemo(() => {
    if (estimatedRemainingMs === null || !isGenerating) return null;
    const s = Math.round(estimatedRemainingMs / 1000);
    return s >= 60 ? `~${Math.ceil(s / 60)} min` : `~${s} s`;
  }, [estimatedRemainingMs, isGenerating]);

  return (
    <div className="bookwriter-panel">
      <h3>📖 Automatischer Buchautor</h3>

      {/* Resume-Dialog (C2): Job läuft seit App-Neustart weiter */}
      {resumeJob && resumeJob.outline && (
        <div className="bw-resume" role="dialog" aria-label="Generierung fortsetzen?">
          <p>
            Unterbrochene Generierung gefunden (Kapitel {resumeJob.currentChapter} / {resumeJob.outline.chapters.length}).
            Bereits gespeicherte Kapitel bleiben erhalten.
          </p>
          <button className="bw-start" onClick={handleResume}>▶️ Fortsetzen</button>
          <button className="bw-stop" onClick={handleDiscardJob}>🗑 Verwerfen</button>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="bw-tabs">
        <button
          className={viewMode === "planner" ? "bw-tab active" : "bw-tab"}
          onClick={() => setViewMode("planner")}
        >
          📋 Kapitelplaner
        </button>
        <button
          className={viewMode === "classic" ? "bw-tab active" : "bw-tab"}
          onClick={() => setViewMode("classic")}
        >
          ⚡ Klassisch
        </button>
      </div>

      {viewMode === "planner" ? (
        <>
          <div className="bw-fields">
            <label>
              Buchtitel:
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. KI im Alltag" />
            </label>
            <label>
              Prämisse:
              <input value={premise} onChange={(e) => setPremise(e.target.value)} placeholder="Kurzidee / Exposé (optional)" />
            </label>
            <div className="bw-fields-row">
              <label>
                Genre:
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option>Sachbuch</option><option>Roman</option><option>Thriller</option>
                  <option>Fantasy</option><option>Selbsthilfe</option><option>Business</option>
                </select>
              </label>
              <label>
                Zielgruppe:
                <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
              </label>
            </div>
          </div>
          <ChapterPlanner
            chapters={storeChapters}
            onAddChapter={newPlannedChapter}
            onUpdateChapter={updateChapter}
            onDeleteChapter={handleDeleteChapter}
            onReorderChapters={reorderChapters}
          />
          <div className="cp-generation">
            <button
              onClick={handleRegenerateOutline}
              disabled={isRegeneratingOutline || !topic.trim()}
              className="cp-gen-btn"
              title="Nur die Gliederung neu erstellen — fertige Kapitel bleiben erhalten"
            >
              🔄 Gliederung neu generieren
            </button>
            {isRegeneratingOutline && <span className="bw-progress-text">Gliederung wird neu erstellt…</span>}
            {storeChapters.filter((ch) => ch.status === "planned").map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleGeneratePlannedChapter(ch)}
                disabled={isGenerating || !activeProjectId}
                className="cp-gen-btn"
              >
                ✍️ Kapitel generieren: {ch.title}
              </button>
            ))}
          </div>
          {/* Export-Sektion (C3): Format-Auswahl, Fortschritt, Erfolgs-Meldung. */}
          <div className="bw-export-section" data-testid="bw-export-section">
            <h4>📦 Export</h4>
            <div className="bw-export-row">
              <label>
                Format:
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  disabled={isExporting}
                  aria-label="Exportformat"
                >
                  <option value="markdown">Markdown (.md)</option>
                  <option value="docx">Word (.docx)</option>
                  <option value="epub">EPUB (.epub)</option>
                  <option value="opml">Scrivener-Outline (.opml)</option>
                </select>
              </label>
              <button
                onClick={handleExport}
                disabled={isExporting || !activeProjectId}
                className="bw-export-btn"
                data-testid="bw-export-btn"
                title="Export nur bei Entwurf/Abgeschlossen; needs_revision-Warnung"
              >
                {isExporting ? "⏳ Exportiere…" : "📦 Buch exportieren"}
              </button>
            </div>
            {exportProgress !== null && (
              <div className="bw-progress" data-testid="bw-export-progress">
                <div className="bw-progress-bar">
                  <div className="bw-progress-fill" style={{ width: `${exportProgress}%` }} />
                </div>
                <span className="bw-progress-text">{exportStatus}</span>
              </div>
            )}
            {exportStatus && exportProgress === null && (
              <div
                className="bw-export-success"
                data-testid="bw-export-success"
                role="status"
              >
                {exportStatus}
              </div>
            )}
            {exportError && (
              <div className="bw-error" data-testid="bw-export-error">Export: {exportError}</div>
            )}
          </div>
        </>
      ) : (
        <div className="bw-fields">
          <label>
            Thema:
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. KI im Alltag" />
          </label>
          <label>
            Genre:
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option>Sachbuch</option><option>Roman</option><option>Thriller</option>
              <option>Fantasy</option><option>Selbsthilfe</option><option>Business</option>
            </select>
          </label>
          <label>
            Zielgruppe:
            <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
          </label>
          <label>
            Kapitel:
            <input type="number" min={3} max={30} value={chapterCount} onChange={(e) => setChapterCount(Number(e.target.value))} />
          </label>
        </div>
      )}

      <div className="bw-actions">
        {viewMode === "classic" && (
          <>
            {!isGenerating ? (
              <button onClick={handleGenerate} disabled={!topic.trim()} className="bw-start">
                📝 Buch generieren
              </button>
            ) : (
              <button onClick={handleStop} className="bw-stop" title="Bereits generierte Kapitel bleiben erhalten.">⏹ Stoppen</button>
            )}
          </>
        )}
      </div>

      {isGenerating && (
        <div className="bw-progress">
          <div className="bw-progress-bar">
            <div className="bw-progress-fill" style={{ width: `${(currentChapter / Math.max(1, chapterCount)) * 100}%` }} />
          </div>
          <span className="bw-progress-text">
            Kapitel {currentChapter} / {chapterCount}
            {remainingLabel ? ` · geschätzte Restzeit ${remainingLabel}` : ""}
          </span>
        </div>
      )}

      {error && <div className="bw-error">Fehler: {error}</div>}

      {liveText && (
        <div className="bw-live">
          <h4>Live:</h4>
          <pre>{liveText}</pre>
        </div>
      )}

      {outline && chapters.length > 0 && (
        <div className="bw-result">
          <h4>{outline.title}</h4>
          <div className="bw-chapters">
            {chapters.map((c) => {
              // C3: pro Kapitel Status-Badge, Wortzahl vs. Ziel, Retry-Zähler,
              // inline Fehler im Row.
              const retry = retryCounts[c.number] ?? 0;
              const words = countWords(c.content);
              const rowError = chapterErrors[c.number];
              return (
                <div key={c.number} className="bw-chapter">
                  <summary>
                    Kapitel {c.number}: {c.title} ({c.content.length} Zeichen)
                  </summary>
                  <div className="bw-chapter-meta">
                    <span
                      className="cp-status-badge"
                      data-testid={`bw-status-${c.number}`}
                      style={{ background: STATUS_COLORS[statusForChapter(c, chapters)] }}
                    >
                      {STATUS_LABELS[statusForChapter(c, chapters)]}
                    </span>
                    <span className="bw-wordcount" data-testid={`bw-words-${c.number}`}>
                      {words.toLocaleString("de-DE")} / {outlineWordTarget(c.number).toLocaleString("de-DE")} Wörter
                    </span>
                    {retry > 0 && (
                      <span className="bw-retry-badge" data-testid={`bw-retry-${c.number}`}>🔁 {retry}× Retry</span>
                    )}
                  </div>
                  {rowError && (
                    <div className="bw-chapter-error" data-testid={`bw-chapter-error-${c.number}`}>
                      Kapitel {c.number}: {rowError} —{" "}
                      <button
                        className="bw-retry-btn"
                        onClick={() => {
                          setChapterErrors((prev) => {
                            // Rest ohne Eintrag für dieses Kapitel (Rest-Pattern).
                            const rest: Record<number, string> = {};
                            for (const [k, v] of Object.entries(prev)) {
                              if (Number(k) !== c.number) rest[Number(k)] = v;
                            }
                            return rest;
                          });
                          const cfg = configFor();
                          setIsGenerating(true);
                          // Wiederaufnahme genau dieses Kapitels:
                          const jobId = activeJobIdRef.current ?? "";
                          (async () => {
                            await runGeneration(cfg, outline!, c.number, chapters, {
                              id: jobId, projectId: activeProjectId ?? "",
                            } as BookJob);
                            setIsGenerating(false);
                          })();
                        }}
                      >
                        erneut versuchen?
                      </button>
                    </div>
                  )}
                  <p>{c.content}</p>
                </div>
              );
            })}
          </div>
          {outline && chapters.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (!activeProjectId) {
                    alert("Bitte erst ein Projekt öffnen/anlegen!");
                    return;
                  }
                  for (const ch of chapters) {
                    const tipTapJson = markdownToTipTap(ch.content);
                    newChapter(`Kapitel ${ch.number}: ${ch.title}`, tipTapJson);
                  }
                  setLiveText((prev) => prev + `\n📚 ${chapters.length} Kapitel mit Content angelegt!`);
                }}
                className="bw-export"
                style={{ background: "#4f46e5", marginRight: "8px" }}
              >
                📚 Kapitel anlegen ({chapters.length})
              </button>
              <button
                onClick={() => {
                  const filename = `${outline.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;padding:20px">${fullText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
                    w.document.title = filename;
                  }
                }}
                className="bw-export"
              >
                📥 Als Markdown anzeigen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Status eines klassisch generierten Kapitels für das Badge (C3). */
function statusForChapter(c: BookChapter, all: BookChapter[]): ChapterStatus {
  return all.includes(c) ? "draft" : "generating";
}

/** Zielwortzahl aus der Outline (Default 2000, wenn kein Summary-Target). */
function outlineWordTarget(chapterNumber: number): number {
  void chapterNumber;
  return 2000;
}
