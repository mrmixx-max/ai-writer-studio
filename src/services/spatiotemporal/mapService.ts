/**
 * Spatiotemporal Service — WP 16.1 (4D-Chronik & Reisezeit-Wächter)
 *
 * Lokaler, deterministischer Service zur Berechnung von Reisezeiten
 * und -fähigkeiten zwischen Koordinaten. Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Coord {
  x: number;
  y: number;
}

export type TravelMode = 'foot' | 'horse' | 'carriage' | 'ship' | 'modern';
export type TerrainType = 'road' | 'forest' | 'mountain' | 'ocean' | 'hyper';

export interface TravelTime {
  days: number;
  hours: number;
  feasible: boolean;
}

export interface FeasibilityResult {
  feasible: boolean;
  requiredDays: number;
  availableDays: number;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Geschwindigkeiten in km/Tag */
const TRAVEL_SPEEDS: Record<TravelMode, number> = {
  foot: 30,
  horse: 50,
  carriage: 70,
  ship: 100,
  modern: 500,
};

/** Gelände-Multiplikatoren (höher = langsamer) */
const TERRAIN_MULTIPLIERS: Record<TerrainType, number> = {
  road: 1.0,
  forest: 1.3,
  mountain: 2.0,
  ocean: 1.5,
  hyper: 0.5,
};

const HOURS_PER_DAY = 24;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_AVAILABLE_DAYS = 30;

// ─── getDistance ─────────────────────────────────────────────────────────────

/**
 * Berechnet die Distanz zwischen zwei Koordinaten.
 * @param a - Erste Koordinate
 * @param b - Zweite Koordinate
 * @param metric - Distanzmetrik (Standard: 'euclidean')
 * @returns Distanz in km
 */
export function getDistance(
  a: Coord,
  b: Coord,
  metric: 'euclidean' | 'manhattan' = 'euclidean',
): number {
  if (!a || !b) return 0;

  const dx = Math.abs((b.x ?? 0) - (a.x ?? 0));
  const dy = Math.abs((b.y ?? 0) - (a.y ?? 0));

  if (metric === 'manhattan') {
    return dx + dy;
  }

  return Math.sqrt(dx * dx + dy * dy);
}

// ─── calculateTravelTime ─────────────────────────────────────────────────────

/**
 * Berechnet die Reisezeit zwischen zwei Koordinaten.
 * @param from - Startkoordinate
 * @param to - Zielkoordinate
 * @param mode - Reisemodus
 * @param terrain - Geländetyp (Standard: 'road')
 * @returns TravelTime mit Tagen, Stunden und Machbarkeit
 */
export function calculateTravelTime(
  from: Coord,
  to: Coord,
  mode: TravelMode,
  terrain: TerrainType = 'road',
): TravelTime {
  if (!from || !to) {
    return { days: 0, hours: 0, feasible: false };
  }

  const distance = getDistance(from, to);

  if (distance === 0) {
    return { days: 0, hours: 0, feasible: true };
  }

  const speed = TRAVEL_SPEEDS[mode];
  if (!speed || speed <= 0) {
    return { days: 0, hours: 0, feasible: false };
  }

  const terrainMultiplier = TERRAIN_MULTIPLIERS[terrain] ?? 1.0;
  const effectiveSpeed = speed / terrainMultiplier;

  const totalHours = (distance / effectiveSpeed) * HOURS_PER_DAY;
  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = Math.round((totalHours % HOURS_PER_DAY) * 100) / 100;

  return { days, hours, feasible: true };
}

// ─── checkTravelFeasibility ─────────────────────────────────────────────────

/**
 * Prüft, ob eine Reise im Handlungsablauf zeitlich möglich ist.
 * @param chapterTimestamp - Aktueller Kapitel-Zeitstempel
 * @param from - Startkoordinate
 * @param to - Zielkoordinate
 * @param mode - Reisemodus
 * @param deadline - Optional: Deadline (Standard: 30 Tage ab chapterTimestamp)
 * @returns FeasibilityResult
 */
export function checkTravelFeasibility(
  chapterTimestamp: Date,
  from: Coord,
  to: Coord,
  mode: TravelMode,
  deadline?: Date,
): FeasibilityResult {
  if (!chapterTimestamp || isNaN(chapterTimestamp.getTime())) {
    return {
      feasible: false,
      requiredDays: 0,
      availableDays: 0,
      message: 'Ungültiger Kapitel-Zeitstempel',
    };
  }

  if (!from || !to) {
    return {
      feasible: false,
      requiredDays: 0,
      availableDays: 0,
      message: 'Ungültige Koordinaten',
    };
  }

  const travelTime = calculateTravelTime(from, to, mode);

  if (!travelTime.feasible) {
    return {
      feasible: false,
      requiredDays: 0,
      availableDays: 0,
      message: 'Reise nicht möglich',
    };
  }

  const requiredDays = travelTime.days + (travelTime.hours > 0 ? 1 : 0);

  let availableDays: number;
  if (deadline && !isNaN(deadline.getTime())) {
    const diffMs = deadline.getTime() - chapterTimestamp.getTime();
    availableDays = Math.max(0, Math.floor(diffMs / MS_PER_DAY));
  } else {
    availableDays = DEFAULT_AVAILABLE_DAYS;
  }

  const feasible = requiredDays <= availableDays;

  const message = feasible
    ? `Reise möglich: ${requiredDays} Tag(e) benötigt, ${availableDays} Tag(e) verfügbar`
    : `Reise nicht möglich: ${requiredDays} Tag(e) benötigt, aber nur ${availableDays} Tag(e) verfügbar`;

  return { feasible, requiredDays, availableDays, message };
}
