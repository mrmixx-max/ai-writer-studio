// OrbitalAstrodynamicsEngine (WP 112.1)
// Orbital-Astrodynamik & Raumflug-Rechner.
// Lichtgeschwindigkeits-Funkverzögerung, Flugbahn-Rechner, Cockpit-Logbuch.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type CelestialBodyId = "earth" | "moon" | "mars" | "venus" | "jupiter" | "saturn";

export interface CelestialBody {
  id: CelestialBodyId;
  name: string;
  /** Entfernung zur Erde in Kilometer (durchschnittlich). */
  distanceFromEarthKm: number;
  /** Lichtlaufzeit in Minuten (ein Weg). */
  lightTimeMinutes: number;
  /** Oberflächengravitation in m/s². */
  surfaceGravity: number;
}

export const CELESTIAL_BODIES: CelestialBody[] = [
  { id: "earth", name: "Erde", distanceFromEarthKm: 0, lightTimeMinutes: 0, surfaceGravity: 9.81 },
  { id: "moon", name: "Mond", distanceFromEarthKm: 384400, lightTimeMinutes: 1.28, surfaceGravity: 1.62 },
  { id: "mars", name: "Mars", distanceFromEarthKm: 225000000, lightTimeMinutes: 12.5, surfaceGravity: 3.71 },
  { id: "venus", name: "Venus", distanceFromEarthKm: 41000000, lightTimeMinutes: 2.3, surfaceGravity: 8.87 },
  { id: "jupiter", name: "Jupiter", distanceFromEarthKm: 628000000, lightTimeMinutes: 35, surfaceGravity: 24.79 },
  { id: "saturn", name: "Saturn", distanceFromEarthKm: 1275000000, lightTimeMinutes: 71, surfaceGravity: 10.44 },
];

export function getCelestialBody(id: CelestialBodyId): CelestialBody | undefined {
  return CELESTIAL_BODIES.find((b) => b.id === id);
}

/** Lichtgeschwindigkeit in km/s. */
export const SPEED_OF_LIGHT_KM_S = 299792.458;

/** Berechnet die Funkverzögerung in Minuten für eine Einwegsübertragung. */
export function radioDelayMinutes(fromId: CelestialBodyId, toId: CelestialBodyId): number {
  const from = getCelestialBody(fromId) || CELESTIAL_BODIES[0];
  const to = getCelestialBody(toId) || CELESTIAL_BODIES[0];
  const distance = Math.abs(from.distanceFromEarthKm - to.distanceFromEarthKm);
  const seconds = distance / SPEED_OF_LIGHT_KM_S;
  return Math.round((seconds / 60) * 100) / 100;
}

/** Berechnet die Funkverzögerung in Sekunden für eine Einwegsübertragung. */
export function radioDelaySeconds(fromId: CelestialBodyId, toId: CelestialBodyId): number {
  return Math.round(radioDelayMinutes(fromId, toId) * 60);
}

export type FlightProfileId = "brachistochrone" | "hohmann";

export interface FlightProfile {
  id: FlightProfileId;
  name: string;
  description: string;
  /** Beschleunigung in m/s². */
  acceleration: number;
  /** Delta-v in km/s. */
  deltaV: number;
  /** Flugzeit in Stunden. */
  flightTimeHours: number;
  /** Treibstoffverbrauch in Tonnen. */
  fuelTons: number;
  /** Künstliche Schwerkraft während des Fluges. */
  artificialGravity: number;
}

