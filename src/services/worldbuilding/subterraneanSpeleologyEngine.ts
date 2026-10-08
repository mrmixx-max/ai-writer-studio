// SubterraneanSpeleologyEngine (WP 106.2)
// Unterirdischer Höhlen- & Speleologie-Simulator.
// 5 Untertage-Zonen, Grubengas-/Stickstoff-/Stabilitätsprüfung, Prosa für totale Dunkelheit.
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

export type CaveZoneId = "entranceCleft" | "geothermalFissure" | "subterraneanLake" | "fungalForest" | "magmaChambers";

export interface CaveZone {
  id: CaveZoneId;
  name: string;
  depthMeters: number;
  /** Grundtemperatur in Grad Celsius. */
  temperatureC: number;
  /** Ausgangs-Sauerstoffgehalt in Prozent. */
  baseOxygenPercent: number;
  /** Ausgangs-Stabilität 0..100. */
  baseStability: number;
  hazards: string[];
}

export const CAVE_ZONES: CaveZone[] = [
  {
    id: "entranceCleft",
    name: "Eingangskluft",
    depthMeters: 20,
    temperatureC: 8,
    baseOxygenPercent: 20.9,
    baseStability: 92,
    hazards: ["Steinschlag am Portal", "Zugluft mit Sand"],
  },
  {
    id: "geothermalFissure",
    name: "Geothermale Spalte",
    depthMeters: 400,
    temperatureC: 48,
    baseOxygenPercent: 19.2,
    baseStability: 74,
    hazards: ["Schwefelwasserstoff", "Dampfschläge", "Hitzeerschöpfung"],
  },
  {
    id: "subterraneanLake",
    name: "Unterirdischer Abgrundsee",
    depthMeters: 900,
    temperatureC: 6,
    baseOxygenPercent: 18.4,
    baseStability: 68,
    hazards: ["Erstickende Kälte", "Grundlosigkeit", "Kohlendioxid-Senken"],
  },
  {
    id: "fungalForest",
    name: "Biolumineszenter Pilzwald",
    depthMeters: 1500,
    temperatureC: 14,
    baseOxygenPercent: 17.6,
    baseStability: 71,
    hazards: ["Sporen-Atmung", "Bodenfallgruben", "Lichtverwirrung"],
  },
  {
    id: "magmaChambers",
    name: "Tiefe Magmakammern",
    depthMeters: 3200,
    temperatureC: 120,
    baseOxygenPercent: 15.1,
    baseStability: 42,
    hazards: ["Schlagwetter-Explosion", "Hitzekollaps", "Sofortiger Einsturz"],
  },
];

export function getCaveZone(id: CaveZoneId): CaveZone | undefined {
  return CAVE_ZONES.find((z) => z.id === id);
}

export interface GasReading {
  zone: CaveZoneId;
  /** Methan in Volumenprozent (Schlagwetter ab 4 %). */
  methanePercent: number;
  /** Kohlendioxid in Volumenprozent. */
  carbonDioxidePercent: number;
  /** Schwefelwasserstoff in ppm. */
  hydrogenSulfidePpm: number;
  /** Sauerstoffgehalt in Prozent. */
  oxygenPercent: number;
}

export function sampleGases(zoneId: CaveZoneId, seed: number = 42): GasReading {
  const zone = getCaveZone(zoneId) || CAVE_ZONES[0];
  const rng = createSeededRandom(hashString(`gas:${zoneId}:${seed}`));
  const depthFactor = zone.depthMeters / 3200;
  return {
    zone: zone.id,
    methanePercent: Math.round(depthFactor * (1 + rng() * 4) * 100) / 100,
    carbonDioxidePercent: Math.round(depthFactor * (0.4 + rng() * 2.6) * 100) / 100,
    hydrogenSulfidePpm: Math.round(depthFactor * (5 + rng() * 60)),
    oxygenPercent: Math.round(zone.baseOxygenPercent * 100) / 100,
  };
}

export type HazardSeverity = "ok" | "warn" | "critical";

export interface HazardAssessment {
  kind: "schlagwetter" | "erstickung" | "giftgas" | "stabilität";
  severity: HazardSeverity;
  value: number;
  threshold: number;
  message: string;
}

