// HeraldicBlazonStudio (WP 88.1)
// Heraldisches Wappen- & Blasonierungs-Studio.
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

export type TinctureType = "metal" | "color" | "fur";

export interface Tincture {
  name: string;
  heraldicName: string;
  type: TinctureType;
  hex: string;
  abbreviation: string;
}

export interface Charge {
  name: string;
  heraldicName: string;
  defaultTincture: string;
  description: string;
}

export interface Division {
  name: string;
  heraldicName: string;
  description: string;
}

export interface CoatOfArms {
  id: string;
  name: string;
  fieldTincture: string;
  division?: string;
  charges: Array<{
    charge: string;
    tincture: string;
    position?: string;
  }>;
  motto?: string;
  mottoLanguage: "de" | "fr" | "la";
  blazoningDe: string;
  blazoningFr: string;
  createdAt: string;
}

const TINCTURES: Tincture[] = [
  { name: "Gold", heraldicName: "Or", type: "metal", hex: "#FFD700", abbreviation: "O" },
  { name: "Silber", heraldicName: "Argent", type: "metal", hex: "#C0C0C0", abbreviation: "A" },
  { name: "Rot", heraldicName: "Gules", type: "color", hex: "#FF0000", abbreviation: "G" },
  { name: "Blau", heraldicName: "Azure", type: "color", hex: "#0000FF", abbreviation: "B" },
  { name: "Grün", heraldicName: "Vert", type: "color", hex: "#008000", abbreviation: "V" },
  { name: "Schwarz", heraldicName: "Sable", type: "color", hex: "#000000", abbreviation: "S" },
  { name: "Purpur", heraldicName: "Purpure", type: "color", hex: "#800080", abbreviation: "P" },
  { name: "Hermelin", heraldicName: "Ermine", type: "fur", hex: "#FFFFFF", abbreviation: "E" },
  { name: "Feh", heraldicName: "Vair", type: "fur", hex: "#E0E0E0", abbreviation: "V" },
];

const CHARGES: Charge[] = [
  { name: "Löwe", heraldicName: "Lion", defaultTincture: "Gules", description: "Aufrechter, rot bewehrter Löwe" },
  { name: "Greif", heraldicName: "Griffin", defaultTincture: "Or", description: "Halber Löwe, halber Adler" },
  { name: "Adler", heraldicName: "Eagle", defaultTincture: "Sable", description: "Ausgebreiteter Adler" },
  { name: "Hirsch", heraldicName: "Stag", defaultTincture: "Or", description: "Springender Hirsch" },
  { name: "Eber", heraldicName: "Boar", defaultTincture: "Sable", description: "Wilder Eber" },
  { name: "Rabe", heraldicName: "Raven", defaultTincture: "Sable", description: "Schwarzer Rabe" },
  { name: "Rose", heraldicName: "Rose", defaultTincture: "Gules", description: "Fünfblättrige Rose" },
  { name: "Lilie", heraldicName: "Fleur-de-lis", defaultTincture: "Or", description: "Goldene Lilie" },
  { name: "Kreuz", heraldicName: "Cross", defaultTincture: "Argent", description: "Gemeines Kreuz" },
  { name: "Turm", heraldicName: "Tower", defaultTincture: "Argent", description: "Zinnengekrönter Turm" },
];

const DIVISIONS: Division[] = [
  { name: "geteilt", heraldicName: "party per fess", description: "Horizontal geteilt" },
  { name: "gespalten", heraldicName: "party per pale", description: "Vertikal gespalten" },
  { name: "schräglinks geteilt", heraldicName: "party per bend", description: "Diagonal von rechts oben nach links unten" },
  { name: "schrägrechts geteilt", heraldicName: "party per bend sinister", description: "Diagonal von links oben nach rechts unten" },
  { name: "geviert", heraldicName: "quarterly", description: "In vier Felder geviertelt" },
  { name: "gescheckert", heraldicName: "checky", description: "Schachbrettmuster" },
  { name: "pfahlweise", heraldicName: "paly", description: "Senkrechte Streifen" },
  { name: "balkenweise", heraldicName: "barry", description: "Waagrechte Streifen" },
];

const MOTTOS_DE = [
  "Fides et fortitudo", "Semper fidelis", "Virtus sola nobilitat",
  "Per aspera ad astra", "Fortitudine vincit", "Honor et gloria",
];

const MOTTOS_FR = [
  "Foi et valeur", "Toujours fidèle", "La vertu seule ennoblit",
  "Par les rudes chemins vers les étoiles", "La force triomphe", "Honneur et gloire",
];

const MOTTOS_LA = [
  "Fides et fortitudo", "Semper fidelis", "Virtus sola nobilitat",
  "Per aspera ad astra", "Fortitudine vincit", "Honor et gloria",
];

function getTincture(name: string): Tincture | undefined {
  return TINCTURES.find(t => t.name.toLowerCase() === name.toLowerCase() || t.heraldicName.toLowerCase() === name.toLowerCase());
}

export function getTinctureType(tinctureName: string): TinctureType {
  const t = getTincture(tinctureName);
  return t?.type || "color";
}

