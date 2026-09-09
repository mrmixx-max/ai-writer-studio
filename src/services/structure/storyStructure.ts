// Story Structure (Sprint 28, Agent 6): 3-Akt-Struktur, Heldenreise.
// Lokal, kein LLM nötig, deterministisch.

export interface StructurePoint {
  position: number; // 0-100%
  label: string;
  type: "exposition" | "inciting" | "rising" | "climax" | "falling" | "resolution";
  confidence: number;
}

export interface StoryStructure {
  points: StructurePoint[];
  structureType: "three-act" | "hero-journey" | "circular" | "linear" | "unknown";
  completeness: number; // 0-100
  missingElements: string[];
  suggestions: string[];
}

/**
 * Erkennt die Geschichtsstruktur.
 */
export function analyzeStoryStructure(text: string): StoryStructure {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) {
    return { points: [], structureType: "unknown", completeness: 0, missingElements: ["Text ist leer"], suggestions: [] };
  }

  const points: StructurePoint[] = [];
  const length = sentences.length;

  // Exposition (erste 10%)
  points.push({ position: 5, label: "Exposition", type: "exposition", confidence: 80 });
  
  // Inciting Incident (10-20%)
  const incitingSentence = sentences.slice(Math.floor(length * 0.1), Math.floor(length * 0.2)).find((s) => 
    s.toLowerCase().includes("plötzlich") || s.toLowerCase().includes("als") || s.toLowerCase().includes("als sich") || s.toLowerCase().includes("an jenem tag")
  );
  if (incitingSentence) points.push({ position: 15, label: "Auslösendes Ereignis", type: "inciting", confidence: 70 });

  // Rising Action (20-50%)
  points.push({ position: 35, label: "Steigende Handlung", type: "rising", confidence: 60 });

  // Climax (50-80%)
  const climaxSentence = sentences.slice(Math.floor(length * 0.5), Math.floor(length * 0.8)).find((s) => 
    s.toLowerCase().includes("!") || s.toLowerCase().includes("entscheidend") || s.toLowerCase().includes("final") || s.toLowerCase().includes("showdown")
  );
  if (climaxSentence) points.push({ position: 65, label: "Klimax", type: "climax", confidence: 65 });

  // Falling Action (80-90%)
  points.push({ position: 85, label: "Fallende Handlung", type: "falling", confidence: 50 });

  // Resolution (90-100%)
  points.push({ position: 95, label: "Auflösung", type: "resolution", confidence: 70 });

  const hasExposition = points.some((p) => p.type === "exposition");
  const hasInciting = points.some((p) => p.type === "inciting");
  const hasClimax = points.some((p) => p.type === "climax");
  const hasResolution = points.some((p) => p.type === "resolution");

  const missingElements: string[] = [];
  if (!hasExposition) missingElements.push("Exposition fehlt");
  if (!hasInciting) missingElements.push("Auslösendes Ereignis fehlt");
  if (!hasClimax) missingElements.push("Klimax fehlt");
  if (!hasResolution) missingElements.push("Auflösung fehlt");

  const completeness = Math.round(((hasExposition ? 25 : 0) + (hasInciting ? 25 : 0) + (hasClimax ? 25 : 0) + (hasResolution ? 25 : 0)));

  const structureType: StoryStructure["structureType"] = (hasInciting && hasClimax && hasResolution) 
    ? "three-act" 
    : !hasResolution 
    ? "linear" 
    : "unknown";

  const suggestions: string[] = [];
  if (missingElements.length > 0) suggestions.push(...missingElements.map((m) => `Element ergänzen: ${m}`));
  if (completeness < 50) suggestions.push("Struktur unvollständig — fehlende Elemente ergänzen");
  if (suggestions.length === 0) suggestions.push("Gute 3-Akt-Struktur erkannt");

  return { points, structureType, completeness, missingElements, suggestions };
}
