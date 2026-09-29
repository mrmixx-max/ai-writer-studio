// BookWriterPanel Generation Logic - Core generation loop extracted from God Object

import { useCallback } from "react";
import { withRetry } from "@/services/resilience/retry";
import { generateOutline, generateChapter, type BookOutline, type BookChapter } from "@/services/writing/bookwriter";
import { createBookJob, setBookJobOutline, updateBookJobProgress, setBookJobStatus, completeBookJob, deleteBookJob, type BookJob } from "@/services/bookwriter/jobs";
import type { GenerationConfig, BookWriterState, BookWriterActions } from "./types";

/**
 * Hook for the core generation loop
 * Handles outline generation, chapter generation, resume, and abort logic
 */
export function useGeneration(
  state: BookWriterState,
  actions: BookWriterActions,
  abortRef: React.MutableRefObject<AbortController | null>,
  activeJobIdRef: React.MutableRefObject<string | null>,
  activeProjectId: string | null,
  recordChapterDuration: (durationMs: number, totalChapters: number, doneChapters: number) => number,
  settings: { model: string; ollamaBaseUrl: string | null | undefined },
  t: (key: string, params?: Record<string, string | number>) => string,
  reconcileOutline: (chapters: Array<{ title: string; summary: string }>) => void,
) {

  // Core generation loop - extracted from handleGenerate and handleResume
    const runGeneration = useCallback(async (
      cfg: GenerationConfig,
      bookOutline: BookOutline,
      startAt: number,
      written: BookChapter[],
      job: BookJob,
    ) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      for (let i = startAt; i <= bookOutline.chapters.length; i++) {
        if (ctrl.signal.aborted) break;

        actions.setCurrentChapter(i);
        actions.setLiveText(prev => prev + `✍️ Schreibe Kapitel ${i}: ${bookOutline.chapters[i - 1].title}...\n`);
        const startedAt = Date.now();

        try {
          // Agent-1-Retry: JSON-/Netzwerkfehler werden bis zu 3× wiederholt
          const chapter = await withRetry(
            () => generateChapter(cfg, bookOutline, i, written, ctrl.signal, (m: string) => actions.setLiveText(prev => prev + m + "\n")),
            {
              attempts: 3,
              baseDelayMs: 1000,
              signal: ctrl.signal,
              onRetry: (attempt: number) => {
                actions.setRetryCounts(prev => ({ ...prev, [i]: attempt }));
                actions.setLiveText(prev => prev + `⚠️ Kapitel ${i}: Versuch ${attempt + 1} nach Fehler\n`);
              },
            },
          );

          const elapsed = Date.now() - startedAt;
          actions.setChapters(prev => [...prev, chapter]);
          const estimatedRemaining = recordChapterDuration(elapsed, bookOutline.chapters.length, written.length + 1);
          actions.setEstimatedRemainingMs(estimatedRemaining);
          actions.setLiveText(prev => prev + `✅ Kapitel ${i} fertig (${chapter.content.length} Zeichen)\n\n`);

          // Job-Fortschritt committed (persistNow) → Prozess-Kill-sicher
          await updateBookJobProgress(job.id, i);
        } catch (e: unknown) {
          if (e instanceof Error && e.name === "AbortError") break;
          const msg = e instanceof Error ? e.message : String(e);
          actions.setChapterErrors(prev => ({ ...prev, [i]: msg }));
          actions.setLiveText(prev => prev + `❌ Kapitel ${i}: ${msg}\n`);
          await setBookJobStatus(job.id, "interrupted", `Kapitel ${i}: ${msg}`);
          continue;
        }
      }
    }, [actions, abortRef, recordChapterDuration]);

  // Main generation handler
  const handleGenerate = useCallback(async () => {
    if (!state.topic.trim() || !activeProjectId) return;

    actions.setIsGenerating(true);
    actions.setError(null);
    actions.setOutline(null);
    actions.setChapters([]);
    actions.setCurrentChapter(0);
    actions.setLiveText("");
    actions.setRetryCounts({});
    actions.setChapterErrors({});
    actions.setEstimatedRemainingMs(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Job anlegen VOR der Outline — crash-sicher ab hier (C1)
    const cfg: GenerationConfig = {
      topic: state.topic.trim(),
      genre: state.genre,
      targetAudience: state.targetAudience,
      chapterCount: state.chapterCount,
      wordsPerChapter: state.wordsPerChapter,
      polish: state.polish,
      model: settings.model,
      baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
      language: state.language,
      tone: state.tone.trim() || undefined,
      concept: state.concept.trim() || undefined,
    };
    const job = createBookJob(activeProjectId, cfg);
    activeJobIdRef.current = job.id;

    try {
      // Schritt 1: Outline
      actions.setLiveText("📋 Erstelle Gliederung...\n");
      const appendLive = (m: string) => actions.setLiveText(prev => prev + m + "\n");
      const bookOutline = await generateOutline(cfg, ctrl.signal, undefined, appendLive);
      actions.setOutline(bookOutline);
      await setBookJobOutline(job.id, bookOutline);
      actions.setLiveText(prev => prev + `✅ Gliederung erstellt: ${bookOutline.chapters.length} Kapitel\n\n`);

      // Schritt 2: Kapitel einzeln generieren mit Live-Text
      const writtenChapters: BookChapter[] = [];
      await runGeneration(cfg, bookOutline, 1, writtenChapters, job);

      // Abbruch-Guard: kein "completed" nach Stop
      if (ctrl.signal.aborted || abortRef.current?.signal.aborted) {
        await setBookJobStatus(job.id, "interrupted", "Vom Nutzer abgebrochen");
        return;
      }

      actions.setLiveText(prev => prev + "🎉 Buch fertig!");
      await completeBookJob(job.id);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        actions.setError(e.message);
        actions.setLiveText(prev => prev + `❌ Fehler: ${e.message.split("\n")[0]}\n`);
        await setBookJobStatus(job.id, "interrupted", e.message);
      }
    } finally {
      actions.setIsGenerating(false);
    }
  }, [state, actions, abortRef, activeJobIdRef, activeProjectId, runGeneration, settings]);

  // Resume handler
  const handleResume = useCallback(async () => {
    const job = state.resumeJob;
    actions.setResumeJob(null);
    if (!job || !job.outline) return;

    actions.setIsGenerating(true);
    actions.setError(null);
    actions.setOutline(job.outline);
    actions.setChapters([]);
    actions.setRetryCounts({});
    actions.setChapterErrors({});
    actions.setLiveText(`⏩ Fortsetzung ab Kapitel ${job.currentChapter + 1}...\n`);

    const cfg: GenerationConfig = { 
      ...job.config, 
      model: settings.model, 
      baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
      polish: job.config.polish ?? false,
    } as GenerationConfig;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    activeJobIdRef.current = job.id;
    await setBookJobStatus(job.id, "running", null);

    try {
      const writtenChapters: BookChapter[] = [];
      await runGeneration(cfg, job.outline, job.currentChapter + 1, writtenChapters, job);

      if (ctrl.signal.aborted || abortRef.current?.signal.aborted) {
        await setBookJobStatus(job.id, "interrupted", "Vom Nutzer abgebrochen");
        return;
      }

      actions.setLiveText(prev => prev + "🎉 Buch fertig!");
      await completeBookJob(job.id);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        actions.setError(e.message);
        actions.setLiveText(prev => prev + `❌ Fehler: ${e.message.split("\n")[0]}\n`);
        await setBookJobStatus(job.id, "interrupted", e.message);
      }
    } finally {
      actions.setIsGenerating(false);
    }
  }, [state, actions, abortRef, activeJobIdRef, runGeneration, settings]);

  // Discard job handler
  const handleDiscardJob = useCallback(async () => {
    if (state.resumeJob) await deleteBookJob(state.resumeJob.id);
    actions.setResumeJob(null);
  }, [state.resumeJob, actions]);

  // Stop handler with confirmation
  const handleStop = useCallback(async (confirmFn: (msg: string) => Promise<boolean>) => {
    const ok = await confirmFn(t("bookwriter.confirmStop"));
    if (!ok) return;

    abortRef.current?.abort();
    actions.setIsGenerating(false);
    const jobId = activeJobIdRef.current;
    if (jobId) void setBookJobStatus(jobId, "interrupted", "Vom Nutzer abgebrochen");
  }, [actions, abortRef, activeJobIdRef, t]);

  // Regenerate outline handler
  const handleRegenerateOutline = useCallback(async () => {
    if (!state.topic.trim()) return;
    actions.setIsRegeneratingOutline(true);
    actions.setError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const bookOutline = await generateOutline(
        {
          topic: state.topic.trim(),
          genre: state.genre,
          targetAudience: state.targetAudience,
          chapterCount: state.chapterCount,
          wordsPerChapter: state.wordsPerChapter,
          polish: state.polish,
          model: settings.model,
          baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
          language: state.language,
          tone: state.tone.trim() || undefined,
          concept: state.concept.trim() || undefined,
        },
        ctrl.signal,
        undefined,
        (m: string) => actions.setLiveText(prev => prev + m + "\n"),
      );

      actions.setOutline(bookOutline);
      // Store-Reconcile would be called here
      reconcileOutline(bookOutline.chapters.map((c) => ({ title: c.title, summary: c.summary })));
      actions.setLiveText(prev => prev + `🔄 Gliederung neu generiert (${bookOutline.chapters.length} Kapitel) — fertige Kapitel blieben erhalten.\n`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        actions.setError(e.message);
        actions.setLiveText(prev => prev + `❌ Fehler: Gliederung — ${e.message.split("\n")[0]}\n`);
      }
    } finally {
      actions.setIsRegeneratingOutline(false);
    }
  }, [state, actions, abortRef, settings, reconcileOutline]);

  // Generate planned chapter handler (for future chapter planning)
  const handleGeneratePlannedChapter = useCallback(async (chapterNumber: number) => {
    if (!state.topic.trim() || !activeProjectId || !state.outline) return;
    
    const cfg: GenerationConfig = {
      topic: state.topic.trim(),
      genre: state.genre,
      targetAudience: state.targetAudience,
      chapterCount: state.chapterCount,
      wordsPerChapter: state.wordsPerChapter,
      polish: state.polish,
      model: settings.model,
      baseUrl: settings.ollamaBaseUrl || "http://127.0.0.1:11434",
      language: state.language,
      tone: state.tone.trim() || undefined,
      concept: state.concept.trim() || undefined,
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    
    const chapter = state.outline.chapters[chapterNumber - 1];
    if (!chapter) return;

    actions.setCurrentChapter(chapterNumber);
    actions.setLiveText(prev => prev + `✍️ Schreibe geplantes Kapitel ${chapterNumber}: ${chapter.title}...\n`);
    
    const writtenChapters: BookChapter[] = state.chapters.filter(c => c.number < chapterNumber);
    
    try {
      const generatedChapter = await withRetry(
        () => generateChapter(cfg, state.outline!, chapterNumber, writtenChapters, ctrl.signal, (m: string) => actions.setLiveText(prev => prev + m + "\n")),
        {
          attempts: 3,
          baseDelayMs: 1000,
          signal: ctrl.signal,
          onRetry: (attempt: number) => {
            actions.setRetryCounts(prev => ({ ...prev, [chapterNumber]: attempt }));
            actions.setLiveText(prev => prev + `⚠️ Kapitel ${chapterNumber}: Versuch ${attempt + 1} nach Fehler\n`);
          },
        },
      );
      
      actions.setChapters(prev => [...prev, generatedChapter]);
      actions.setLiveText(prev => prev + `✅ Geplantes Kapitel ${chapterNumber} fertig (${generatedChapter.content.length} Zeichen)\n\n`);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      actions.setChapterErrors(prev => ({ ...prev, [chapterNumber]: msg }));
      actions.setLiveText(prev => prev + `❌ Kapitel ${chapterNumber}: ${msg}\n`);
    }
  }, [state, actions, abortRef, settings]);

  return {
    handleGenerate,
    handleResume,
    handleDiscardJob,
    handleStop,
    handleRegenerateOutline,
    handleGeneratePlannedChapter,
    runGeneration,
  };
}