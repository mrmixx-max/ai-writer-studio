// CrowdMurmurGenerator (WP 89.1)
// Menschenmengen-Gemurmel & Hofklatsch-Generator.
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

export type CrowdMood = "festive" | "tense" | "reverent" | "hostile" | "neutral" | "panic" | "mourning" | "celebration";

export interface CrowdLayer {
  id: string;
  name: string;
  volume: number; // 0-100%
  density: number; // Personen pro m²
  distance: "foreground" | "middleground" | "background";
  content: string[];
}

export interface CrowdMurmur {
  id: string;
  location: string;
  mood: CrowdMood;
  timeOfDay: "dawn" | "morning" | "noon" | "afternoon" | "evening" | "night";
  layers: CrowdLayer[];
  overallVolume: number;
  dominantTopic?: string;
  seed: number;
}

export interface CrowdSnippet {
  text: string;
  layer: "foreground" | "middleground" | "background";
  speaker?: string;
  mood: CrowdMood;
}

const LOCATIONS = [
  "Marktplatz", "Ballsaal", "Hafenschenke", "Kathedrale", "Thronsaal",
  "Kaserne", "Universität", "Theater", "Turnierplatz", "Kloster",
  "Markthalle", "Weinkeller", "Rathaus", "Bibliothek", "Gefängnis",
];

const _MOODS: CrowdMood[] = ["festive", "tense", "reverent", "hostile", "neutral", "panic", "mourning", "celebration"];

const TIME_OF_DAY: CrowdMurmur["timeOfDay"][] = ["dawn", "morning", "noon", "afternoon", "evening", "night"];

const FOREGROUND_SPEAKERS = [
  "Marktschreier", "Händler", "Wache", "Bettler", "Gaukler",
  "Bäcker", "Metzger", "Schmied", "Weber", "Töpfer",
];

const MIDDLEGROUND_TOPICS = {
  festive: [
    "Hast du das Feuerwerk gesehen?", "Der Wein ist ausgezeichnet dieses Jahr!",
    "Die Musik ist wunderbar!", "Endlich wieder ein Fest!", "Die Tänzer sind herrlich!",
  ],
  tense: [
    "Hast du gehört? Die Armee marschiert!", "Die Steuern wurden wieder erhöht!",
    "Man sieht sich auf der Straße nicht mehr sicher.", "Der Graf hat neue Wachen eingestellt.",
    "Es heißt, der Feind steht vor den Toren.",
  ],
  reverent: [
    "Möge der Heilige uns beschützen.", "Die Prozession war wunderschön.",
    "Betet für die Seele des Verstorbenen.", "Der Segen des Priesters war kräftig.",
    "In stiller Andacht vereint.",
  ],
  hostile: [
    "Hinaus mit dem Verräter!", "Er hat uns alle verraten!",
    "Kein Brot für Verräter!", "Man sollte ihn fortschicken!",
    "Sein Name wird verflucht sein!",
  ],
  neutral: [
    "Das Brot ist teuer diese Woche.", "Die Ernte war mittelmäßig.",
    "Der neue Schuster macht gute Arbeit.", "Wetter wird besser, hoffentlich.",
    "Hast du die neueste Nachricht gehört?",
  ],
  panic: [
    "Lauft! Das Feuer breitet sich aus!", "Die Mauer ist durchbrochen!",
    "Rettet die Kinder!", "Wo ist der Ausgang?", "Hilfe! Feuer!",
  ],
  mourning: [
    "Er war ein guter Mann.", "Die Trauerfeier war ergreifend.",
    "Sie hinterlässt eine große Lücke.", "Möge sie in Frieden ruhen.",
    "Ein großer Verlust für uns alle.",
  ],
  celebration: [
    "Auf den Sieg!", "Endlich Frieden!", "Unser Held ist zurückgekehrt!",
    "Die Krone sitzt fest!", "Es lebe der König!",
  ],
};

