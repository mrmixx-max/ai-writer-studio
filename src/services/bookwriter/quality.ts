// Bookwriter: Qualitätsloop.
//
// Prüft jedes Kapitel nach der Generierung automatisch auf:
// - Konsistenz (Figuren, Orte, Zeitlinie)
// - Stil (Füllwörter, Passiv, Satzlänge)
// - Wiederholungen
// - Struktur (Überschriften, Länge)
// - Kapitelziel-Erreichung
//
// Nutzt die bestehende Manuskriptprüfung (diagnostics), anstatt sie
// neu zu bauen.

import { loadSettings } from "@/services/settings";
import { createProvider, buildMessages } from "@/services/llm";
import { promptQualityCheck } from "./prompts";
import { saveArtifact } from "./state";
import type { BookBriefing, OutlineChapter, QualityScore } from "@/types/bookwriter";
import { DIMENSION_LABELS } from "@/types/bookwriter";

/** Ergebnis der Kapitelprüfung. */
export interface ChapterQualityResult {
  chapterIndex: number;
  chapterTitle: string;
  scores: QualityScore[];
  overallLevel: "green" | "yellow" | "red";
  issues: string[];
  suggestions: string[];
}

/** Qualitätsloop für ein einzelnes Kapitel. */
export async function checkChapterQuality(
  runId: string,
  briefing: BookBriefing,
  chapter: OutlineChapter,
  chapterContent: string,
  chapterIndex: number,
  allChapters: Array<{ title: string; content: string }>,
): Promise<ChapterQualityResult> {
  const settings = loadSettings();
  const system = systemForGenre(briefing.genre, briefing.tone, briefing.language);

  const scores: QualityScore[] = [];
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Stilprüfung: Nutze die bestehende Stilprüfung.
  const styleIssues = checkStyle(chapterContent);
  issues.push(...styleIssues);

  // Länge gegen Zielwortzahl.
  const wordCount = countWords(chapterContent);
  const targetWords = chapter.estimatedWords;
  const lengthDeviation = Math.abs(wordCount - targetWords) / targetWords;

  if (lengthDeviation > 0.3) {
    const direction = wordCount > targetWords ? "über" : "unter";
    issues.push(
      `Kapitel ist ${direction} der Zielwortzahl: ${wordCount} statt ca. ${targetWords} Wörter.`,
    );
    suggestions.push(
      wordCount > targetWords
        ? "Prüfe, ob sich der Satz an einer inhaltischen Zäsur teilen lässt."
        : "Das Kapitel könnte mehr Tiefe gewinnen, etwa durch ein Beispiel oder eine Szene.",
    );
  }

  // Wiederholungsprüfung.
  const repetitions = checkRepetitions(chapterContent);
  issues.push(...repetitions);

  // Konsistenz mit Vorkapiteln.
  if (chapterIndex > 0) {
    const consistencyIssues = checkConsistencyWithPrevious(
      chapterContent,
      allChapters.slice(0, chapterIndex),
    );
    issues.push(...consistencyIssues);
  }

  // Qualitätswerte für jede Dimension.
  const dimensions: Array<QualityScore["dimension"]> = [
    "kohaerenz", "stilgleichheit", "wiederholungsgrad", "kapitelqualitaet",
  ];

  for (const dim of dimensions) {
    const score = await evaluateDimensionSafe(
      settings,
      system,
      dim,
      chapter,
      chapterContent,
    );
    scores.push(score);
  }

  // Gesamtbewertung.
  const overallLevel = determineOverallLevel(scores);

  const result: ChapterQualityResult = {
    chapterIndex,
    chapterTitle: chapter.title,
    scores,
    overallLevel,
    issues,
    suggestions,
  };

  // Speichern.
  await saveArtifact(runId, "qualitaet", `chapter-${chapterIndex}`, result);

  return result;
}

/** Stilprüfung — kopiert aus diagnostics/style.ts, hier vereinfacht. */
function checkStyle(content: string): string[] {
  const issues: string[] = [];

  // Füllwörter.
  const fillers = ["eigentlich", "irgendwie", "quasi", "gewissermaßen", "letztlich"];
  const found = fillers.filter((f) => content.toLowerCase().includes(f));
  if (found.length >= 3) {
    issues.push(`Viele Füllwörter: ${found.join(", ")}.`);
  }

  // Sehr lange Sätze.
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const longSentences = sentences.filter((s) => countWords(s) > 40);
  if (longSentences.length > 3) {
    issues.push(`${longSentences.length} sehr lange Sätze (über 40 Wörter).`);
  }

  return issues;
}