/** Schlagwetter-Grenze: 4 % Methan ist explosiv, 2 % Warnschwelle. */
export const METHANE_EXPLOSIVE_PERCENT = 4;
export const METHANE_WARN_PERCENT = 2;
/** Sauerstoff unter 16 % führt zur Bewusstlosigkeit. */
export const OXYGEN_CRITICAL_PERCENT = 16;
export const OXYGEN_WARN_PERCENT = 18;
/** H2S ab 100 ppm ist akut gefährlich. */
export const H2S_CRITICAL_PPM = 100;
export const H2S_WARN_PPM = 20;
/** Stabilität unter 50 bedeutet akute Einsturzgefahr. */
export const STABILITY_CRITICAL = 50;
export const STABILITY_WARN = 65;

export function assessHazards(reading: GasReading, stability: number): HazardAssessment[] {
  const assessments: HazardAssessment[] = [];

  assessments.push({
    kind: "schlagwetter",
    severity:
      reading.methanePercent >= METHANE_EXPLOSIVE_PERCENT
        ? "critical"
        : reading.methanePercent >= METHANE_WARN_PERCENT
          ? "warn"
          : "ok",
    value: reading.methanePercent,
    threshold: METHANE_EXPLOSIVE_PERCENT,
    message:
      reading.methanePercent >= METHANE_EXPLOSIVE_PERCENT
        ? `Schlagwetter! ${reading.methanePercent} % Methan — jede Flamme entzündet die Grube.`
        : reading.methanePercent >= METHANE_WARN_PERCENT
          ? `Warnung: ${reading.methanePercent} % Methan steigen an.`
          : `Methan unkritisch (${reading.methanePercent} %).`,
  });

  assessments.push({
    kind: "erstickung",
    severity:
      reading.oxygenPercent < OXYGEN_CRITICAL_PERCENT
        ? "critical"
        : reading.oxygenPercent < OXYGEN_WARN_PERCENT
          ? "warn"
          : "ok",
    value: reading.oxygenPercent,
    threshold: OXYGEN_CRITICAL_PERCENT,
    message:
      reading.oxygenPercent < OXYGEN_CRITICAL_PERCENT
        ? `Stickstoff-Erstickung: nur ${reading.oxygenPercent} % Sauerstoff.`
        : reading.oxygenPercent < OXYGEN_WARN_PERCENT
          ? `Sauerstoff dünn (${reading.oxygenPercent} %) — Flammen brennen schwächer.`
          : `Sauerstoff ausreichend (${reading.oxygenPercent} %).`,
  });

  assessments.push({
    kind: "giftgas",
    severity:
      reading.hydrogenSulfidePpm >= H2S_CRITICAL_PPM
        ? "critical"
        : reading.hydrogenSulfidePpm >= H2S_WARN_PPM
          ? "warn"
          : "ok",
    value: reading.hydrogenSulfidePpm,
    threshold: H2S_CRITICAL_PPM,
    message:
      reading.hydrogenSulfidePpm >= H2S_CRITICAL_PPM
        ? `Schwefelwasserstoff bei ${reading.hydrogenSulfidePpm} ppm — tödlich in Minuten.`
        : reading.hydrogenSulfidePpm >= H2S_WARN_PPM
          ? `H₂S riecht nach faulen Eiern (${reading.hydrogenSulfidePpm} ppm).`
          : `Kein nennenswerter Giftgasbefund (${reading.hydrogenSulfidePpm} ppm).`,
  });

  assessments.push({
    kind: "stabilität",
    severity: stability < STABILITY_CRITICAL ? "critical" : stability < STABILITY_WARN ? "warn" : "ok",
    value: stability,
    threshold: STABILITY_CRITICAL,
    message:
      stability < STABILITY_CRITICAL
        ? `Einsturzgefahr bei Stabilität ${stability} — der Fels singt vor dem Bruch.`
        : stability < STABILITY_WARN
          ? `Risse im Hang (Stabilität ${stability}) — Vorsicht bei Erschütterung.`
          : `Gestein stabil (${stability}).`,
  });

  return assessments;
}

export interface DarknessPassage {
  zone: CaveZoneId;
  text: string;
  sensesUsed: string[];
}

