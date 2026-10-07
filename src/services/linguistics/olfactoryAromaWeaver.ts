// OlfactoryAromaWeaver (WP 90.1)
// Olfaktorischer Aroma- & Duft-Synthesizer.
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

export type AromaOctave = "resinous" | "metallic" | "decay" | "earthy" | "animalic" | "spicy" | "smoky" | "fermented";

export interface AromaNote {
  octave: AromaOctave;
  descriptor: string;
  intensity: number; // 0-100
}

export interface AromaProfile {
  id: string;
  location: string;
  topNote: AromaNote;
  heartNote: AromaNote;
  baseNote: AromaNote;
  memoryAnchor?: string;
  seed: number;
}

export interface OlfactoryMemory {
  character: string;
  aroma: string;
  memory: string;
  emotion: string;
}

const OCTAVE_DESCRIPTORS: Record<AromaOctave, string[]> = {
  resinous: ["Harz", "Weihrauch", "Myrrhe", "Balsam", "Kiefernnadeln", "Zedernholz", "Bernstein", "Kopal"],
  metallic: ["Ozon", "Blut", "Eisen", "Kupfer", "Gewitterluft", "Schmiedefeuer", "Münzkalte", "Stahl"],
  decay: ["Moder", "Fäulnis", "Schwefel", "Kadaver", "Schimmel", "Sumpf", "Verwesung", "Miasma"],
  earthy: ["Petrichor", "feuchte Erde", "Moos", "Pilze", "Wurzeln", "Torf", "Lehm", "Steinstaub"],
  animalic: ["Moschus", "Zibet", "Ambra", "Leder", "Schweiß", "Fell", "Stall", "Wild"],
  spicy: ["Zimt", "Nelke", "Pfeffer", "Kardamom", "Safran", "Ingwer", "Chili", "Koriander"],
  smoky: ["Rauch", "Asche", "Teer", "Holzkohle", "verbranntes Haar", "Pech", "Ruß", "Glut"],
  fermented: ["Hefe", "Bier", "Essig", "Sauerkraut", "Käse", "Überreife Früchte", "Kompost", "Gärung"],
};

const LOCATION_TEMPLATES = [
  "mittelalterliche Apotheke",
  "Schmiede bei Nacht",
  "verlassener Kerker",
  "blühender Kräutergarten",
  "Küstendorf bei Ebbe",
  "Taverne am Hafen",
  "königliche Bibliothek",
  "Schlachtfeld nach dem Regen",
  "Hexenhütte im Moor",
  "Weinkeller unter der Stadt",
];

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createAromaProfile(location: string, seed: number = 42): AromaProfile {
  const rng = createSeededRandom(hashString(location + seed));
  const loc = location || pickRandom(LOCATION_TEMPLATES, rng);
  
  const octaves: AromaOctave[] = ["resinous", "metallic", "decay", "earthy", "animalic", "spicy", "smoky", "fermented"];
  const topOctave = pickRandom(octaves, rng);
  const heartOctave = pickRandom(octaves.filter(o => o !== topOctave), rng);
  const baseOctave = pickRandom(octaves.filter(o => o !== topOctave && o !== heartOctave), rng);

  const topDescriptor = pickRandom(OCTAVE_DESCRIPTORS[topOctave], rng);
  const heartDescriptor = pickRandom(OCTAVE_DESCRIPTORS[heartOctave], rng);
  const baseDescriptor = pickRandom(OCTAVE_DESCRIPTORS[baseOctave], rng);

  const topNote: AromaNote = {
    octave: topOctave,
    descriptor: topDescriptor,
    intensity: 70 + Math.floor(rng() * 30),
  };
  const heartNote: AromaNote = {
    octave: heartOctave,
    descriptor: heartDescriptor,
    intensity: 50 + Math.floor(rng() * 40),
  };
  const baseNote: AromaNote = {
    octave: baseOctave,
    descriptor: baseDescriptor,
    intensity: 30 + Math.floor(rng() * 40),
  };

  const memoryAnchor = rng() < 0.6 ? generateMemoryAnchor(loc, rng) : undefined;

  return {
    id: `AROMA-${hashString(loc + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    location: loc,
    topNote,
    heartNote,
    baseNote,
    memoryAnchor,
    seed,
  };
}

function generateMemoryAnchor(location: string, rng: () => number): string {
  const characters = ["Elara", "Thorne", "Mira", "Kael", "Sylas", "Veyra", "Darian", "Liora"];
  const emotions = ["Sehnsucht", "Angst", "Geborgenheit", "Scham", "Freude", "Trauer", "Wut", "Stolz"];
  const memories = [
    "der Geruch von Mutter's Brot am Sonntagmorgen",
    "der Rauch vom Lagerfeuer beim ersten Übernachtungsausflug",
    "der Duft von Regen auf heißem Asphalt im Juli",
    "der stechende Geruch von Desinfektionsmittel im Krankenhaus",
    "das Aroma von getrockneten Kräutern in Großmutters Küche",
    "der modrige Keller, in dem man als Kind verstecken spielte",
    "der süße Geruch von Jasmin an lauen Sommerabenden",
    "der metallische Geschmack von Blut nach dem Sturz vom Fahrrad",
  ];
  
  const char = pickRandom(characters, rng);
  const emotion = pickRandom(emotions, rng);
  const memory = pickRandom(memories, rng);
  
  return `${char} verbindet ${location} mit ${emotion} – ${memory}.`;
}

export function formatAromaProfile(profile: AromaProfile): string {
  const octaveLabels: Record<AromaOctave, string> = {
    resinous: "🌲 Harzig/Balsamisch",
    metallic: "⚡ Metallisch/Ozon",
    decay: "💀 Verwesung/Fäulnis",
    earthy: "🌍 Erde/Petrichor",
    animalic: "🦌 Animalisch/Moschus",
    spicy: "🌶️ Scharf/Gewürzt",
    smoky: "🔥 Rauchig/Asche",
    fermented: "🍺 Gärung/Hefe",
  };

  return [
    `👃 AROMA-PROFIL: ${profile.location}`,
    `ID: ${profile.id} | Seed: ${profile.seed}`,
    "",
    `KOPFNOTE: ${octaveLabels[profile.topNote.octave]} — ${profile.topNote.descriptor} (${profile.topNote.intensity}%)`,
    `HERZNOTE: ${octaveLabels[profile.heartNote.octave]} — ${profile.heartNote.descriptor} (${profile.heartNote.intensity}%)`,
    `BASISNOTE: ${octaveLabels[profile.baseNote.octave]} — ${profile.baseNote.descriptor} (${profile.baseNote.intensity}%)`,
    "",
    profile.memoryAnchor ? `🧠 ERINNERUNGS-ANKER: ${profile.memoryAnchor}` : "Kein Erinnerungs-Anker generiert.",
  ].join("\n");
}

export function createSampleProfile(): AromaProfile {
  return createAromaProfile("mittelalterliche Apotheke", 42);
}

export function createSampleMemory(): OlfactoryMemory {
  return {
    character: "Elara",
    aroma: "Petrichor & Minze",
    memory: "der Geruch von Mutter's Brot am Sonntagmorgen",
    emotion: "Geborgenheit",
  };
}