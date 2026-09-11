// Hook Analyzer (Sprint 28, Agent 1): Eröffnungssätze (Hooks) analysieren.
// Lokal, kein LLM nötig, deterministisch.

export interface HookAnalysis {
  hook: string;
  type: "question" | "action" | "dialogue" | "statement" | "description" | "thought" | "unknown";
  strength: number; // 0-100
  wordCount: number;
  startsWith: string;
  hasConflict: boolean;
  hasMystery: boolean;
  hasEmotion: boolean;
  suggestions: string[];
}

export interface HookReport {
  hooks: HookAnalysis[];
  averageStrength: number;
  strongestHook: string;
  weakestHook: string;
  recommendations: string[];
}

/**
 * Analysiert einen Eröffnungssatz (Hook).
 */
export function analyzeHook(text: string): HookAnalysis {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const firstSentence = sentences[0]?.trim() ?? "";
  const words = firstSentence.split(/\s+/).filter(Boolean);
  const lower = firstSentence.toLowerCase();

  const type: HookAnalysis["type"] = firstSentence.includes("?") 
    ? "question"
    : firstSentence.match(/^[»""„"»—–-]/)
    ? "dialogue"
    : lower.startsWith("ich ") || lower.startsWith("wir ") || lower.startsWith("er ") || lower.startsWith("sie ")
    ? "thought"
    : words.length > 0 && /^[A-ZÄÖÜ]/.test(words[0])
    ? "statement"
    : "description";

  // Stärke berechnen
  let strength = 30;
  if (type === "question") strength += 20;
  if (type === "dialogue") strength += 15;
  if (type as string === "action") strength += 10;
  if (words.length >= 5 && words.length <= 20) strength += 10;
  if (words.length < 5) strength += 5;
  if (hasConflict(lower)) strength += 15;
  if (hasMystery(lower)) strength += 10;
  if (hasEmotion(lower)) strength += 10;

  const suggestions: string[] = [];
  if (strength < 50) suggestions.push("Hook ist schwach — mit Frage oder Dialog beginnen");
  if (words.length > 25) suggestions.push("Erster Satz zu lang — kürzer für mehr Wirkung");
  if (words.length < 3) suggestions.push("Erster Satz zu kurz — mehr Kontext");
  if (type as string === "unknown") suggestions.push("Eröffnung unklar — Frage, Dialog oder Action bevorzugen");
  if (suggestions.length === 0) suggestions.push("Guter Hook — beibehalten");

  return {
    hook: firstSentence,
    type,
    strength: Math.min(100, strength),
    wordCount: words.length,
    startsWith: words[0] ?? "",
    hasConflict: hasConflict(lower),
    hasMystery: hasMystery(lower),
    hasEmotion: hasEmotion(lower),
    suggestions,
  };
}

function hasConflict(text: string): boolean {
  return ["krieg", "streit", "kampf", "konflikt", "problem", "schwierigkeit", "gefahr", "bedrohung", "krise", "not", "angst", "wut", "hass", "rache", "verrat"].some((w) => text.includes(w));
}

function hasMystery(text: string): boolean {
  return ["geheimnis", "rätsel", "unbekannt", "mysteriös", "dunkel", "heimlich", "verborgen", "verschwunden", "missng", "seltsam", "ungewöhnlich", "wunder", "zauber", "verflucht", "prophezeiung"].some((w) => text.includes(w));
}

function hasEmotion(text: string): boolean {
  return ["liebe", "hass", "angst", "freude", "trauer", "wut", "hoffnung", "verzweiflung", "ekel", "überraschung", "schmerz", "glück", "kummer", "sehnsucht", "leid"].some((w) => text.includes(w));
}

/**
 * Analysiert alle Eröffnungssätze eines Textes.
 */
export function analyzeAllHooks(text: string): HookReport {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const hooks: HookAnalysis[] = [];

  for (const para of paragraphs) {
    hooks.push(analyzeHook(para));
  }

  const avgStrength = hooks.length > 0 ? Math.round(hooks.reduce((s, h) => s + h.strength, 0) / hooks.length) : 0;
  const strongest = hooks.length > 0 ? hooks.reduce((a, b) => a.strength > b.strength ? a : b) : null;
  const weakest = hooks.length > 0 ? hooks.reduce((a, b) => a.strength < b.strength ? a : b) : null;

  const recommendations: string[] = [];
  if (avgStrength < 40) recommendations.push("Alle Hooks sind schwach — stärkere Eröffnungen");
  if (hooks.some((h) => h.wordCount > 25)) recommendations.push("Lange Hooks kürzen");
  if (hooks.filter((h) => h.type === "question").length === 0) recommendations.push("Fragen-Hooks für mehr Neugier");

  return {
    hooks,
    averageStrength: avgStrength,
    strongestHook: strongest?.hook ?? "",
    weakestHook: weakest?.hook ?? "",
    recommendations,
  };
}
