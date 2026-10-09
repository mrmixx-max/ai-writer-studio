// ArmorMetallurgySimulator (WP 122.1)
// Rüstungs-Metallurgie & Durchschlag-Simulator für historische Romane.
// Vier Rüstungsschichten, eine Waffen-Treffer-Matrix und viszerale Kampfprosa.
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

// ---------------------------------------------------------------------------
// 1. Vier Rüstungsschichten
// ---------------------------------------------------------------------------

export interface ArmorLayer {
  id: string;
  name: string;
  description: string;
  hardness: number; // 0-10
  weight: number; // relatives Gewicht (beliebige Einheit, vergleichbar)
  coverage: number; // 0-1
}

export const ARMOR_LAYERS = [
  {
    id: "gambeson",
    name: "Wattiertes Gambeson/Aketon",
    description:
      "Aus vielen Lagen Leinen gesteppt und mit Wolle oder Hadern ausgestopft. Fängt Hiebe ab, indem es die Wucht verteilt, und dämpft Stiche durch die schiere Dicke des Polsters.",
    hardness: 1,
    weight: 3,
    coverage: 0.95,
  },
  {
    id: "mail",
    name: "Vernietetes Kettenhemd",
    description:
      "Tausende ineinandergreifende Eisenringe, vernietet statt nur geschweißt. Ein biegsames Geflecht, das Schnittwunden verhindert, doch gegen die rohe Wucht stumpfer Treffer wenig ausrichtet.",
    hardness: 4,
    weight: 9,
    coverage: 0.8,
  },
  {
    id: "plate",
    name: "Gehärteter Plattenharnisch",
    description:
      "Aus dem Ganzen getriebene, im Wasser oder Öl gehärtete Stahlplatten. Sie lassen Stiche und Schnitte abgleiten, kippen die Spitze ab — doch ein wuchtiger Sturz auf harten Grund bricht das Blech und die Knochen darunter.",
    hardness: 9,
    weight: 22,
    coverage: 0.7,
  },
  {
    id: "surcoat",
    name: "Wappenrock",
    description:
      "Der lose übergeworfene Stoffrock mit dem Wappen des Geschlechts. Er schützt kaum den Leib, doch er polstert die Ränder des Harnischs, dämpft Scheuern und verrät dem Feind den Namen des Mannes.",
    hardness: 0,
    weight: 1,
    coverage: 0.35,
  },
] as const;

export type ArmorLayerId = (typeof ARMOR_LAYERS)[number]["id"];

// ---------------------------------------------------------------------------
// 2. Waffen-Treffer-Matrix
// ---------------------------------------------------------------------------

export interface WeaponType {
  id: string;
  name: string;
  description: string;
  penetration: number; // 0-10
  force: number; // 0-10
  targetArea: string;
}

export const WEAPON_TYPES = [
  {
    id: "swordThrust",
    name: "Schwertstich",
    description:
      "Die Klinge schießt vor, die Spitze sucht eine Fuge zwischen den Platten — Achsel, Hals, Weiche.",
    penetration: 8,
    force: 4,
    targetArea: "Achselhöhle und Visierfuge",
  },
  {
    id: "arrowBodkin",
    name: "Pfeilhagel Bodkin-Spitze",
    description:
      "Eine schmale, vierkantige Nadelfspitze aus gehärtetem Stahl, gefiedert und aus langem Bogen geschleudert, um Rüstung zu durchstoßen.",
    penetration: 9,
    force: 5,
    targetArea: "Brust und Schulterpanzer",
  },
  {
    id: "lanceCharge",
    name: "Lanzenanritt",
    description:
      "Das volle Gewicht von Ross und Reiter hinter einer eisenbeschlagenen Lanze, getragen vom Galopp — eine Wucht, die auch geschlossenes Blech beulen lässt.",
    penetration: 6,
    force: 10,
    targetArea: "Brustkorb und Sattelgurt",
  },
  {
    id: "maceBlow",
    name: "Streitkolbenschlag",
    description:
      "Ein bleierner oder eiserner Kopf auf kurzem Schaft. Er muss keine Platte durchdringen — die übertragene Erschütterung genügt, um Knochen zu brechen.",
    penetration: 2,
    force: 9,
    targetArea: "Helm und Schlüsselbein",
  },
] as const;

