// VectorCartographer (WP 84.1)
//
// Vektor-Kartenstudio & Reisezeit-Pathfinder für Fantasy- und Sci-Fi-Welten.
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

/** Terrain-Typ. */
export type TerrainType = "plains" | "road" | "forest" | "hills" | "mountains" | "swamp" | "desert" | "water";

/** Fortbewegungsart. */
export type TravelMode = "foot_march" | "ox_cart" | "mounted" | "ship";

/** Ein Karten-Element. */
export interface MapElement {
  id: string;
  type: "continent" | "river" | "mountain" | "city" | "border" | "hex";
  x: number;
  y: number;
  name?: string;
  properties?: Record<string, unknown>;
}

/** Ein Reise-Pfad. */
export interface TravelPath {
  waypoints: Array<{ x: number; y: number }>;
  mode: TravelMode;
  terrainCrossed: TerrainType[];
  distanceKm: number;
  durationDays: number;
}

/** Geschwindigkeiten in km/Tag. */
export const TRAVEL_SPEEDS: Record<TravelMode, Record<TerrainType, number>> = {
  foot_march: { plains: 30, road: 35, forest: 20, hills: 18, mountains: 8, swamp: 10, desert: 15, water: 0 },
  ox_cart: { plains: 15, road: 20, forest: 8, hills: 6, mountains: 3, swamp: 4, desert: 5, water: 0 },
  mounted: { plains: 60, road: 70, forest: 35, hills: 30, mountains: 15, swamp: 20, desert: 40, water: 0 },
  ship: { plains: 0, road: 0, forest: 0, hills: 0, mountains: 0, swamp: 0, desert: 0, water: 120 },
};

/** Erstellt einen leeren Karten-Layer. */
export function createEmptyMap(_name: string): MapElement[] {
  return [];
}

/** Fügt ein Element hinzu. */
export function addMapElement(elements: MapElement[], element: MapElement): MapElement[] {
  return [...elements, element];
}

/** Berechnet die euklidische Distanz. */
export function computeDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy) * 10; // 1 Einheit = 10 km
}

/** Berechnet die Reisedauer. */
export function calculateTravelTime(path: TravelPath): TravelPath {
  let totalDays = 0;
  let totalDistance = 0;

  for (let i = 0; i < path.waypoints.length - 1; i++) {
    const dist = computeDistance(path.waypoints[i], path.waypoints[i + 1]);
    totalDistance += dist;

    const terrain = path.terrainCrossed[i] || "plains";
    const speed = TRAVEL_SPEEDS[path.mode][terrain] || 1;
    const days = dist / speed;
    totalDays += days;
  }

  return { ...path, distanceKm: totalDistance, durationDays: Math.round(totalDays * 10) / 10 };
}

/** Erstellt einen Beispiel-Pfad. */
export function createSamplePath(): TravelPath {
  return {
    waypoints: [
      { x: 0, y: 0 },
      { x: 5, y: 2 },
      { x: 10, y: 5 },
      { x: 15, y: 8 },
    ],
    mode: "mounted",
    terrainCrossed: ["plains", "forest", "hills", "mountains"],
    distanceKm: 0,
    durationDays: 0,
  };
}

/** Formatiert einen Pfad als Text. */
export function formatPath(path: TravelPath): string {
  const lines: string[] = [];
  lines.push(`=== REISEZEIT-PATHFINDER ===`);
  lines.push(`Modus: ${path.mode}`);
  lines.push(`Distanz: ${path.distanceKm} km`);
  lines.push(`Dauer: ${path.durationDays} Tage`);
  lines.push("");
  lines.push("Wegpunkte:");
  path.waypoints.forEach((wp, i) => {
    lines.push(`  ${i + 1}. (${wp.x}, ${wp.y})`);
  });
  return lines.join("\n");
}

/** Erstellt eine Beispiel-Karte. */
export function createSampleMap(): MapElement[] {
  return [
    { id: "cont-1", type: "continent", x: 10, y: 10, name: "Aetheria" },
    { id: "riv-1", type: "river", x: 5, y: 5, name: "Silberfluss" },
    { id: "mtn-1", type: "mountain", x: 20, y: 15, name: "Drachenspitze" },
    { id: "city-1", type: "city", x: 12, y: 12, name: "Falkenstein" },
    { id: "hex-1", type: "hex", x: 8, y: 8 },
  ];
}