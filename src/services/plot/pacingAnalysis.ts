// Pacing- & Spannungskurven-Visualisierer (WP 5.2).
//
// Analysiert Kapitel nach Textlänge, Aktions-Dichte, Dialoganteil und
// emotionaler Ladung. Rendert eine SVG-Kurve: Spitzen = Climax/Action,
// Täler = Reflexion/Pausen. Klick auf einen Datenpunkt springt zum Kapitel.
//
// Lokal, kein LLM nötig, deterministisch. Defensive Fallbacks bei fehlenden
// Daten (Kapitel ohne Inhalt, leere Bücher).

import type { BookChapterInput } from "@/services/bookwriter/export/types";

/** Pacing-Datenpunkt für ein Kapitel. */
export interface PacingPoint {
  /** Kapitelnummer (1-basiert). */
  chapter: number;
  /** Kapiteltitel. */
  title: string;
  /** Textlänge in Zeichen. */
  charCount: number;
  /** Textlänge in Wörtern. */
  wordCount: number;
  /** Aktions-Dichte (0-1): Verben, Ausrufe, kurze Sätze. */
  actionDensity: number;
  /** Dialoganteil (0-1): Anteil der Dialogzeilen am Gesamttext. */
  dialogueRatio: number;
  /** Emotionale Ladung (0-1): Spannung basierend auf Emotionswörtern. */
  emotionalCharge: number;
  /** Gesamtpacing-Score (0-1): gewichtete Kombination. */
  pacingScore: number;
}

/** Ergebnis der Pacing-Analyse. */
export interface PacingAnalysis {
  points: PacingPoint[];
  /** Durchschnittlicher Pacing-Score über alle Kapitel. */
  averagePacing: number;
  /** Kapitel mit dem höchsten Pacing-Score (Climax). */
  climaxChapter: number | null;
  /** Kapitel mit dem niedrigsten Pacing-Score (tiefster Punkt). */
  lowestChapter: number | null;
}

/**
 * Berechnet die Aktions-Dichte eines Textes.
 * Indikatoren: Ausrufezeichen, kurze Sätze, Verben der Bewegung.
 */