export type WeaponTypeId = (typeof WEAPON_TYPES)[number]["id"];

// ---------------------------------------------------------------------------
// Interne Nachschlagetabellen
// ---------------------------------------------------------------------------

function findArmor(armorId: string): ArmorLayer {
  const armor = ARMOR_LAYERS.find((a) => a.id === armorId);
  if (!armor) {
    throw new Error(`Unbekannte Rüstungsschicht: "${armorId}".`);
  }
  return armor as ArmorLayer;
}

function findWeapon(weaponId: string): WeaponType {
  const weapon = WEAPON_TYPES.find((w) => w.id === weaponId);
  if (!weapon) {
    throw new Error(`Unbekannte Waffe: "${weaponId}".`);
  }
  return weapon as WeaponType;
}

// ---------------------------------------------------------------------------
// 3. Treffer-Simulation
// ---------------------------------------------------------------------------

export interface HitResult {
  penetrated: boolean;
  damage: number; // 0-10
  description: string;
  effectiveness: number; // 0-1
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Simuliert einen einzelnen Treffer gegen eine Rüstungsschicht.
 * Der Durchschlag hängt von Durchschlagskraft (penetration) minus
 * Rüstungshärte (hardness) ab; stumpfe Wucht (force) bricht Knochen
 * auch dann, wenn die Haut unversehrt bleibt. Deterministisch pro Seed.
 */
export function simulateHit(weaponId: string, armorId: string, seed: number): HitResult {
  const weapon = findWeapon(weaponId);
  const armor = findArmor(armorId);

  const rng = createSeededRandom(hashString(`${weaponId}|${armorId}|${seed}`));
  const jitter = rng(); // Streuung 0-1

  // Durchschlag-Vorteil: Spitze gegen Härte.
  const penAdvantage = weapon.penetration - armor.hardness * 0.85;
  // Zufällige Streuung von ±1.5 auf die effektive Durchschlagskraft.
  const effectivePen = penAdvantage + (jitter - 0.5) * 3;
  // Trefferfläche der Rüstung dämpft den Durchschlag.
  const coverageFactor = 0.4 + armor.coverage * 0.6;

  const penetrated = effectivePen > 0;

  // Schaden aus Durchdringung und Wucht, gemildert durch die Rüstung.
  let rawDamage: number;
  if (penetrated) {
    rawDamage = weapon.penetration * 0.6 + weapon.force * 0.4 + effectivePen * 0.4;
  } else {
    // Stumpfe Wucht schlägt durch den Panzer hindurch, auch ohne Schnitt.
    rawDamage = weapon.force * 0.75 - armor.hardness * 0.35;
  }
  rawDamage *= coverageFactor;
  const damage = Math.max(0, Math.min(10, round2(rawDamage)));

  // Effektivität: wie gut die Waffe gegen genau diese Rüstung wirkt.
  const effectiveness = Math.max(
    0.05,
    Math.min(1, round2(0.5 + (effectivePen > 0 ? effectivePen * 0.08 : weapon.force * 0.04) + jitter * 0.1))
  );

  const description = penetrated
    ? `Durchschlag: ${weapon.name} durchbricht ${armor.name}. Schaden ${damage}/10, Wirksamkeit ${Math.round(effectiveness * 100)} %.`
    : `Abgewehrt: ${armor.name} hält dem ${weapon.name} stand. Stumpfe Wucht reicht dennoch hindurch. Schaden ${damage}/10, Wirksamkeit ${Math.round(effectiveness * 100)} %.`;

  return { penetrated, damage, description, effectiveness };
}

// ---------------------------------------------------------------------------
// 4. Viszerale Kampfprosa
// ---------------------------------------------------------------------------

const PENETRATION_OPENERS: string[] = [
  "Das berstende Eisen schrie auf, als die Spitze die Platte aufriss.",
  "Mit einem Schrei berstenden Eisens brach die Kante durch den Stahl.",
  "Splitternd zersprang das gehärtete Blech, und die Spitze fand den Weg nach innen.",
  "Ein Knirschen von berstendem Eisen, dann das feuchte Nachgeben von Fleisch.",
];

const BLUNT_HITS: string[] = [
  "Stumpfe Rippenbrüche unter dem Panzer — die Wucht fuhr durch das Blech, als wäre es Papier.",
  "Unter dem Harnisch knackten die Rippen wie trockenes Reisig; das Eisen blieb ganz, der Mann darunter nicht.",
  "Die Wucht trieb durch den Panzer und brach stumpf die Rippen, ohne die Haut zu ritzen.",
  "Ein dumpfer Schlag, dann das splitternde Geräusch von Knochen, die unter geschlossenem Blech nachgaben.",
];

const GRAPPLES: string[] = [
  "Im Hebelgriff des Nahkampfs verdrehte sich der Arm, bis die Rüstung selbst zur Falle wurde.",
  "Sie rangen im Hebelgriff, Atem in schweißnassem Filz, bis ein Gelenk unter dem Panzer nachgab.",
  "Der Hebelgriff im Nahkampf fand die Fuge an der Achsel und riss die Schulter aus dem Gelenk.",
  "Hand am Visier, Knie im Lehm — der Hebelgriff bog den Helm zur Seite, und die Rippen barsten darunter.",
];

const DEATH_IMAGERY: string[] = [
  "Blut sickerte warm durch die Wattierung und tropfte in den Staub.",
  "Röchelnd sank der Mann, das Eisen schwer wie ein Sargdeckel.",
  "Der letzte Atem entwich als Blutschaum durch das gebrochene Visier.",
  "Die Beine gaben nach, und das Gewicht des Harnischs zog ihn in den Dreck.",
];

/**
 * Erzeugt eine viszerale, deterministische Kampfbeschreibung für einen
 * Treffer. Enthält je nach Ausgang berstendes Eisen, stumpfe Rippenbrüche
 * unter dem Panzer und den Hebelgriff im Nahkampf.
 */
export function generateCombatProse(weaponId: string, armorId: string, seed: number): string {
  const weapon = findWeapon(weaponId);
  const armor = findArmor(armorId);
  const hit = simulateHit(weaponId, armorId, seed);

  const rng = createSeededRandom(hashString(`prose|${weaponId}|${armorId}|${seed}`));

  const parts: string[] = [];

  if (hit.penetrated) {
    parts.push(pick(PENETRATION_OPENERS, rng));
    // Berstendes Eisen gehört zum durchschlagenden Treffer.
    parts.push(
      `Die ${weapon.name} stieß in die ${weapon.targetArea.toLowerCase()} und riss ${armor.name} auf.`
    );
    parts.push(pick(DEATH_IMAGERY, rng));
  } else {
    // Stumpfer Treffer: Wucht statt Durchschlag, Eisen hält, Knochen nicht.
    parts.push(pick(BLUNT_HITS, rng));
    parts.push(
      `${weapon.name} traf die ${armor.name}, ohne sie zu durchdringen — die Wucht allein genügte.`
    );
  }

  // Der Hebelgriff im Nahkampf gehört bei jedem wuchtigen Treffer dazu.
  if (weapon.force >= 6 || !hit.penetrated) {
    parts.push(pick(GRAPPLES, rng));
  } else {
    parts.push(pick(GRAPPLES, rng));
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Sample-Factories
// ---------------------------------------------------------------------------

export function createSampleArmorLayer(): ArmorLayer {
  return { ...(findArmor("plate") as ArmorLayer) };
}

export function createSampleWeapon(): WeaponType {
  return { ...(findWeapon("maceBlow") as WeaponType) };
}
