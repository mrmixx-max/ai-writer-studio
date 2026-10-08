// TopographicalReliefStudio (WP 104.2)
// Topografisches Höhenschichten- & Relief-Studio.
// Hypsometrische Höhenstufen, taktische Sichtachsen, Höhenmeter-Erschöpfungskalkulator.
// Deterministisch & offline. Keine Node-Module.

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

export type ElevationBandId =
  | "seaLevel"
  | "lowland"
  | "hillCountry"
  | "montane"
  | "alpine"
  | "nival";

export interface ElevationBand {
  id: ElevationBandId;
  name: string;
  minMeters: number;
  maxMeters: number;
  description: string;
}

/** Hypsometrische Höhenstufen (Meter über Meereshöhe). */
export const ELEVATION_BANDS: ElevationBand[] = [
  { id: "seaLevel", name: "Meereshöhe", minMeters: -50, maxMeters: 200, description: "Küsten, Marschen, Flussdeltas." },
  { id: "lowland", name: "Tiefland", minMeters: 200, maxMeters: 500, description: "Ackerland, Wiesen, sanfte Hügel." },
  { id: "hillCountry", name: "Hügelland", minMeters: 500, maxMeters: 1000, description: "Bewaldete Hänge, Terrassenfelder." },
  { id: "montane", name: "Montane Stufe", minMeters: 1000, maxMeters: 2000, description: "Nadelwald, Almweiden, erste Felswände." },
  { id: "alpine", name: "Alpine Stufe", minMeters: 2000, maxMeters: 3000, description: "Kahle Gräte, Schneefelder, Gletscherzungen." },
  { id: "nival", name: "Nivale Stufe", minMeters: 3000, maxMeters: 9000, description: "Ewiger Schnee, Eis, kein Pflanzenwuchs." },
];

export function getElevationBand(meters: number): ElevationBand {
  for (const band of ELEVATION_BANDS) {
    if (meters >= band.minMeters && meters < band.maxMeters) return band;
  }
  return ELEVATION_BANDS[ELEVATION_BANDS.length - 1];
}

export interface ReliefCell {
  x: number;
  y: number;
  elevationMeters: number;
  band: ElevationBandId;
}

export interface ReliefMap {
  id: string;
  width: number;
  height: number;
  cells: ReliefCell[];
  minMeters: number;
  maxMeters: number;
}

/** Erzeugt ein deterministisches Höhenraster aus überlagerten Sinuswellen (value noise light). */
export function generateReliefMap(width: number, height: number, seed: number = 42): ReliefMap {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const rng = createSeededRandom(hashString(`relief:${w}x${h}:${seed}`));
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const phaseC = rng() * Math.PI * 2;

  const cells: ReliefCell[] = [];
  let minMeters = Infinity;
  let maxMeters = -Infinity;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / Math.max(1, w - 1);
      const ny = y / Math.max(1, h - 1);
      const ridge = Math.sin(nx * Math.PI * 2 + phaseA) * Math.cos(ny * Math.PI * 2 + phaseB);
      const detail = Math.sin((nx + ny) * Math.PI * 4 + phaseC) * 0.35;
      const normalised = (ridge + detail + 1.35) / 2.7; // 0..1
      const elevationMeters = Math.round(normalised * 3600);
      minMeters = Math.min(minMeters, elevationMeters);
      maxMeters = Math.max(maxMeters, elevationMeters);
      cells.push({ x, y, elevationMeters, band: getElevationBand(elevationMeters).id });
    }
  }

  return {
    id: `RELIEF-${hashString(`${w}x${h}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    width: w,
    height: h,
    cells,
    minMeters: Number.isFinite(minMeters) ? minMeters : 0,
    maxMeters: Number.isFinite(maxMeters) ? maxMeters : 0,
  };
}

export function cellAt(map: ReliefMap, x: number, y: number): ReliefCell | undefined {
  return map.cells.find((c) => c.x === x && c.y === y);
}

export interface SlopeResult {
  from: { x: number; y: number };
  to: { x: number; y: number };
  riseMeters: number;
  horizontalUnits: number;
  gradientPercent: number;
  classification: "flach" | "mäßig" | "steil" | "unpassierbar";
}

export function calculateSlope(map: ReliefMap, from: { x: number; y: number }, to: { x: number; y: number }): SlopeResult | null {
  const a = cellAt(map, from.x, from.y);
  const b = cellAt(map, to.x, to.y);
  if (!a || !b) return null;
  const riseMeters = b.elevationMeters - a.elevationMeters;
  const horizontalUnits = Math.hypot(to.x - from.x, to.y - from.y);
  if (horizontalUnits === 0) return null;
  const gradientPercent = Math.round((Math.abs(riseMeters) / horizontalUnits) * 100 * 10) / 10;
  const classification =
    gradientPercent < 15 ? "flach" : gradientPercent < 45 ? "mäßig" : gradientPercent < 100 ? "steil" : "unpassierbar";
  return { from: { ...from }, to: { ...to }, riseMeters, horizontalUnits, gradientPercent, classification };
}

export interface SightLineResult {
  fortress: { x: number; y: number };
  valleyPoint: { x: number; y: number };
  visible: boolean;
  deadAngleAt: { x: number; y: number } | null;
  reason: string;
}

/**
 * Sichtachsen-Analyse: Eine Festung überwacht das Tal, wenn keine Zwischenerhebung
 * die Sichtlinie um mehr als 5 % der Höhendifferenz überragt.
 */
