/**
 * Dynastie-Engine-Service — WP 30.2 (Epilog-Webstuhl & Dynastien-Chronik)
 *
 * Lokaler, deterministischer Service zur Modellierung von Stammbäumen,
 * biologischer Plausibilitätsprüfung und Epilog-Zeitleisten.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Race = 'human' | 'elf' | 'dwarf';

export interface DynastyMember {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number;
  title: string;
  race: Race;
  parentIds: string[];
  spouseIds: string[];
}

export interface Dynasty {
  id: string;
  name: string;
  members: DynastyMember[];
}

export interface PlausibilityResult {
  plausible: boolean;
  issues: string[];
}

export interface EpilogueEntry {
  year: number;
  memberName: string;
  event: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const RACE_LIFESPAN: Record<Race, { min: number; max: number }> = {
  human: { min: 14, max: 80 },
  elf: { min: 50, max: 500 },
  dwarf: { min: 40, max: 200 },
};

const MOTHER_MIN_AGE = 14;
const MOTHER_MAX_AGE = 50;
const FATHER_MIN_AGE = 12;
const FATHER_MAX_AGE = 80;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Erstellt eine Dynastie mit sortierten Mitgliedern.
 */
export function createDynasty(members: DynastyMember[]): Dynasty {
  if (!members || members.length === 0) {
    return { id: 'dynasty-1', name: 'Unbekannte Dynastie', members: [] };
  }

  const sorted = [...members].sort((a, b) => a.birthYear - b.birthYear);
  return {
    id: 'dynasty-1',
    name: 'Dynastie',
    members: sorted,
  };
}

/**
 * Prüft die biologische Plausibilität eines Mitglieds.
 */
export function checkBiologicalPlausibility(
  member: DynastyMember,
  parents: DynastyMember[],
): PlausibilityResult {
  const issues: string[] = [];

  if (!member) {
    return { plausible: true, issues: [] };
  }

  const mother = parents?.find((p) => p.id !== member.id && p.race === member.race);
  const father = parents?.find((p) => p.id !== member.id && p.id !== mother?.id);

  if (mother) {
    const motherAgeAtBirth = member.birthYear - mother.birthYear;
    if (motherAgeAtBirth < MOTHER_MIN_AGE) {
      issues.push(`Mutter war ${motherAgeAtBirth} Jahre alt (Minimum: ${MOTHER_MIN_AGE})`);
    }
    if (motherAgeAtBirth > MOTHER_MAX_AGE) {
      issues.push(`Mutter war ${motherAgeAtBirth} Jahre alt (Maximum: ${MOTHER_MAX_AGE})`);
    }
  }

  if (father) {
    const fatherAgeAtBirth = member.birthYear - father.birthYear;
    if (fatherAgeAtBirth < FATHER_MIN_AGE) {
      issues.push(`Vater war ${fatherAgeAtBirth} Jahre alt (Minimum: ${FATHER_MIN_AGE})`);
    }
    if (fatherAgeAtBirth > FATHER_MAX_AGE) {
      issues.push(`Vater war ${fatherAgeAtBirth} Jahre alt (Maximum: ${FATHER_MAX_AGE})`);
    }
  }

  // Lebensspanne prüfen
  if (member.deathYear) {
    const lifespan = member.deathYear - member.birthYear;
    const raceLimit = RACE_LIFESPAN[member.race];
    if (lifespan > raceLimit.max) {
      issues.push(`Lebenspanne ${lifespan} Jahre über Maximum (${raceLimit.max}) für ${member.race}`);
    }
    if (lifespan < raceLimit.min) {
      issues.push(`Lebenspanne ${lifespan} Jahre unter Minimum (${raceLimit.min}) für ${member.race}`);
    }
  }

  return { plausible: issues.length === 0, issues };
}

/**
 * Generiert eine chronologische Epilog-Zeitleiste.
 */
export function generateEpilogueTimeline(dynasty: Dynasty): EpilogueEntry[] {
  if (!dynasty || !dynasty.members || dynasty.members.length === 0) return [];

  const entries: EpilogueEntry[] = [];

  for (const member of dynasty.members) {
    entries.push({
      year: member.birthYear,
      memberName: member.name,
      event: `Geburt: ${member.name}`,
    });

    if (member.deathYear) {
      entries.push({
        year: member.deathYear,
        memberName: member.name,
        event: `Tod: ${member.name}`,
      });
    }
  }

  return entries.sort((a, b) => a.year - b.year);
}
