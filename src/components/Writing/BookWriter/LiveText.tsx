// BookWriterPanel UI Components - Live Text, Chapter Editor, and Controls

import { useI18n } from "@/i18n";
import type { BookWriterState } from "./types";
import { STATUS_LABELS, STATUS_COLORS } from "./types";

export interface LiveTextProps {
  state: BookWriterState;
}

export function LiveText({ state }: LiveTextProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="bw-live">
      <div className="bw-live-header">
        <h3>{tFlex("bookwriter.live", "Live")}</h3>
        {state.isGenerating && (
          <span className="bw-generating-badge">{tFlex("bookwriter.controls.generate", "Generiere...")}</span>
        )}
        {state.estimatedRemainingMs && state.isGenerating && (
          <span className="bw-eta">ETA: {Math.round(state.estimatedRemainingMs / 1000)}s</span>
        )}
      </div>

      <div
        className="bw-live-content"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <pre>{state.liveText || "Keine Live-Ausgabe"}</pre>
      </div>

      {state.error && (
        <div className="bw-error-banner" role="alert">
          {state.error}
        </div>
      )}
    </div>
  );
}

export interface ChapterEditorProps {
  state: BookWriterState;
  onSave: (content: string) => void;
  onContentChange: (content: string) => void;
  onHideError: (chapterNumber: number) => void;
}

export function ChapterEditor({ state, onSave, onContentChange, onHideError }: ChapterEditorProps) {

  if (!state.outline || state.currentChapter === 0) return null;

  const outlineChapter = state.outline.chapters[state.currentChapter - 1];
  const chapter = state.chapters.find((c) => c.number === state.currentChapter);

  if (!outlineChapter) return null;

  const status = chapter?.status || "planned";
  const content = chapter?.content || "";

  return (
    <div className="bw-editor">
      <div className="bw-editor-header">
        <h3>Kapitel {state.currentChapter}: {outlineChapter.title}</h3>
        <div className="bw-editor-status">
          <span
            className="bw-status-badge"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      {state.chapterErrors[state.currentChapter] && (
        <div className="bw-chapter-error" role="alert">
          {state.chapterErrors[state.currentChapter]}
          <button onClick={() => onHideError(state.currentChapter)}>
            Fehler ausblenden
          </button>
        </div>
      )}

      <textarea
        className="bw-editor-textarea"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Kapitel-Inhalt..."
        rows={20}
        spellCheck={true}
      />

      <div className="bw-editor-actions">
        <button
          onClick={() => onSave(content)}
          disabled={state.isGenerating}
        >
          Speichern
        </button>
        <button
          onClick={() => onHideError(state.currentChapter)}
          disabled={state.isGenerating || !state.chapterErrors[state.currentChapter]}
        >
          Fehler ausblenden
        </button>
      </div>
    </div>
  );
}

export interface GenerationControlsProps {
  state: BookWriterState;
  onGenerate: () => void;
  onResume: () => void;
  onDiscardJob: () => void;
  onStop: () => void;
}

export function GenerationControls({
  state,
  onGenerate,
  onResume,
  onDiscardJob,
  onStop,
}: GenerationControlsProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="bw-controls">
      {state.resumeJob && !state.isGenerating && (
        <div className="bw-resume-banner">
          <span>Fortsetzung verfügbar ab Kapitel {state.resumeJob.currentChapter}</span>
          <div className="bw-resume-actions">
            <button onClick={onResume} className="bw-btn-primary">
              {tFlex("bookwriter.resume", "Fortsetzen")}
            </button>
            <button onClick={onDiscardJob} className="bw-btn-secondary">
              {tFlex("bookwriter.discard", "Verwerfen")}
            </button>
          </div>
        </div>
      )}

      {!state.isGenerating && !state.resumeJob && (
        <button
          className="bw-btn-primary bw-btn-large"
          onClick={onGenerate}
          disabled={!state.topic.trim() || state.isRegeneratingOutline}
        >
          {state.isRegeneratingOutline
            ? "Gliederung wird neu erstellt..."
            : tFlex("bookwriter.generate", "Generieren")}
        </button>
      )}

      {state.isGenerating && (
        <button
          className="bw-btn-danger bw-btn-large"
          onClick={onStop}
        >
          {tFlex("bookwriter.stop", "Stop")}
        </button>
      )}
    </div>
  );
}

export interface ExportControlsProps {
  state: BookWriterState;
  onExport: () => void;
  onExportFormatChange: (format: "markdown" | "docx" | "epub" | "opml") => void;
}

export function ExportControls({ state, onExport, onExportFormatChange }: ExportControlsProps) {
  const { t } = useI18n();

  // Fallback for strict i18n keys
  const tFlex = (key: string, fallback: string) => {
    try {
      return t(key as any) || fallback;
    } catch {
      return fallback;
    }
  };

  if (!state.outline || state.chapters.length === 0) return null;

  return (
    <div className="bw-export">
      <h3>{tFlex("bookwriter.exportTitle", "Export")}</h3>

      <select
        value={state.exportFormat}
        onChange={(e) => onExportFormatChange(e.target.value as "markdown" | "docx" | "epub" | "opml")}
      >
        <option value="epub">EPUB</option>
        <option value="docx">DOCX</option>
        <option value="markdown">Markdown</option>
        <option value="opml">OPML</option>
      </select>

      {state.isExporting && (
        <div className="bw-export-progress">
          <progress value={state.exportProgress || 0} max="100" />
          <span>{state.exportStatus}</span>
        </div>
      )}

      {state.exportError && (
        <div className="bw-export-error" role="alert">
          {state.exportError}
        </div>
      )}

      <button
        className="bw-btn-secondary"
        onClick={onExport}
        disabled={state.isExporting || state.isGenerating}
      >
        {state.isExporting ? tFlex("bookwriter.exporting", "Exportiere...") : tFlex("bookwriter.exportBtn", "Exportieren")}
      </button>
    </div>
  );
}