export function analyzeSightLine(
  map: ReliefMap,
  fortress: { x: number; y: number },
  valleyPoint: { x: number; y: number }
): SightLineResult {
  const f = cellAt(map, fortress.x, fortress.y);
  const v = cellAt(map, valleyPoint.x, valleyPoint.y);
  if (!f || !v) {
    return { fortress: { ...fortress }, valleyPoint: { ...valleyPoint }, visible: false, deadAngleAt: null, reason: "Position außerhalb der Karte." };
  }

  const steps = Math.max(1, Math.round(Math.hypot(valleyPoint.x - fortress.x, valleyPoint.y - fortress.y)));
  const tolerance = Math.abs(f.elevationMeters - v.elevationMeters) * 0.05;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(fortress.x + (valleyPoint.x - fortress.x) * t);
    const y = Math.round(fortress.y + (valleyPoint.y - fortress.y) * t);
    const mid = cellAt(map, x, y);
    if (!mid) continue;
    const lineElevation = f.elevationMeters + (v.elevationMeters - f.elevationMeters) * t;
    if (mid.elevationMeters > lineElevation + tolerance) {
      return {
        fortress: { ...fortress },
        valleyPoint: { ...valleyPoint },
        visible: false,
        deadAngleAt: { x, y },
        reason: `Erhebung bei (${x},${y}) verdeckt die Sichtlinie.`,
      };
    }
  }

  return {
    fortress: { ...fortress },
    valleyPoint: { ...valleyPoint },
    visible: true,
    deadAngleAt: null,
    reason: "Freie Sichtachse — die Festung überwacht das Tal vollständig.",
  };
}

export interface PartyProfile {
  id: string;
  name: string;
  /** Basistempo in Metern Höhengewinn pro Stunde (ohne Erschöpfung). */
  baseClimbRate: number;
  /** Körpermasse-Faktor: Träger/Tross verlieren mehr. */
  loadFactor: number;
  members: number;
}

export const PARTY_PROFILES: PartyProfile[] = [
  { id: "scout", name: "Späher (leicht)", baseClimbRate: 500, loadFactor: 1, members: 1 },
  { id: "walker", name: "Wanderer", baseClimbRate: 400, loadFactor: 1.15, members: 1 },
  { id: "caravan", name: "Handelstross", baseClimbRate: 250, loadFactor: 1.6, members: 12 },
  { id: "army", name: "Heereszug", baseClimbRate: 200, loadFactor: 2.1, members: 400 },
];

export function getPartyProfile(id: string): PartyProfile | undefined {
  return PARTY_PROFILES.find((p) => p.id === id);
}

export interface FatigueResult {
  party: string;
  climbMeters: number;
  hoursNeeded: number;
  caloriesPerPerson: number;
  altitudeSicknessRisk: number; // 0..100
  verdict: string;
}

/**
 * Erschöpfungskalkulator: Zeit- und Kalorienverlust beim Passübergang.
 * Ab 2.500 m Höhe steigt das Risiko der Höhenkrankheit.
 */
export function calculateFatigue(party: PartyProfile, climbMeters: number, targetAltitudeMeters: number): FatigueResult {
  const climb = Math.max(0, climbMeters);
  const effectiveRate = party.baseClimbRate / party.loadFactor;
  const hoursNeeded = effectiveRate > 0 ? Math.round((climb / effectiveRate) * 10) / 10 : 0;

  // Kalorien: Grundumsatz + Höhenzuschlag je Kilogramm Last
  const baseCalories = 60 * party.loadFactor;
  const climbCalories = (climb / 100) * 90 * party.loadFactor;
  const caloriesPerPerson = Math.round(baseCalories + climbCalories);

  const altitudeSicknessRisk =
    targetAltitudeMeters <= 2500
      ? Math.max(0, Math.round((targetAltitudeMeters / 2500) * 15))
      : Math.min(100, Math.round(15 + ((targetAltitudeMeters - 2500) / 30) * party.loadFactor));

  const verdict =
    hoursNeeded === 0
      ? "Kein Höhengewinn — kein Erschöpfungszuschlag."
      : altitudeSicknessRisk >= 60
        ? "Kritisch: Höhenkrankheit wahrscheinlich, Zwischenlager einplanen."
        : altitudeSicknessRisk >= 30
          ? "Warnung: Akklimatisierungspause empfohlen."
          : "Unkritisch bei ausreichender Verpflegung.";

  return {
    party: party.name,
    climbMeters: climb,
    hoursNeeded,
    caloriesPerPerson,
    altitudeSicknessRisk,
    verdict,
  };
}

export interface ReliefReport {
  id: string;
  map: ReliefMap;
  bandCounts: { band: ElevationBandId; count: number }[];
  highestBand: ElevationBand;
  gradientSummary: string;
}

export function analyzeRelief(map: ReliefMap): ReliefReport {
  const counts = new Map<ElevationBandId, number>();
  for (const cell of map.cells) {
    counts.set(cell.band, (counts.get(cell.band) ?? 0) + 1);
  }
  const bandCounts = ELEVATION_BANDS.map((b) => ({ band: b.id, count: counts.get(b.id) ?? 0 }));
  const highestBand = getElevationBand(map.maxMeters);
  const gradientSummary = `${map.minMeters} m bis ${map.maxMeters} m über ${map.width}×${map.height} Felder.`;
  return {
    id: `REPORT-${hashString(`${map.id}:${map.cells.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    map,
    bandCounts,
    highestBand,
    gradientSummary,
  };
}

export function createSampleReliefMap(): ReliefMap {
  return generateReliefMap(8, 6, 42);
}

export function createSampleReliefReport(): ReliefReport {
  return analyzeRelief(createSampleReliefMap());
}

// Hält pick() für die deterministische Auswahl eines Beispiel-Profils im Einsatz.
export function randomSampleParty(seed: number = 42): PartyProfile {
  const rng = createSeededRandom(hashString(`party:${seed}`));
  return pick(PARTY_PROFILES, rng);
}
