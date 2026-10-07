// ChoralHymnSynthesizer (WP 92.2)
// Schlachtruf-, Choral- & Hymnen-Synthesizer.
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

export type HymnType = "battle" | "march" | "funeral" | "victory" | "antiphonal" | "liturgical";

export interface HymnLine {
  soloist: string;
  choir: string;
  measure: number;
}

export interface HymnProfile {
  id: string;
  name: string;
  type: HymnType;
  mode: "dorian" | "aeolian" | "phrygian" | "mixolydian" | "ionian";
  bpm: number; // Marschtempo
  timeSignature: "4/4" | "3/4" | "2/4" | "6/8";
  lines: HymnLine[];
  seed: number;
}

export interface AudioPreview {
  soloistFreq: number[];
  choirFreq: number[];
  duration: number;
}

const MODES = ["dorian", "aeolian", "phrygian", "mixolydian", "ionian"] as const;

const BATTLE_SOLOIST = [
  "Wer hält die Furt, wenn der Wall zerbricht?",
  "Wer steht im Feuer, wenn der Stahl erklingt?",
  "Wessen Banner weht, wenn die Nacht hereinbricht?",
  "Wer trägt das Schwert, das die Dunkelheit durchbricht?",
  "Wer ruft den Namen, den der Feind nicht kennt?",
];

const BATTLE_CHOIR = [
  "Unser Stahl und das ewige Licht!",
  "Unser Blut für das heilige Recht!",
  "Unser Mut zerbricht jedes Leid!",
  "Vorwärts, Brüder, in die Schlacht!",
  "Für Ehre, Heimat, ewige Macht!",
];

const MARCH_SOLOIST = [
  "Schritt für Schritt, der Weg ist lang.",
  "Der Staub bedeckt den schweren Tritt.",
  "Die Sonne brennt, der Schatten kühlt.",
  "Ein Lied auf den Lippen, ein Ziel im Blick.",
];

const MARCH_CHOIR = [
  "Links, zwei, drei, vier – vorwärts marsch!",
  "Ein Herz, ein Schritt, ein ewiger Bogen!",
  "Nicht müde, nicht matt, bis das Ziel erreicht!",
  "Für das Banner, das nie verweht!",
];

const FUNERAL_SOLOIST = [
  "Hier ruht, der das Schwert nie senkte.",
  "Das Licht erlischt, die Tat bleibt.",
  "Ein Name in Stein, ein Atem im Wind.",
];

const FUNERAL_CHOIR = [
  "Ewige Ruh, ewiger Frieden.",
  "Sein Name lebt in unseren Reihen.",
  "Der Herr segne seinen Weg.",
];

const VICTORY_SOLOIST = [
  "Der Feind ist gefallen, die Furt ist frei.",
  "Die Krone glänzt auf dem Haupt des Siegers.",
  "Die Tore öffnen sich, das Volk jubelt.",
];

const VICTORY_CHOIR = [
  "Sieg! Sieg! Unser Banner weht!",
  "Ehre den Helden, Ruhm den Tapferen!",
  "Das Lied des Sieges hallt ewig wider!",
];

const ANTIPHONAL_SOLOIST = [
  "Wer wacht am Tor der Ewigkeit?",
  "Wer hütet das Feuer, das nie erlischt?",
  "Wer trägt das Kreuz in die Finsternis?",
];

const ANTIPHONAL_CHOIR = [
  "Wir wachen! Wir hüten! Wir tragen!",
  "Unser Glaube ist Stahl, unser Mut ist Flamme!",
  "Für immer und ewig – Amen!",
];

const LITURGICAL_SOLOIST = [
  "Herr, segne unsere Klingen und Schilde.",
  "Gib uns Weisheit im Angesicht des Todes.",
  "Führe uns durch das Tal des Schattens.",
];

const LITURGICAL_CHOIR = [
  "Kyrie eleison, Christe eleison.",
  "Dein Wille geschehe, jetzt und allezeit.",
  "Amen. Amen. Amen.",
];

const SOLOIST_MAP: Record<HymnType, string[]> = {
  battle: BATTLE_SOLOIST,
  march: MARCH_SOLOIST,
  funeral: FUNERAL_SOLOIST,
  victory: VICTORY_SOLOIST,
  antiphonal: ANTIPHONAL_SOLOIST,
  liturgical: LITURGICAL_SOLOIST,
};

