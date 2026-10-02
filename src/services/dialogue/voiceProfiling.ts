// Voice Profiling (WP 6.2): Dialog-Konsistenz & Charakter-Stimmen-Wächter.
//
// Extrahiert wörtliche Reden pro Figur und berechnet Metriken:
// - Durchschnittliche Satzlänge
// - Füllwort-Quote
// - Formalitätsgrad
// - Dialekt-/Slang-Muster
//
// Gibt diskrete Hinweise, wenn eine Figur plötzlich anders spricht als
// in ihrem Profil kalibriert. Lokal, kein LLM nötig, deterministisch.



/** Voice-Profil einer Figur. */
export interface VoiceProfile {
  /** Name der Figur. */
  character: string;
  /** Anzahl der Dialogzeilen. */
  totalLines: number;
  /** Anzahl der Wörter. */
  totalWords: number;
  /** Durchschnittliche Satzlänge (Wörter pro Satz). */
  averageSentenceLength: number;
  /** Füllwort-Quote (0-1). */
  fillerWordRatio: number;
  /** Formalitätsgrad (0-1): 0 = umgangssprachlich, 1 = formell. */
  formalityScore: number;
  /** Dialekt-/Slang-Muster (0-1). */
  dialectScore: number;
  /** Typische Wörter der Figur (Top 5). */
  characteristicWords: string[];
}

/** Hinweis auf eine Abweichung vom Voice-Profil. */
export interface VoiceDeviation {
  /** Name der Figur. */
  character: string;
  /** Art der Abweichung. */
  type: "sentence_length" | "filler_words" | "formality" | "dialect";
  /** Beschreibung der Abweichung. */
  message: string;
  /** Schwere der Abweichung (0-1). */
  severity: number;
}

/** Ergebnis der Voice-Analyse. */
export interface VoiceAnalysis {
  profiles: VoiceProfile[];
  deviations: VoiceDeviation[];
}

/** Deutsche Füllwörter. */
const FILLER_WORDS = new Set([
  "eigentlich", "irgendwie", "quasi", "halt", "eben", "wohl", "ziemlich",
  "relativ", "gewissermaßen", "praktisch", "sozusagen", "irgendwas",
  "sowieso", "total", "absolut", "irgendwo", "irgendwann", "irgendwer",
]);

/** Formelle Wörter (Indikatoren für formelle Sprache). */
const FORMAL_WORDS = new Set([
  "sie", "ihnen", "ihr", "ihrem", "ihren", "dieser", "diese", "dieses",
  "jener", "jene", "jenes", "welcher", "welche", "welches", "daher",
  "demnach", "folglich", "demzufolge", "insofern", "mithin", "ferner",
]);

/** Umgangssprachliche Wörter (Indikatoren für informelle Sprache). */
const INFORMAL_WORDS = new Set([
  "du", "dein", "deine", "deinem", "deinen", "euch", "mal", "doch",
  "schon", "noch", "nur", "auch", "ganz", "echt", "total", "mega",
  "krass", "geil", "alter", "bruder", "kumpel", "freund", "freundin",
]);

/** Dialekt-/Slang-Muster (deutsche Indikatoren). */
const DIALECT_PATTERNS = [
  /\b(gell|gelle|gellchen)\b/i,
  /\b(nö|ne|nee)\b/i,
  /\b(na|naa|naaa)\b/i,
  /\b(hamma|hammata)\b/i,
  /\b(ossa|ossa)\b/i,
  /\b(biste|bistu)\b/i,
  /\b(hammer|hammert)\b/i,
  /\b(klar|klaro)\b/i,
];

/**
 * Extrahiert wörtliche Reden aus einem Text.
 * Unterstützt: „...“, "...", »...«, —...
 */
export function extractQuotedSpeech(text: string): string[] {
  const speeches: string[] = [];
  const patterns = [
    /„([^“]+)“/g,
    /"([^"]+)"/g,
    /»([^«]+)«/g,
    /—\s*([^—\n]+)/g,
  ];

  // Debug: Zeige was gefunden wird
  // console.log('extractQuotedSpeech:', text, patterns.map(p => text.match(p)));

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const speech = match[1]?.trim();
      if (speech && speech.length > 2) {
        speeches.push(speech);
      }
    }
  }

  return speeches;
}

