// Writing Pace Analysis (Sprint 27, Agent 4): Schreibgeschwindigkeit,
// Rhythmus und Pacing. Lokal, kein LLM nötig, deterministisch.

export interface PacePoint {
  position: number; // 0-100%
  wordsPerSentence: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordLength: number;
  dialogueRatio: number;
}

export interface PaceAnalysis {
  points: PacePoint[];
  overallPace: "fast" | "medium" | "slow";
  averageWordsPerSentence: number;
  averageSentenceLength: number;
  pacingScore: number; // 0-100
  variation: number; // Standard deviation
  suggestions: string[];
}

/**
 * Analysiert das Pacing eines Textes.
 */
export function analyzeWritingPace(text: string): PaceAnalysis {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) {
    return {
      points: [],
      overallPace: "medium",
      averageWordsPerSentence: 0,
      averageSentenceLength: 0,
      pacingScore: 50,
      variation: 0,
      suggestions: ["Text ist leer"],
    };
  }

  const points: PacePoint[] = [];
  const chunkSize = Math.max(1, Math.floor(paragraphs.length / 10));
  
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const chunk = paragraphs.slice(i, i + chunkSize).join("\n\n");
    const sentences = chunk.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const words = chunk.split(/\s+/).filter(Boolean);
    const dialogueLines = chunk.split("\n").filter((l) => {
      const t = l.trim();
      return /^[»""„"»]/.test(t) || /^[—–-]\s/.test(t) || /^[A-ZÄÖÜ][a-zäöübf]+:\s*[""]?/.test(t);
    }).length;

    const wordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgWordLength = words.reduce((s, w) => s + w.length, 0) / Math.max(1, words.length);
    const dialogueRatio = sentences.length > 0 ? dialogueLines / sentences.length : 0;

    points.push({
      position: Math.round((i / paragraphs.length) * 100),
      wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
      sentenceCount: sentences.length,
      paragraphCount: Math.min(chunkSize, paragraphs.length - i),
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    });
  }

  const avgWPS = points.reduce((s, p) => s + p.wordsPerSentence, 0) / Math.max(1, points.length);
  const variation = Math.sqrt(
    points.reduce((s, p) => s + Math.pow(p.wordsPerSentence - avgWPS, 2), 0) / Math.max(1, points.length)
  );

  let overallPace: "fast" | "medium" | "slow" = "medium";
  if (avgWPS < 12) overallPace = "fast";
  else if (avgWPS > 20) overallPace = "slow";

  const pacingScore = Math.round(
    50 + (variation * 5) + (avgWPS > 10 && avgWPS < 25 ? 20 : 0) + (points.length > 5 ? 10 : 0)
  );

  const suggestions: string[] = [];
  if (variation < 3) suggestions.push("Wenig Variation — mehr Abwechslung bei der Satzlänge");
  if (avgWPS > 25) suggestions.push("Lange Sätze — kurze Sätze für Spannung einstreuen");
  if (avgWPS < 8) suggestions.push("Sehr kurze Sätze — für Tiefe längere Sätze verwenden");
  if (points.length < 3) suggestions.push("Text ist kurz — mehr Inhalt für Pacing-Analyse");
  if (suggestions.length === 0) suggestions.push("Gutes Pacing mit guter Variation");

  return {
    points,
    overallPace,
    averageWordsPerSentence: Math.round(avgWPS * 10) / 10,
    averageSentenceLength: Math.round(avgWPS),
    pacingScore: Math.min(100, pacingScore),
    variation: Math.round(variation * 10) / 10,
    suggestions,
  };
}

/**
 * Generiert ein ASCII-Diagramm der Pacing-Kurve.
 */
export function generatePaceAscii(analysis: PaceAnalysis, width = 50, height = 12): string {
  if (analysis.points.length === 0) return "Keine Daten";

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(" "));
  const maxWPS = Math.max(...analysis.points.map((p) => p.wordsPerSentence), 1);

  for (let i = 0; i < analysis.points.length; i++) {
    const x = Math.floor((i / analysis.points.length) * (width - 1));
    const y = height - 1 - Math.floor((analysis.points[i].wordsPerSentence / maxWPS) * (height - 1));
    if (y >= 0 && y < height && x >= 0 && x < width) {
      grid[y][x] = "█";
    }
  }

  const lines = grid.map((row) => row.join(""));
  lines.push("0%" + " ".repeat(width - 8) + "100%");
  lines.push(`Ø Satzlänge: ${analysis.averageWordsPerSentence} Wörter | Pace: ${analysis.overallPace}`);
  return lines.join("\n");
}
