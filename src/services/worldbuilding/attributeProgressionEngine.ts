// AttributeProgressionEngine (WP 134.1)
// Attributs-Skalierungs- & Stufen-Engine für Progression Fantasy & LitRPG.
// 3 Skalierungskurven, 5 Rangstufen, Physik-Äquivalente.
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
// 1. Kernattribute
// ---------------------------------------------------------------------------

export type AttributeId =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "luck"
  | "mana";

export interface AttributeDef {
  id: AttributeId;
  name: string;
  short: string;
  description: string;
  baseValue: number;
  growthRate: number; // pro Level
}

export const ATTRIBUTE_DEFS: AttributeDef[] = [
  { id: "strength", name: "Stärke", short: "STR", description: "Rohe physische Kraft — Heben, Zerbrechen, Kampf.", baseValue: 5, growthRate: 1.2 },
  { id: "dexterity", name: "Geschicklichkeit", short: "DEX", description: "Geschwindigkeit, Reflexe, Präzision.", baseValue: 5, growthRate: 1.1 },
  { id: "constitution", name: "Konstitution", short: "CON", description: "Ausdauer, Widerstand, Lebenskraft.", baseValue: 5, growthRate: 1.15 },
  { id: "intelligence", name: "Intelligenz", short: "INT", description: "Logik, Analyse, magisches Verständnis.", baseValue: 5, growthRate: 1.1 },
  { id: "wisdom", name: "Weisheit", short: "WIS", description: "Intuition, Wahrnehmung, Willenskraft.", baseValue: 5, growthRate: 1.05 },
  { id: "charisma", name: "Charisma", short: "CHA", description: "Überzeugungskraft, Führung, Ausstrahlung.", baseValue: 5, growthRate: 1.0 },
  { id: "luck", name: "Glück", short: "LUK", description: "Zufall, Kritische Treffer, Schicksal.", baseValue: 5, growthRate: 0.8 },
  { id: "mana", name: "Mana", short: "MAN", description: "Magische Energie, Zauberkraft.", baseValue: 5, growthRate: 1.3 },
];

// ---------------------------------------------------------------------------
// 2. Skalierungskurven
// ---------------------------------------------------------------------------

export type ScalingCurve = "linear" | "exponential" | "logarithmic";

export interface ScalingResult {
  level: number;
  value: number;
  delta: number; // Differenz zum vorherigen Level
  percentIncrease: number; // prozentuale Steigerung
}

export function scaleAttribute(
  baseValue: number,
  growthRate: number,
  level: number,
  curve: ScalingCurve
): ScalingResult {
  if (level < 1) throw new Error("Level must be >= 1");
  if (level === 1) {
    return { level, value: baseValue, delta: 0, percentIncrease: 0 };
  }

  let value: number;
  switch (curve) {
    case "linear":
      value = baseValue + growthRate * (level - 1);
      break;
    case "exponential":
      value = baseValue * Math.pow(1 + growthRate / 10, level - 1);
      break;
    case "logarithmic":
      // Soft-Cap: abnehmender Grenznutzen
      value = baseValue + growthRate * Math.log2(level) * 5;
      break;
  }

  const prevValue = scaleAttribute(baseValue, growthRate, level - 1, curve).value;
  const delta = value - prevValue;
  const percentIncrease = prevValue > 0 ? (delta / prevValue) * 100 : 0;

  return { level, value: Math.round(value * 100) / 100, delta: Math.round(delta * 100) / 100, percentIncrease: Math.round(percentIncrease * 100) / 100 };
}

export function generateProgressionTable(
  baseValue: number,
  growthRate: number,
  maxLevel: number,
  curve: ScalingCurve
): ScalingResult[] {
  const results: ScalingResult[] = [];
  for (let i = 1; i <= maxLevel; i++) {
    results.push(scaleAttribute(baseValue, growthRate, i, curve));
  }
  return results;
}

// ---------------------------------------------------------------------------
// 3. Rangstufen (Tiers)
// ---------------------------------------------------------------------------

export type TierId = "mortal" | "iron" | "gold" | "ascended" | "demigod";

export interface Tier {
  id: TierId;
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  description: string;
}

export const TIERS: Tier[] = [
  { id: "mortal", name: "Sterblich", minLevel: 1, maxLevel: 20, color: "#9e9e9e", description: "Gewöhnliche Menschen, keine besonderen Fähigkeiten." },
  { id: "iron", name: "Eisen", minLevel: 21, maxLevel: 40, color: "#78909c", description: "Gelernte Krieger und Magier, erste Meisterungen." },
  { id: "gold", name: "Gold", minLevel: 41, maxLevel: 60, color: "#ffd54f", description: "Elite-Kräfte, legendäre Taten." },
  { id: "ascended", name: "Aufgestiegen", minLevel: 61, maxLevel: 80, color: "#ce93d8", description: "Übermenschliche Existenz, göttliche Kraft." },
  { id: "demigod", name: "Halbgott", minLevel: 81, maxLevel: 100, color: "#80deea", description: "Nahe göttliche Macht, Welt verändernd." },
];

export function getTierForLevel(level: number): Tier {
  const tier = TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel);
  if (!tier) throw new Error(`Level ${level} out of range 1-100`);
  return tier;
}

