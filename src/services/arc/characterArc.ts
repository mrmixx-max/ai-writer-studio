// Character Arc (Sprint 28, Agent 3): Charakterentwicklung analysieren.
// Lokal, kein LLM nötig, deterministisch.

export interface ArcPoint {
  position: number; // 0-100%
  development: number; // -100 bis +100
  event: string;
}

export interface CharacterArc {
  points: ArcPoint[];
  overallDevelopment: number;
  arcType: "positive" | "negative" | "flat" | "wave";
  turningPoint: number;
  suggestions: string[];
}

const POSITIVE_KEYWORDS = ["lernen", "wachsen", "siegen", "retten", "heilen", "vergeben", "lieben", "vertrauen", "hoffnung", "mut", "freude", "frieden", "triumph", "erfolg", "klarheit", "erkenntnis", "reife", "weisheit", "kraft", "selbstbewusstsein"];
const NEGATIVE_KEYWORDS = ["fallen", "scheitern", "verlieren", "sterben", "verraten", "hassen", "zerstören", "verzweifeln", "kapitulieren", "aufgiven", "schwach", "ängstlich", "unsicher", "verwirrt", "verloren", "allein", "verlassen", "verflucht", "verdammt", "brennen"];

/**
 * Analysiert die Charakterentwicklung.
 */
export function analyzeCharacterArc(text: string, _characterName?: string): CharacterArc {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) {
    return { points: [], overallDevelopment: 0, arcType: "flat", turningPoint: 0, suggestions: ["Text ist leer"] };
  }

  const points: ArcPoint[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    let development = 0;
    for (const kw of POSITIVE_KEYWORDS) if (sentence.includes(kw)) development += 10;
    for (const kw of NEGATIVE_KEYWORDS) if (sentence.includes(kw)) development -= 10;
    points.push({ position: Math.round((i / sentences.length) * 100), development, event: sentences[i].slice(0, 50) });
  }

  const overallDevelopment = Math.round(points.reduce((s, p) => s + p.development, 0) / points.length);
  const turningPoint = points.reduce((min, p) => p.development < min.development ? p : min, points[0])?.position ?? 0;

  let arcType: CharacterArc["arcType"] = "flat";
  if (overallDevelopment > 20) arcType = "positive";
  else if (overallDevelopment < -20) arcType = "negative";
  else if (Math.max(...points.map((p) => p.development)) - Math.min(...points.map((p) => p.development)) > 50) arcType = "wave";

  const suggestions: string[] = [];
  if (arcType === "flat") suggestions.push("Charakterentwicklung flach — mehr Wendepunkte");
  if (overallDevelopment > 50) suggestions.push("Sehr positive Entwicklung — für Tiefe sorgen");
  if (overallDevelopment < -50) suggestions.push("Sehr negative Entwicklung — Momente der Hoffnung");
  if (suggestions.length === 0) suggestions.push("Gute Charakterentwicklung mit klarem Bogen");

  return { points, overallDevelopment, arcType, turningPoint, suggestions };
}
