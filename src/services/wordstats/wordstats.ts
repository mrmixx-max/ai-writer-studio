// WordStats Engine (Sprint 25, Agent 6): Häufigkeit + N-Gramme + KWIC.
// Rein, frameworkfrei, ohne Dependencies. Ergänzt die Basis-Statistik aus
// services/writing/wordstats.ts um Frequenzanalyse, N-Gramme und KWIC-Suche.

export interface WordFrequency {
  word: string;
  count: number;
  /** Anteil an allen Tokens in Prozent (0–100). */
  frequency: number;
}

export interface NGram {
  words: string[];
  count: number;
}

export interface KWICResult {
  before: string;
  keyword: string;
  after: string;
  /** Wort-Position (Token-Index) im Text. */
  position: number;
}

export interface WordStatsResult {
  totalWords: number;
  uniqueWords: number;
  /** Type-Token-Ratio 0–1. */
  typeTokenRatio: number;
  averageWordLength: number;
  topWords: WordFrequency[];
  rareWords: WordFrequency[];
  bigrams: NGram[];
  trigrams: NGram[];
  kwic: KWICResult[];
}

/** Deutsche Stopwords (120). */
export const GERMAN_STOPWORDS: string[] = [
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem",
  "einen", "eines", "einem", "kein", "keine", "keiner", "keinem", "keinen",
  "und", "oder", "aber", "denn", "doch", "jedoch", "sondern", "sowie",
  "als", "wie", "so", "auch", "noch", "nur", "schon", "bereits", "kaum",
  "fast", "sehr", "mehr", "wenig", "wenige", "viel", "viele", "alle",
  "alles", "jeder", "jede", "jedes", "jedem", "jeden", "manche", "mancher",
  "dieser", "diese", "dieses", "diesen", "diesem", "jener", "jene", "jenes",
  "welcher", "welche", "welches", "was", "wer", "wen", "wem", "wo", "wohin",
  "woher", "wann", "warum", "wieso", "weshalb", "wenn", "weil", "dass",
  "ob", "obwohl", "während", "bevor", "nachdem", "bis", "seit", "durch",
  "für", "gegen", "ohne", "um", "am", "an", "auf", "aus", "bei", "mit",
  "nach", "neben", "von", "vor", "zu", "zum", "zur", "über", "unter",
  "zwischen", "hinter", "neben", "ist", "sind", "war", "waren", "wird",
  "werden", "wurde", "wurden", "sei", "seien", "hat", "haben", "hatte",
  "hatten", "habe", "kann", "können", "konnte", "muss", "müssen", "musste",
  "soll", "sollen", "sollte", "will", "wollen", "wollte", "darf", "dürfen",
  "mag", "mögen", "mochte", "ich", "du", "er", "sie", "es", "wir", "ihr",
  "mich", "dich", "sich", "uns", "euch", "mir", "dir", "ihm", "ihnen",
  "mein", "dein", "sein", "ihr", "unser", "euer", "nicht", "kein",
];

/** Englische Stopwords (120). */
export const ENGLISH_STOPWORDS: string[] = [
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
  "while", "because", "as", "until", "of", "at", "by", "for", "with",
  "about", "against", "between", "into", "through", "during", "before",
  "after", "above", "below", "to", "from", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "once", "here",
  "there", "where", "why", "how", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just",
  "should", "now", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing", "would",
  "could", "ought", "shall", "may", "might", "must", "need", "dare",
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
  "your", "yours", "yourself", "yourselves", "he", "him", "his",
  "himself", "she", "her", "hers", "herself", "it", "its", "itself",
  "they", "them", "their", "theirs", "themselves", "what", "which",
  "who", "whom", "this", "that", "these", "those", "am", "whom",
];

const STOPWORDS: Set<string> = new Set([...GERMAN_STOPWORDS, ...ENGLISH_STOPWORDS]);

