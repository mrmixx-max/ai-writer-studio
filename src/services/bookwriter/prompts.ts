// Prompt-Templates für den Bookwriter.
//
// Sprint 6 (Agent 2): Die Prompts leben jetzt EXTERN in
// prompts/prompts.json (Handlebars-Templates + Genre-Profile). Diese Datei
// ist die abwärtskompatible Fassade: identische Funktionssignaturen, die
// gerenderten Prompts sind byte-identisch zu den bisherigen Hardcoded-
// Strings. Neue Genres sind reine Datenänderung in prompts.json.
//
// Dynamische Variablen (Handlebars): targetAudience, tone (Tone-of-Voice)
// und Buchlänge (chapterCount/wordsPerChapter/chapterWords) werden je
// Aufruf injiziert — siehe prompts/library.ts.

import {
  systemFromProfile,
  renderPrompt,
} from "./prompts/library";

export {
  PROMPT_LIBRARY,
  PROMPT_LIBRARY_VERSION,
  listGenres,
  listTemplates,
  renderPrompt,
  resolveGenre,
  normalizeGenreKey,
  systemFromProfile,
} from "./prompts/library";
export { renderTemplate, isTruthy } from "./prompts/template";
export type { TemplateVars } from "./prompts/template";
export type { GenreProfile, PromptLibrary } from "./prompts/library";

export const PROMPT_VERSION = "2.0";

/** Bauen einen System-Prompt je nach Genre (jetzt aus prompts.json). */
export function systemForGenre(genre: string, tone: string, language: string): string {
  return systemFromProfile(genre, tone, language);
}

const BLURB_STYLES = [
  "Spannend und mitreißend, endet mit einer direkten Frage an den Leser.",
  "Ruhig und reflektiert, spricht den Nutzen für den Leser an.",
  "Provokant und pointiert, stellt eine unbequeme Frage.",
];

/** Prompt: Titel generieren. */
export function promptTitles(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  targetAudience: string;
  corePromise: string;
}): string {
  return renderPrompt("titles", {
    genre: briefing.genre,
    idea: briefing.idea,
    uniqueAngle: briefing.uniqueAngle,
    targetAudience: briefing.targetAudience,
    corePromise: briefing.corePromise,
  });
}

/** Prompt: Untertitel generieren. */
export function promptSubtitles(title: string, briefing: {
  genre: string;
  corePromise: string;
  targetAudience: string;
}): string {
  return renderPrompt("subtitles", {
    title,
    genre: briefing.genre,
    corePromise: briefing.corePromise,
    targetAudience: briefing.targetAudience,
  });
}

/** Prompt: Positionierung entwickeln. */
export function promptPositioning(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  targetAudience: string;
}): string {
  return renderPrompt("positioning", {
    genre: briefing.genre,
    idea: briefing.idea,
    uniqueAngle: briefing.uniqueAngle,
    targetAudience: briefing.targetAudience,
  });
}

/** Prompt: Gliederung generieren. */
export function promptOutline(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  corePromise: string;
  chapterCount: number;
  wordsPerChapter: number;
  targetAudience: string;
  tone: string;
  customOutline: string | null;
}): string {
  return renderPrompt("outline", {
    genre: briefing.genre,
    idea: briefing.idea,
    uniqueAngle: briefing.uniqueAngle,
    corePromise: briefing.corePromise,
    targetAudience: briefing.targetAudience,
    tone: briefing.tone,
    chapterCount: briefing.chapterCount,
    wordsPerChapter: briefing.wordsPerChapter,
    customOutline: briefing.customOutline ?? "",
  });
}

/** Prompt: Kapitel schreiben. */
export function promptWriteChapter(briefing: {
  genre: string;
  tone: string;
  idea: string;
  corePromise: string;
  targetAudience: string;
}, chapter: {
  title: string;
  goal: string;
  conflict: string;
  outcome: string;
  estimatedWords: number;
  pov: string;
  subchapters: string[];
}, context: {
  previousSummaries: string[];
  researchNotes: string[];
}): string {
  return renderPrompt("writeChapter", {
    genre: briefing.genre,
    idea: briefing.idea,
    corePromise: briefing.corePromise,
    targetAudience: briefing.targetAudience,
    tone: briefing.tone,
    chapterTitle: chapter.title,
    chapterGoal: chapter.goal,
    chapterConflict: chapter.conflict,
    chapterOutcome: chapter.outcome,
    chapterPov: chapter.pov,
    chapterWords: chapter.estimatedWords,
    subchapters: chapter.subchapters,
    previousSummaries: context.previousSummaries,
    researchNotes: context.researchNotes,
  });
}

/** Prompt: Kapitel zusammenfassen. */
export function promptSummarizeChapter(title: string, content: string): string {
  return renderPrompt("summarizeChapter", {
    title,
    content: content.slice(0, 4000),
  });
}

/** Prompt: Klappentext. */
export function promptBlurb(title: string, subtitle: string, briefing: {
  genre: string;
  idea: string;
  corePromise: string;
  targetAudience: string;
  tone: string;
}, variant: number): string {
  return renderPrompt("blurb", {
    title,
    subtitle,
    genre: briefing.genre,
    idea: briefing.idea,
    corePromise: briefing.corePromise,
    targetAudience: briefing.targetAudience,
    tone: briefing.tone,
    blurbStyle: BLURB_STYLES[variant % BLURB_STYLES.length],
  });
}

/** Prompt: Keywords. */
export function promptKeywords(title: string, briefing: {
  genre: string;
  idea: string;
  targetAudience: string;
}): string {
  return renderPrompt("keywords", {
    title,
    genre: briefing.genre,
    idea: briefing.idea,
    targetAudience: briefing.targetAudience,
  });
}

/** Prompt: Qualitätsbewertung. */
export function promptQualityCheck(dimension: string, chapter: {
  title: string;
  goal: string;
  content: string;
}): string {
  return renderPrompt("qualityCheck", {
    dimension,
    chapterTitle: chapter.title,
    chapterGoal: chapter.goal,
    chapterContent: chapter.content.slice(0, 3000),
  });
}