export function getNextTier(level: number): Tier | null {
  const current = getTierForLevel(level);
  const idx = TIERS.indexOf(current);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

// ---------------------------------------------------------------------------
// 4. Physik-Äquivalente
// ---------------------------------------------------------------------------

export interface PhysicsEquivalent {
  attribute: AttributeId;
  value: number;
  description: string;
  realWorldComparison: string;
}

export function getPhysicsEquivalent(attribute: AttributeId, value: number): PhysicsEquivalent {
  switch (attribute) {
    case "strength": {
      const kn = Math.round(value * 0.35 * 10) / 10;
      const canLift = Math.round(value * 15);
      return {
        attribute, value,
        description: `Stärke ${value}: Hebt ca. ${canLift} kg, Schlagkraft ca. ${kn} kN.`,
        realWorldComparison: value < 10 ? "Durchschnittlicher Mensch" : value < 25 ? "Trainierter Athlet" : value < 50 ? "Stärkster Mensch der Welt" : value < 80 ? "Übermenschlich" : "Göttlich",
      };
    }
    case "dexterity": {
      const reactionMs = Math.max(50, Math.round(300 - value * 2));
      return {
        attribute, value,
        description: `Geschicklichkeit ${value}: Reaktionszeit ca. ${reactionMs} ms.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Gewichtsklasse" : value < 50 ? "Olympiateilnehmer" : value < 80 ? "Übermenschlich" : "Göttlich",
      };
    }
    case "constitution": {
      const hp = Math.round(value * 10);
      return {
        attribute, value,
        description: `Konstitution ${value}: Lebenspunkte ca. ${hp}, hohe Widerstandsfähigkeit.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Gesund" : value < 50 ? "Eisern" : value < 80 ? "Unverwundbar" : "Göttlich",
      };
    }
    case "intelligence": {
      const iq = Math.round(100 + value * 2);
      return {
        attribute, value,
        description: `Intelligenz ${value}: IQ ca. ${iq}, analytische Brillanz.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Hochbegabt" : value < 50 ? "Genie" : value < 80 ? "Übermenschlich" : "Göttlich",
      };
    }
    case "wisdom": {
      return {
        attribute, value,
        description: `Weisheit ${value}: Tiefe Intuition, starke Willenskraft.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Klug" : value < 50 ? "Weise" : value < 80 ? "Seherisch" : "Göttlich",
      };
    }
    case "charisma": {
      return {
        attribute, value,
        description: `Charisma ${value}: Faszination, Führung, Überzeugungskraft.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Sympathisch" : value < 50 ? "Magnetisch" : value < 80 ? "Hypnotisch" : "Göttlich",
      };
    }
    case "luck": {
      const critChance = Math.min(50, Math.round(value * 0.5));
      return {
        attribute, value,
        description: `Glück ${value}: Kritische Treffer ca. ${critChance}%.`,
        realWorldComparison: value < 10 ? "Durchschnittlich" : value < 25 ? "Glücklich" : value < 50 ? "Segen" : value < 80 ? "Wunder" : "Göttlich",
      };
    }
    case "mana": {
      const spellPower = Math.round(value * 5);
      return {
        attribute, value,
        description: `Mana ${value}: Magische Energie ca. ${spellPower} MP.`,
        realWorldComparison: value < 10 ? "Leer" : value < 25 ? "Lehrling" : value < 50 ? "Magier" : value < 80 ? "Erzmagier" : "Göttlich",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Power-Creep-Analyse
// ---------------------------------------------------------------------------

export interface PowerCreepAnalysis {
  curve: ScalingCurve;
  level10: number;
  level50: number;
  level100: number;
  ratio10to100: number;
  verdict: "balanced" | "moderate" | "severe";
  recommendation: string;
}

export function analyzePowerCreep(
  baseValue: number,
  growthRate: number,
  curve: ScalingCurve
): PowerCreepAnalysis {
  const l10 = scaleAttribute(baseValue, growthRate, 10, curve).value;
  const l50 = scaleAttribute(baseValue, growthRate, 50, curve).value;
  const l100 = scaleAttribute(baseValue, growthRate, 100, curve).value;
  const ratio = Math.round((l100 / l10) * 100) / 100;

  let verdict: "balanced" | "moderate" | "severe";
  let recommendation: string;

  if (ratio < 50) {
    verdict = "balanced";
    recommendation = "Gute Balance. Das Wachstum bleibt über 100 Level kontrollierbar.";
  } else if (ratio < 200) {
    verdict = "moderate";
    recommendation = "Moderates Power Creep. Betrachte Soft-Caps oder abnehmende Steigerungen.";
  } else {
    verdict = "severe";
    recommendation = "Kritisches Power Creep! Level 100 ist unspielbar stark. Reduziere growthRate oder nutze logarithmische Skalierung.";
  }

  return { curve, level10: l10, level50: l50, level100: l100, ratio10to100: ratio, verdict, recommendation };
}

// ---------------------------------------------------------------------------
// 6. Hilfsfunktionen
// ---------------------------------------------------------------------------

export function createSampleAttribute(): AttributeDef {
  return ATTRIBUTE_DEFS[0];
}

export function getAllAttributes(): AttributeDef[] {
  return [...ATTRIBUTE_DEFS];
}

export function getAttributeById(id: AttributeId): AttributeDef {
  const attr = ATTRIBUTE_DEFS.find((a) => a.id === id);
  if (!attr) throw new Error(`Unknown attribute: ${id}`);
  return attr;
}

export function compareCurves(
  baseValue: number,
  growthRate: number,
  level: number
): Record<ScalingCurve, number> {
  return {
    linear: scaleAttribute(baseValue, growthRate, level, "linear").value,
    exponential: scaleAttribute(baseValue, growthRate, level, "exponential").value,
    logarithmic: scaleAttribute(baseValue, growthRate, level, "logarithmic").value,
  };
}
