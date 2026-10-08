// NauticalNavalSimulator (WP 108.1)
// Segelschiff-Physik & Seeschlachten-Simulator.
// Windrosen- & Segel-Physik, Breitseiten-Ballistik, Seeschlachten-Prosa.
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

export type PointOfSailId =
  | "closeHauled"
  | "closeReach"
  | "beamReach"
  | "broadReach"
  | "running";

export interface PointOfSail {
  id: PointOfSailId;
  name: string;
  /** Windeinfallswinkel in Grad (0 = direkt von vorn, 180 = von achtern). */
  angleDegrees: number;
  /** Geschwindigkeitsfaktor relativ zur Rumpfgeschwindigkeit. */
  speedFactor: number;
  /** Krängungswinkel in Grad. */
  heelDegrees: number;
  /** Abdrift (Leeway) in Grad. */
  leewayDegrees: number;
  description: string;
}

/** Lee = windabgewandte Seite, Luv = windzugewandte Seite. */
export const POINTS_OF_SAIL: PointOfSail[] = [
  { id: "closeHauled", name: "Hart am Wind", angleDegrees: 45, speedFactor: 0.6, heelDegrees: 22, leewayDegrees: 8, description: "Segel dichtgeholt, größte Krängung, stärkste Abdrift nach Lee." },
  { id: "closeReach", name: "Am Wind (Kreuzkurs)", angleDegrees: 60, speedFactor: 0.75, heelDegrees: 18, leewayDegrees: 6, description: "Kreuzen gegen den Wind, Schoten fest, gute Höhe am Wind." },
  { id: "beamReach", name: "Halber Wind", angleDegrees: 90, speedFactor: 0.9, heelDegrees: 12, leewayDegrees: 3, description: "Wind querab — schnellster und ausgewogenster Kurs." },
  { id: "broadReach", name: "Raumschots", angleDegrees: 135, speedFactor: 0.85, heelDegrees: 8, leewayDegrees: 2, description: "Wind von schräg achtern, Schoten gefiert, ruhige Fahrt." },
  { id: "running", name: "Vor dem Wind", angleDegrees: 180, speedFactor: 0.7, heelDegrees: 4, leewayDegrees: 1, description: "Wind von achtern — Gefahr des Überholens durch die See." },
];

export function getPointOfSail(id: PointOfSailId): PointOfSail | undefined {
  return POINTS_OF_SAIL.find((p) => p.id === id);
}

/** Wählt den Segelkurs anhand des Windeinfallswinkels. */
export function pointOfSailForAngle(angleDegrees: number): PointOfSail {
  const a = Math.abs(angleDegrees) % 360;
  const normalised = a > 180 ? 360 - a : a;
  if (normalised < 50) return POINTS_OF_SAIL[0];
  if (normalised < 75) return POINTS_OF_SAIL[1];
  if (normalised < 115) return POINTS_OF_SAIL[2];
  if (normalised < 160) return POINTS_OF_SAIL[3];
  return POINTS_OF_SAIL[4];
}

export type RigId = "sloop" | "brig" | "frigate" | "shipOfTheLine";

export interface Rig {
  id: RigId;
  name: string;
  /** Rumpflänge in Metern. */
  lengthMeters: number;
  /** Wasserverdrängung in Tonnen. */
  displacementTons: number;
  /** Rumpfgeschwindigkeit in Knoten (Froudesche Zahl). */
  hullSpeedKnots: number;
  /** Anzahl Geschütze je Breitseite. */
  gunsPerBroadside: number;
  sails: string[];
}

export const RIGS: Rig[] = [
  {
    id: "sloop",
    name: "Schaluppe",
    lengthMeters: 20,
    displacementTons: 120,
    hullSpeedKnots: 7,
    gunsPerBroadside: 4,
    sails: ["Großsegel", "Fock", "Klüver"],
  },
  {
    id: "brig",
    name: "Brigg",
    lengthMeters: 30,
    displacementTons: 350,
    hullSpeedKnots: 9,
    gunsPerBroadside: 8,
    sails: ["Großsegel", "Fock", "Bramsegel", "Klüver"],
  },
  {
    id: "frigate",
    name: "Fregatte",
    lengthMeters: 45,
    displacementTons: 1100,
    hullSpeedKnots: 11,
    gunsPerBroadside: 18,
    sails: ["Großsegel", "Fock", "Bramsegel", "Royal", "Klüver", "Besan"],
  },
  {
    id: "shipOfTheLine",
    name: "Linienschiff",
    lengthMeters: 65,
    displacementTons: 3500,
    hullSpeedKnots: 9,
    gunsPerBroadside: 37,
    sails: ["Großsegel", "Fock", "Bramsegel", "Royal", "Klüver", "Besan", "Oberbramsegel"],
  },
];

