// NarrativeVoiceprintCloner (WP 81.1)
//
// Stilometrische DNA-Extraktion und Pseudonym-Profile für Autoren.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein Stimmabdruck-Profil. */
export interface VoiceprintProfile {
  id: string;
  name: string;
  sentenceMelody: number; // 0-100
  metaphorDensity: number; // 0-100
  adjectivePreference: number; // 0-100
  punctuationRhythm: number; // 0-100
  vocabularyRarity: number; // 0-100
  overallScore: number; // 0-100
}

/** Ein Pseudonym-Profil. */
export interface PseudonymProfile {
  id: string;
  name: string;
  description: string;
  voiceprint: VoiceprintProfile;
}

/** Extrahiert einen Stimmabdruck aus einem Text. */
export function extractVoiceprint(text: string): VoiceprintProfile {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Satzmelodie: durchschnittliche Satzlänge
  const avgSentenceLength = words.length / Math.max(1, sentences.length);
  const sentenceMelody = Math.min(100, Math.round(avgSentenceLength * 2));

  // Metaphern-Dichte: Verhältnis von "wie" und "als" zu Wörtern
  const metaphorCount = (text.match(/wie|als/g) || []).length;
  const metaphorDensity = Math.min(100, Math.round((metaphorCount / Math.max(1, words.length)) * 1000));

  // Adjektiv-Präferenz: Verhältnis von Adjektiven zu Wörtern
  const adjectiveCount = (text.match(/\b(der|die|das|ein|eine)\s+\w+/g) || []).length;
  const adjectivePreference = Math.min(100, Math.round((adjectiveCount / Math.max(1, words.length)) * 500));

  // Satzzeichen-Rhythmus: Verhältnis von Kommas zu Wörtern
  const commaCount = (text.match(/,/g) || []).length;
  const punctuationRhythm = Math.min(100, Math.round((commaCount / Math.max(1, words.length)) * 200));

  // Vokabular-Seltenheit: einzigartige Wörter
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const vocabularyRarity = Math.min(100, Math.round((uniqueWords.size / Math.max(1, words.length)) * 100));

  const overallScore = Math.round(
    (sentenceMelody + metaphorDensity + adjectivePreference + punctuationRhythm + vocabularyRarity) / 5,
  );

  return {
    id: `vp-${hashString(text.slice(0, 50)).toString(16).padStart(8, "0")}`,
    name: "Autoren-Stimmabdruck",
    sentenceMelody,
    metaphorDensity,
    adjectivePreference,
    punctuationRhythm,
    vocabularyRarity,
    overallScore,
  };
}

/** Bewertet einen Text gegen ein Profil. */
export function scoreTextAgainstProfile(text: string, profile: VoiceprintProfile): number {
  const voiceprint = extractVoiceprint(text);
  const diff =
    Math.abs(voiceprint.sentenceMelody - profile.sentenceMelody) +
    Math.abs(voiceprint.metaphorDensity - profile.metaphorDensity) +
    Math.abs(voiceprint.adjectivePreference - profile.adjectivePreference) +
    Math.abs(voiceprint.punctuationRhythm - profile.punctuationRhythm) +
    Math.abs(voiceprint.vocabularyRarity - profile.vocabularyRarity);
  return Math.max(0, 100 - Math.round(diff / 5));
}

/** Erstellt ein Pseudonym-Profil. */
export function createPseudonymProfile(name: string, description: string, seed: number = 42): PseudonymProfile {
  const rng = createSeededRandom(seed);
  const voiceprint: VoiceprintProfile = {
    id: `vp-${hashString(name).toString(16).padStart(8, "0")}`,
    name,
    sentenceMelody: 30 + Math.floor(rng() * 70),
    metaphorDensity: 20 + Math.floor(rng() * 80),
    adjectivePreference: 20 + Math.floor(rng() * 80),
    punctuationRhythm: 20 + Math.floor(rng() * 80),
    vocabularyRarity: 20 + Math.floor(rng() * 80),
    overallScore: 0,
  };
  voiceprint.overallScore = Math.round(
    (voiceprint.sentenceMelody + voiceprint.metaphorDensity + voiceprint.adjectivePreference + voiceprint.punctuationRhythm + voiceprint.vocabularyRarity) / 5,
  );
  return { id: `pp-${hashString(name).toString(16).padStart(8, "0")}`, name, description, voiceprint };
}

/** Formatiert ein Profil als Text. */
export function formatVoiceprint(profile: VoiceprintProfile): string {
  const lines: string[] = [];
  lines.push(`=== STIMMABDRUCK: ${profile.name} ===`);
  lines.push(`Satzmelodie: ${profile.sentenceMelody}%`);
  lines.push(`Metaphern-Dichte: ${profile.metaphorDensity}%`);
  lines.push(`Adjektiv-Präferenz: ${profile.adjectivePreference}%`);
  lines.push(`Satzzeichen-Rhythmus: ${profile.punctuationRhythm}%`);
  lines.push(`Vokabular-Seltenheit: ${profile.vocabularyRarity}%`);
  lines.push(`Gesamt: ${profile.overallScore}%`);
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Profil. */
export function createSampleProfile(): PseudonymProfile {
  return createPseudonymProfile("Dark-Fantasy-Pseudonym", "Düsterer, epischer Tonfall", 42);
}
