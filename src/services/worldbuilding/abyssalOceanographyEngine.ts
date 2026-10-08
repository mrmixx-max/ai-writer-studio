// AbyssalOceanographyEngine (WP 109.1)
// Tiefsee-Ozeanografie & Abyssale Zonen.
// Pelagiale Tiefenstufen, Biolumineszenz-Spektrum, klaustrophobische Tiefsee-Prosa.
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

export type PelagicZoneId = "epipelagic" | "mesopelagic" | "bathypelagic" | "abyssopelagic" | "hadopelagic";

export interface PelagicZone {
  id: PelagicZoneId;
  name: string;
  /** Tiefenbereich in Metern. */
  minDepthMeters: number;
  maxDepthMeters: number;
  /** Lichtdurchlässigkeit in Prozent der Oberflächenhelligkeit. */
  lightPercent: number;
  /** Wassertemperatur in Grad Celsius. */
  temperatureC: number;
  description: string;
}

/** Pelagiale Tiefenstufen — von der Sonnenzone bis zum Tiefseegraben. */
export const PELAGIC_ZONES: PelagicZone[] = [
  { id: "epipelagic", name: "Epipelagial (Sonnenzone)", minDepthMeters: 0, maxDepthMeters: 200, lightPercent: 100, temperatureC: 20, description: "Photosynthese möglich, wärmstes Wasser, reichste Biomasse." },
  { id: "mesopelagic", name: "Mesopelagial (Dämmerzone)", minDepthMeters: 200, maxDepthMeters: 1000, lightPercent: 1, temperatureC: 8, description: "Restlicht ausreicht kaum zum Sehen; erste Leuchtorganismen." },
  { id: "bathypelagic", name: "Bathypelagial (Tiefsee)", minDepthMeters: 1000, maxDepthMeters: 4000, lightPercent: 0, temperatureC: 4, description: "Völlige Finsternis, nur Biolumineszenz erhellt die Tiefe." },
  { id: "abyssopelagic", name: "Abyssopelagial (Abgrund)", minDepthMeters: 4000, maxDepthMeters: 6000, lightPercent: 0, temperatureC: 2, description: "Tonnen von Druck, nahezu gefrorenes Wasser, karge Flora." },
  { id: "hadopelagic", name: "Hadopelagial (Tiefseegraben)", minDepthMeters: 6000, maxDepthMeters: 11000, lightPercent: 0, temperatureC: 1.5, description: "Grabenwasser unter enormem Druck, hydrothermale Schlote, Extremophilen." },
];

export function getPelagicZone(id: PelagicZoneId): PelagicZone | undefined {
  return PELAGIC_ZONES.find((z) => z.id === id);
}

/** Bestimmt die pelagiale Zone anhand der Tiefe. */
export function zoneForDepth(depthMeters: number): PelagicZone {
  const d = Math.max(0, depthMeters);
  for (const zone of PELAGIC_ZONES) {
    if (d >= zone.minDepthMeters && d < zone.maxDepthMeters) return zone;
  }
  return PELAGIC_ZONES[PELAGIC_ZONES.length - 1];
}

/** Wassertiefe in Metern, Wasserdichte 1025 kg/m³ (Salzwasser), Erdbeschleunigung 9,81 m/s². */
export const SEAWATER_DENSITY = 1025;
export const GRAVITY = 9.81;

/** Hydrostatischer Druck in Bar (1 Bar = 100.000 Pa) plus 1,013 Bar Luftdruck an der Oberfläche. */
export function hydrostaticPressureBar(depthMeters: number): number {
  const depth = Math.max(0, depthMeters);
  const pascals = SEAWATER_DENSITY * GRAVITY * depth;
  const bar = pascals / 100000;
  return Math.round((bar + 1.013) * 100) / 100;
}

/** Lichtdämpfung: exponentielle Extinktion mit Koeffizient 0,04 / m. */
export function lightAtDepthPercent(depthMeters: number): number {
  const depth = Math.max(0, depthMeters);
  const percent = 100 * Math.exp(-0.04 * depth);
  return Math.round(percent * 10000) / 10000;
}

export interface DepthReading {
  depthMeters: number;
  zone: PelagicZone;
  pressureBar: number;
  lightPercent: number;
  temperatureC: number;
  /** true, wenn ein Mensch ohne Druckkörper sofort stirbt. */
  lethalWithoutHull: boolean;
}

export function readDepth(depthMeters: number): DepthReading {
  const depth = Math.max(0, depthMeters);
  const zone = zoneForDepth(depth);
  const pressureBar = hydrostaticPressureBar(depth);
  return {
    depthMeters: depth,
    zone,
    pressureBar,
    lightPercent: lightAtDepthPercent(depth),
    temperatureC: zone.temperatureC,
    // Über ~50 m Wassertiefe ist freies Tauchen tödlich (Druck > 6 Bar).
    lethalWithoutHull: pressureBar > 6,
  };
}

export interface BioluminescenceOrganism {
  name: string;
  /** Lichtfarbe als beschreibender Name (keine Hex-Werte). */
  colorName: string;
  /** Wellenlänge in Nanometern. */
  wavelengthNm: number;
  mechanism: string;
  zone: PelagicZoneId;
}