const DARKNESS_OPENERS = [
  "Das Licht erlischt, und die Welt zieht sich auf eine Handbreit zusammen.",
  "Die Lampe stirbt, und mit ihr der letzte Begriff von Ferne.",
  "Dann nichts. Kein Umriss, kein Horizont, nur der eigene Atem.",
];

const DARKNESS_SENSES = [
  "Die Fingerspitzen finden nassen Fels, kalt und scharf wie Zähne.",
  "Ein Luftzug streicht über den Nacken — irgendwo dort vorn muss Öffnung sein.",
  "Tropfen fallen in unregelmäßigem Takt; an ihrem Klang misst man die Höhe der Decke.",
  "Der Boden unter den Sohlen ist glatt, dann plötzlich schräg — der Hang neigt sich.",
  "Ein Geruch von Eisen und feuchtem Kalk legt sich auf die Zunge.",
  "Die Stille ist nicht leer; sie hat ein Gewicht und drückt von allen Seiten.",
  "Der eigene Puls ist der lauteste Laut im Raum.",
];

export function generateDarknessPassage(zoneId: CaveZoneId, senseCount: number = 3, seed: number = 42): DarknessPassage {
  const rng = createSeededRandom(hashString(`dark:${zoneId}:${seed}`));
  const total = Math.max(1, Math.min(senseCount, DARKNESS_SENSES.length));
  const senses: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (senses.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * DARKNESS_SENSES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    senses.push(DARKNESS_SENSES[idx]);
  }
  const opener = pick(DARKNESS_OPENERS, rng);
  return { zone: zoneId, text: `${opener} ${senses.join(" ")}`, sensesUsed: senses };
}

export interface CaveSurvey {
  id: string;
  zone: CaveZone;
  gases: GasReading;
  hazards: HazardAssessment[];
  stability: number;
  oxygenPercent: number;
  darknessPassage: DarknessPassage;
  survivable: boolean;
}

export function surveyZone(zoneId: CaveZoneId, oxygenDepletion: number = 0, stabilityLoss: number = 0, seed: number = 42): CaveSurvey {
  const zone = getCaveZone(zoneId) || CAVE_ZONES[0];
  const gases = sampleGases(zoneId, seed);
  const oxygenPercent = Math.max(0, Math.round((gases.oxygenPercent - Math.max(0, oxygenDepletion)) * 100) / 100);
  const stability = Math.max(0, Math.min(100, zone.baseStability - Math.max(0, stabilityLoss)));
  const adjusted: GasReading = { ...gases, oxygenPercent };
  const hazards = assessHazards(adjusted, stability);
  const darknessPassage = generateDarknessPassage(zoneId, 3, seed);
  const survivable = hazards.every((h) => h.severity !== "critical");

  return {
    id: `SURVEY-${hashString(`${zoneId}:${oxygenDepletion}:${stabilityLoss}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    zone,
    gases: adjusted,
    hazards,
    stability,
    oxygenPercent,
    darknessPassage,
    survivable,
  };
}

export interface SpeleologyReport {
  id: string;
  surveys: CaveSurvey[];
  criticalCount: number;
  deepestZone: CaveZone;
}

export function analyzeCaveSystem(zoneIds: CaveZoneId[], seed: number = 42): SpeleologyReport {
  const active = zoneIds
    .map((id) => getCaveZone(id))
    .filter((z): z is CaveZone => Boolean(z));
  const list = active.length > 0 ? active : CAVE_ZONES;
  const surveys = list.map((z, i) => surveyZone(z.id, i * 0.4, i * 6, seed + i));
  const criticalCount = surveys.reduce((s, x) => s + x.hazards.filter((h) => h.severity === "critical").length, 0);
  const deepestZone = [...list].sort((a, b) => b.depthMeters - a.depthMeters)[0];
  return {
    id: `SPELEO-${hashString(zoneIds.join(",") + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    surveys,
    criticalCount,
    deepestZone,
  };
}

export function createSampleCaveSurvey(): CaveSurvey {
  return surveyZone("geothermalFissure", 0, 0, 42);
}

export function createSampleSpeleologyReport(): SpeleologyReport {
  return analyzeCaveSystem(["entranceCleft", "geothermalFissure", "subterraneanLake", "fungalForest", "magmaChambers"], 42);
}
