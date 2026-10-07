// StageLightingDirector (WP 88.2)
// Bühnen-Lichtregie & Farbtemperatur-Synthesizer.
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

export type LightType = "key" | "fill" | "back" | "rim" | "background" | "special" | "practical";

export interface LightSource {
  id: string;
  name: string;
  type: LightType;
  kelvin: number;
  intensity: number; // 0-100%
  position: { x: number; y: number; z: number }; // Bühnenkoordinaten
  angle: number; // Grad
  focus: number; // 0-100% (0=Flutlicht, 100%=Spot)
  colorFilter?: string; // Gel-Farbfilter (Lee/Rosco Nummern)
  gelName?: string;
}

export interface LightCue {
  id: string;
  name: string;
  timecode: string; // HH:MM:SS oder "Cue 1"
  lights: LightSource[];
  duration: number; // Sekunden für Fade
  description: string;
  script: string; // Regie-Anweisung als Text
}

export interface LightingScene {
  id: string;
  name: string;
  description: string;
  cues: LightCue[];
  overallMood: string;
  dominantKelvin: number;
}

const GEL_FILTERS = [
  { number: "L201", name: "Full CT Blue", kelvinShift: -2000, description: "Tageslicht-Korrektur" },
  { number: "L202", name: "Half CT Blue", kelvinShift: -1000, description: "Halbe Tageslicht-Korrektur" },
  { number: "L203", name: "Quarter CT Blue", kelvinShift: -500, description: "Viertel Tageslicht-Korrektur" },
  { number: "L204", name: "Full CT Orange", kelvinShift: 2000, description: "Kunstlicht auf Tageslicht" },
  { number: "L205", name: "Half CT Orange", kelvinShift: 1000, description: "Halbe Kunstlicht-Korrektur" },
  { number: "L206", name: "Quarter CT Orange", kelvinShift: 500, description: "Viertel Kunstlicht-Korrektur" },
  { number: "L105", name: "Orange", kelvinShift: 1500, description: "Warmes Orange" },
  { number: "L106", name: "Primary Red", kelvinShift: 0, description: "Reines Rot" },
  { number: "L107", name: "Light Rose", kelvinShift: 0, description: "Zartes Rosa" },
  { number: "L108", name: "English Rose", kelvinShift: 0, description: "Englisches Rosa" },
  { number: "L109", name: "Light Salmon", kelvinShift: 800, description: "Lachs" },
  { number: "L110", name: "Middle Rose", kelvinShift: 0, description: "Mittleres Rosa" },
  { number: "L111", name: "Dark Pink", kelvinShift: 0, description: "Dunkles Pink" },
  { number: "L115", name: "Peacock Blue", kelvinShift: -1500, description: "Pfauenblau" },
  { number: "L116", name: "Medium Blue-Green", kelvinShift: -1200, description: "Blaugrün" },
  { number: "L117", name: "Steel Blue", kelvinShift: -1000, description: "Stahlblau" },
  { number: "L118", name: "Light Blue", kelvinShift: -800, description: "Hellblau" },
  { number: "L119", name: "Dark Blue", kelvinShift: -2000, description: "Dunkelblau" },
  { number: "L120", name: "Deep Blue", kelvinShift: -2500, description: "Tiefblau" },
  { number: "L121", name: "Leaf Green", kelvinShift: 0, description: "Blattgrün" },
  { number: "L122", name: "Fern Green", kelvinShift: 0, description: "Farn-grün" },
  { number: "L124", name: "Dark Green", kelvinShift: 0, description: "Dunkelgrün" },
  { number: "L126", name: "Mauve", kelvinShift: 0, description: "Flieder" },
  { number: "L128", name: "Bright Pink", kelvinShift: 0, description: "Helles Pink" },
  { number: "L131", name: "Marine Blue", kelvinShift: -2000, description: "Marineblau" },
  { number: "L132", name: "Medium Blue", kelvinShift: -1500, description: "Mittelblau" },
  { number: "L134", name: "Golden Amber", kelvinShift: 2000, description: "Goldener Bernstein" },
  { number: "L135", name: "Deep Golden Amber", kelvinShift: 2500, description: "Tiefer Goldener Bernstein" },
  { number: "L136", name: "Pale Lavender", kelvinShift: -500, description: "Blasses Lavendel" },
  { number: "L136", name: "Special Lavender", kelvinShift: -800, description: "Spezielles Lavendel" },
  { number: "L137", name: "Special Lavender", kelvinShift: -1000, description: "Spezielles Lavendel" },
  { number: "L139", name: "Primary Green", kelvinShift: 0, description: "Primäres Grün" },
  { number: "L141", name: "Bright Blue", kelvinShift: -1500, description: "Helles Blau" },
  { number: "L142", name: "Pale Violet", kelvinShift: -800, description: "Blasses Violett" },
  { number: "L147", name: "Apricot", kelvinShift: 1200, description: "Aprikose" },
  { number: "L148", name: "Bright Rose", kelvinShift: 0, description: "Helles Rosa" },
  { number: "L152", name: "Pale Gold", kelvinShift: 1500, description: "Blasses Gold" },
  { number: "L154", name: "Pale Rose", kelvinShift: 0, description: "Blasses Rosa" },
  { number: "L156", name: "Chocolate", kelvinShift: 0, description: "Schokolade" },
  { number: "L158", name: "Deep Orange", kelvinShift: 1800, description: "Tieforange" },
  { number: "L159", name: "No Color Straw", kelvinShift: 500, description: "Stroh" },
  { number: "L161", name: "Slate Blue", kelvinShift: -1200, description: "Schieferblau" },
  { number: "L162", name: "Bastard Amber", kelvinShift: 1000, description: "Bastard-Amber" },
  { number: "L164", name: "Flame Red", kelvinShift: 0, description: "Flammenrot" },
  { number: "L165", name: "Daylight Blue", kelvinShift: -2000, description: "Tageslichtblau" },
  { number: "L169", name: "Lilac Tint", kelvinShift: -800, description: "Fliedertönung" },
  { number: "L170", name: "Deep Lavender", kelvinShift: -1200, description: "Tieflavendel" },
  { number: "L174", name: "Dark Steel Blue", kelvinShift: -1500, description: "Dunkles Stahlblau" },
  { number: "L176", name: "Loving Amber", kelvinShift: 1200, description: "Liebevolles Amber" },
  { number: "L179", name: "Loving Amber", kelvinShift: 1500, description: "Liebevolles Amber" },
  { number: "L180", name: "Dark Lavender", kelvinShift: -1500, description: "Dunkellavendel" },
  { number: "L181", name: "Congo Blue", kelvinShift: -2500, description: "Kongo-Blau" },
  { number: "L182", name: "Light Red", kelvinShift: 0, description: "Hellrot" },
  { number: "L183", name: "Moonlight Blue", kelvinShift: -2000, description: "Mondlichtblau" },
];