const BACKGROUND_SOUNDS = {
  festive: ["Lachen", "Musik", "Tanzschritte", "Glasgeklirr", "Jubel"],
  tense: ["leises Flüstern", "schnelles Atmen", "Waffengeklirr", "schwere Schritte", "unterdrücktes Husten"],
  reverent: ["Gebetsmurmeln", "Kerzenflackern", "leises Weinen", "Schritte auf Stein", "Räucherwerk"],
  hostile: ["Buhrufe", "Pfeifen", "Steinewerfen", "Wutgeschrei", "Türenschlagen"],
  neutral: ["Geplauder", "Feilschen", "Wagenrasseln", "Hufschlag", "Türknarren"],
  panic: ["Schreien", "Rennen", "Zerbrechen", "Feuerknacken", "Sirenen"],
  mourning: ["Schluchzen", "leises Beten", "Blätterrascheln", "Erdschaufeln", "Glockengeläut"],
  celebration: ["Jubelrufe", "Trommelwirbel", "Fanfaren", "Tanz", "Feuerwerk"],
};

function getMoodConfig(mood: CrowdMood) {
  const configs: Record<CrowdMood, { fgVolume: number; mgVolume: number; bgVolume: number; density: number }> = {
    festive: { fgVolume: 70, mgVolume: 60, bgVolume: 50, density: 4 },
    tense: { fgVolume: 40, mgVolume: 50, bgVolume: 60, density: 3 },
    reverent: { fgVolume: 20, mgVolume: 30, bgVolume: 40, density: 2 },
    hostile: { fgVolume: 80, mgVolume: 70, bgVolume: 60, density: 5 },
    neutral: { fgVolume: 50, mgVolume: 40, bgVolume: 30, density: 3 },
    panic: { fgVolume: 90, mgVolume: 80, bgVolume: 70, density: 6 },
    mourning: { fgVolume: 30, mgVolume: 40, bgVolume: 50, density: 2 },
    celebration: { fgVolume: 85, mgVolume: 75, bgVolume: 65, density: 5 },
  };
  return configs[mood];
}

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

export function createCrowdMurmur(location: string, mood: CrowdMood, timeOfDay: CrowdMurmur["timeOfDay"], seed: number = 42): CrowdMurmur {
  const rng = createSeededRandom(hashString(location + mood + timeOfDay + seed));
  const moodConfig = getMoodConfig(mood);
  const locationName = location || pickRandom(LOCATIONS, rng);
  const time = timeOfDay || pickRandom(TIME_OF_DAY, rng);
  
  const fgCount = 3 + Math.floor(rng() * 4);
  const mgCount = 4 + Math.floor(rng() * 3);
  const bgCount = 2 + Math.floor(rng() * 3);

  const _moodTopics = MIDDLEGROUND_TOPICS[mood] || MIDDLEGROUND_TOPICS.neutral;
  const bgSounds = BACKGROUND_SOUNDS[mood] || BACKGROUND_SOUNDS.neutral;

  const foreground: CrowdLayer = {
    id: `FG-${hashString("fg" + seed).toString(16).padStart(6, "0")}`,
    name: "Vordergrund",
    volume: moodConfig.fgVolume,
    density: moodConfig.density,
    distance: "foreground",
    content: shuffleArray([...MIDDLEGROUND_TOPICS[mood] || MIDDLEGROUND_TOPICS.neutral, ...FOREGROUND_SPEAKERS.map(s => `${s}: "Waren feil!"`)], rng).slice(0, fgCount),
  };

  const middleground: CrowdLayer = {
    id: `MG-${hashString("mg" + seed).toString(16).padStart(6, "0")}`,
    name: "Mittelgrund",
    volume: moodConfig.mgVolume,
    density: Math.max(1, moodConfig.density - 1),
    distance: "middleground",
    content: shuffleArray(MIDDLEGROUND_TOPICS[mood] || MIDDLEGROUND_TOPICS.neutral, rng).slice(0, mgCount),
  };

  const background: CrowdLayer = {
    id: `BG-${hashString("bg" + seed).toString(16).padStart(6, "0")}`,
    name: "Hintergrund",
    volume: moodConfig.bgVolume,
    density: Math.max(1, moodConfig.density - 2),
    distance: "background",
    content: shuffleArray(bgSounds, rng).slice(0, bgCount),
  };

  const allTopics = [...foreground.content, ...middleground.content];
  const dominantTopic = allTopics.length > 0 ? pickRandom(allTopics, rng) : undefined;

  return {
    id: `CROWD-${hashString(locationName + mood + time + seed).toString(16).padStart(8, "0")}`,
    location: locationName,
    mood,
    timeOfDay: time,
    layers: [foreground, middleground, background],
    overallVolume: Math.round((moodConfig.fgVolume + moodConfig.mgVolume + moodConfig.bgVolume) / 3),
    dominantTopic,
    seed,
  };
}