function calculateActionDensity(text: string): number {
  if (!text.trim()) return 0;

  const sentences = text.split(/[.!?…]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  // Kurze Sätze (< 10 Wörter) deuten auf Action hin
  const shortSentences = sentences.filter((s) => s.trim().split(/\s+/).length < 10);
  const shortRatio = shortSentences.length / sentences.length;

  // Ausrufezeichen
  const exclamations = (text.match(/!/g) || []).length;
  const exclamationRatio = Math.min(1, exclamations / sentences.length);

  // Bewegungsverben (deutsche Indikatoren)
  const actionVerbs = /\b(läuft|rennt|springt|stürzt|greift|schlägt|wirft|hebt|dreht|stolpert|bricht|reißt|drückt|schiebt|zieht|fallen|fliegt|stürzt|jagt|flieht|kämpft)\b/gi;
  const actionMatches = (text.match(actionVerbs) || []).length;
  const actionVerbRatio = Math.min(1, actionMatches / sentences.length);

  return Math.min(1, shortRatio * 0.4 + exclamationRatio * 0.3 + actionVerbRatio * 0.3);
}

/**
 * Berechnet den Dialoganteil eines Textes.
 * Erkennt Dialogzeilen an typischen Mustern.
 */
function calculateDialogueRatio(text: string): number {
  if (!text.trim()) return 0;

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return 0;

  const dialoguePatterns = [
    /^[»""„"»]([^»""„"»]+)[»""„"»]/,
    /^[—–-]\s*[^—–-]/,
    /^[A-ZÄÖÜ][a-zäöüß]+\s*:/,
  ];

  const dialogueLines = lines.filter((line) =>
    dialoguePatterns.some((p) => p.test(line.trim())),
  );

  return Math.min(1, dialogueLines.length / lines.length);
}

/**
 * Berechnet die emotionale Ladung eines Textes.
 * Positiv: Freude, Liebe, Hoffnung. Negativ: Angst, Wut, Trauer.
 */
function calculateEmotionalCharge(text: string): number {
  if (!text.trim()) return 0;

  // Positive Emotionen
  const positiveWords = /\b(freude|glück|liebe|hoffnung|frieden|schön|lächelt|umarmt|träumt|genießt|erleichtert|zufrieden)\b/gi;
  const positiveMatches = (text.match(positiveWords) || []).length;

  // Negative Emotionen (Spannung)
  const negativeWords = /\b(angst|furcht|hass|wut|trauer|schmerz|schrei|panik|verzweiflung|bedrohung|gefahr|dunkel|kalt|schwer|hart|bitter)\b/gi;
  const negativeMatches = (text.match(negativeWords) || []).length;

  // Intensivierer
  const intensifiers = /\b(sehr|extrem|total|völlig|absolut|höchst|äußerst)\b/gi;
  const intensifierMatches = (text.match(intensifiers) || []).length;

  const totalWords = text.split(/\s+/).filter(Boolean).length;
  if (totalWords === 0) return 0;

  const rawScore = (positiveMatches + negativeMatches * 1.5 + intensifierMatches * 0.5) / totalWords;
  return Math.min(1, rawScore * 10);
}

/**
 * Berechnet den Pacing-Score für ein Kapitel.
 * Gewichtung: Action 35%, Emotion 30%, Dialog 20%, Länge 15%.
 */
function calculatePacingScore(
  actionDensity: number,
  emotionalCharge: number,
  dialogueRatio: number,
  wordCount: number,
  maxWordCount: number,
): number {
  const lengthFactor = maxWordCount > 0 ? wordCount / maxWordCount : 0;
  return (
    actionDensity * 0.35 +
    emotionalCharge * 0.3 +
    dialogueRatio * 0.2 +
    lengthFactor * 0.15
  );
}

/**
 * Analysiert die Pacing-Struktur eines Buchs.
 * Gibt eine Liste von Pacing-Datenpunkten zurück, eine pro Kapitel.
 */
export function analyzePacing(chapters: BookChapterInput[]): PacingAnalysis {
  if (chapters.length === 0) {
    return { points: [], averagePacing: 0, climaxChapter: null, lowestChapter: null };
  }

  // Maximale Wortlänge für Normalisierung
  const wordCounts = chapters.map((c) => {
    const text = typeof c.content === "string" ? c.content : "";
    return text.split(/\s+/).filter(Boolean).length;
  });
  const maxWordCount = Math.max(...wordCounts, 1);

  const points: PacingPoint[] = chapters.map((chapter, i) => {
    const text = typeof chapter.content === "string" ? chapter.content : "";
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = text.length;

    const actionDensity = calculateActionDensity(text);
    const dialogueRatio = calculateDialogueRatio(text);
    const emotionalCharge = calculateEmotionalCharge(text);
    const pacingScore = calculatePacingScore(
      actionDensity,
      emotionalCharge,
      dialogueRatio,
      wordCount,
      maxWordCount,
    );

    return {
      chapter: chapter.number ?? i + 1,
      title: chapter.title,
      charCount,
      wordCount,
      actionDensity: Math.round(actionDensity * 100) / 100,
      dialogueRatio: Math.round(dialogueRatio * 100) / 100,
      emotionalCharge: Math.round(emotionalCharge * 100) / 100,
      pacingScore: Math.round(pacingScore * 100) / 100,
    };
  });

  const averagePacing =
    points.length > 0
      ? Math.round((points.reduce((s, p) => s + p.pacingScore, 0) / points.length) * 100) / 100
      : 0;

  // Climax = höchster Score, Lowest = niedrigster Score
  let climaxChapter: number | null = null;
  let lowestChapter: number | null = null;
  let maxScore = -1;
  let minScore = 2;

  for (const p of points) {
    if (p.pacingScore > maxScore) {
      maxScore = p.pacingScore;
      climaxChapter = p.chapter;
    }
    if (p.pacingScore < minScore) {
      minScore = p.pacingScore;
      lowestChapter = p.chapter;
    }
  }

  return { points, averagePacing, climaxChapter, lowestChapter };
}

/**
 * Generiert SVG-Pfade für die Pacing-Kurve.
 * Gibt einen SVG-Pfad zurück, der als `d`-Attribut verwendet werden kann.
 */
export function generatePacingSvgPath(
  points: PacingPoint[],
  width: number,
  height: number,
  padding: number = 20,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const x = width / 2;
    const y = height - padding - points[0].pacingScore * (height - 2 * padding);
    return `M ${x} ${y}`;
  }

  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const stepX = innerWidth / (points.length - 1);

  // Smooth curve using cubic bezier
  let path = "";
  for (let i = 0; i < points.length; i++) {
    const x = padding + i * stepX;
    const y = height - padding - points[i].pacingScore * innerHeight;

    if (i === 0) {
      path = `M ${x} ${y}`;
    } else {
      const prevX = padding + (i - 1) * stepX;
      const prevY = height - padding - points[i - 1].pacingScore * innerHeight;
      const cpX1 = prevX + stepX * 0.4;
      const cpX2 = x - stepX * 0.4;
      path += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
    }
  }

  return path;
}

/**
 * Generiert SVG-Koordinaten für die Datenpunkte (für Klick-Events).
 */
export function generatePacingDots(
  points: PacingPoint[],
  width: number,
  height: number,
  padding: number = 20,
): { x: number; y: number; chapter: number; title: string; score: number }[] {
  if (points.length === 0) return [];

  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  return points.map((p, i) => ({
    x: padding + i * stepX,
    y: height - padding - p.pacingScore * innerHeight,
    chapter: p.chapter,
    title: p.title,
    score: p.pacingScore,
  }));
}
