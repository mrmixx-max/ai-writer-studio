// MythicBeastAnatomy (WP 98.2)
// Mythologisches Bestiarium & Anatomie-Studio.
// Biologische Adaption, mittelalterliche Bestiarien-Moral, Naturforscher-Tagebuch.
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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type HabitatId =
  | "deepSea"
  | "highMountain"
  | "subterranean"
  | "primevalForest"
  | "desert"
  | "volcanic";

export interface Habitat {
  id: HabitatId;
  name: string;
  pressure: string;
  light: string;
  temperature: string;
}

export const HABITATS: Habitat[] = [
  { id: "deepSea", name: "Tiefsee", pressure: "enorm", light: "kein Sonnenlicht", temperature: "eiskalt" },
  { id: "highMountain", name: "Hochgebirge", pressure: "dünn", light: "grell", temperature: "frostig" },
  { id: "subterranean", name: "Unterwelt/Höhlen", pressure: "gleichmäßig", light: "völlige Finsternis", temperature: "kühl-feucht" },
  { id: "primevalForest", name: "Urwald", pressure: "normal", light: "gedämpft", temperature: "warm-schwül" },
  { id: "desert", name: "Wüste", pressure: "normal", light: "unerbittlich", temperature: "glühend heiß" },
  { id: "volcanic", name: "Vulkanische Zone", pressure: "schwankend", light: "Glut", temperature: "sengend" },
];

export interface SkeletalTrait {
  habitat: HabitatId;
  boneStructure: string;
  sense: string;
  diet: string;
  adaptation: string;
}

const SKELETAL_TRAITS: SkeletalTrait[] = [
  {
    habitat: "deepSea",
    boneStructure: "Knorpelgerüst statt starrem Knochen — druckfest und biegsam",
    sense: "Biolumineszenz-Leuchtköder am Kopf zur Anlockung der Beute",
    diet: "Aas und blinde Tiefseefische",
    adaptation: "Der Körper komprimiert sich, je tiefer das Tier steigt.",
  },
  {
    habitat: "highMountain",
    boneStructure: "Hohle Röhrenknochen — leicht, doch splitternd bei Sturz",
    sense: "Fernsicht bis zu fünf Meilen, scharfer Windgeruch",
    diet: "Gämse, Murmeltier, wandernde Vögel",
    adaptation: "Ein vergrößertes Herz pumpt Blut durch die dünne Höhenluft.",
  },
  {
    habitat: "subterranean",
    boneStructure: "Massiver, kurzer Schädel mit verdickten Kieferknochen",
    sense: "Echoortung durch Ultraschall-Klicks in völliger Finsternis",
    diet: "Höhleninsekten, Pilze, kleine Säuger",
    adaptation: "Atrophierte Augen, dafür ein fellartiges Tastfeld am Rumpf.",
  },
  {
    habitat: "primevalForest",
    boneStructure: "Gelenkige Wirbelsäule erlaubt das Durchschlängeln enger Wurzeln",
    sense: "Geruchssinn, der Beute über einen Tag alte Spuren verfolgt",
    diet: "Allesfresser — Früchte, Aas, lebende Beute",
    adaptation: "Tarnfarbene Haut, die sich der Rinde und dem Laub anpasst.",
  },
  {
    habitat: "desert",
    boneStructure: "Schlanker, langer Bau mit schmalen Röhrenknochen zur Wärmeabgabe",
    sense: "Wärmesinnesgruben am Kiefer nehmen Beute durch den Sand wahr",
    diet: "Kleine Nagetiere, Echsen, Insekten",
    adaptation: "Speichert Wasser im Fettschwanz und ruht den glühenden Tag über.",
  },
  {
    habitat: "volcanic",
    boneStructure: "Knochen mit metallischen Einlagerungen — hitzebeständig",
    sense: "Wahrnehmung von Erschütterungen im Gestein vor einem Ausbruch",
    diet: "Schwefelkrusten, verkohlte Pflanzen, Glut-Insekten",
    adaptation: "Eine schuppige Haut reflektiert die Hitze der Lavaströme.",
  },
];

export function getHabitat(id: HabitatId): Habitat | undefined {
  return HABITATS.find((h) => h.id === id);
}

export function getSkeletalTrait(id: HabitatId): SkeletalTrait | undefined {
  return SKELETAL_TRAITS.find((t) => t.habitat === id);
}

export interface FolkBelief {
  claim: string;
  region: string;
}