/**
 * Ordnet Dialogzeilen einer Figur zu.
 * Unterstützt:
 * - „...", sagte Name / „...", fragte Name
 * - Name: „..."
 * - —..., sagte Name
 * - Fallback auf "Unbekannt"
 */
export function assignDialogueToCharacters(text: string): Map<string, string[]> {
  const characterSpeech = new Map<string, string[]>();

  const addSpeech = (character: string, speech: string) => {
    const clean = speech.trim();
    if (!clean) return; // Erlaubt auch 2-Buchstaben-Wörter wie "Hi", "Ja", "Ok"
    const existing = characterSpeech.get(character) ?? [];
    existing.push(clean);
    characterSpeech.set(character, existing);
  };

  const VERBS = "sagte|fragte|antwortete|rief|murmelte|flüsterte|schrie|meinte|erwiderte";
  const NAME = "[A-ZÄÖÜ][a-zäöüß]+";
  // Alle gängigen öffnenden und schließenden Anführungszeichen (inkl. U+201D ”)
  const Q_OPEN = "[„\"»«“]";
  const Q_CLOSE = "[“”\"«»]";

  // 1. Muster: —..., sagte Name
  const dashRegex = new RegExp(`—\\s*([^—\\n\\.\\?!]+[\\.\\?!]?)\\s*,?\\s*(?:${VERBS})\\s+(${NAME})`, "gi");
  for (const m of text.matchAll(dashRegex)) {
    addSpeech(m[2], m[1]);
  }

  // 2. Muster: Name: „..."
  const prefixRegex = new RegExp(`(${NAME})\\s*:\\s*${Q_OPEN}(.*?)${Q_CLOSE}`, "gis");
  for (const m of text.matchAll(prefixRegex)) {
    addSpeech(m[1], m[2]);
  }

  // 3. Muster: „...", sagte Name
  const inquitRegex = new RegExp(`${Q_OPEN}(.*?)${Q_CLOSE}\\s*,?\\s*(?:${VERBS})\\s+(${NAME})`, "gis");
  for (const m of text.matchAll(inquitRegex)) {
    addSpeech(m[2], m[1]);
  }

  // 4. Fallback: Zitate ohne Inquit-Formel oder Sprecherangabe ("Unbekannt")
  if (characterSpeech.size === 0) {
    const fallbackRegex = new RegExp(`${Q_OPEN}(.*?)${Q_CLOSE}`, "gis");
    for (const m of text.matchAll(fallbackRegex)) {
      addSpeech("Unbekannt", m[1]);
    }
  }

  return characterSpeech;
}

/**
 * Berechnet die durchschnittliche Satzlänge.
 */
function calculateAverageSentenceLength(text: string): number {
  const sentences = text.split(/[.!?…]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce(
    (sum, s) => sum + s.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.round((totalWords / sentences.length) * 10) / 10;
}

/**
 * Berechnet die Füllwort-Quote.
 */
function calculateFillerWordRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const fillerCount = words.filter((w) => FILLER_WORDS.has(w)).length;
  return Math.round((fillerCount / words.length) * 100) / 100;
}

/**
 * Berechnet den Formalitätsgrad (0-1).
 * 0 = umgangssprachlich, 1 = formell.
 */
function calculateFormalityScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0.5;

  const formalCount = words.filter((w) => FORMAL_WORDS.has(w)).length;
  const informalCount = words.filter((w) => INFORMAL_WORDS.has(w)).length;

  if (formalCount === 0 && informalCount === 0) return 0.5;
  return Math.round((formalCount / (formalCount + informalCount)) * 100) / 100;
}

/**
 * Berechnet den Dialekt-/Slang-Score (0-1).
 */
function calculateDialectScore(text: string): number {
  const matches = DIALECT_PATTERNS.reduce((sum, pattern) => {
    return sum + (text.match(pattern) || []).length;
  }, 0);

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;

  return Math.min(1, Math.round((matches / words) * 100) / 100);
}

/**
 * Findet die typischen Wörter einer Figur (Top 5 nach Häufigkeit).
 */