const KELVIN_MOODS = [
  { min: 1800, max: 2200, mood: "Intim, romantisch, nostalgisch", description: "Kerzenlicht, offenes Feuer" },
  { min: 2200, max: 2700, mood: "Warm, gemütlich, intim", description: "Glühbirne, warmes Wohnzimmerlicht" },
  { min: 2700, max: 3200, mood: "Einladend, behaglich", description: "Halogen, warmes Weiß" },
  { min: 3200, max: 4000, mood: "Neutral, natürlich", description: "Morgen/Abendlicht, Fotolicht" },
  { min: 4000, max: 5000, mood: "Klar, aktiv, konzentriert", description: "Tageslicht, Bürobeleuchtung" },
  { min: 5000, max: 6500, mood: "Kühl, steril, klinisch", description: "Mittagssonne, Operationslicht" },
  { min: 6500, max: 10000, mood: "Extrem kühl, surreal, unwirklich", description: "Nordlicht, Überbelichtung" },
];
function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createLightSource(type: LightType, seed: number, kelvin?: number): LightSource {
  const rng = createSeededRandom(seed);
  const baseKelvin = kelvin || (type === "key" ? 3200 : type === "fill" ? 3500 : type === "back" ? 4000 : 5600);
  
  const positions: Record<LightType, { x: number; y: number; z: number }> = {
    key: { x: -3, y: 2, z: -4 },
    fill: { x: 3, y: 1.5, z: -3 },
    back: { x: 0, y: 3, z: 5 },
    rim: { x: 0, y: 2.5, z: 4 },
    background: { x: 0, y: 1, z: 6 },
    special: { x: -4, y: 2, z: -2 },
    practical: { x: 2, y: 0.8, z: -2 },
  };

  const gel = pickRandom(GEL_FILTERS, rng);
  const intensity = clamp(40 + rng() * 60, 10, 100);
  const focus = clamp(20 + rng() * 80, 0, 100);
  const angle = clamp(15 + rng() * 60, 10, 90);

  return {
    id: `LS-${hashString(`${type}${seed}`).toString(16).padStart(6, "0")}`,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
    type,
    kelvin: clamp(baseKelvin + gel.kelvinShift, 1800, 10000),
    intensity,
    position: positions[type],
    angle,
    focus,
    colorFilter: gel.number,
    gelName: gel.name,
  };
}

