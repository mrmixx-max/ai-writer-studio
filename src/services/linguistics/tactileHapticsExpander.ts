// TactileHapticsExpander (WP 78.2)
//
// Erweitert flache Gegenstandsbeschreibungen um viszerale Tastempfindungen
// über 5 Textur-Dimensionen. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Textur-Dimension. */
export type TextureDimension = "friction" | "thermal" | "viscosity" | "topography" | "pressure";

/** Ein Textur-Ergebnis. */
export interface TextureProfile {
  dimension: TextureDimension;
  value: string;
  intensity: number; // 0-100
  description: string;
}

/** Eine haptische Analyse. */
export interface HapticAnalysis {
  object: string;
  profiles: TextureProfile[];
  overallIntensity: number;
}

/** Dimension-Labels. */
export const DIMENSION_LABELS: Record<TextureDimension, string> = {
  friction: "Reibung & Haftung",
  thermal: "Thermische Leitfähigkeit",
  viscosity: "Viskosität & Nachgiebigkeit",
  topography: "Oberflächen-Topografie",
  pressure: "Druck & Schmerz",
};

/** Werte je Dimension. */
const DIMENSION_VALUES: Record<TextureDimension, string[]> = {
  friction: ["schmirgelnd", "klebrig", "seifig-glatt", "sandig", "rutschig", "grob"],
  thermal: ["schockkalt", "wärmespeichernd", "kühl", "neutral", "warm", "heiß"],
  viscosity: ["zähflüssig", "gallertartig", "mürbe", "federnd", "flüssig", "fest"],
  topography: ["vernarbt", "geriffelt", "samtig-weich", "splittert", "glat", "wabenförmig"],
  pressure: ["stumpfes Drücken", "pochender Einstich", "brennende Scheuerstelle", "kribbelnd", "drückend", "stechend"],
};

/** Analysiert die Textur eines Gegenstandes. */
export function analyzeTexture(object: string, seed: number = 42): HapticAnalysis {
  const rng = createSeededRandom(seed);
  const dimensions: TextureDimension[] = ["friction", "thermal", "viscosity", "topography", "pressure"];
  const profiles: TextureProfile[] = dimensions.map((dim) => {
    const values = DIMENSION_VALUES[dim];
    const value = values[Math.floor(rng() * values.length)];
    const intensity = 20 + Math.floor(rng() * 80);
    return { dimension: dim, value, intensity, description: `${DIMENSION_LABELS[dim]}: ${value} (${intensity}%)` };
  });

  const overallIntensity = Math.round(profiles.reduce((sum, p) => sum + p.intensity, 0) / profiles.length);

  return { object, profiles, overallIntensity };
}

/** Erweitert eine Beschreibung um haptische Details. */
export function expandDescription(description: string, seed: number = 42): string {
  const rng = createSeededRandom(seed);
  const dimensions: TextureDimension[] = ["friction", "thermal", "viscosity", "topography", "pressure"];
  const parts: string[] = [description];

  for (const dim of dimensions) {
    const values = DIMENSION_VALUES[dim];
    const value = values[Math.floor(rng() * values.length)];
    parts.push(`${DIMENSION_LABELS[dim]}: ${value}`);
  }

  return parts.join(". ") + ".";
}

/** Formatiert eine haptische Analyse als Text. */
export function formatHapticAnalysis(analysis: HapticAnalysis): string {
  const lines: string[] = [];
  lines.push(`=== HAPTISCHE ANALYSE: ${analysis.object} ===`);
  lines.push(`Gesamtintensität: ${analysis.overallIntensity}%`);
  lines.push("");
  for (const p of analysis.profiles) {
    lines.push(`  ${p.description}`);
  }
  return lines.join("\n");
}

/** Erstellt eine Beispiel-Analyse. */
export function createSampleAnalysis(): HapticAnalysis {
  return analyzeTexture("eine alte Eichentür", 42);
}
