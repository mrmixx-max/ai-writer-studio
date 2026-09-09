// Repetition Finder (Sprint 26, Agent 2): Wort- und Phrasenwiederholungen
// im Text erkennen. Lokal, kein LLM nötig, deterministisch.

export interface Repetition {
  id: string;
  text: string;
  count: number;
  positions: number[];
  type: "word" | "phrase";
}

export interface RepetitionReport {
  repetitions: Repetition[];
  totalWords: number;
  uniqueWords: number;
  repetitionRatio: number;
  checkedAt: number;
}

let repCounter = 0;
function nextId(): string {
  repCounter += 1;
  return `rep-${Date.now().toString(36)}-${repCounter}`;
}

const GERMAN_STOPWORDS = new Set<string>(["der", "die", "das", "und", "ist", "ein", "eine", "nicht", "mit", "auf", "für", "den", "dem", "von", "zu", "bei", "als", "auch", "noch", "nach", "über", "sich", "sie", "er", "es", "ich", "wir", "ihr", "was", "wie", "wer", "wo", "wenn", "dass", "so", "dann", "aber", "aus", "wird", "hat", "nur", "war", "kann", "muss", "schon", "vor", "vorbei", "unter", "immer", "um", "an", "ihm", "mehr", "dieser", "diese", "dieses", "jeder", "jede", "jedes", "alle", "viel", "wenig", "sehr", "mein", "meine", "dein", "deine", "sein", "seine", "ihr", "ihre", "unser", "unsere", "euer", "eure", "einem", "einen", "hatte", "hatten", "waren", "wurde", "wurden", "sind", "wird", "werden", "wollte", "wollten", "konnte", "konnten", "sollte", "sollten", "durfte", "durften", "mochte", "mochten", "wuerde", "wuerden", "steht", "stehen", "stand", "standen", "geht", "gehen", "ging", "gingen", "kommt", "kommen", "kam", "kamen", "sagte", "sagten", "macht", "machen", "gab", "gaben", "kam", "kamen", "nahm", "nahmen", "wusste", "wussten"]);

const ENGLISH_STOPWORDS = new Set<string>(["the", "a", "an", "and", "is", "it", "in", "to", "of", "for", "on", "with", "as", "at", "by", "from", "or", "but", "not", "this", "that", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "need", "dare", "ought", "used", "to", "you", "he", "she", "we", "they", "i", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our", "their", "mine", "yours", "hers", "ours", "theirs", "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves", "what", "which", "who", "whom", "whose", "when", "where", "why", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "also", "now", "here", "there", "once", "again", "ever", "never", "always", "sometimes", "often", "still", "already", "even", "back", "away", "out", "up", "down", "off", "over", "under", "again", "further", "then", "once"]);

/**
 * Findet Wortwiederholungen im Text.
 * Ignoriert Stopwords und kurze Wörter (< 4 Zeichen).
 */
export function findWordRepetitions(text: string, language: "de" | "en" = "de"): Repetition[] {
  const words = text.toLowerCase().match(/\b[a-zäöüß]{4,}\b/g) ?? [];
  const stopwords = language === "de" ? GERMAN_STOPWORDS : ENGLISH_STOPWORDS;
  const wordPositions = new Map<string, number[]>();

  let pos = 0;
  for (const word of words) {
    if (!stopwords.has(word)) {
      if (!wordPositions.has(word)) wordPositions.set(word, []);
      wordPositions.get(word)!.push(pos);
    }
    pos++;
  }

  const repetitions: Repetition[] = [];
  for (const [word, positions] of wordPositions) {
    if (positions.length >= 3) {
      repetitions.push({
        id: nextId(),
        text: word,
        count: positions.length,
        positions,
        type: "word",
      });
    }
  }

  return repetitions.sort((a, b) => b.count - a.count);
}

/**
 * Findet Phrasenwiederholungen (N-Gramme) im Text.
 * Sucht nach wiederholten Phrasen mit 2-5 Wörtern.
 */
export function findPhraseRepetitions(text: string, language: "de" | "en" = "de"): Repetition[] {
  const words = text.toLowerCase().match(/\b[a-zäöüß]+\b/g) ?? [];
  const stopwords = language === "de" ? GERMAN_STOPWORDS : ENGLISH_STOPWORDS;
  const phrases: Repetition[] = [];

  for (let n = 2; n <= 5; n++) {
    const phrasePositions = new Map<string, number[]>();
    
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      // Prüfe ob Phrase nur aus Stopwords besteht
      const phraseWords = phrase.split(" ");
      const isOnlyStopwords = phraseWords.every((w) => stopwords.has(w));
      if (isOnlyStopwords) continue;

      if (!phrasePositions.has(phrase)) phrasePositions.set(phrase, []);
      phrasePositions.get(phrase)!.push(i);
    }

    for (const [phrase, positions] of phrasePositions) {
      if (positions.length >= 2) {
        phrases.push({
          id: nextId(),
          text: phrase,
          count: positions.length,
          positions,
          type: "phrase",
        });
      }
    }
  }

  return phrases.sort((a, b) => b.count - a.count).slice(0, 50);
}

/**
 * Generiert einen Wiederholungsbericht.
 */
export function generateRepetitionReport(text: string, language: "de" | "en" = "de"): RepetitionReport {
  const words = text.toLowerCase().match(/\b[a-zäöüß]+\b/g) ?? [];
  const uniqueWords = new Set(words);
  const wordReps = findWordRepetitions(text, language);
  const phraseReps = findPhraseRepetitions(text, language);
  const allRepetitions = [...wordReps, ...phraseReps].sort((a, b) => b.count - a.count);

  const totalReps = allRepetitions.reduce((s, r) => s + r.count, 0);
  const ratio = words.length > 0 ? totalReps / words.length : 0;

  return {
    repetitions: allRepetitions,
    totalWords: words.length,
    uniqueWords: uniqueWords.size,
    repetitionRatio: Math.round(ratio * 100) / 100,
    checkedAt: Date.now(),
  };
}