export function calculateFlight(
  fromId: CelestialBodyId,
  toId: CelestialBodyId,
  profileId: FlightProfileId,
  payloadTons: number = 10
): FlightProfile {
  const from = getCelestialBody(fromId) || CELESTIAL_BODIES[0];
  const to = getCelestialBody(toId) || CELESTIAL_BODIES[0];
  const distance = Math.abs(from.distanceFromEarthKm - to.distanceFromEarthKm);

  if (profileId === "brachistochrone") {
    // 1G-Schub bis zur Hälfte, Drehung, 1G-Bremsung
    const halfDistance = distance / 2;
    const accel = 9.81;
    const timeSeconds = 2 * Math.sqrt((halfDistance * 1000) / accel);
    const timeHours = timeSeconds / 3600;
    const deltaV = (accel * timeSeconds) / 1000;
    const fuel = payloadTons * 0.5;
    return {
      id: "brachistochrone",
      name: "Brachistochron-Flug",
      description: "Kontinuierlicher 1G-Schub bis zur Hälfte, Drehung um 180°, 1G-Bremsung. Bietet künstliche Schwerkraft.",
      acceleration: accel,
      deltaV: Math.round(deltaV * 100) / 100,
      flightTimeHours: Math.round(timeHours * 100) / 100,
      fuelTons: Math.round(fuel * 100) / 100,
      artificialGravity: 1,
    };
  }

  // Hohmann-Transfer: elliptischer Übergangsorbit
  const r1 = from.distanceFromEarthKm + 6371; // Erdradius
  const r2 = to.distanceFromEarthKm + 6371;
  const a = (r1 + r2) / 2;
  const mu = 398600.4418; // Erdgravitationsparameter km³/s²
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vTransfer1 = Math.sqrt(mu * (2 / r1 - 1 / a));
  const vTransfer2 = Math.sqrt(mu * (2 / r2 - 1 / a));
  const deltaV1 = Math.abs(vTransfer1 - v1);
  const deltaV2 = Math.abs(v2 - vTransfer2);
  const totalDeltaV = deltaV1 + deltaV2;
  const timeSeconds = Math.PI * Math.sqrt((a * a * a) / mu);
  const timeHours = timeSeconds / 3600;
  const fuel = payloadTons * 0.15;

  return {
    id: "hohmann",
    name: "Hohmann-Transfer",
    description: "Sparsamer elliptischer Übergangsorbit für Frachter. Keine künstliche Schwerkraft.",
    acceleration: 0,
    deltaV: Math.round(totalDeltaV * 100) / 100,
    flightTimeHours: Math.round(timeHours * 100) / 100,
    fuelTons: Math.round(fuel * 100) / 100,
    artificialGravity: 0,
  };
}

export interface CockpitLogEntry {
  timestamp: string;
  message: string;
  type: "info" | "warning" | "critical";
}

const COCKPIT_MESSAGES = {
  info: [
    "Navigationssystem kalibriert. Kurs bestätigt.",
    "Triebwerke auf 100 % Schub. Beschleunigung stabil.",
    "Lebenserhaltungssysteme im Normalbereich.",
    "Kommunikationsarray synchronisiert. Signalstärke gut.",
    "Kurskorrekturmanöver geplant. Delta-v reserviert.",
  ],
  warning: [
    "G-Kraft-Warnung: Beschleunigung überschreitet 3G.",
    "Treibstoffreserven unter 30 %. Verbrauch überwachen.",
    "Funkverzögerung steigt. Letztes Update vor 12 Minuten.",
    "Thermische Belastung der Hülle steigt. Kühlung aktiv.",
    "Gyroskop-Abweichung erkannt. Kalibrierung empfohlen.",
  ],
  critical: [
    "KRITISCH: Triebwerksausfall auf 2 von 4 Einheiten.",
    "KRITISCH: Hüllentemperatur kritisch. Sofortige Kursänderung.",
    "KRITISCH: Notstrom aktiviert. Lebenserhaltung auf Minimum.",
    "KRITISCH: Kommunikationsverlust. Letztes Signal vor 24 Minuten.",
  ],
};

export function generateCockpitLog(entryCount: number = 5, seed: number = 42): CockpitLogEntry[] {
  const rng = createSeededRandom(hashString(`cockpit:${entryCount}:${seed}`));
  const total = Math.max(1, Math.min(entryCount, 20));
  const entries: CockpitLogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < total; i++) {
    const typeRoll = rng();
    const type = typeRoll < 0.6 ? "info" : typeRoll < 0.9 ? "warning" : "critical";
    const messages = COCKPIT_MESSAGES[type];
    const message = pick(messages, rng);
    const timestamp = new Date(now + i * 60000).toISOString();
    entries.push({ timestamp, message, type });
  }

  return entries;
}

export interface FlightPlan {
  id: string;
  from: CelestialBody;
  to: CelestialBody;
  profile: FlightProfile;
  radioDelayMinutes: number;
  cockpitLog: CockpitLogEntry[];
}

export function createFlightPlan(
  fromId: CelestialBodyId,
  toId: CelestialBodyId,
  profileId: FlightProfileId,
  payloadTons: number = 10,
  seed: number = 42
): FlightPlan {
  const from = getCelestialBody(fromId) || CELESTIAL_BODIES[0];
  const to = getCelestialBody(toId) || CELESTIAL_BODIES[0];
  const profile = calculateFlight(fromId, toId, profileId, payloadTons);
  const delay = radioDelayMinutes(fromId, toId);
  const log = generateCockpitLog(5, seed);

  return {
    id: `FLIGHT-${hashString(`${fromId}:${toId}:${profileId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    from,
    to,
    profile,
    radioDelayMinutes: delay,
    cockpitLog: log,
  };
}

export function createSampleFlightPlan(): FlightPlan {
  return createFlightPlan("earth", "mars", "brachistochrone", 10, 42);
}