export function createLightCue(name: string, timecode: string, seed: number): LightCue {
  const rng = createSeededRandom(seed);
  const types: LightType[] = ["key", "fill", "back", "rim", "background"];
  const lights = types.slice(0, 2 + Math.floor(rng() * 3)).map((t, i) => 
    createLightSource(t, seed + i + 1)
  );
  const duration = 1 + Math.floor(rng() * 5);
  
  const dominantKelvin = lights.reduce((sum, l) => sum + l.kelvin, 0) / lights.length;
  const mood = getKelvinMood(dominantKelvin);

  return {
    id: `CUE-${hashString(name + seed).toString(16).padStart(6, "0")}`,
    name,
    timecode,
    lights,
    duration,
    description: `${mood.mood} — ${lights.length} Scheinwerfer, dominant ${Math.round(dominantKelvin)} K`,
    script: `[LICHT: ${lights.map(l => `${l.type} ${l.kelvin}K ${l.intensity}%`).join(", ")}. Fade ${duration}s. ${mood.description}]`,
  };
}

export function createLightingScene(name: string, seed: number, cueCount: number = 5): LightingScene {
  const _rng = createSeededRandom(seed);
  const cues: LightCue[] = [];
  
  for (let i = 0; i < cueCount; i++) {
    cues.push(createLightCue(`Cue ${i + 1}`, `${String(i + 1).padStart(2, "0")}:00:00`, seed + i * 100));
  }

  const allKelvins = cues.flatMap(c => c.lights.map(l => l.kelvin));
  const dominantKelvin = Math.round(allKelvins.reduce((a, b) => a + b, 0) / allKelvins.length);
  const mood = getKelvinMood(dominantKelvin);

  return {
    id: `SCENE-${hashString(name + seed).toString(16).padStart(6, "0")}`,
    name,
    description: `${mood.mood} (${dominantKelvin} K) — ${cues.length} Cues, ${cues.flatMap(c => c.lights).length} Scheinwerfer`,
    cues,
    overallMood: mood.mood,
    dominantKelvin,
  };
}

export function generateLightingScript(scene: LightingScene): string {
  const lines = [
    `LICHTREGIE: ${scene.name}`,
    `Stimmung: ${scene.overallMood} (${scene.dominantKelvin} K)`,
    "",
  ];
  
  for (const cue of scene.cues) {
    lines.push(`--- ${cue.timecode} ${cue.name} (Fade ${cue.duration}s) ---`);
    lines.push(cue.script);
    lines.push("");
    for (const light of cue.lights) {
      const pos = `Pos(${light.position.x},${light.position.y},${light.position.z})`;
      const gel = light.gelName ? ` [Gel: ${light.colorFilter} ${light.gelName}]` : "";
      lines.push(`  ${light.type.toUpperCase()}: ${light.kelvin}K | ${light.intensity}% | Fokus ${light.focus}% | Winkel ${light.angle}° | ${pos}${gel}`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}

export function getKelvinMood(kelvin: number): { mood: string; description: string } {
  const match = KELVIN_MOODS.find(m => kelvin >= m.min && kelvin <= m.max);
  return match || { mood: "Unbekannt", description: "Außerhalb definierter Bereiche" };
}

export function createSampleScene(): LightingScene {
  return createLightingScene("Akt 1, Szene 1 - Schlosshof bei Nacht", 42, 3);
}

export function createSampleScript(): string {
  return generateLightingScript(createSampleScene());
}