export function generateCrowdSnippets(murmur: CrowdMurmur, count: number = 10): CrowdSnippet[] {
  const rng = createSeededRandom(murmur.seed + 1000);
  const snippets: CrowdSnippet[] = [];
  
  const allContent = [
    ...murmur.layers[0].content.map(c => ({ text: c, layer: "foreground" as const, mood: murmur.mood })),
    ...murmur.layers[1].content.map(c => ({ text: c, layer: "middleground" as const, mood: murmur.mood })),
    ...murmur.layers[2].content.map(c => ({ text: c, layer: "background" as const, mood: murmur.mood })),
  ];
  
  const shuffled = shuffleArray(allContent, rng);
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    snippets.push({
      text: shuffled[i].text,
      layer: shuffled[i].layer,
      speaker: shuffled[i].layer === "foreground" ? "Unbekannt" : undefined,
      mood: shuffled[i].mood,
    });
  }
  
  return snippets;
}

export function formatCrowdMurmur(murmur: CrowdMurmur): string {
  const moodLabels: Record<CrowdMood, string> = {
    festive: "🎉 Festlich",
    tense: "⚡ Angespannt",
    reverent: "🙏 Ehrfürchtig",
    hostile: "😡 Feindselig",
    neutral: "😐 Neutral",
    panic: "😱 Panisch",
    mourning: "😢 Trauernd",
    celebration: "🎊 Feiernd",
  };

  const timeLabels: Record<CrowdMurmur["timeOfDay"], string> = {
    dawn: "Morgendämmerung",
    morning: "Vormittag",
    noon: "Mittag",
    afternoon: "Nachmittag",
    evening: "Abend",
    night: "Nacht",
  };

  const lines = [
    `👥 MENGENMURMEL: ${murmur.location}`,
    `Stimmung: ${moodLabels[murmur.mood]} | Zeit: ${timeLabels[murmur.timeOfDay]} | Lautstärke: ${murmur.overallVolume}%`,
    `Schichten: ${murmur.layers.length}`,
    "",
  ];

  for (const layer of murmur.layers) {
    const vol = "█".repeat(Math.round(layer.volume / 10));
    lines.push(`${layer.name} (${layer.volume}% ${vol}):`);
    layer.content.slice(0, 3).forEach(c => lines.push(`  "${c}"`));
    if (layer.content.length > 3) lines.push(`  ... und ${layer.content.length - 3} mehr`);
    lines.push("");
  }

  if (murmur.dominantTopic) {
    lines.push(`🎯 Dominantes Thema: "${murmur.dominantTopic}"`);
  }

  return lines.join("\n");
}

export function createSampleMurmur(): CrowdMurmur {
  return createCrowdMurmur("Marktplatz", "festive", "morning", 42);
}

export function createSampleSnippets(): CrowdSnippet[] {
  return generateCrowdSnippets(createSampleMurmur(), 5);
}