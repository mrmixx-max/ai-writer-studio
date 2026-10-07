// ParallelClimaxSynchronizer (WP 93.1)
// Paralleler Klimax- & Schnitt-Synchronizer.
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

export type StrandLabel = "A" | "B" | "C" | "D";

export interface PlotStrand {
  label: StrandLabel;
  name: string;
  location: string;
  characters: string[];
  beats: StrandBeat[];
}

export interface StrandBeat {
  act: number;
  beatType: "setup" | "complication" | "crisis" | "darkNight" | "climax" | "resolution";
  description: string;
  tension: number; // 1-10
  timestamp: number; // relative 0-100
}

export interface SyncProfile {
  id: string;
  name: string;
  strands: PlotStrand[];
  globalClimaxTimestamp: number; // 0-100
  matchCuts: MatchCut[];
  seed: number;
}

export interface MatchCut {
  fromStrand: StrandLabel;
  toStrand: StrandLabel;
  trigger: string; // was löst den Schnitt aus
  transitionText: string; // filmischer Übergangsatz
  timestamp: number;
}

const STRAND_LABELS: StrandLabel[] = ["A", "B", "C", "D"];

const BEAT_TYPES = ["setup", "complication", "crisis", "darkNight", "climax", "resolution"] as const;

const LOCATIONS = [
  "Thronsaal", "Raumschiff-Brücke", "Unterirdisches Bunker", "Schlachtfeld",
  "Himmelszitadelle", "Tiefe des Ozeans", "Vulkan-Krater", "Eisige Tundra",
  "Vergessener Tempel", "Cyberpunk-Metropole", "Magische Akademie", "Postapokalyptische Ruine",
];

const CHARACTER_ARCHETYPES = [
  "Der widerwillige Held", "Der verratene Mentor", "Die loyale Gefährtin",
  "Der charismatische Schurke", "Die weise Seherin", "Der gefallene Ritter",
  "Das unschuldige Kind", "Der rachsüchtige Prinz", "Die Wissenschaftlerin",
];

const MATCH_CUT_TRIGGERS = [
  "ein fallendes Schwert",
  "ein zerspringender Kristall",
  "ein letzter Atemzug",
  "ein aufleuchtendes Signal",
  "ein zerspringendes Fenster",
  "ein erlösender Gongschlag",
  "ein fallender Tropfen Blut",
  "ein letzter Blick in die Ferne",
];

