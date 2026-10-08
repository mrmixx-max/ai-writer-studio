// CyberneticAugmentationLedger (WP 112.2)
// Cyberware- & Transhumanismus-Hauptbuch.
// 5 Augmentierungs-Slots, Menschlichkeitsverlust-Index, Glitch-Prosa.
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

export type AugmentationSlotId = "neural" | "optics" | "limbs" | "organs" | "armor";

export interface AugmentationSlot {
  id: AugmentationSlotId;
  name: string;
  description: string;
  /** Energieverbrauch in Watt. */
  powerDraw: number;
  /** Bio-Kompatibilität 0..1 (1 = voll kompatibel). */
  bioCompatibility: number;
  /** Menschlichkeitsverlust je Einbau 0..1. */
  humanityLoss: number;
  /** Phantomschmerz-Intensität 0..1. */
  phantomPain: number;
  /** Medikamentenabhängigkeit 0..1. */
  drugDependency: number;
}

export const AUGMENTATION_SLOTS: AugmentationSlot[] = [
  {
    id: "neural",
    name: "Neuro-Interface (Neural Lace)",
    description: "Direkte Gehirn-Maschine-Schnittstelle. Ermöglicht Gedankensteuerung und Datenzugriff.",
    powerDraw: 15,
    bioCompatibility: 0.7,
    humanityLoss: 0.3,
    phantomPain: 0.2,
    drugDependency: 0.4,
  },
  {
    id: "optics",
    name: "Sensorische Cyberoptik",
    description: "Künstliche Augen mit Nachtsicht, Zoom und HUD-Einblendungen.",
    powerDraw: 8,
    bioCompatibility: 0.85,
    humanityLoss: 0.15,
    phantomPain: 0.1,
    drugDependency: 0.2,
  },
  {
    id: "limbs",
    name: "Künstliche Gliedmaßen",
    description: "Prothesen mit verstärkter Kraft, Schnelligkeit und modularen Werkzeugen.",
    powerDraw: 25,
    bioCompatibility: 0.75,
    humanityLoss: 0.25,
    phantomPain: 0.5,
    drugDependency: 0.3,
  },
  {
    id: "organs",
    name: "Biosynthetische Organe",
    description: "Künstliche Herz, Lunge, Leber und Nieren. Immunsuppressiva erforderlich.",
    powerDraw: 12,
    bioCompatibility: 0.6,
    humanityLoss: 0.2,
    phantomPain: 0.15,
    drugDependency: 0.8,
  },
  {
    id: "armor",
    name: "Subdermale Panzerung",
    description: "Kevlar-ähnliche Schicht unter der Haut. Schutz vor Schüssen und Stichen.",
    powerDraw: 5,
    bioCompatibility: 0.9,
    humanityLoss: 0.1,
    phantomPain: 0.05,
    drugDependency: 0.1,
  },
];

export function getAugmentationSlot(id: AugmentationSlotId): AugmentationSlot | undefined {
  return AUGMENTATION_SLOTS.find((s) => s.id === id);
}

export interface AugmentationProfile {
  id: string;
  installed: AugmentationSlot[];
  /** Gesamtenergieverbrauch in Watt. */
  totalPowerDraw: number;
  /** Durchschnittliche Bio-Kompatibilität 0..1. */
  avgBioCompatibility: number;
  /** Kumulierter Menschlichkeitsverlust 0..1. */
  totalHumanityLoss: number;
  /** Durchschnittlicher Phantomschmerz 0..1. */
  avgPhantomPain: number;
  /** Durchschnittliche Medikamentenabhängigkeit 0..1. */
  avgDrugDependency: number;
  /** Dissoziations-Index 0..1 (1 = vollständige Entfremdung). */
  dissociationIndex: number;
}