export const BIOLUMINESCENT_ORGANISMS: BioluminescenceOrganism[] = [
  { name: "Leuchtbakterien-Kolonie", colorName: "grünblau", wavelengthNm: 490, mechanism: "Symbiose in Leuchtorganen — Dauerlicht ohne Energieaufwand des Wirts.", zone: "mesopelagic" },
  { name: "Staatsqualle", colorName: "schimmernd-blaßblau", wavelengthNm: 470, mechanism: "Ketten aus Einzeltieren, die bei Berührung in Wellen aufleuchten.", zone: "bathypelagic" },
  { name: "Anglerfisch-Lockköder", colorName: "kaltblau", wavelengthNm: 480, mechanism: "Leuchtorgan an der Stirnlocke, das Beute anzieht.", zone: "bathypelagic" },
  { name: "Tiefsee-Garnele", colorName: "violettrot", wavelengthNm: 430, mechanism: "Ausstoß leuchtender Wolken zur Tarnung vor Fressfeinden.", zone: "mesopelagic" },
  { name: "Vampirtintenfisch", colorName: "tiefrot", wavelengthNm: 700, mechanism: "Photophoren an den Armspitzen, die im Rotlicht Beute blenden.", zone: "bathypelagic" },
  { name: "Graben-Medesuse", colorName: "grellblau", wavelengthNm: 460, mechanism: "Schock-Leuchten im Hadal — lockt und schreckt zugleich.", zone: "hadopelagic" },
];

export function getBioluminescenceForZone(zoneId: PelagicZoneId): BioluminescenceOrganism[] {
  return BIOLUMINESCENT_ORGANISMS.filter((o) => o.zone === zoneId);
}

export interface BioluminescenceSpectrum {
  zone: PelagicZoneId;
  organisms: BioluminescenceOrganism[];
  dominantWavelengthNm: number;
  /** Beschreibung des Spektrums für den Leser. */
  description: string;
}

export function generateBioluminescenceSpectrum(zoneId: PelagicZoneId, seed: number = 42): BioluminescenceSpectrum {
  const organisms = getBioluminescenceForZone(zoneId);
  if (organisms.length === 0) {
    return {
      zone: zoneId,
      organisms: [],
      dominantWavelengthNm: 0,
      description: "Keine Leuchtorganismen in dieser Tiefe — nur die Schwärze selbst.",
    };
  }
  const rng = createSeededRandom(hashString(`spectrum:${zoneId}:${seed}`));
  const dominant = pick(organisms, rng);
  const description = `${organisms.length} Leuchtarten, vorherrschend ${dominant.colorName} bei ${dominant.wavelengthNm} nm. ${dominant.mechanism}`;
  return { zone: zoneId, organisms, dominantWavelengthNm: dominant.wavelengthNm, description };
}

export interface AbyssalPassage {
  depthMeters: number;
  text: string;
  pressureBar: number;
}

const HULL_IMAGES = [
  "Die Rumpfwände knarrten, als presse eine Faust von außen gegen jede Planke.",
  "Ein Knall fuhr durch den Stahl wie ein Peitschenhieb, und eine Niete sprang.",
  "Das Schiff ächzte unter Tonnen von Wasser, die es nicht mehr losließ.",
  "Irgendwo tief in der Wand sang Metall, hoch und klagend, ehe es verstummte.",
  "Ein Riss zog sich über die Schottwand, fein wie ein Haar und tödlich wie eine Klinge.",
  "Der Druck legte sich auf die Bullaugen, und das Glas bog sich nach innen.",
  "Jede Schweißnaht pochte, als atme der Rumpf gegen das Gewicht der Tiefe an.",
];

export function generateAbyssalPassage(depthMeters: number, imageCount: number = 3, seed: number = 42): AbyssalPassage {
  const depth = Math.max(0, depthMeters);
  const pressureBar = hydrostaticPressureBar(depth);
  const rng = createSeededRandom(hashString(`abyss:${Math.round(depth)}:${seed}`));
  const total = Math.max(1, Math.min(imageCount, HULL_IMAGES.length));
  const used: string[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (used.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * HULL_IMAGES.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    used.push(HULL_IMAGES[idx]);
  }
  const intro = `Bei ${Math.round(depth)} Metern lasten ${pressureBar} Bar auf jeder Quadratfläche.`;
  return { depthMeters: depth, text: `${intro} ${used.join(" ")}`, pressureBar };
}

export interface OceanProfile {
  id: string;
  readings: DepthReading[];
  deepestZone: PelagicZone;
  maxPressureBar: number;
  spectra: BioluminescenceSpectrum[];
}

export function analyzeOceanProfile(depths: number[], seed: number = 42): OceanProfile {
  const list = depths.length > 0 ? depths : [50, 400, 2000, 5000, 8000];
  const readings = list.map((d) => readDepth(d));
  const deepestZone = readings.reduce((max, r) => (r.zone.maxDepthMeters > max.maxDepthMeters ? r.zone : max), readings[0].zone);
  const maxPressureBar = readings.reduce((m, r) => Math.max(m, r.pressureBar), 0);
  const zoneIds = [...new Set(readings.map((r) => r.zone.id))];
  const spectra = zoneIds.map((z, i) => generateBioluminescenceSpectrum(z, seed + i));
  return {
    id: `OCEAN-${hashString(list.join(",") + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    readings,
    deepestZone,
    maxPressureBar,
    spectra,
  };
}

export function createSampleDepthReading(): DepthReading {
  return readDepth(4000);
}

export function createSampleOceanProfile(): OceanProfile {
  return analyzeOceanProfile([50, 400, 2000, 5000, 8000], 42);
}