const CHOIR_MAP: Record<HymnType, string[]> = {
  battle: BATTLE_CHOIR,
  march: MARCH_CHOIR,
  funeral: FUNERAL_CHOIR,
  victory: VICTORY_CHOIR,
  antiphonal: ANTIPHONAL_CHOIR,
  liturgical: LITURGICAL_CHOIR,
};

const TYPE_LABELS: Record<HymnType, string> = {
  battle: "⚔️ Schlachthymne",
  march: "🥁 Marschlied",
  funeral: "⚰️ Trauergesang",
  victory: "🏆 Siegeshymne",
  antiphonal: "🎵 Antiphonaler Wechselgesang",
  liturgical: "⛪ Liturgischer Choral",
};

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createHymnProfile(name: string, type: HymnType, seed: number = 42): HymnProfile {
  const rng = createSeededRandom(hashString(name + type + seed));
  const mode = pickRandom(MODES, rng) as "dorian" | "aeolian" | "phrygian" | "mixolydian" | "ionian";
  
  const bpmRange: Record<HymnType, [number, number]> = {
    battle: [100, 140],
    march: [110, 130],
    funeral: [50, 70],
    victory: [90, 120],
    antiphonal: [70, 100],
    liturgical: [60, 80],
  };
  const [minBpm, maxBpm] = bpmRange[type];
  const bpm = minBpm + Math.floor(rng() * (maxBpm - minBpm + 1));
  
  const timeSigs: Record<HymnType, "4/4" | "3/4" | "2/4" | "6/8"> = {
    battle: "4/4",
    march: "2/4",
    funeral: "3/4",
    victory: "4/4",
    antiphonal: "4/4",
    liturgical: "3/4",
  };
  
  const soloistLines = SOLOIST_MAP[type];
  const choirLines = CHOIR_MAP[type];
  const lineCount = 4 + Math.floor(rng() * 4); // 4-7 lines
  
  const lines: HymnLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push({
      soloist: pickRandom(soloistLines, rng),
      choir: pickRandom(choirLines, rng),
      measure: i + 1,
    });
  }
  
  return {
    id: `HYMN-${hashString(name + type + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    type,
    mode,
    bpm,
    timeSignature: timeSigs[type],
    lines,
    seed,
  };
}

export function generateAudioPreview(profile: HymnProfile): AudioPreview {
  // Berechne Frequenzen basierend auf Modus und BPM
  const baseFreq = profile.mode === "dorian" ? 293.66 : // D4
                   profile.mode === "aeolian" ? 329.63 : // E4
                   profile.mode === "phrygian" ? 261.63 : // C4
                   profile.mode === "mixolydian" ? 349.23 : // F4
                   392.00; // G4 ionian
  
  const soloistFreq = profile.lines.map((_, i) => baseFreq * Math.pow(2, (i % 3) / 12));
  const choirFreq = profile.lines.map((_, i) => baseFreq * 0.5 * Math.pow(2, (i % 4) / 12));
  const duration = (60 / profile.bpm) * profile.lines.length * 4; // Sekunden
  
  return { soloistFreq, choirFreq, duration };
}

export function formatHymnProfile(profile: HymnProfile): string {
  const typeLabel = TYPE_LABELS[profile.type];
  return [
    `🎵 CHORAL-HYMNEN PROFIL: ${profile.name}`,
    `ID: ${profile.id} | Typ: ${typeLabel} | Modus: ${profile.mode} | ${profile.bpm} BPM | ${profile.timeSignature}`,
    `Zeilen: ${profile.lines.length}`,
    "",
    ...profile.lines.map(l => 
      `Takt ${l.measure.toString().padStart(2)} | 🎤 ${l.soloist} | 🎭 ${l.choir}`
    ),
    "",
    `🎵 AUDIO-VORSCHAU: Soloist ${profile.lines.length} Töne, Chor ${profile.lines.length} Töne`,
  ].join("\n");
}

export function createSampleProfile(): HymnProfile {
  return createHymnProfile("Eiserner Marsch", "march", 42);
}

export function createSampleAntiphonal(): HymnProfile {
  return createHymnProfile("Wache der Ewigkeit", "antiphonal", 123);
}