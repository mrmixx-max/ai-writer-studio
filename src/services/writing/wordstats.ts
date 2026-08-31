// Wort-Statistiken berechnen.
export interface WordStats {
  totalWords: number;
  totalChars: number;
  totalSentences: number;
  totalParagraphs: number;
  avgWordsPerSentence: number;
  avgSentencesPerParagraph: number;
  readingTimeMin: number;
  uniqueWords: number;
  vocabularyRichness: number; // 0-100
  topWords: { word: string; count: number }[];
  longestSentence: string;
  shortestSentence: string;
}

const GERMAN_STOP_WORDS = new Set([
  "der", "die", "das", "ein", "eine", "und", "ist", "sind", "war", "waren",
  "wird", "werden", "wurde", "wurden", "hat", "haben", "hatte", "hatten",
  "kann", "können", "konnte", "konnten", "muss", "müssen", "musste",
  "sich", "ihn", "ihm", "ihr", "ihre", "sein", "seine", "mein", "dein",
  "nicht", "auch", "noch", "nur", "schon", "wie", "was", "wer", "wo",
  "wenn", "weil", "dass", "daß", "ob", "als", "an", "am", "auf", "aus",
  "bei", "bis", "durch", "für", "gegen", "in", "mit", "nach", "ohne",
  "um", "von", "vor", "zu", "zum", "zur", "über", "unter", "zwischen",
  "dann", "dort", "hier", "so", "sehr", "mehr", "wenig", "viel", "alle",
  "jeder", "jede", "jedes", "man", "mir", "dir", "uns", "euch", "ich",
  "du", "er", "sie", "es", "wir", "ihr", "den", "dem", "des", "dieser",
  "diese", "dieses", "jener", "jene", "jenes", "welcher", "welche", "welches",
]);

export function computeWordStats(text: string): WordStats {
  const cleanText = text.replace(/[^\wäöüÄÖÜß\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleanText.split(" ").filter((w) => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // Häufigste Wörter (ohne Stop-Wörter)
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (GERMAN_STOP_WORDS.has(lower) || lower.length < 3) continue;
    wordCounts.set(lower, (wordCounts.get(lower) || 0) + 1);
  }
  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  const uniqueWords = wordCounts.size;
  const vocabularyRichness = words.length > 0
    ? Math.min(Math.round((uniqueWords / words.length) * 100 * 5), 100)
    : 0;

  // Lesezeit (Durchschnitt: 200 Wörter/Minute)
  const readingTimeMin = Math.max(1, Math.round(words.length / 200));

  // Kürzeste/längste Satz
  const sortedSentences = [...sentences].sort((a, b) => a.trim().length - b.trim().length);

  return {
    totalWords: words.length,
    totalChars: text.length,
    totalSentences: sentences.length,
    totalParagraphs: paragraphs.length,
    avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
    avgSentencesPerParagraph: paragraphs.length > 0 ? Math.round(sentences.length / paragraphs.length) : 0,
    readingTimeMin,
    uniqueWords,
    vocabularyRichness,
    topWords,
    longestSentence: sortedSentences[sortedSentences.length - 1]?.trim() || "",
    shortestSentence: sortedSentences[0]?.trim() || "",
  };
}
