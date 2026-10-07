// LoreArchaeologyEngine (WP 86.1)
// Narrative Lore-Archäologie & Schichten-Generator.
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

export type EraName = string;

export interface Era {
  name: EraName;
  startYear: number;
  endYear: number;
  culture: string;
  techLevel: "primitiv" | "antik" | "mittelalterlich" | "renaissance" | "industriell" | "modern" | "postapokalyptisch";
  signatureMaterials: string[];
  typicalStructures: string[];
  scriptStyle: string;
}

export interface StratigraphyLayer {
  era: EraName;
  depth: number;
  thickness: number;
  artifacts: string[];
  structures: string[];
  inscriptions: string[];
  preservation: "intakt" | "verwittert" | "fragmentarisch" | "verschüttet";
}

export interface ArchaeologicalSite {
  id: string;
  name: string;
  location: { x: number; y: number };
  layers: StratigraphyLayer[];
  currentEra: EraName;
  dominantCulture: string;
  mysteryLevel: number;
}

export interface Artifact {
  id: string;
  name: string;
  era: EraName;
  type: "waffe" | "werkzeug" | "schmuck" | "schrifttafel" | "keramik" | "bauwerk" | "relikt";
  material: string;
  condition: "neuwertig" | "gebraucht" | "beschädigt" | "stark verwittert" | "fragment";
  inscriptions: string[];
  repurposedFrom?: string;
  repurposedTo?: string;
}

export interface DecipheredText {
  original: string;
  reconstructed: string;
  confidence: number;
  gaps: { start: number; end: number; suggestion: string }[];
  language: string;
  script: string;
}