function findCharacteristicWords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const frequency = new Map<string, number>();

  for (const word of words) {
    // Ignoriere Stoppwörter und kurze Wörter
    if (word.length < 4 || FILLER_WORDS.has(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Erstellt ein Voice-Profil für eine Figur.
 */
export function createVoiceProfile(character: string, speeches: string[]): VoiceProfile {
  const fullText = speeches.join(" ");
  const words = fullText.split(/\s+/).filter(Boolean);

  return {
    character,
    totalLines: speeches.length,
    totalWords: words.length,
    averageSentenceLength: calculateAverageSentenceLength(fullText),
    fillerWordRatio: calculateFillerWordRatio(fullText),
    formalityScore: calculateFormalityScore(fullText),
    dialectScore: calculateDialectScore(fullText),
    characteristicWords: findCharacteristicWords(fullText),
  };
}

/**
 * Vergleicht ein Voice-Profil mit einem anderen und findet Abweichungen.
 */
export function findVoiceDeviations(
  profile: VoiceProfile,
  comparison: VoiceProfile,
): VoiceDeviation[] {
  const deviations: VoiceDeviation[] = [];

  // Satzlängen-Abweichung
  const sentenceDiff = Math.abs(profile.averageSentenceLength - comparison.averageSentenceLength);
  if (sentenceDiff > 5) {
    deviations.push({
      character: profile.character,
      type: "sentence_length",
      message: `Achtung: ${profile.character} nutzt plötzlich ${profile.averageSentenceLength > comparison.averageSentenceLength ? "längere" : "kürzere"} Sätze (Ø ${profile.averageSentenceLength} vs. Ø ${comparison.averageSentenceLength} Wörter).`,
      severity: Math.min(1, sentenceDiff / 10),
    });
  }

  // Füllwort-Abweichung
  const fillerDiff = Math.abs(profile.fillerWordRatio - comparison.fillerWordRatio);
  if (fillerDiff > 0.1) {
    deviations.push({
      character: profile.character,
      type: "filler_words",
      message: `Achtung: ${profile.character} hat eine ${profile.fillerWordRatio > comparison.fillerWordRatio ? "höhere" : "niedrigere"} Füllwort-Quote (${Math.round(profile.fillerWordRatio * 100)}% vs. ${Math.round(comparison.fillerWordRatio * 100)}%).`,
      severity: Math.min(1, fillerDiff * 2),
    });
  }

  // Formalitäts-Abweichung
  const formalityDiff = Math.abs(profile.formalityScore - comparison.formalityScore);
  if (formalityDiff > 0.3) {
    deviations.push({
      character: profile.character,
      type: "formality",
      message: `Achtung: ${profile.character} spricht ${profile.formalityScore > comparison.formalityScore ? "formeller" : "umgangssprachlicher"} als gewohnt (${Math.round(profile.formalityScore * 100)}% vs. ${Math.round(comparison.formalityScore * 100)}%).`,
      severity: Math.min(1, formalityDiff),
    });
  }

  // Dialekt-Abweichung
  const dialectDiff = Math.abs(profile.dialectScore - comparison.dialectScore);
  if (dialectDiff > 0.05) {
    deviations.push({
      character: profile.character,
      type: "dialect",
      message: `Achtung: ${profile.character} verwendet ${profile.dialectScore > comparison.dialectScore ? "mehr" : "weniger"} Dialekt/Slang als gewohnt.`,
      severity: Math.min(1, dialectDiff * 5),
    });
  }

  return deviations;
}

/**
 * Analysiert die Voice-Profile eines Texts.
 * Erstellt Profile für alle Figuren und findet Abweichungen.
 */
export function analyzeVoiceProfiles(text: string): VoiceAnalysis {
  const characterSpeech = assignDialogueToCharacters(text);
  const profiles: VoiceProfile[] = [];
  const deviations: VoiceDeviation[] = [];

  for (const [character, speeches] of characterSpeech) {
    const profile = createVoiceProfile(character, speeches);
    profiles.push(profile);
  }

  // Vergleiche Profile miteinander (erster Profile als Referenz)
  if (profiles.length > 1) {
    const reference = profiles[0];
    for (let i = 1; i < profiles.length; i++) {
      deviations.push(...findVoiceDeviations(profiles[i], reference));
    }
  }

  return { profiles, deviations };
}
