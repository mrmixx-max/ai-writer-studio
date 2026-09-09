// Condense Engine (Sprint 26, Agent 5): Textverkürzung ohne Informationsverlust.
// Lokal, kein LLM nötig, deterministisch.

export interface CondenseResult {
  original: string;
  condensed: string;
  technique: string;
  removedWords: number;
  originalLength: number;
  condensedLength: number;
  compressionRatio: number;
}

export interface CondenseTechnique {
  id: string;
  name: string;
  description: string;
}

export const CONDENSE_TECHNIQUES: CondenseTechnique[] = [
  { id: "remove-fillers", name: "Füller entfernen", description: "Überflüssige Wörter streichen" },
  { id: "shorten-sentences", name: "Sätze kürzen", description: "Lange Sätze auf das Wesentliche reduzieren" },
  { id: "remove-redundancy", name: "Redundanzen entfernen", description: "Doppelte Informationen streichen" },
  { id: "summarize-paragraphs", name: "Absätze zusammenfassen", description: "Jeder Absatz auf einen Satz" },
  { id: "bullet-points", name: "Stichpunkte", description: "Text als Liste umwandeln" },
];

const FILLER_WORDS_DE = [
  "eigentlich", "wirklich", "ganz", "einfach", "irgendwie", "sozusagen",
  "gewissermaßen", "im Grunde genommen", "an und für sich", "schon",
  "ja", "doch", "mal", "eh", "halt", "irgendwo", "irgendwann",
  "irgendwie", "vielleicht", "wohl", "wohl eher", "eher", "ziemlich",
  "relativ", "äußerst", "extrem", "total", "absolut", "komplett",
  "vollkommen", "gänzlich", "restlos", "schlichtweg", "schlechthin",
];

const FILLER_WORDS_EN = [
  "actually", "really", "quite", "just", "simply", "basically",
  "essentially", "literally", "honestly", "frankly", "clearly",
  "obviously", "certainly", "definitely", "absolutely", "completely",
  "totally", "entirely", "utterly", "thoroughly", "perfectly",
];

/**
 * Entfernt Füllerwörter aus dem Text.
 */
export function removeFillers(text: string, language: "de" | "en" = "de"): CondenseResult {
  const fillers = language === "de" ? FILLER_WORDS_DE : FILLER_WORDS_EN;
  let condensed = text;
  let removed = 0;

  for (const filler of fillers) {
    const regex = new RegExp(`\\b${filler}\\b`, "gi");
    const matches = condensed.match(regex);
    if (matches) {
      removed += matches.length;
      condensed = condensed.replace(regex, "");
    }
  }

  // Doppelte Leerzeichen entfernen
  condensed = condensed.replace(/\s+/g, " ").trim();

  return {
    original: text,
    condensed,
    technique: "remove-fillers",
    removedWords: removed,
    originalLength: text.length,
    condensedLength: condensed.length,
    compressionRatio: text.length > 0 ? (text.length - condensed.length) / text.length : 0,
  };
}

/**
 * Kürzt lange Sätze auf das Wesentliche.
 */
export function shortenSentences(text: string): CondenseResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const condensed: string[] = [];
  let removed = 0;

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    if (words.length > 20) {
      // Erste 10 Wörter + letzte 5 Wörter behalten
      const shortened = [...words.slice(0, 10), "...", ...words.slice(-5)].join(" ");
      condensed.push(shortened);
      removed += words.length - 16;
    } else {
      condensed.push(sentence);
    }
  }

  const result = condensed.join(" ");
  return {
    original: text,
    condensed: result,
    technique: "shorten-sentences",
    removedWords: removed,
    originalLength: text.length,
    condensedLength: result.length,
    compressionRatio: text.length > 0 ? (text.length - result.length) / text.length : 0,
  };
}

/**
 * Entfernt redundante Informationen.
 */
export function removeRedundancy(text: string): CondenseResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const condensed: string[] = [];
  let removed = 0;

  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (seen.has(normalized)) {
      removed++;
    } else {
      seen.add(normalized);
      condensed.push(sentence);
    }
  }

  const result = condensed.join(" ");
  return {
    original: text,
    condensed: result,
    technique: "remove-redundancy",
    removedWords: removed,
    originalLength: text.length,
    condensedLength: result.length,
    compressionRatio: text.length > 0 ? (text.length - result.length) / text.length : 0,
  };
}

/**
 * Fasst jeden Absatz auf einen Satz zusammen.
 */
export function summarizeParagraphs(text: string): CondenseResult {
  const paragraphs = text.split(/\n\s*\n/);
  const condensed: string[] = [];
  let removed = 0;

  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      // Ersten Satz behalten
      condensed.push(sentences[0]);
      removed += sentences.length - 1;
    } else {
      condensed.push(para);
    }
  }

  const result = condensed.join("\n\n");
  return {
    original: text,
    condensed: result,
    technique: "summarize-paragraphs",
    removedWords: removed,
    originalLength: text.length,
    condensedLength: result.length,
    compressionRatio: text.length > 0 ? (text.length - result.length) / text.length : 0,
  };
}

/**
 * Wandelt Text in Stichpunkte um.
 */
export function convertToBulletPoints(text: string): CondenseResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const bullets = sentences.map((s) => `• ${s.trim()}`).join("\n");

  return {
    original: text,
    condensed: bullets,
    technique: "bullet-points",
    removedWords: 0,
    originalLength: text.length,
    condensedLength: bullets.length,
    compressionRatio: 0,
  };
}

/**
 * Hauptfunktion: Text mit einer Technik kondensieren.
 */
export function condenseText(text: string, techniqueId: string): CondenseResult {
  switch (techniqueId) {
    case "remove-fillers":
      return removeFillers(text);
    case "shorten-sentences":
      return shortenSentences(text);
    case "remove-redundancy":
      return removeRedundancy(text);
    case "summarize-paragraphs":
      return summarizeParagraphs(text);
    case "bullet-points":
      return convertToBulletPoints(text);
    default:
      return {
        original: text,
        condensed: text,
        technique: "unknown",
        removedWords: 0,
        originalLength: text.length,
        condensedLength: text.length,
        compressionRatio: 0,
      };
  }
}

/**
 * Wendet alle Kondensationstechniken auf den Text an.
 */
export function condenseAll(text: string): CondenseResult[] {
  return CONDENSE_TECHNIQUES.map((t) => condenseText(text, t.id));
}
