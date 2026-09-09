// Pacing Map (Sprint 28, Agent 4): Visuelle Pacing-Karte.
// Lokal, kein LLM nötig, deterministisch.

export interface PacingSegment {
  id: string;
  startLine: number;
  endLine: number;
  wordCount: number;
  pace: "fast" | "medium" | "slow";
  density: number; // 0-100
}

export interface PacingMap {
  segments: PacingSegment[];
  totalWords: number;
  fastPercentage: number;
  mediumPercentage: number;
  slowPercentage: number;
  longestFastSegment: number;
  longestSlowSegment: number;
  suggestions: string[];
}

/**
 * Erstellt eine Pacing-Karte aus einem Text.
 */
export function generatePacingMap(text: string, segmentSize: number = 100): PacingMap {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { segments: [], totalWords: 0, fastPercentage: 0, mediumPercentage: 0, slowPercentage: 0, longestFastSegment: 0, longestSlowSegment: 0, suggestions: ["Text ist leer"] };
  }

  const segments: PacingSegment[] = [];
  let idCounter = 0;

  for (let i = 0; i < words.length; i += segmentSize) {
    const segment = words.slice(i, i + segmentSize);
    const wordCount = segment.length;
    const sentences = segment.join(" ").split(/(?<=[.!?])\s+/).length;
    const avgWordsPerSentence = wordCount / Math.max(1, sentences);
    
    let pace: PacingSegment["pace"] = "medium";
    if (avgWordsPerSentence < 10) pace = "fast";
    else if (avgWordsPerSentence > 20) pace = "slow";

    const density = Math.min(100, Math.round((avgWordsPerSentence / 25) * 100));

    segments.push({
      id: `seg-${idCounter}`,
      startLine: i,
      endLine: i + wordCount,
      wordCount,
      pace,
      density,
    });
    idCounter++;
  }

  const fastSegments = segments.filter((s) => s.pace === "fast");
  const mediumSegments = segments.filter((s) => s.pace === "medium");
  const slowSegments = segments.filter((s) => s.pace === "slow");

  const total = segments.length;
  const fastPercentage = Math.round((fastSegments.length / total) * 100);
  const mediumPercentage = Math.round((mediumSegments.length / total) * 100);
  const slowPercentage = 100 - fastPercentage - mediumPercentage;

  const longestFastSegment = fastSegments.length > 0 ? Math.max(...fastSegments.map((s) => s.wordCount)) : 0;
  const longestSlowSegment = slowSegments.length > 0 ? Math.max(...slowSegments.map((s) => s.wordCount)) : 0;

  const suggestions: string[] = [];
  if (fastPercentage > 60) suggestions.push("Zu viel schnelles Pacing — mehr Atempausen");
  if (slowPercentage > 60) suggestions.push("Zu viel langsames Pacing — Tempo erhöhen");
  if (mediumPercentage > 80) suggestions.push("Mittleres Pacing dominiert — mehr Abwechslung");
  if (suggestions.length === 0) suggestions.push("Gutes Pacing mit guter Balance");

  return { segments, totalWords: words.length, fastPercentage, mediumPercentage, slowPercentage, longestFastSegment, longestSlowSegment, suggestions };
}
