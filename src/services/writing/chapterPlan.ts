// Kapitelplanung: Wortzählung, Fortschrittsberechnung, Validierung.
import type { Chapter } from "@/types/project";

/**
 * Deutsche Wortzählung: entfernt Markdown-Syntax, zählt Leerzeichen-getrennte Token.
 * Berücksichtigt: Überschriften, Listen, Code-Blöcke, Gedankenstriche.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;

  // Markdown-Syntax entfernen
  const cleaned = text
    // Code-Blöcke
    .replace(/```[\s\S]*?```/g, "")
    // Inline-Code
    .replace(/`[^`]*`/g, "")
    // Überschriften-Marker
    .replace(/^#{1,6}\s+/gm, "")
    // Listen-Marker
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Bold/Italic
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, "$2")
    // Links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Bilder ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // HTML-Tags
    .replace(/<[^>]+>/g, "")
    // Mehrere Leerzeichen/Newlines
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return 0;

  // Leerzeichen-getrennte Token zählen
  return cleaned.split(" ").filter((w) => w.length > 0).length;
}

/**
 * Leitet Mindest- und Höchstwortzahl aus der Zielwortzahl ab.
 * Default-Toleranz: ±20%.
 */
export function deriveMinMax(
  targetWordCount: number,
  tolerancePercent = 20,
): { min: number; max: number } {
  const tolerance = Math.round((targetWordCount * tolerancePercent) / 100);
  const min = Math.max(100, targetWordCount - tolerance);
  const max = targetWordCount + tolerance;
  return { min, max };
}

export interface WordStats {
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  isUnderMinimum: boolean;
  isOverMaximum: boolean;
  isWithinRange: boolean;
}

/**
 * Berechnet Fortschritt und Abweichung für ein Kapitel.
 */
export function computeWordStats(chapter: Chapter): WordStats {
  const current = chapter.currentWordCount || 0;
  const target = chapter.targetWordCount || 1;
  const remaining = Math.max(0, target - current);
  const progressPercent = Math.min(100, Math.round((current / target) * 100));
  const isUnderMinimum = current < chapter.minimumWordCount;
  const isOverMaximum = current > chapter.maximumWordCount;
  const isWithinRange =
    current >= chapter.minimumWordCount && current <= chapter.maximumWordCount;

  return {
    current,
    target,
    remaining,
    progressPercent,
    isUnderMinimum,
    isOverMaximum,
    isWithinRange,
  };
}

/**
 * Validiert einen Kapitelplan. Gibt Liste von Fehlermeldungen zurück.
 * Leere Liste = valide.
 */
export function validateChapterPlan(chapter: Partial<Chapter>): string[] {
  const errors: string[] = [];

  if (chapter.targetWordCount !== undefined) {
    if (chapter.targetWordCount < 100) {
      errors.push("Zielwortzahl muss mindestens 100 sein.");
    }
    if (chapter.targetWordCount > 50000) {
      errors.push("Zielwortzahl darf 50.000 nicht überschreiten.");
    }
  }

  if (
    chapter.minimumWordCount !== undefined &&
    chapter.maximumWordCount !== undefined &&
    chapter.minimumWordCount > chapter.maximumWordCount
  ) {
    errors.push("Mindestwortzahl darf nicht größer sein als Höchstwortzahl.");
  }

  if (
    chapter.targetWordCount !== undefined &&
    chapter.minimumWordCount !== undefined &&
    chapter.targetWordCount < chapter.minimumWordCount
  ) {
    errors.push("Zielwortzahl darf nicht kleiner sein als Mindestwortzahl.");
  }

  if (
    chapter.targetWordCount !== undefined &&
    chapter.maximumWordCount !== undefined &&
    chapter.targetWordCount > chapter.maximumWordCount
  ) {
    errors.push("Zielwortzahl darf nicht größer sein als Höchstwortzahl.");
  }

  return errors;
}

/**
 * Erstellt ein neues Kapitel mit sinnvollen Defaults.
 */
export function createDefaultChapter(
  projectId: string,
  orderIndex: number,
  overrides?: Partial<Chapter>,
): Chapter {
  const targetWordCount = overrides?.targetWordCount ?? 2000;
  const { min, max } = deriveMinMax(targetWordCount);

  const now = Date.now();
  return {
    id: overrides?.id ?? `ch_${now}_${Math.random().toString(36).slice(2, 9)}`,
    projectId,
    title: overrides?.title ?? `Kapitel ${orderIndex + 1}`,
    content: overrides?.content ?? "",
    orderIndex,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    status: overrides?.status ?? "planned",
    targetWordCount,
    minimumWordCount: overrides?.minimumWordCount ?? min,
    maximumWordCount: overrides?.maximumWordCount ?? max,
    currentWordCount: overrides?.currentWordCount ?? 0,
    purpose: overrides?.purpose,
    synopsis: overrides?.synopsis,
    generatedContent: overrides?.generatedContent,
    lastError: overrides?.lastError,
  };
}
