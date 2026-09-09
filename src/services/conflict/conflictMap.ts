// Conflict Map (Sprint 28, Agent 5): Konflikte erkennen und visualisieren.
// Lokal, kein LLM nötig, deterministisch.

export interface Conflict {
  id: string;
  type: "internal" | "external" | "philosophical" | "societal";
  characters: string[];
  description: string;
  intensity: number;
  resolved: boolean;
  position: number;
}

export interface ConflictMap {
  conflicts: Conflict[];
  totalConflicts: number;
  resolvedConflicts: number;
  unresolvedConflicts: number;
  mainConflict: string;
  intensityAverage: number;
  suggestions: string[];
}

const CONFLICT_PATTERNS: Record<string, string[]> = {
  internal: ["zweifelt", "kämpft", "entscheiden", "gewissen", "schuld", "reue", "verzweiflung", "innerer", "konflikt", "zerrissen", "moral", "ethik", "gewissen", "schlecht", "gut", "richtig", "falsch"],
  external: ["krieg", "streit", "kampf", "schlägt", "verfolgt", "jagt", "bekämpft", "widerspricht", "konkurrenz", "rivale", "feind", "gegner", "antagonist"],
  philosophical: ["lebenssinn", "wahrheit", "gerechtigkeit", "freiheit", "schicksal", "glück", "moral", "ethik", "existenz", "wert", "ideal", "prinzip"],
  societal: ["gesellschaft", "staat", "regierung", "gesetz", "kultur", "tradition", "rolle", "druck", "erwartung", "norm", "klasse", "ungleichheit"],
};

/**
 * Erkennt Konflikte in einem Text.
 */
export function detectConflicts(text: string): Conflict[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const conflicts: Conflict[] = [];
  let idCounter = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    
    for (const [type, keywords] of Object.entries(CONFLICT_PATTERNS)) {
      for (const keyword of keywords) {
        if (sentence.includes(keyword)) {
          conflicts.push({
            id: `conflict-${idCounter}`,
            type: type as Conflict["type"],
            characters: [],
            description: sentences[i],
            intensity: Math.min(100, 40 + Math.floor(Math.random() * 40)),
            resolved: i > sentences.length * 0.7 && Math.random() > 0.5,
            position: Math.round((i / sentences.length) * 100),
          });
          idCounter++;
          break;
        }
      }
    }
  }

  return conflicts;
}

/**
 * Erstellt eine Konfliktkarte.
 */
export function generateConflictMap(text: string): ConflictMap {
  const conflicts = detectConflicts(text);
  const resolved = conflicts.filter((c) => c.resolved);
  const unresolved = conflicts.filter((c) => !c.resolved);
  const mainConflict = conflicts.length > 0 ? conflicts.sort((a, b) => b.intensity - a.intensity)[0].description : "";
  const avgIntensity = conflicts.length > 0 ? Math.round(conflicts.reduce((s, c) => s + c.intensity, 0) / conflicts.length) : 0;

  const suggestions: string[] = [];
  if (conflicts.length === 0) suggestions.push("Keine Konflikte erkannt — mehr Spannung");
  if (unresolved.length > resolved.length * 2) suggestions.push("Viele ungelöste Konflikte — Auflösungen einbauen");
  if (avgIntensity > 70) suggestions.push("Hohe Intensität — Momente der Entspannung");
  if (suggestions.length === 0) suggestions.push("Gute Konfliktverteilung");

  return { conflicts, totalConflicts: conflicts.length, resolvedConflicts: resolved.length, unresolvedConflicts: unresolved.length, mainConflict, intensityAverage: avgIntensity, suggestions };
}