export function getRig(id: RigId): Rig | undefined {
  return RIGS.find((r) => r.id === id);
}

export interface SailingState {
  rig: Rig;
  pointOfSail: PointOfSail;
  windSpeedKnots: number;
  /** Rumpfgeschwindigkeit in Knoten. */
  speedKnots: number;
  heelDegrees: number;
  leewayDegrees: number;
  /** Gefühlte Geschwindigkeit in km/h für den Leser. */
  speedKmh: number;
}

export function calculateSailing(rigId: RigId, angleDegrees: number, windSpeedKnots: number): SailingState {
  const rig = getRig(rigId) || RIGS[0];
  const pointOfSail = pointOfSailForAngle(angleDegrees);
  const wind = Math.max(0, windSpeedKnots);
  // Windstärke skaliert die erreichbare Fahrt; der Kursfaktor und die Rumpfgeschwindigkeit begrenzen sie.
  const theoretical = wind * pointOfSail.speedFactor;
  const speedKnots = Math.round(Math.min(rig.hullSpeedKnots, theoretical) * 10) / 10;
  // Stärkerer Wind erhöht die Krängung, begrenzt durch den Kurs.
  const heelBoost = Math.min(1.5, wind / 20);
  const heelDegrees = Math.round(Math.min(45, pointOfSail.heelDegrees * heelBoost) * 10) / 10;
  return {
    rig,
    pointOfSail,
    windSpeedKnots: wind,
    speedKnots,
    heelDegrees,
    leewayDegrees: pointOfSail.leewayDegrees,
    speedKmh: Math.round(speedKnots * 1.852 * 10) / 10,
  };
}

export type AmmoTypeId = "roundShot" | "chainShot" | "grapeshot" | "carronade";

export interface AmmoType {
  id: AmmoTypeId;
  name: string;
  /** Effektive Reichweite in Metern. */
  effectiveRangeMeters: number;
  /** Rumpfschaden 0..1. */
  hullDamage: number;
  /** Takelageschaden 0..1 (Entmastung). */
  riggingDamage: number;
  /** Personenschaden 0..1. */
  crewDamage: number;
  description: string;
}

export const AMMO_TYPES: AmmoType[] = [
  { id: "roundShot", name: "Vollkugel", effectiveRangeMeters: 900, hullDamage: 1, riggingDamage: 0.3, crewDamage: 0.4, description: "Massive Eisenkugel gegen den Rumpf — Durchschlag und Splitter." },
  { id: "chainShot", name: "Kettengeschoss", effectiveRangeMeters: 450, hullDamage: 0.2, riggingDamage: 1, crewDamage: 0.2, description: "Zwei Kugeln an einer Kette — reißt Rahen und Wanten nieder." },
  { id: "grapeshot", name: "Kartätsche", effectiveRangeMeters: 200, hullDamage: 0.1, riggingDamage: 0.1, crewDamage: 1, description: "Büchsenkugeln im Nahkampf — verheert das Deck." },
  { id: "carronade", name: "Karronade", effectiveRangeMeters: 350, hullDamage: 0.85, riggingDamage: 0.5, crewDamage: 0.7, description: "Kurze, schwere Smasher — verheerend auf kurze Distanz." },
];

export function getAmmoType(id: AmmoTypeId): AmmoType | undefined {
  return AMMO_TYPES.find((a) => a.id === id);
}

export interface BroadsideResult {
  ammo: AmmoType;
  distanceMeters: number;
  /** Reichweitenabfall 0..1 (1 = volle Wirkung). */
  rangeEffect: number;
  hullDamagePercent: number;
  riggingDamagePercent: number;
  crewCasualties: number;
  /** Wirkung in einem Satz. */
  summary: string;
}

/** Referenz-Breitseite: 37 Geschütze (Linienschiff) erzeugen volle Wirkung. */
export const REFERENCE_BROADSIDE_GUNS = 37;

