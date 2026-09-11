// Style Analyzer (Sprint 27, Agent 5): Stil-Analyse für Texte.
// Lokal, kein LLM nötig, deterministisch.

export interface StyleMetrics {
  vocabularyRichness: number;
  averageWordLength: number;
  averageSentenceLength: number;
  passiveVoiceRatio: number;
  dialogueRatio: number;
  descriptionRatio: number;
  actionRatio: number;
  emotionRatio: number;
  readabilityScore: number;
}

export interface StyleAnalysis {
  metrics: StyleMetrics;
  style: "formal" | "informal" | "literary" | "technical" | "journalistic" | "conversational";
  tone: "positive" | "negative" | "neutral" | "mixed";
  audience: "general" | "educated" | "expert" | "young";
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
}

/**
 * Analysiert den Stil eines Textes.
 */
export function analyzeStyle(text: string): StyleAnalysis {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  
  if (words.length === 0) {
    return {
      metrics: {
        vocabularyRichness: 0,
        averageWordLength: 0,
        averageSentenceLength: 0,
        passiveVoiceRatio: 0,
        dialogueRatio: 0,
        descriptionRatio: 0,
        actionRatio: 0,
        emotionRatio: 0,
        readabilityScore: 50,
      },
      style: "conversational",
      tone: "neutral",
      audience: "general",
      suggestions: ["Text ist leer"],
      strengths: [],
      weaknesses: [],
    };
  }

  const avgWordLength = words.reduce((s, w) => s + w.length, 0) / words.length;
  const avgSentenceLength = words.length / Math.max(1, sentences.length);
  const vocabularyRichness = uniqueWords.size / words.length;

  // Erkenne Passivkonstruktionen
  const passivePatterns = [
    /wurde\s+\w+/gi,
    /wurden\s+\w+/gi,
    /wird\s+\w+/gi,
    /werden\s+\w+/gi,
    /ist\s+\w+/gi,
    /sind\s+\w+/gi,
  ];
  let passiveCount = 0;
  for (const pattern of passivePatterns) {
    const matches = text.match(pattern);
    if (matches) passiveCount += matches.length;
  }
  const passiveVoiceRatio = passiveCount / Math.max(1, sentences.length);

  // Erkenne Dialoge
  const dialogueLines = sentences.filter((s) => {
    const t = s.trim();
    return /^[»""„"»]/.test(t) || /^[—–-]\s/.test(t) || /^[A-ZÄÖÜ][a-zäöübf]+:\s*[""]?/.test(t);
  }).length;
  const dialogueRatio = dialogueLines / Math.max(1, sentences.length);

  // Erkenne Handlung vs. Beschreibung
  const actionVerbs = ["rennen", "springen", "schlagen", "werfen", "fliegen", "fallen", "greifen", "stoßen", "ziehen", "drücken", "laufen", "klettern", "schwimmen", "fahren", "fliegen", "explodieren", "zerstören", "retten", "kämpfen", "siegen"];
  const descriptionAdjektive = ["groß", "klein", "schön", "hässlich", "alt", "jung", "hell", "dunkel", "warm", "kalt", "hart", "weich", "laut", "leise", "schnell", "langsam", "dick", "dünn", "schwer", "leicht"];
  
  let actionCount = 0;
  let descriptionCount = 0;
  const lowerText = text.toLowerCase();
  for (const verb of actionVerbs) {
    const matches = lowerText.match(new RegExp(`\\b${verb}`, "g"));
    if (matches) actionCount += matches.length;
  }
  for (const adj of descriptionAdjektive) {
    const matches = lowerText.match(new RegExp(`\\b${adj}`, "g"));
    if (matches) descriptionCount += matches.length;
  }
  const actionRatio = actionCount / Math.max(1, words.length);
  const descriptionRatio = descriptionCount / Math.max(1, words.length);

  // Erkenne Emotionen
  const emotionWords = ["freude", "trauer", "wut", "angst", "liebe", "hass", "hoffnung", "verzweiflung", "ekel", "überraschung", "glück", "schmerz", "freudig", "traurig", "wütend", "ängstlich", "verliebt", "hasserfüllt", "hoffnungsvoll", "verzweifelt"];
  let emotionCount = 0;
  for (const emo of emotionWords) {
    const matches = lowerText.match(new RegExp(`\\b${emo}`, "g"));
    if (matches) emotionCount += matches.length;
  }
  const emotionRatio = emotionCount / Math.max(1, words.length);

  // Lesbarkeit (Flesch-ähnlich)
  const readabilityScore = Math.min(100, Math.max(0, 100 - (avgSentenceLength * 2) - (avgWordLength * 5)));

  // Stil bestimmen
  let style: StyleAnalysis["style"] = "conversational";
  if (vocabularyRichness > 0.6 && avgWordLength > 5) style = "literary";
  else if (passiveVoiceRatio > 0.3 && avgSentenceLength > 20) style = "technical";
  else if (avgSentenceLength < 12 && dialogueRatio > 0.3) style = "journalistic";
  else if (vocabularyRichness < 0.4 && avgWordLength < 4.5) style = "informal";
  else if (avgSentenceLength > 18 && passiveVoiceRatio > 0.2) style = "formal";

  // Ton bestimmen
  const positiveWords = ["gut", "schön", "glücklich", "freude", "liebe", "hoffnung", "frieden", "erfolg", "gewinn", "sieg", "hell", "warm", "sanft", "freundlich"];
  const negativeWords = ["schlecht", "hässlich", "traurig", "hass", "krieg", "verlust", "niederlage", "dunkel", "kalt", "hart", "feindlich", "schmerz", "angst", "wut"];
  let positiveCount = 0;
  let negativeCount = 0;
  for (const w of positiveWords) {
    const matches = lowerText.match(new RegExp(`\\b${w}`, "g"));
    if (matches) positiveCount += matches.length;
  }
  for (const w of negativeWords) {
    const matches = lowerText.match(new RegExp(`\\b${w}`, "g"));
    if (matches) negativeCount += matches.length;
  }
  let tone: StyleAnalysis["tone"] = "neutral";
  if (positiveCount > negativeCount * 2) tone = "positive";
  else if (negativeCount > positiveCount * 2) tone = "negative";
  else if (positiveCount > 0 && negativeCount > 0) tone = "mixed";

  // Zielgruppe
  let audience: StyleAnalysis["audience"] = "general";
  if (vocabularyRichness > 0.65 && avgWordLength > 5.5) audience = "expert";
  else if (vocabularyRichness > 0.5 || avgWordLength > 5) audience = "educated";
  else if (avgSentenceLength < 10 && avgWordLength < 4) audience = "young";

  // Vorschläge
  const suggestions: string[] = [];
  if (vocabularyRichness < 0.3) suggestions.push("Wortschatz erweitern — mehr Synonyme verwenden");
  if (avgSentenceLength > 25) suggestions.push("Sätze kürzer machen für bessere Lesbarkeit");
  if (passiveVoiceRatio > 0.3) suggestions.push("Passivkonstruktionen reduzieren — aktive Sprache ist lebendiger");
  if (dialogueRatio < 0.1 && words.length > 100) suggestions.push("Dialoge einstreuen für mehr Leben");
  if (emotionRatio < 0.05 && words.length > 100) suggestions.push("Mehr emotionale Begriffe für Tiefe");
  if (suggestions.length === 0) suggestions.push("Guter Stil mit ausgewogener Sprache");

  // Stärken
  const strengths: string[] = [];
  if (vocabularyRichness > 0.5) strengths.push("Reichhaltiger Wortschatz");
  if (avgSentenceLength > 10 && avgSentenceLength < 20) strengths.push("Gute Satzlänge");
  if (dialogueRatio > 0.2 && dialogueRatio < 0.5) strengths.push("Gute Dialogbalance");
  if (actionRatio > descriptionRatio) strengths.push("Handlungsorientiert");
  if (emotionRatio > 0.1) strengths.push("Emotionalreich");

  // Schwächen
  const weaknesses: string[] = [];
  if (vocabularyRichness < 0.3) weaknesses.push("Begrenzter Wortschatz");
  if (avgSentenceLength > 25) weaknesses.push("Zu lange Sätze");
  if (avgSentenceLength < 8) weaknesses.push("Zu kurze Sätze");
  if (passiveVoiceRatio > 0.4) weaknesses.push("Zu viel Passiv");
  if (dialogueRatio > 0.6) weaknesses.push("Zu viel Dialog");

  return {
    metrics: {
      vocabularyRichness: Math.round(vocabularyRichness * 100) / 100,
      averageWordLength: Math.round(avgWordLength * 10) / 10,
      averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      passiveVoiceRatio: Math.round(passiveVoiceRatio * 100) / 100,
      dialogueRatio: Math.round(dialogueRatio * 100) / 100,
      descriptionRatio: Math.round(descriptionRatio * 100) / 100,
      actionRatio: Math.round(actionRatio * 100) / 100,
      emotionRatio: Math.round(emotionRatio * 100) / 100,
      readabilityScore: Math.round(readabilityScore),
    },
    style,
    tone,
    audience,
    suggestions,
    strengths,
    weaknesses,
  };
}

// --- Autoren-Vergleich (deterministisch, lokal, kein LLM) ---
// Referenzprofile: grobe, aber stabile Stil-Fingerprints kanonischer Autoren.
// similarity = 100 - gewichtete Distanz (0-100, gerundet).

export type PacingLabel = "slow" | "medium" | "fast";

export interface AuthorProfile {
  author: string;
  description: string;
  avgSentenceLength: number;
  vocabularyRichness: number;
  dialogueRatio: number;
  descriptionRatio: number;
  pacing: PacingLabel;
}

const AUTHOR_PROFILES: AuthorProfile[] = [
  { author: "Ernest Hemingway", description: "Kurze Sätze, karger Stil, hohes Tempo", avgSentenceLength: 12, vocabularyRichness: 0.55, dialogueRatio: 0.3, descriptionRatio: 0.25, pacing: "fast" },
  { author: "Franz Kafka", description: "Verschachtelt, bürokratische Kälte, langsam", avgSentenceLength: 24, vocabularyRichness: 0.62, dialogueRatio: 0.15, descriptionRatio: 0.4, pacing: "slow" },
  { author: "Thomas Mann", description: "Periodenbau, hoher Wortschatz, bedächtig", avgSentenceLength: 28, vocabularyRichness: 0.7, dialogueRatio: 0.1, descriptionRatio: 0.45, pacing: "slow" },
  { author: "Edgar Wallace", description: "Heftroman-Tempo, dialog-getrieben", avgSentenceLength: 14, vocabularyRichness: 0.5, dialogueRatio: 0.35, descriptionRatio: 0.3, pacing: "fast" },
  { author: "Jerry Cotton", description: "G-Man-Action, schnell, direkt", avgSentenceLength: 11, vocabularyRichness: 0.48, dialogueRatio: 0.3, descriptionRatio: 0.3, pacing: "fast" },
  { author: "Jules Verne", description: "Abenteuer mit Erklär-Tiefe, mittlere Satzlänge", avgSentenceLength: 18, vocabularyRichness: 0.6, dialogueRatio: 0.25, descriptionRatio: 0.45, pacing: "medium" },
  { author: "Agatha Christie", description: "Kriminalrätsel, dialogstark, flott", avgSentenceLength: 15, vocabularyRichness: 0.52, dialogueRatio: 0.4, descriptionRatio: 0.3, pacing: "fast" },
  { author: "Stephen King", description: "Horror-Alltag, bildhaft, mittleres Tempo", avgSentenceLength: 16, vocabularyRichness: 0.58, dialogueRatio: 0.3, descriptionRatio: 0.45, pacing: "medium" },
  { author: "Mark Twain", description: "Erzählton, lakonischer Dialog", avgSentenceLength: 17, vocabularyRichness: 0.6, dialogueRatio: 0.35, descriptionRatio: 0.35, pacing: "medium" },
  { author: "Hermann Hesse", description: "Lyrisch, introspektiv, langsam", avgSentenceLength: 22, vocabularyRichness: 0.68, dialogueRatio: 0.12, descriptionRatio: 0.45, pacing: "slow" },
];

export interface TextStyleProfile {
  author: string;
  avgSentenceLength: number;
  vocabularyRichness: number;
  dialogueRatio: number;
  descriptionRatio: number;
  pacing: PacingLabel;
}

export interface AuthorComparison {
  author: string;
  similarity: number;
  description: string;
}

export interface StyleComparisonResult {
  comparisons: AuthorComparison[];
  textProfile: TextStyleProfile;
  verdict: string;
}

function pacingOf(avgSentenceLength: number): PacingLabel {
  if (avgSentenceLength < 14) return "fast";
  if (avgSentenceLength > 20) return "slow";
  return "medium";
}

export function analyzeTextProfile(text: string): TextStyleProfile {
  const m = analyzeStyle(text).metrics;
  return {
    author: "Dein Text",
    avgSentenceLength: m.averageSentenceLength,
    vocabularyRichness: m.vocabularyRichness,
    dialogueRatio: m.dialogueRatio,
    descriptionRatio: m.descriptionRatio,
    pacing: pacingOf(m.averageSentenceLength),
  };
}

function similarityTo(t: TextStyleProfile, a: AuthorProfile): number {
  const dSent = Math.min(1, Math.abs(t.avgSentenceLength - a.avgSentenceLength) / 20);
  const dVoc = Math.abs(t.vocabularyRichness - a.vocabularyRichness);
  const dDia = Math.abs(t.dialogueRatio - a.dialogueRatio);
  const dDes = Math.abs(t.descriptionRatio - a.descriptionRatio);
  const dPace = t.pacing === a.pacing ? 0 : 0.5;
  const dist = dSent * 0.3 + dVoc * 0.25 + dDia * 0.2 + dDes * 0.15 + dPace * 0.1;
  return Math.max(0, Math.round((1 - dist) * 100));
}

export function compareToAllAuthors(text: string): StyleComparisonResult {
  const textProfile = analyzeTextProfile(text);
  const comparisons = AUTHOR_PROFILES.map((a) => ({
    author: a.author,
    similarity: similarityTo(textProfile, a),
    description: a.description,
  })).sort((x, y) => y.similarity - x.similarity);
  const best = comparisons[0];
  return {
    comparisons,
    textProfile,
    verdict: best
      ? `Am nächsten an ${best.author} (${best.similarity} %): ${best.description}.`
      : "Kein Vergleich möglich.",
  };
}

export function getAvailableAuthors(): string[] {
  return AUTHOR_PROFILES.map((a) => a.author);
}

// Legacy-Typ, wird vom Panel nicht mehr verwendet (bleibt für Kompatibilität exportiert).
export interface StyleProfile { id: string; name: string; author: string; avgSentenceLength: number; vocabularyRichness: number; dialogueRatio: number; descriptionRatio: number; pacing: string; comparisons: unknown[]; textProfile: unknown; verdict: unknown; }