const DEFAULT_ERAS: Era[] = [
  { name: "Bronzezeitliche Götter-Ära", startYear: -3000, endYear: -2000, culture: "Ur-Elfen", techLevel: "antik", signatureMaterials: ["Bronze", "Meteoreisen", "Verzauberter Stein"], typicalStructures: ["Zikkurate", "Sternwarten", "Tempelanlagen"], scriptStyle: "Keilschrift mit Sternsymbolen" },
  { name: "Goldenes Kaiserreich", startYear: -1999, endYear: -500, culture: "Hochmenschen", techLevel: "mittelalterlich", signatureMaterials: ["Goldlegierung", "Weißer Marmor", "Glasstahl"], typicalStructures: ["Paläste", "Aquädukte", "Bibliotheken"], scriptStyle: "Elegante Serifenschrift" },
  { name: "Glas-Kataklysmus", startYear: -499, endYear: 0, culture: "Überlebende", techLevel: "postapokalyptisch", signatureMaterials: ["Obsidian", "Vulkanisches Glas", "Verstrahltes Metall"], typicalStructures: ["Unterirdische Bunker", "Glasierte Ruinen", "Warnsteine"], scriptStyle: "Kratzige Notizen in Asche" },
  { name: "Feudale Gegenwart", startYear: 1, endYear: 1500, culture: "Menschenreiche", techLevel: "mittelalterlich", signatureMaterials: ["Eisen", "Eiche", "Lehm"], typicalStructures: ["Burgen", "Dörfer", "Klöster"], scriptStyle: "Gotische Minuskel" },
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

export function generateEras(seed: number, customEras?: Era[]): Era[] {
  const rng = createSeededRandom(seed);
  const eras = customEras && customEras.length > 0 ? customEras : DEFAULT_ERAS;
  return shuffleArray(eras, rng).map((e, i) => ({ ...e, startYear: e.startYear + Math.floor(rng() * 50) - 25 }));
}

export function createStratigraphy(siteName: string, seed: number, eras: Era[] = DEFAULT_ERAS): StratigraphyLayer[] {
  const rng = createSeededRandom(hashString(siteName + seed));
  const layers: StratigraphyLayer[] = [];
  let currentDepth = 0;

  for (const era of eras) {
    const thickness = 0.5 + rng() * 3;
    const preservationRoll = rng();
    let preservation: StratigraphyLayer["preservation"];
    if (preservationRoll < 0.2) preservation = "intakt";
    else if (preservationRoll < 0.5) preservation = "verwittert";
    else if (preservationRoll < 0.8) preservation = "fragmentarisch";
    else preservation = "verschüttet";

    const artifactCount = Math.floor(rng() * 4) + 1;
    const artifacts = shuffleArray([
      "Zeremonialdolch", "Siegelring", "Tontafel", "Münze", "Perlenkette", "Pfeilspitze",
      "Webgewicht", "Räuchergefäß", "Spiegel", "Amulett"
    ], rng).slice(0, artifactCount);

    const structureCount = Math.floor(rng() * 3) + 1;
    const structures = shuffleArray(era.typicalStructures, rng).slice(0, structureCount);

    const inscriptionCount = Math.floor(rng() * 3);
    const inscriptions = [];
    for (let i = 0; i < inscriptionCount; i++) {
      const templates = [
        "Herrscher {name} errichtete dies im Jahr {year}",
        "Möge {gott} diesen Ort segnen",
        "Grenze des {reich} — Eindringlinge sterben",
        "Opfer für {göttin}: {gabe}",
        "Hier ruht {held}, Bezwinger von {feind}",
      ];
      let text = pickRandom(templates, rng);
      text = text.replace("{name}", pickRandom(["Aelindor", "Tharion", "Malakor", "Veshra", "Kaelith"], rng));
      text = text.replace("{year}", String(Math.floor(rng() * 5000) - 3000));
      text = text.replace("{gott}", pickRandom(["Solaris", "Lunara", "Ignis", "Aqua", "Terra"], rng));
      text = text.replace("{reich}", pickRandom(["Sonnenreich", "Mondkönigreich", "Feuerlande", "Meeresdomäne"], rng));
      text = text.replace("{göttin}", pickRandom(["Aphria", "Selene", "Hestia", "Nympha"], rng));
      text = text.replace("{gabe}", pickRandom(["Wein", "Blut", "Räucherwerk", "Gold", "Ernte"], rng));
      text = text.replace("{held}", pickRandom(["Kaldor", "Mireille", "Thorne", "Elara", "Varian"], rng));
      text = text.replace("{feind}", pickRandom(["den Schattenfürsten", "die Ork-Horden", "den Drachen", "die Pest"], rng));
      inscriptions.push(text);
    }

    layers.push({
      era: era.name,
      depth: currentDepth,
      thickness,
      artifacts,
      structures,
      inscriptions,
      preservation,
    });
    currentDepth += thickness;
  }
  return layers;
}

export function createArchaeologicalSite(name: string, seed: number, x: number, y: number): ArchaeologicalSite {
  const rng = createSeededRandom(hashString(name + seed + x + y));
  const eras = generateEras(seed);
  const layers = createStratigraphy(name, seed, eras);
  const currentEra = eras[eras.length - 1].name;
  const dominantCulture = eras[0].culture;

  return {
    id: `site-${hashString(name + seed).toString(16).padStart(8, "0")}`,
    name,
    location: { x, y },
    layers,
    currentEra,
    dominantCulture,
    mysteryLevel: Math.floor(rng() * 100),
  };
}

export function generateArtifact(siteName: string, seed: number, layerIndex: number): Artifact {
  const rng = createSeededRandom(hashString(siteName + seed + layerIndex));
  const eras = generateEras(seed);
  const era = eras[layerIndex % eras.length];
  const types: Artifact["type"][] = ["waffe", "werkzeug", "schmuck", "schrifttafel", "keramik", "bauwerk", "relikt"];
  const materials = era.signatureMaterials;
  const conditions: Artifact["condition"][] = ["neuwertig", "gebraucht", "beschädigt", "stark verwittert", "fragment"];

  const repurposedRoll = rng();
  let repurposedFrom: string | undefined;
  let repurposedTo: string | undefined;
  if (repurposedRoll < 0.3) {
    repurposedFrom = pickRandom(["Ursprünglicher Tempelaltar", "Königliche Krone", "Priesterstab", "Kriegsstandarte"], rng);
    repurposedTo = pickRandom(["Banditen-Festungstor", "Bauern-Pflugschar", "Händler-Waage", "Diebes-Werkzeug"], rng);
  }

  return {
    id: `art-${hashString(siteName + seed + layerIndex).toString(16).padStart(8, "0")}`,
    name: pickRandom(["Klinge der Ahnen", "Trinkhorn des Häuptlings", "Siegel der Ersten", "Amulett des Schutzes", "Tafel der Gesetze"], rng),
    era: era.name,
    type: pickRandom(types, rng),
    material: pickRandom(materials, rng),
    condition: pickRandom(conditions, rng),
    inscriptions: [],
    repurposedFrom,
    repurposedTo,
  };
}

export function decipherInscription(text: string, seed: number, language: string = "Alt-Elfisch"): DecipheredText {
  const rng = createSeededRandom(hashString(text + seed));
  const chars = text.split("");
  const gaps: DecipheredText["gaps"] = [];
  let reconstructed = "";
  let gapStart = -1;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === "[" || char === "?" || char === "�" || rng() < 0.15) {
      if (gapStart === -1) gapStart = i;
      reconstructed += "[...]";
    } else {
      if (gapStart !== -1) {
        gaps.push({ start: gapStart, end: i - 1, suggestion: pickRandom(["König", "Tempel", "Gott", "Jahr", "Name"], rng) });
        gapStart = -1;
      }
      reconstructed += char;
    }
  }
  if (gapStart !== -1) {
    gaps.push({ start: gapStart, end: chars.length - 1, suggestion: pickRandom(["Ende", "Segen", "Fluch", "Warnung"], rng) });
  }

  const confidence = Math.max(0.1, 1 - gaps.length * 0.15 - rng() * 0.2);

  return {
    original: text,
    reconstructed,
    confidence: Math.round(confidence * 100) / 100,
    gaps,
    language,
    script: "Runen/Keilschrift",
  };
}

export function createSampleSite(): ArchaeologicalSite {
  return createArchaeologicalSite("Ruinen von Aelindor", 42, 1250, 3400);
}

export function createSampleArtifact(): Artifact {
  return generateArtifact("Ruinen von Aelindor", 42, 1);
}

export function createSampleDeciphering(): DecipheredText {
  return decipherInscription("[König] Aelindor errichtete [dies] im Jahr [-2847] zum [Lobe] von [Solaris]", 42);
}