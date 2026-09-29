// BookWriterPanel Types - Extracted from God Object for maintainability

import type { BookOutline, BookChapter } from "@/services/writing/bookwriter";
import type { BookJob } from "@/services/bookwriter/jobs";
import type { ChapterStatus } from "@/types/project";
import type { ExportFormat } from "@/services/bookwriter/export";

// Re-export types
export type { ChapterStatus } from "@/types/project";
export type { ExportFormat } from "@/services/bookwriter/export";
export type { BookJob } from "@/services/bookwriter/jobs";
export type { BookOutline, BookChapter } from "@/services/writing/bookwriter";

/** Status-Badge-Labels/Farben — gleiche Quelle wie ChapterPlanner (C3). */
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
export type RetryCounts = Record<number, number>;

/** Inline-Fehler je Kapitelnummer (statt generischem Abbruch, C3). */
export type ChapterErrors = Record<number, string>;

/** View modes for the panel */
export type ViewMode = "classic" | "planner";

/** Configuration for generation */
export interface GenerationConfig {
  topic: string;
  genre: string;
  targetAudience: string;
  chapterCount: number;
  wordsPerChapter?: number;
  polish: boolean;
  model: string;
  baseUrl: string;
  language: string;
  tone?: string;
  concept?: string;
}

/** BookWriterPanel State shape */
export interface BookWriterState {
  topic: string;
  genre: string;
  targetAudience: string;
  chapterCount: number;
  wordsPerChapter: number;
  polish: boolean;
  tone: string;
  language: string;
  viewMode: ViewMode;
  premise: string;
  concept: string;
  outline: BookOutline | null;
  chapters: BookChapter[];
  currentChapter: number;
  liveText: string;
  isGenerating: boolean;
  error: string | null;
  retryCounts: RetryCounts;
  estimatedRemainingMs: number | null;
  chapterErrors: ChapterErrors;
  resumeJob: BookJob | null;
  exportFormat: ExportFormat;
  isExporting: boolean;
  exportProgress: number | null;
  exportStatus: string | null;
  exportError: string | null;
  panelNotice: string | null;
  isRegeneratingOutline: boolean;
  isSuggestingConcept: boolean;
}

/** BookWriterPanel Actions shape */
export interface BookWriterActions {
  setTopic: (topic: string) => void;
  setGenre: (genre: string) => void;
  setTargetAudience: (audience: string) => void;
  setChapterCount: (count: number) => void;
  setWordsPerChapter: (words: number) => void;
  setPolish: (polish: boolean) => void;
  setTone: (tone: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setPremise: (premise: string) => void;
  setConcept: (concept: string) => void;
  setOutline: (outline: BookOutline | null) => void;
  setChapters: (chapters: BookChapter[] | ((prev: BookChapter[]) => BookChapter[])) => void;
  setCurrentChapter: (chapter: number) => void;
  setLiveText: (text: string | ((prev: string) => string)) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setRetryCounts: (counts: RetryCounts | ((prev: RetryCounts) => RetryCounts)) => void;
  setEstimatedRemainingMs: (ms: number | null) => void;
  setChapterErrors: (errors: ChapterErrors | ((prev: ChapterErrors) => ChapterErrors)) => void;
  setResumeJob: (job: BookJob | null) => void;
  setExportFormat: (format: ExportFormat) => void;
  setIsExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number | null) => void;
  setExportStatus: (status: string | null) => void;
  setExportError: (error: string | null) => void;
  setPanelNotice: (notice: string | null) => void;
  setIsRegeneratingOutline: (regenerating: boolean) => void;
  setIsSuggestingConcept: (suggesting: boolean) => void;
}

/** Chapter generation result with metadata */
export interface ChapterGenerationResult {
  chapter: BookChapter;
  elapsed: number;
}

/** Export configuration */
export interface ExportConfig {
  format: ExportFormat;
  title: string;
  author: string;
  language: string;
  chapters: Array<{
    number: number;
    title: string;
    content: string;
    status?: string;
  }>;
}