/** Maximale KWIC-Treffer, damit große Texte das UI nicht fluten. */
export const MAX_KWIC_RESULTS = 50;
/** Standard-Kontextbreite (Wörter links/rechts) für analyze(). */
export const DEFAULT_KWIC_CONTEXT = 5;
/** Anzahl Top-Wörter / seltener Wörter / N-Gramme in analyze(). */
export const TOP_LIMIT = 20;
export const NGRAM_LIMIT = 10;

/** Kleinbuchstaben-Tokens (Unicode-Buchstaben + Ziffern). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? [];
}

function sortFreq(entries: Iterable<[string, number]>, total: number): WordFrequency[] {
  return [...entries]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([word, count]) => ({
      word,
      count,
      frequency: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
}

/** Top-N Inhaltswörter (ohne Stopwords, min. 2 Zeichen), absteigend sortiert. */
export function getTopWords(text: string, n: number): WordFrequency[] {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return sortFreq(counts, tokens.length).slice(0, Math.max(0, n));
}

/** N-Gramme über alle Tokens (inkl. Stopwords — Kollokationen bleiben sichtbar). */
export function getNGrams(text: string, n: number): NGram[] {
  if (n < 1) return [];
  const tokens = tokenize(text);
  if (tokens.length < n) return [];
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= tokens.length; i++) {
    const key = tokens.slice(i, i + n).join(" ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, NGRAM_LIMIT)
    .map(([key, count]) => ({ words: key.split(" "), count }));
}

/** KWIC-Suche: Keyword im Wort-Kontext (Original-Schreibweise erhalten). */
export function searchKWIC(text: string, keyword: string, context: number): KWICResult[] {
  const key = keyword.toLowerCase().trim();
  if (!key) return [];
  const raw = text.split(/\s+/).filter((w) => w.length > 0);
  const norm = (w: string): string => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const ctx = Math.max(0, context);
  const out: KWICResult[] = [];
  for (let i = 0; i < raw.length && out.length < MAX_KWIC_RESULTS; i++) {
    if (norm(raw[i]) !== key) continue;
    out.push({
      before: raw.slice(Math.max(0, i - ctx), i).join(" "),
      keyword: raw[i],
      after: raw.slice(i + 1, i + 1 + ctx).join(" "),
      position: i,
    });
  }
  return out;
}

/** Type-Token-Ratio 0–1 (0 bei leerem Text). */
export function getVocabularyRichness(unique: number, total: number): number {
  if (total <= 0 || unique <= 0) return 0;
  return Math.min(1, Math.max(0, unique / total));
}

/** Vollanalyse: Frequenz + seltene Wörter + Bi-/Trigramme + KWIC zum Top-Wort. */
export function analyze(text: string): WordStatsResult {
  const tokens = tokenize(text);
  const totalWords = tokens.length;
  const uniqueWords = new Set(tokens).size;
  const typeTokenRatio = getVocabularyRichness(uniqueWords, totalWords);
  const averageWordLength =
    totalWords > 0
      ? Math.round((tokens.reduce((s, t) => s + t.length, 0) / totalWords) * 10) / 10
      : 0;
  const topWords = getTopWords(text, TOP_LIMIT);
  const allCounts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    allCounts.set(t, (allCounts.get(t) ?? 0) + 1);
  }
  const rareWords = sortFreq(
    [...allCounts.entries()].filter(([, c]) => c === 1).map(([w, c]) => [w, c] as [string, number]),
    totalWords,
  ).slice(0, TOP_LIMIT);
  const bigrams = getNGrams(text, 2);
  const trigrams = getNGrams(text, 3);
  const kwic = topWords.length > 0 ? searchKWIC(text, topWords[0].word, DEFAULT_KWIC_CONTEXT) : [];
  return {
    totalWords,
    uniqueWords,
    typeTokenRatio,
    averageWordLength,
    topWords,
    rareWords,
    bigrams,
    trigrams,
    kwic,
  };
}

/** Zwei Texte getrennt analysieren (Vergleich-Modus des Panels). */
export function compareWordUsage(
  text1: string,
  text2: string,
): { text1: WordStatsResult; text2: WordStatsResult } {
  return { text1: analyze(text1), text2: analyze(text2) };
}
