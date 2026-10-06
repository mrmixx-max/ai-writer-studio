// PlanetaryClimateEngine (WP 82.2)
//
// Planetarer Klima- & Jahreszeiten-Simulator für Fantasy- und Sci-Fi-Welten.
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

/** Planeten-Parameter. */
export interface PlanetParams {
  dayLengthHours: number;
  yearLengthDays: number;
  axialTiltDeg: number;
  moonCount: number;
  orbitalEccentricity: number;
}

/** Klimazone. */
export interface ClimateZone {
  name: string;
  minTempC: number;
  maxTempC: number;
  precipitation: string;
}

/** Jahreszeit. */
export interface Season {
  name: string;
  startDay: number;
  endDay: number;
  avgTempC: number;
  daylightHours: number;
}

/** Klimatischer Bericht. */
export interface ClimateReport {
  planetName: string;
  zones: ClimateZone[];
  seasons: Season[];
  polarNightDays: number;
  monsoonMonths: number;
}

/** Berechnet die Klimazonen. */
export function computeClimateZones(params: PlanetParams): ClimateZone[] {
  const baseTemp = 15 - Math.abs(params.axialTiltDeg - 23) * 0.5;
  return [
    { name: "Äquator", minTempC: baseTemp + 10, maxTempC: baseTemp + 25, precipitation: "hoch" },
    { name: "Tropen", minTempC: baseTemp + 5, maxTempC: baseTemp + 15, precipitation: "mittel" },
    { name: "Gemäßigt", minTempC: baseTemp - 5, maxTempC: baseTemp + 5, precipitation: "mittel" },
    { name: "Subpolar", minTempC: baseTemp - 15, maxTempC: baseTemp - 5, precipitation: "niedrig" },
    { name: "Polar", minTempC: baseTemp - 30, maxTempC: baseTemp - 15, precipitation: "sehr niedrig" },
  ];
}

/** Berechnet die Jahreszeiten. */
export function computeSeasons(params: PlanetParams): Season[] {
  const tiltFactor = params.axialTiltDeg / 23;
  const baseTemp = 15 - Math.abs(params.axialTiltDeg - 23) * 0.5;
  const daylightVariation = params.dayLengthHours * tiltFactor;

  return [
    { name: "Frühling", startDay: 1, endDay: Math.floor(params.yearLengthDays * 0.25), avgTempC: baseTemp, daylightHours: params.dayLengthHours },
    { name: "Sommer", startDay: Math.floor(params.yearLengthDays * 0.25) + 1, endDay: Math.floor(params.yearLengthDays * 0.5), avgTempC: baseTemp + 10 * tiltFactor, daylightHours: params.dayLengthHours + daylightVariation },
    { name: "Herbst", startDay: Math.floor(params.yearLengthDays * 0.5) + 1, endDay: Math.floor(params.yearLengthDays * 0.75), avgTempC: baseTemp, daylightHours: params.dayLengthHours },
    { name: "Winter", startDay: Math.floor(params.yearLengthDays * 0.75) + 1, endDay: params.yearLengthDays, avgTempC: baseTemp - 10 * tiltFactor, daylightHours: params.dayLengthHours - daylightVariation },
  ];
}

/** Berechnet die Polarnächte. */
export function computePolarNightDays(params: PlanetParams): number {
  return Math.floor(params.yearLengthDays * (params.axialTiltDeg / 90) * 0.5);
}

/** Berechnet die Monsunmonate. */
export function computeMonsoonMonths(params: PlanetParams): number {
  return Math.max(1, Math.floor(params.moonCount * 2 + params.orbitalEccentricity * 10));
}

/** Erstellt einen vollständigen Klimabericht. */
export function generateClimateReport(planetName: string, params: PlanetParams): ClimateReport {
  return {
    planetName,
    zones: computeClimateZones(params),
    seasons: computeSeasons(params),
    polarNightDays: computePolarNightDays(params),
    monsoonMonths: computeMonsoonMonths(params),
  };
}

/** Formatiert einen Klimabericht als Text. */
export function formatClimateReport(report: ClimateReport): string {
  const lines: string[] = [];
  lines.push(`=== KLIMABERICHT: ${report.planetName} ===`);
  lines.push("");
  lines.push("KLIMAZONEN:");
  for (const zone of report.zones) {
    lines.push(`  ${zone.name}: ${zone.minTempC}°C bis ${zone.maxTempC}°C, Niederschlag: ${zone.precipitation}`);
  }
  lines.push("");
  lines.push("JAHRESZEITEN:");
  for (const season of report.seasons) {
    lines.push(`  ${season.name}: Tag ${season.startDay}-${season.endDay}, Ø ${season.avgTempC}°C, ${season.daylightHours}h Tageslicht`);
  }
  lines.push("");
  lines.push(`Polarnächte: ${report.polarNightDays} Tage`);
  lines.push(`Monsunmonate: ${report.monsoonMonths}`);
  return lines.join("\n");
}

/** Erstellt einen Beispiel-Bericht. */
export function createSampleClimateReport(): ClimateReport {
  return generateClimateReport("Aetherie", {
    dayLengthHours: 24,
    yearLengthDays: 365,
    axialTiltDeg: 23,
    moonCount: 2,
    orbitalEccentricity: 0.1,
  });
}