const FOLK_BELIEF_TEMPLATES = [
  "Bauern schwören, dass sein Atem Milch sauer werden lässt",
  "Die Hebammen hängen {artikel} {name} Abbild über die Wiege, damit der Säugling nicht schreit",
  "Jäger lassen eine Schale Milch am Waldrand stehen, sonst folgt {artikel} {name} ihnen bis zur Tür",
  "Man sagt, wer {artikel} {name} beim Namen ruft, verliert für sieben Jahre das Lachen",
  "Ein Zahn von {artikel} {name} unter der Schwelle hält Blitz und Feuer fern",
  "Am Vorabend des Erntefests wird {artikel} {name} dreimal der Rücken gekehrt, damit das Korn nicht fault",
  "Der Rauch von verbranntem {material} vertreibt {artikel} {name} aus den Ställen",
];

const REGIONS = ["Feldmark", "Hochtal", "Küstengau", "Waldmark", "Salzsteppe", "Grenzmark"];

function articleFor(name: string, gender: "der" | "die" | "das"): string {
  return gender === "die" ? "die" : gender === "das" ? "das" : "den";
}

export function generateFolkBeliefs(beastName: string, count: number = 4, seed: number = 42): FolkBelief[] {
  const rng = createSeededRandom(hashString("belief:" + beastName + ":" + seed));
  const gender = pick(["der", "die", "das"] as const, rng);
  const material = pick(["Wacholder", "Knoblauch", "Bibergeil", "Farnkraut", "Salbei", "Pechnelke"], rng);
  const total = Math.max(1, Math.min(count, FOLK_BELIEF_TEMPLATES.length));
  const beliefs: FolkBelief[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (beliefs.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * FOLK_BELIEF_TEMPLATES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const claim = FOLK_BELIEF_TEMPLATES[idx]
      .replace(/\{name\}/g, beastName)
      .replace(/\{artikel\}/g, articleFor(beastName, gender))
      .replace(/\{material\}/g, material);
    beliefs.push({ claim, region: pick(REGIONS, rng) });
  }
  return beliefs;
}

export interface FieldJournalEntry {
  entryNo: number;
  date: string;
  observation: string;
  measurement: string;
}

const OBSERVATIONS = [
  "Exemplar am Rand einer Lichtung, äsend und zugleich wachend — ein Widerspruch in der Haltung.",
  "Das Tier starrte über eine Stunde unbewegt; nur die Pupille folgte jedem meiner Schritte.",
  "Bei Annäherung stieß es einen Laut aus wie {laut}, tief in der Brust, kaum hörbar.",
  "Ein Junges folgte ihm auf zwanzig Schritte und wurde mit einem Schnauben verjagt.",
  "Die Spur misst {spur}; die Klauen sind rückwärts gerichtet, ohne Zweifel.",
  "Es trank nicht, sondern sog die Feuchte aus dem Boden — ich vermesse den Fleck morgen von Neuem.",
  "Im Schlaf zuckte es, als träumte es von einer Jagd, die ich niemals sehen werde.",
];

const SOUNDS = ["fernem Donner", "einer rostigen Kette", "einer Kinderstimme", "brechendem Holz", "einer Glocke"];

export function generateFieldJournal(beastName: string, count: number = 4, seed: number = 42): FieldJournalEntry[] {
  const rng = createSeededRandom(hashString("journal:" + beastName + ":" + seed));
  const total = Math.max(1, Math.min(count, OBSERVATIONS.length));
  const entries: FieldJournalEntry[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (entries.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * OBSERVATIONS.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const sound = pick(SOUNDS, rng);
    const spur = `${(12 + Math.floor(rng() * 20))} Zoll`;
    const observation = OBSERVATIONS[idx].replace(/\{laut\}/g, sound).replace(/\{spur\}/g, spur);
    const day = 1 + entries.length * 3 + Math.floor(rng() * 2);
    entries.push({
      entryNo: entries.length + 1,
      date: `Tag ${day} im Feld`,
      observation,
      measurement: `Schulterhöhe ${(3 + rng() * 3).toFixed(1)} Fuß · Gewicht ${(80 + Math.floor(rng() * 400))} Pfund`,
    });
  }
  return entries;
}

export interface MythicBeast {
  id: string;
  name: string;
  habitat: Habitat;
  skeletal: SkeletalTrait;
  folkBeliefs: FolkBelief[];
  fieldJournal: FieldJournalEntry[];
}

export function createMythicBeast(name: string, habitatId: HabitatId, seed: number = 42): MythicBeast {
  const habitat = getHabitat(habitatId) || HABITATS[0];
  const skeletal = getSkeletalTrait(habitatId) || SKELETAL_TRAITS[0];
  return {
    id: `BEAST-${hashString(name + habitatId + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    habitat,
    skeletal,
    folkBeliefs: generateFolkBeliefs(name, 4, seed),
    fieldJournal: generateFieldJournal(name, 4, seed),
  };
}

export function createSampleMythicBeast(): MythicBeast {
  return createMythicBeast("Nachtgreif", "highMountain", 42);
}
