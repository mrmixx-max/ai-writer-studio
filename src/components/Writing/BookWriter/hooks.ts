// BookWriterPanel Hooks - State management extracted from God Object

import { useState, useCallback, useRef } from "react";
import type {
  BookWriterState,
  BookWriterActions,
  ViewMode,
  RetryCounts,
  ChapterErrors,
  BookJob,
  BookOutline,
  BookChapter,
} from "./types";

/**
 * Main state hook for BookWriterPanel
 * Extracts all useState and derived state from the God Object
 */
export function useBookWriterState(): [BookWriterState, BookWriterActions] {
  // Core state
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("Sachbuch");
  const [targetAudience, setTargetAudience] = useState("Erwachsene");
  const [chapterCount, setChapterCount] = useState(8);
  const [wordsPerChapter, setWordsPerChapter] = useState(1000);
  const [polish, setPolish] = useState(true);
  const [tone, setTone] = useState("");
  const [language] = useState("Deutsch");
  const [viewMode, setViewMode] = useState<ViewMode>("planner");
  const [premise, setPremise] = useState("");
  const [concept, setConcept] = useState("");
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [liveText, setLiveText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCounts, setRetryCounts] = useState<RetryCounts>({});
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState<number | null>(null);
  const [chapterErrors, setChapterErrors] = useState<ChapterErrors>({});
  const [resumeJob, setResumeJob] = useState<BookJob | null>(null);
  const [exportFormat, setExportFormat] = useState<"markdown" | "docx" | "epub" | "opml">("epub");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const [isSuggestingConcept, setIsSuggestingConcept] = useState(false);

  // Actions object
  const actions: BookWriterActions = {
    setTopic,
    setGenre,
    setTargetAudience,
    setChapterCount,
    setWordsPerChapter,
    setPolish,
    setTone,
    setViewMode,
    setPremise,
    setConcept,
    setOutline,
    setChapters,
    setCurrentChapter,
    setLiveText,
    setIsGenerating,
    setError,
    setRetryCounts,
    setEstimatedRemainingMs,
    setChapterErrors,
    setResumeJob,
    setExportFormat,
    setIsExporting,
    setExportProgress,
    setExportStatus,
    setExportError,
    setPanelNotice,
    setIsRegeneratingOutline,
    setIsSuggestingConcept,
  };

  const state: BookWriterState = {
    topic,
    genre,
    targetAudience,
    chapterCount,
    wordsPerChapter,
    polish,
    tone,
    language,
    viewMode,
    premise,
    concept,
    outline,
    chapters,
    currentChapter,
    liveText,
    isGenerating,
    error,
    retryCounts,
    estimatedRemainingMs,
    chapterErrors,
    resumeJob,
    exportFormat,
    isExporting,
    exportProgress,
    exportStatus,
    exportError,
    panelNotice,
    isRegeneratingOutline,
    isSuggestingConcept,
  };

  return [state, actions];
}

/**
 * Hook for chapter duration tracking and remaining time estimation
 */
export function useChapterTiming() {
  const chapterDurationsRef = useRef<number[]>([]);

  const recordChapterDuration = useCallback((durationMs: number, totalChapters: number, doneChapters: number) => {
    const durations = chapterDurationsRef.current;
    durations.push(durationMs);
    const window = durations.slice(-3);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    const remaining = Math.max(0, totalChapters - doneChapters);
    return avg * remaining;
  }, []);

  return { recordChapterDuration };
}

/**
 * Hook for abort controller management
 */
export function useAbortController() {
  const abortRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const createController = useCallback(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const isAborted = useCallback(() => {
    return abortRef.current?.signal.aborted ?? false;
  }, []);

  return { createController, abort, isAborted, abortRef, activeJobIdRef };
}