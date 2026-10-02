/**
 * Cognitive-Attention-Service — WP 30.1 (Biometrische Aufmerksamkeits-Simulation)
 *
 * Lokaler, deterministischer Service zur Berechnung kognitiver Belastung,
 * Glaze-Over-Zonenerkennung und Lesezeit-Matrix.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReaderProfile = 'diagonal' | 'standard' | 'genuss';

export interface CognitiveLoadResult {
  index: number;
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface GlazeOverZone {
  paragraphIndex: number;
  attentionDrop: number;
  reason: string;
}

export interface ReadingTimeResult {
  seconds: number;
  words: number;
  wpm: number;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const WPM_MAP: Record<ReaderProfile, number> = {
  diagonal: 350,
  standard: 220,
  genuss: 130,
};

const PASSIV_PATTERN = /\b(wurde|wurden|wird|werden|ist|sind|hat|haben|konnte|musste|sollte|wollte)\b/gi;
const ABSTRAKT_PATTERN = /\b(konzept|theorie|methode|system|prozess|struktur|funktion|analyse|evaluation|implementierung)\b/gi;
const FACHWORT_PATTERN = /\b(algorithmus|datenbank|protokoll|schnittstelle|architektur|framework|middleware|pipeline|repository)\b/gi;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Berechnet die kognitive Belastung eines Textes.
 */
export function calculateCognitiveLoad(text: string): CognitiveLoadResult {
  if (!text || typeof text !== 'string') {
    return { index: 0, level: 'low', factors: [] };
  }

  const factors: string[] = [];
  let score = 0;

  // Satzlänge
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0
    ? text.split(/\s+/).length / sentences.length
    : 0;
  if (avgSentenceLength > 25) {
    score += 30;
    factors.push('Lange Sätze');
  } else if (avgSentenceLength > 15) {
    score += 15;
    factors.push('Mittellange Sätze');
  }

  // Fachwortdichte
  const words = text.split(/\s+/);
  const fachwortCount = words.filter((w) => FACHWORT_PATTERN.test(w)).length;
  const fachwortDensity = words.length > 0 ? fachwortCount / words.length : 0;
  if (fachwortDensity > 0.05) {
    score += 70;
    factors.push('Hohe Fachwortdichte');
  }

  // Abstraktheitsgrad
  const abstractCount = words.filter((w) => ABSTRAKT_PATTERN.test(w)).length;
  const abstractDensity = words.length > 0 ? abstractCount / words.length : 0;
  if (abstractDensity > 0.03) {
    score += 40;
    factors.push('Hoher Abstraktheitsgrad');
  }

  // Passivkonstruktionen
  const passivCount = (text.match(PASSIV_PATTERN) || []).length;
  const passivDensity = words.length > 0 ? passivCount / words.length : 0;
  if (passivDensity > 0.05) {
    score += 15;
    factors.push('Viele Passivkonstruktionen');
  }

  // Textlänge
  if (words.length > 500) {
    score += 10;
    factors.push('Langer Textabschnitt');
  }

  const index = Math.min(100, score);
  const level: 'low' | 'medium' | 'high' = index < 30 ? 'low' : index < 60 ? 'medium' : 'high';

  return { index, level, factors };
}

/**
 * Erkennt Glaze-Over-Zonen in Absätzen.
 */
export function detectGlazeOverZones(paragraphs: string[]): GlazeOverZone[] {
  if (!paragraphs || paragraphs.length === 0) return [];

  const zones: GlazeOverZone[] = [];
  const loads = paragraphs.map((p) => calculateCognitiveLoad(p).index);

  for (let i = 0; i < loads.length; i++) {
    if (loads[i] > 60) {
      zones.push({
        paragraphIndex: i,
        attentionDrop: loads[i],
        reason: `Kognitive Belastung ${loads[i]} % über Schwellenwert`,
      });
    }
  }

  return zones;
}

/**
 * Berechnet Lesezeiten für verschiedene Leseprofile.
 */
export function calculateReadingTime(text: string, profile: ReaderProfile): ReadingTimeResult {
  if (!text || typeof text !== 'string') {
    return { seconds: 0, words: 0, wpm: 0 };
  }

  const safeProfile: ReaderProfile = profile || 'standard';
  const wpm = WPM_MAP[safeProfile] || 220;
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = Math.round((words / wpm) * 60 * 100) / 100;

  return { seconds, words, wpm };
}