const TRANSITION_TEMPLATES = [
  "{trigger} – Schnitt – {targetStrand}: {targetAction}",
  "{trigger} klirrte zu Boden – Schnitt – In {targetLocation} {targetAction}",
  "Mit dem Klang von {trigger} – harter Schnitt – {targetStrand}: {targetAction}",
  "{trigger} durchbrach die Stille – Schnitt – {targetStrand} {targetAction}",
  "Ein letzter {trigger} – Blitzschnitt – {targetLocation}, wo {targetAction}",
];

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createParallelClimax(
  name: string,
  strandCount: number = 3,
  seed: number = 42
): SyncProfile {
  const rng = createSeededRandom(hashString(name + seed));
  const count = Math.min(Math.max(strandCount, 2), 4);
  const labels = shuffleArray([...STRAND_LABELS], rng).slice(0, count);
  
  const strands: PlotStrand[] = labels.map((label, i) => {
    const strandRng = createSeededRandom(hashString(name + label + seed + i));
    const location = pickRandom(LOCATIONS, strandRng);
    const characters = shuffleArray([...CHARACTER_ARCHETYPES], strandRng).slice(0, 2 + Math.floor(strandRng() * 2));
    
    // Erstelle Beats für jeden Strang
    const beats: StrandBeat[] = BEAT_TYPES.map((beatType, beatIndex) => {
      const tensionCurve = [2, 4, 7, 9, 10, 3]; // dramaturgische Kurve
      const timestamp = (beatIndex / (BEAT_TYPES.length - 1)) * 100;
      
      return {
        act: beatIndex + 1,
        beatType,
        description: `${beatType.charAt(0).toUpperCase() + beatType.slice(1)} in ${location}`,
        tension: tensionCurve[beatIndex] + Math.floor(strandRng() * 3) - 1,
        timestamp,
      };
    });
    
    // Verschiebe Timestamps leicht für jeden Strang
    const offset = (strandRng() - 0.5) * 10;
    beats.forEach(b => { b.timestamp = Math.max(0, Math.min(100, b.timestamp + offset)); });
    
    return { label, name: `Strang ${label}: ${location}`, location, characters, beats };
  });
  
  // Globale Klimax: Durchschnitt aller Strang-Klimax-Zeitpunkte
  const climaxBeats = strands.flatMap(s => s.beats.filter(b => b.beatType === "climax"));
  const globalClimaxTimestamp = climaxBeats.reduce((sum, b) => sum + b.timestamp, 0) / climaxBeats.length;
  
  // Generiere Match-Cuts zwischen den Strängen
  const matchCuts: MatchCut[] = [];
  for (let i = 0; i < count - 1; i++) {
    const fromLabel = labels[i];
    const toLabel = labels[i + 1];
    const _fromStrand = strands.find(s => s.label === fromLabel)!;
    const toStrand = strands.find(s => s.label === toLabel)!;
    const cutRng = createSeededRandom(hashString(name + "cut" + i + seed));
    
    const trigger = pickRandom(MATCH_CUT_TRIGGERS, cutRng);
    const template = pickRandom(TRANSITION_TEMPLATES, cutRng);
    const targetAction = toStrand.beats.find(b => b.beatType === "climax")?.description || "der Showdown beginnt";
    const targetLocation = toStrand.location;
    
    const transitionText = template
      .replace("{trigger}", trigger)
      .replace("{targetStrand}", `Strang ${toLabel}`)
      .replace("{targetLocation}", targetLocation)
      .replace("{targetAction}", targetAction);
    
    // Zeitpunkt kurz vor globaler Klimax
    const timestamp = globalClimaxTimestamp - 5 - cutRng() * 10;
    
    matchCuts.push({
      fromStrand: fromLabel,
      toStrand: toLabel,
      trigger,
      transitionText,
      timestamp: Math.max(0, timestamp),
    });
  }
  
  // Finaler Match-Cut zum letzten Strang (falls > 2)
  if (count > 2) {
    const cutRng = createSeededRandom(hashString(name + "cut" + "final" + seed));
    const trigger = pickRandom(MATCH_CUT_TRIGGERS, cutRng);
    const template = pickRandom(TRANSITION_TEMPLATES, cutRng);
    const toStrand = strands.find(s => s.label === labels[labels.length - 1])!;
    
    matchCuts.push({
      fromStrand: labels[0],
      toStrand: labels[labels.length - 1],
      trigger,
      transitionText: template
        .replace("{trigger}", trigger)
        .replace("{targetStrand}", `Strang ${labels[labels.length - 1]}`)
        .replace("{targetLocation}", toStrand.location)
        .replace("{targetAction}", "das Finale beginnt"),
      timestamp: globalClimaxTimestamp - 2,
    });
  }
  
  return {
    id: `SYNC-${hashString(name + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    strands,
    globalClimaxTimestamp: Math.round(globalClimaxTimestamp),
    matchCuts,
    seed,
  };
}

export function formatSyncProfile(profile: SyncProfile): string {
  const lines = [
    `🎬 PARALLELER KLIMAX-SYNCHRONIZER: ${profile.name}`,
    `ID: ${profile.id} | Stränge: ${profile.strands.length} | Globale Klimax: ${profile.globalClimaxTimestamp}%`,
    `Match-Cuts: ${profile.matchCuts.length}`,
    "",
  ];
  
  for (const strand of profile.strands) {
    lines.push(`📍 STRANG ${strand.label}: ${strand.name}`);
    lines.push(`   Ort: ${strand.location} | Figuren: ${strand.characters.join(", ")}`);
    for (const beat of strand.beats) {
      const tensionBar = "█".repeat(Math.round(beat.tension / 2));
      lines.push(`   Akt ${beat.act} (${beat.timestamp}%): ${beat.beatType.toUpperCase()} [${tensionBar}] ${beat.description}`);
    }
    lines.push("");
  }
  
  lines.push("✂️ MATCH-CUTS:");
  for (const cut of profile.matchCuts) {
    lines.push(`  ${cut.timestamp.toFixed(1)}% | ${cut.fromStrand} → ${cut.toStrand}`);
    lines.push(`    Trigger: "${cut.trigger}"`);
    lines.push(`    Übergang: "${cut.transitionText}"`);
    lines.push("");
  }
  
  return lines.join("\n");
}

export function createSampleProfile(): SyncProfile {
  return createParallelClimax("Die Schlacht um Eldoria", 3, 42);
}

export function createSampleMatchCut(): MatchCut {
  return {
    fromStrand: "A",
    toStrand: "B",
    trigger: "ein fallendes Schwert",
    transitionText: "Ein fallendes Schwert – Schnitt – Strang B: der Showdown beginnt",
    timestamp: 85.5,
  };
}