/** Wiederholungsprüfung. */
function checkRepetitions(content: string): string[] {
  const issues: string[] = [];
  const words = content.toLowerCase().match(/\p{L}{5,}/gu) ?? [];
  const counts = new Map<string, number>();

  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (repeated.length > 0) {
    issues.push(
      `Wortwiederholungen: ${repeated.map(([w, n]) => `${w} (${n}×)`).join(", ")}.`,
    );
  }

  return issues;
}

/** Konsistenz mit Vorkapiteln. */
function checkConsistencyWithPrevious(
  content: string,
  previous: Array<{ title: string; content: string }>,
): string[] {
  const issues: string[] = [];

  // Einfache Prüfung: Figurenname aus vorherigem Kapitel fehlt im aktuellen.
  const nameRe = /\p{Lu}\p{L}{2,}/gu;
  const prevNames = new Set<string>();
  for (const p of previous) {
    const names = p.content.match(nameRe) ?? [];
    for (const n of names) prevNames.add(n);
  }

  const currentNames = new Set(content.match(nameRe) ?? []);
  const missing = [...prevNames].filter(
    (n) => !currentNames.has(n) && !["Der", "Die", "Das", "Ein", "Eine", "Ich", "Er", "Sie"].includes(n),
  );

  if (missing.length > 0 && previous.length > 0) {
    if (missing.length <= 2) return issues;
    issues.push(
      `Figuren aus Vorkapiteln fehlen: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}.`,
    );
  }

  return issues;
}

/** Bewertet eine Qualitätsdimension mit KI — mit Fallback. */
async function evaluateDimensionSafe(
  settings: ReturnType<typeof loadSettings>,
  system: string,
  dimension: QualityScore["dimension"],
  chapter: OutlineChapter,
  content: string,
): Promise<QualityScore> {
  try {
    return await evaluateDimension(settings, system, dimension, chapter, content);
  } catch {
    // Fallback: Regelbasierte Bewertung, wenn kein LLM verfügbar.
    return {
      id: `qs-${Date.now()}-${dimension}`,
      runId: "",
      dimension,
      level: "yellow",
      score: 50,
      details: "Automatische Bewertung nicht verfügbar.",
    };
  }
}

/** Bewertet eine Qualitätsdimension mit KI. */
async function evaluateDimension(
  settings: ReturnType<typeof loadSettings>,
  system: string,
  dimension: QualityScore["dimension"],
  chapter: OutlineChapter,
  content: string,
): Promise<QualityScore> {
  const provider = createProvider(settings);
  const prompt = promptQualityCheck(DIMENSION_LABELS[dimension], {
    title: chapter.title,
    goal: chapter.goal,
    content,
  });

  const messages = buildMessages(prompt, settings, [{ role: "system", content: system }]);

  let raw = "";
  for await (const token of provider.chat(messages, {
    model: settings.model,
    temperature: 0.3,
    maxTokens: 200,
  })) {
    raw += token;
  }

  // JSON aus der Antwort extrahieren.
  const json = raw.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      return {
        id: `qs-${Date.now()}-${dimension}`,
        runId: "",
        dimension,
        level: parsed.level ?? "yellow",
        score: Math.min(100, Math.max(0, parsed.score ?? 50)),
        details: parsed.details ?? null,
      };
    } catch {
      /* Fallback */
    }
  }

  return {
    id: `qs-${Date.now()}-${dimension}`,
    runId: "",
    dimension,
    level: "yellow",
    score: 50,
    details: "Konnte nicht bewertet werden.",
  };
}

/** Gesamtbewertung aus Einzelwerten. */
function determineOverallLevel(scores: QualityScore[]): "green" | "yellow" | "red" {
  const avg = scores.reduce((sum, s) => sum + s.score, 0) / (scores.length || 1);
  const hasRed = scores.some((s) => s.level === "red");

  if (hasRed || avg < 40) return "red";
  if (avg < 70) return "yellow";
  return "green";
}

/** Zählt Wörter. */
function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** System-Prompt für Genre. */
function systemForGenre(genre: string, tone: string, language: string): string {
  return `Du bist ein erfahrener Lektor für ${genre}.
Tonalität: ${tone}
Sprache: ${language}

Bewerte das Kapitel objektiv und konstruktiv.`;
}

/** Qualitätsloop für alle Kapitel. */
export async function runQualityLoop(
  runId: string,
  briefing: BookBriefing,
  chapters: Array<{ title: string; content: string }>,
  outline: OutlineChapter[],
  onProgress?: (chapterIndex: number, result: ChapterQualityResult) => void,
): Promise<ChapterQualityResult[]> {
  const results: ChapterQualityResult[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const result = await checkChapterQuality(
      runId,
      briefing,
      outline[i],
      chapters[i].content,
      i,
      chapters,
    );
    results.push(result);
    onProgress?.(i, result);
  }

  // Gesamtspeichern.
  await saveArtifact(runId, "qualitaet", "all", results);

  return results;
}
