// BookWriterPanel - Refactored main component
// Original God Object (~974 lines) split into:
// - types.ts: Type definitions
// - hooks.ts: State management
// - generation.ts: Generation loop
// - export.ts: Export functionality
// - ConfigForm.tsx: Configuration UI
// - LiveText.tsx: Live text, editor, controls, export UI

import { useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/i18n";
import { useBookWriterState, useAbortController, useChapterTiming } from "./hooks";
import { useGeneration } from "./generation";
import { useExport } from "./export";
import { ConfigForm, PremiseConceptForm, OutlineDisplay } from "./ConfigForm";
import { LiveText, ChapterEditor, GenerationControls, ExportControls } from "./LiveText";

export function BookWriterPanel() {
  const { t } = useI18n();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // Wrap t function to accept string keys (i18n is strict)
  const tFlex = useCallback((key: string, params?: Record<string, string | number>) => t(key as any, params), [t]);

  // State and actions
  const [state, actions] = useBookWriterState();
  const { abortRef, activeJobIdRef } = useAbortController();
  const { recordChapterDuration } = useChapterTiming();

  // Generation logic
  const {
    handleGenerate,
    handleResume,
    handleDiscardJob,
    handleStop,
    handleRegenerateOutline,
  } = useGeneration(
    state,
    actions,
    abortRef,
    activeJobIdRef,
    activeProjectId,
    recordChapterDuration,
    { model: "default", ollamaBaseUrl: undefined },
    tFlex,
    () => { /* reconcile outline */ },
  );

  // Export logic - use state.chapters directly
  const { handleExport } = useExport(
    state,
    actions,
    activeProjectId,
    state.chapters.map((ch) => ({
      number: ch.number,
      title: ch.title,
      content: ch.content,
      status: ch.status ?? "planned",
    })),
    state.topic,
  );

  // Chapter click handler
  const handleChapterClick = useCallback((num: number) => {
    actions.setCurrentChapter(num);
  }, [actions]);

  // Save chapter handler
  const handleSaveChapter = useCallback((content: string) => {
    // Update chapter in store
    if (activeProjectId && state.currentChapter > 0) {
      const chapter = state.chapters.find((c) => c.number === state.currentChapter);
      if (chapter) {
        const updated = { ...chapter, content, status: "draft" as const };
        useProjectStore.getState().updateChapter(activeProjectId, updated);
        actions.setChapters(state.chapters.map((c) => (c.number === state.currentChapter ? updated : c)));
      }
    }
  }, [activeProjectId, state, actions]);

  // Wrap handleStop to match expected signature
  const handleStopWrapped = useCallback(() => {
    handleStop(async (msg) => {
      const confirmed = window.confirm(msg);
      return confirmed;
    });
  }, [handleStop]);

  if (!activeProjectId) {
    return (
      <div className="bw-panel">
        <div className="bw-empty">
          <p>{tFlex("bookwriter.noProject") || "Kein Projekt ausgewählt"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bw-panel">
      <header className="bw-header">
        <h2>{tFlex("bookwriter.title") || "Buch-Schreiber"}</h2>
        <div className="bw-header-actions">
          {state.panelNotice && <span className="bw-notice">{state.panelNotice}</span>}
        </div>
      </header>

      <div className="bw-grid">
        {/* Left sidebar: Config, Premise, Outline */}
        <aside className="bw-sidebar">
          <ConfigForm state={state} actions={actions} />
          <PremiseConceptForm state={state} actions={actions} />
          <OutlineDisplay
            outline={state.outline}
            chapters={state.chapters.map((ch) => ({
              number: ch.number,
              title: ch.title,
              content: ch.content,
              status: ch.status ?? "planned",
            }))}
            currentChapter={state.currentChapter}
            onChapterClick={handleChapterClick}
            onRegenerate={handleRegenerateOutline}
            isRegenerating={state.isRegeneratingOutline}
          />
        </aside>

        {/* Main area: Live text / Chapter editor */}
        <main className="bw-main">
          {state.viewMode === "classic" ? (
            <LiveText state={state} />
          ) : (
            <ChapterEditor
              state={state}
              onSave={handleSaveChapter}
              onContentChange={(content) => actions.setLiveText(content)}
              onHideError={(chapterNum) => {
                const rest: Record<number, string> = {};
                for (const [k, v] of Object.entries(state.chapterErrors)) {
                  if (Number(k) !== chapterNum) rest[Number(k)] = v;
                }
                actions.setChapterErrors(rest);
              }}
            />
          )}
        </main>

        {/* Right sidebar: Controls, Export */}
        <aside className="bw-sidebar bw-sidebar-right">
          <GenerationControls
            state={state}
            onGenerate={handleGenerate}
            onResume={handleResume}
            onDiscardJob={handleDiscardJob}
            onStop={handleStopWrapped}
          />
          <ExportControls
            state={state}
            onExport={handleExport}
            onExportFormatChange={(format) => actions.setExportFormat(format)}
          />
        </aside>
      </div>
    </div>
  );
}

export default BookWriterPanel;