export function fireBroadside(rigId: RigId, ammoId: AmmoTypeId, distanceMeters: number, seed: number = 42): BroadsideResult {
  const rig = getRig(rigId) || RIGS[0];
  const ammo = getAmmoType(ammoId) || AMMO_TYPES[0];
  const rng = createSeededRandom(hashString(`broadside:${rigId}:${ammoId}:${Math.round(distanceMeters)}:${seed}`));

  const distance = Math.max(0, distanceMeters);
  const rangeEffect = distance >= ammo.effectiveRangeMeters ? Math.max(0, 1 - (distance - ammo.effectiveRangeMeters) / ammo.effectiveRangeMeters) : 1;
  const variance = 0.85 + rng() * 0.3;

  const guns = rig.gunsPerBroadside;
  // Wirkung wird gegen eine Referenz-Breitseite normiert, damit 37 Geschütze volle Wirkung entfalten.
  const gunFactor = guns / REFERENCE_BROADSIDE_GUNS;
  const hullDamagePercent = Math.round(Math.min(100, gunFactor * 100 * ammo.hullDamage * rangeEffect * variance));
  const riggingDamagePercent = Math.round(Math.min(100, gunFactor * 100 * ammo.riggingDamage * rangeEffect * variance));
  const crewCasualties = Math.round(gunFactor * 30 * ammo.crewDamage * rangeEffect * variance);

  const summary =
    distance > ammo.effectiveRangeMeters * 2
      ? "Die Kugeln fallen kurz — das Wasser spritzt vor dem Ziel auf."
      : `${guns} Geschütze feuern ${ammo.name} auf ${distance} m: ${hullDamagePercent}% Rumpfschaden, ${riggingDamagePercent}% Takelage, ${crewCasualties} Gefallene.`;

  return {
    ammo,
    distanceMeters: distance,
    rangeEffect: Math.round(rangeEffect * 100) / 100,
    hullDamagePercent,
    riggingDamagePercent,
    crewCasualties,
    summary,
  };
}

export interface BattlePassage {
  text: string;
  imagesUsed: string[];
}

const BATTLE_IMAGES = [
  "Splitterndes Eichenholz regnete über das Deck wie ein Hagel aus Messern.",
  "Pulverqualm wallte gelb und beißend über die Reling und fraß das Tageslicht.",
  "Der Seewind pfiff durch die zerschossenen Wanten und sang in den Kugellöchern.",
  "Eine Rahe krachte herab und zog ein Netz aus Tauwerk und Segeltuch hinter sich her.",
  "Die Karronade bäumte sich auf, und ihr Donner rollte über die Dünung wie ein zweiter Sturm.",
  "Männer rutschten auf dem blutigen Plankengang und klammerten sich an die Püttinge.",
  "Der Rumpf ächzte in jeder Planke, als hätte das Schiff begonnen zu sterben.",
  "Über der Wasserlinie klafften drei Löcher, und die See schluckte sie gierig.",
];

export function generateBattlePassage(imageCount: number = 3, seed: number = 42): BattlePassage {
  const rng = createSeededRandom(hashString(`passage:${imageCount}:${seed}`));
  const total = Math.max(1, Math.min(imageCount, BATTLE_IMAGES.length));
  const used: string[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (used.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * BATTLE_IMAGES.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    used.push(BATTLE_IMAGES[idx]);
  }
  return { text: used.join(" "), imagesUsed: used };
}

export interface NavalEngagement {
  id: string;
  attacker: SailingState;
  defender: SailingState;
  broadside: BroadsideResult;
  passage: BattlePassage;
  /** Wer nach der Salve die Oberhand hat. */
  advantage: "attacker" | "defender" | "even";
}

export function simulateEngagement(
  attackerRig: RigId,
  defenderRig: RigId,
  ammoId: AmmoTypeId,
  distanceMeters: number,
  windSpeedKnots: number = 15,
  seed: number = 42
): NavalEngagement {
  const attacker = calculateSailing(attackerRig, 90, windSpeedKnots);
  const defender = calculateSailing(defenderRig, 135, windSpeedKnots);
  const broadside = fireBroadside(attackerRig, ammoId, distanceMeters, seed);
  const passage = generateBattlePassage(3, seed);

  const score = broadside.hullDamagePercent + broadside.riggingDamagePercent * 0.6;
  const advantage = score > 90 ? "attacker" : score > 45 ? "even" : "defender";

  return {
    id: `ENGAGE-${hashString(`${attackerRig}:${defenderRig}:${ammoId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    attacker,
    defender,
    broadside,
    passage,
    advantage,
  };
}

export function createSampleSailingState(): SailingState {
  return calculateSailing("frigate", 90, 18);
}

export function createSampleEngagement(): NavalEngagement {
  return simulateEngagement("frigate", "brig", "roundShot", 400, 18, 42);
}
