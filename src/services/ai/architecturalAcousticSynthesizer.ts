// ArchitecturalAcousticSynthesizer (WP 79.1)
//
// Berechnet akustische Parameter für Räume: Nachhallzeit, Flatterecho,
// Sprachverständlichkeit und Licht-Schatten-Geometrie.
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

/** Raum-Material. */
export type RoomMaterial = "limestone" | "mahogany" | "concrete" | "clay" | "wood" | "stone";

/** Raum-Parameter. */
export interface RoomParams {
  ceilingHeightM: number;
  volumeM3: number;
  material: RoomMaterial;
  lightSource: "candle" | "torch" | "window" | "chandelier" | "none";
}

/** Akustisches Ergebnis. */
export interface AcousticResult {
  reverbTimeSec: number;
  flutterEcho: number; // 0-100
  speechClarity: number; // 0-100
  description: string;
}

/** Material-Labels. */
export const MATERIAL_LABELS: Record<RoomMaterial, string> = {
  limestone: "feuchter Kalkstein",
  mahogany: "poliertes Mahagoni",
  concrete: "nackter Beton",
  clay: "Lehm",
  wood: "Holz",
  stone: "Stein",
};

/** Licht-Labels. */
export const LIGHT_LABELS: Record<RoomParams["lightSource"], string> = {
  candle: "Kerzen",
  torch: "Fackeln",
  window: "Fensterlicht",
  chandelier: "Kronleuchter",
  none: "keine Lichtquelle",
};

/** Absorptions-Koeffizienten je Material. */
const ABSORPTION: Record<RoomMaterial, number> = {
  limestone: 0.15,
  mahogany: 0.1,
  concrete: 0.05,
  clay: 0.25,
  wood: 0.2,
  stone: 0.08,
};

/** Berechnet die Nachhallzeit (RT60). */
export function computeReverbTime(params: RoomParams): number {
  const absorption = ABSORPTION[params.material];
  if (absorption <= 0) return 0;
  // Vereinfachte Sabine-Formel: RT60 = 0.161 * V / (A * S)
  // Hier vereinfacht: RT60 = 0.161 * V / (absorption * V^(2/3))
  const surface = Math.pow(params.volumeM3, 2 / 3) * 6;
  const rt60 = (0.161 * params.volumeM3) / (absorption * surface);
  return Math.round(rt60 * 100) / 100;
}

/** Berechnet das Flatterecho (0-100). */
export function computeFlutterEcho(params: RoomParams): number {
  const base = params.ceilingHeightM > 5 ? 30 : 10;
  const materialBonus = params.material === "concrete" ? 20 : params.material === "stone" ? 15 : 0;
  return Math.min(100, base + materialBonus);
}

/** Berechnet die Sprachverständlichkeit (0-100). */
export function computeSpeechClarity(params: RoomParams): number {
  const reverb = computeReverbTime(params);
  if (reverb < 0.5) return 95;
  if (reverb < 1.0) return 85;
  if (reverb < 2.0) return 70;
  if (reverb < 3.0) return 50;
  return 30;
}

/** Berechnet die vollständige Akustik. */
export function computeAcoustics(params: RoomParams): AcousticResult {
  const reverb = computeReverbTime(params);
  const flutter = computeFlutterEcho(params);
  const clarity = computeSpeechClarity(params);

  let description: string;
  if (reverb > 3) description = "Der Raum hallt stark — ein leises Flüstern wird zum Echo.";
  else if (reverb > 1.5) description = "Der Raum hat einen warmen, lebendigen Nachhall.";
  else if (reverb > 0.8) description = "Der Raum ist akustisch ausgewogen.";
  else description = "Der Raum ist gedämpft — Schall wird sofort verschluckt.";

  return { reverbTimeSec: reverb, flutterEcho: flutter, speechClarity: clarity, description };
}

/** Formatiert ein akustisches Ergebnis als Text. */
export function formatAcousticResult(result: AcousticResult, params: RoomParams): string {
  const lines: string[] = [];
  lines.push(`=== RAUM-AKUSTIK ===`);
  lines.push(`Material: ${MATERIAL_LABELS[params.material]}`);
  lines.push(`Deckenhöhe: ${params.ceilingHeightM} m`);
  lines.push(`Volumen: ${params.volumeM3} m³`);
  lines.push(`Licht: ${LIGHT_LABELS[params.lightSource]}`);
  lines.push(`Nachhallzeit: ${result.reverbTimeSec} s`);
  lines.push(`Flatterecho: ${result.flutterEcho}%`);
  lines.push(`Sprachverständlichkeit: ${result.speechClarity}%`);
  lines.push(`Beschreibung: ${result.description}`);
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Ergebnis. */
export function createSampleAcousticResult(): AcousticResult {
  return computeAcoustics({
    ceilingHeightM: 8,
    volumeM3: 500,
    material: "limestone",
    lightSource: "candle",
  });
}