export function calculateAugmentationProfile(slotIds: AugmentationSlotId[], seed: number = 42): AugmentationProfile {
  const installed = slotIds.map((id) => getAugmentationSlot(id)).filter((s): s is AugmentationSlot => s !== undefined);
  const totalPowerDraw = installed.reduce((sum, s) => sum + s.powerDraw, 0);
  const avgBioCompatibility = installed.length > 0 ? installed.reduce((sum, s) => sum + s.bioCompatibility, 0) / installed.length : 0;
  const totalHumanityLoss = Math.min(1, installed.reduce((sum, s) => sum + s.humanityLoss, 0));
  const avgPhantomPain = installed.length > 0 ? installed.reduce((sum, s) => sum + s.phantomPain, 0) / installed.length : 0;
  const avgDrugDependency = installed.length > 0 ? installed.reduce((sum, s) => sum + s.drugDependency, 0) / installed.length : 0;
  const dissociationIndex = Math.min(1, totalHumanityLoss * 0.6 + avgPhantomPain * 0.2 + avgDrugDependency * 0.2);

  return {
    id: `AUG-${hashString(`${slotIds.join(",")}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    installed,
    totalPowerDraw,
    avgBioCompatibility: Math.round(avgBioCompatibility * 100) / 100,
    totalHumanityLoss: Math.round(totalHumanityLoss * 100) / 100,
    avgPhantomPain: Math.round(avgPhantomPain * 100) / 100,
    avgDrugDependency: Math.round(avgDrugDependency * 100) / 100,
    dissociationIndex: Math.round(dissociationIndex * 100) / 100,
  };
}

const GLITCH_IMAGES = [
  "Die Firmware stürzte ab, und für einen Herzschlag war alles schwarz — dann flackerten die Netzhaut-Einblendungen zurück, verzerrt und falsch.",
  "Ein Daten-Glitch riss durch die Sicht, als würde jemand mit einer Schere durch die Realität schneiden. Die HUD-Symbole zerfielen zu Pixeln.",
  "Thermische Überhitzung: Die Cyberoptik wurde heiß, und die Welt verschwamm in einem Schleier aus Wärme und Rauschen.",
  "Die subdermale Panzerung spannte sich an, als würde jemand von innen gegen die Haut drücken. Ein Phantomschmerz durchzuckte den Arm.",
  "Das Neuro-Interface piepste — ein Ton, der nicht existieren sollte — und dann war da eine Stimme, die nicht die eigene war.",
  "Die künstliche Hand zuckte, Finger schlossen sich um nichts, und für einen Moment wusste der Körper nicht mehr, wo er endete.",
];

export function generateGlitchProse(imageCount: number = 3, seed: number = 42): string {
  const rng = createSeededRandom(hashString(`glitch:${imageCount}:${seed}`));
  const total = Math.max(1, Math.min(imageCount, GLITCH_IMAGES.length));
  const used: string[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while (used.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * GLITCH_IMAGES.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    used.push(GLITCH_IMAGES[idx]);
  }
  return used.join(" ");
}

export interface CyberwareReport {
  id: string;
  profile: AugmentationProfile;
  glitchProse: string;
  /** Empfohlene Medikamentendosis (fiktiv). */
  medicationSchedule: string;
}

export function analyzeCyberware(slotIds: AugmentationSlotId[], seed: number = 42): CyberwareReport {
  const profile = calculateAugmentationProfile(slotIds, seed);
  const glitchProse = generateGlitchProse(3, seed);
  const medicationSchedule = profile.avgDrugDependency > 0.5
    ? "Täglich: Immunsuppressiva 20mg, Neuro-Stabilisatoren 10mg"
    : profile.avgDrugDependency > 0.2
      ? "Wöchentlich: Immunsuppressiva 10mg"
      : "Keine Medikamente erforderlich";

  return {
    id: `CYBER-${hashString(`${slotIds.join(",")}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    profile,
    glitchProse,
    medicationSchedule,
  };
}

export function createSampleAugmentationProfile(): AugmentationProfile {
  return calculateAugmentationProfile(["neural", "optics", "limbs"], 42);
}

export function createSampleCyberwareReport(): CyberwareReport {
  return analyzeCyberware(["neural", "optics", "limbs"], 42);
}