export function checkTinctureRule(tincture1: string, tincture2: string): boolean {
  const type1 = getTinctureType(tincture1);
  const type2 = getTinctureType(tincture2);
  // Metalle nicht auf Metalle, Farben nicht auf Farben (Felle sind neutral)
  if (type1 === "metal" && type2 === "metal") return false;
  if (type1 === "color" && type2 === "color") return false;
  return true;
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createCoatOfArms(name: string, seed: number = 42): CoatOfArms {
  const rng = createSeededRandom(hashString(name + seed));
  const fieldTincture = pickRandom(TINCTURES.filter(t => t.type !== "fur"), rng).name;
  const useDivision = rng() < 0.3;
  const division = useDivision ? pickRandom(DIVISIONS, rng).name : undefined;

  const chargeCount = 1 + Math.floor(rng() * 3);
  const charges = [];
  for (let i = 0; i < chargeCount; i++) {
    const charge = pickRandom(CHARGES, rng);
    let chargeTincture = pickRandom(TINCTURES.filter(t => t.type !== "fur"), rng).name;
    // Sicherstellen, dass Tincture-Regel eingehalten wird
    if (!checkTinctureRule(fieldTincture, chargeTincture)) {
      const validTinctures = TINCTURES.filter(t => t.type !== "fur" && checkTinctureRule(fieldTincture, t.name));
      if (validTinctures.length > 0) {
        chargeTincture = pickRandom(validTinctures, rng).name;
      }
    }
    charges.push({
      charge: charge.name,
      tincture: chargeTincture,
      position: i === 0 ? "im Schildhaupt" : i === 1 ? "im Mittelfeld" : "im Schildfuß",
    });
  }

  const mottoLang = pickRandom(["de", "fr", "la"] as const, rng);
  const motto = mottoLang === "de" ? pickRandom(MOTTOS_DE, rng) :
    mottoLang === "fr" ? pickRandom(MOTTOS_FR, rng) : pickRandom(MOTTOS_LA, rng);

  const blazoningDe = generateBlazoningDe(fieldTincture, division, charges, motto);
  const blazoningFr = generateBlazoningFr(fieldTincture, division, charges, motto);

  return {
    id: `COA-${hashString(name + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    fieldTincture,
    division,
    charges,
    motto,
    mottoLanguage: mottoLang,
    blazoningDe,
    blazoningFr,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

function generateBlazoningDe(field: string, div: string | undefined, charges: CoatOfArms["charges"], motto: string): string {
  const t = getTincture(field);
  let text = `In ${t?.heraldicName || field}`;
  if (div) text += ` ${div}`;
  text += ` `;
  if (charges.length === 1) {
    const c = charges[0];
    const ct = getTincture(c.tincture);
    text += `ein ${ct?.heraldicName || c.tincture} ${c.charge.toLowerCase()}`;
  } else {
    text += `${charges.length} `;
    charges.forEach((c, i) => {
      const ct = getTincture(c.tincture);
      text += `${i > 0 ? " und " : ""}${ct?.heraldicName || c.tincture} ${c.charge.toLowerCase()}${c.position ? ` ${c.position}` : ""}`;
    });
  }
  if (motto) text += `. Devise: "${motto}"`;
  return text + ".";
}

function generateBlazoningFr(field: string, div: string | undefined, charges: CoatOfArms["charges"], motto: string): string {
  const t = getTincture(field);
  let text = `D'${t?.heraldicName?.toLowerCase() || field.toLowerCase()}`;
  if (div) {
    const d = DIVISIONS.find(d => d.name === div);
    text += ` ${d?.heraldicName || div}`;
  }
  text += ` `;
  if (charges.length === 1) {
    const c = charges[0];
    const ct = getTincture(c.tincture);
    text += `à un ${c.charge.toLowerCase()} de ${ct?.heraldicName?.toLowerCase() || c.tincture.toLowerCase()}`;
  } else {
    charges.forEach((c, i) => {
      const ct = getTincture(c.tincture);
      text += `${i > 0 ? " et " : ""}un ${c.charge.toLowerCase()} de ${ct?.heraldicName?.toLowerCase() || c.tincture.toLowerCase()}`;
    });
  }
  if (motto) text += `. Devise: "${motto}"`;
  return text + ".";
}

export function validateTinctureRule(tincture1: string, tincture2: string): { valid: boolean; reason?: string } {
  const type1 = getTinctureType(tincture1);
  const type2 = getTinctureType(tincture2);
  if (type1 === "metal" && type2 === "metal") {
    return { valid: false, reason: "Metall auf Metall verboten (Or/Argent auf Or/Argent)" };
  }
  if (type1 === "color" && type2 === "color") {
    return { valid: false, reason: "Farbe auf Farbe verboten (Gules/Azure/Vert/Sable aufeinander)" };
  }
  return { valid: true };
}

export function createSampleCoatOfArms(): CoatOfArms {
  return createCoatOfArms("Haus Falkenstein", 42);
}

export function createSampleBlazoning(): { de: string; fr: string } {
  const coa = createSampleCoatOfArms();
  return { de: coa.blazoningDe, fr: coa.blazoningFr };
}