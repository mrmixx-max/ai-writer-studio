// LitRpgCombatLedger (WP 135.2)
// LitRPG-Kampfschaden-Ledger & Statusfenster für Progression Fantasy.
// Rundenbasierter Schadensrechner, Plausibilitäts-Scanner, Statusfenster-Layout.
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

// ---------------------------------------------------------------------------
// 1. Combatant
// ---------------------------------------------------------------------------

export interface Combatant {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number; // 0-1
  critMultiplier: number;
  skills: string[];
}

export interface DamageResult {
  rawDamage: number;
  mitigation: number;
  finalDamage: number;
  isCrit: boolean;
  isDodged: boolean;
  hpRemaining: number;
  mpRemaining: number;
  description: string;
}

export interface RoundResult {
  round: number;
  attackerId: string;
  defenderId: string;
  action: string;
  damage: DamageResult;
  hpAfter: number;
  mpAfter: number;
}

export interface CombatResult {
  rounds: RoundResult[];
  winner: string;
  totalDamageDealt: Record<string, number>;
  totalDamageTaken: Record<string, number>;
}

// ---------------------------------------------------------------------------
// 2. Schadensrechner
// ---------------------------------------------------------------------------

export function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  rng: () => number
): DamageResult {
  // Base damage = attack * variance
  const variance = 0.9 + rng() * 0.2; // 0.9 - 1.1
  const rawDamage = Math.round(attacker.attack * variance);

  // Mitigation = defense * 0.5 (linear scaling)
  const mitigation = Math.round(defender.defense * 0.5);
  const mitigatedDamage = Math.max(1, rawDamage - mitigation);

  // Crit check
  const isCrit = rng() < attacker.critChance;
  const critMultiplier = isCrit ? attacker.critMultiplier : 1.0;
  const finalDamage = Math.round(mitigatedDamage * critMultiplier);

  const hpRemaining = Math.max(0, defender.hp - finalDamage);
  const mpRemaining = Math.max(0, defender.mp - Math.round(finalDamage * 0.1));

  const description = buildDamageDescription(
    attacker, defender, rawDamage, mitigation, finalDamage, isCrit, critMultiplier, hpRemaining
  );

  return { rawDamage, mitigation, finalDamage, isCrit, isDodged: false, hpRemaining, mpRemaining, description };
}

function buildDamageDescription(
  attacker: Combatant,
  defender: Combatant,
  rawDamage: number,
  mitigation: number,
  finalDamage: number,
  isCrit: boolean,
  critMultiplier: number,
  hpRemaining: number
): string {
  let desc = `${attacker.name} greift ${defender.name} an! `;
  desc += `Rohschaden: ${rawDamage}, `;
  desc += `Rüstung reduziert um ${mitigation}, `;
  if (isCrit) {
    desc += `KRITISCHER TREFFER! (${critMultiplier.toFixed(1)}x) `;
  }
  desc += `Endschaden: ${finalDamage}. `;
  desc += `${defender.name} hat noch ${hpRemaining} HP.`;
  if (hpRemaining === 0) {
    desc += ` ${defender.name} ist besiegt!`;
  }
  return desc;
}

// ---------------------------------------------------------------------------
// 3. Rundenbasierter Kampf-Simulator
// ---------------------------------------------------------------------------

export function simulateCombat(
  combatant1: Combatant,
  combatant2: Combatant,
  maxRounds: number,
  rng: () => number
): CombatResult {
  const c1 = { ...combatant1, hp: combatant1.maxHp, mp: combatant1.maxMp };
  const c2 = { ...combatant2, hp: combatant2.maxHp, mp: combatant2.maxMp };

  const rounds: RoundResult[] = [];
  const totalDamageDealt: Record<string, number> = { [c1.id]: 0, [c2.id]: 0 };
  const totalDamageTaken: Record<string, number> = { [c1.id]: 0, [c2.id]: 0 };

  // Determine turn order by speed
  const [first, second] = c1.speed >= c2.speed ? [c1, c2] : [c2, c1];

  for (let round = 1; round <= maxRounds; round++) {
    // First attacker
    if (first.hp > 0 && second.hp > 0) {
      const damage = calculateDamage(first, second, rng);
      second.hp = damage.hpRemaining;
      second.mp = damage.mpRemaining;
      rounds.push({
        round, attackerId: first.id, defenderId: second.id,
        action: "attack", damage,
        hpAfter: second.hp, mpAfter: second.mp,
      });
      totalDamageDealt[first.id] += damage.finalDamage;
      totalDamageTaken[second.id] += damage.finalDamage;
    }

    // Second attacker
    if (second.hp > 0 && first.hp > 0) {
      const damage = calculateDamage(second, first, rng);
      first.hp = damage.hpRemaining;
      first.mp = damage.mpRemaining;
      rounds.push({
        round, attackerId: second.id, defenderId: first.id,
        action: "attack", damage,
        hpAfter: first.hp, mpAfter: first.mp,
      });
      totalDamageDealt[second.id] += damage.finalDamage;
      totalDamageTaken[first.id] += damage.finalDamage;
    }

    if (first.hp <= 0 || second.hp <= 0) break;
  }

  const winner = c1.hp > 0 ? c1.id : c2.hp > 0 ? c2.id : "draw";

  return { rounds, winner, totalDamageDealt, totalDamageTaken };
}

// ---------------------------------------------------------------------------
// 4. Plausibilitäts-Scanner
// ---------------------------------------------------------------------------

export interface PlausibilityIssue {
  type: "damage_mismatch" | "hp_overflow" | "mp_overflow" | "negative_stat" | "impossible_crit";
  message: string;
  severity: "error" | "warning";
}

export interface PlausibilityResult {
  valid: boolean;
  issues: PlausibilityIssue[];
  score: number; // 0-100
}

export function scanCombatForPlausibility(
  combatants: Combatant[],
  rounds: RoundResult[],
  proseDamageMentions: string[] = []
): PlausibilityResult {
  const issues: PlausibilityIssue[] = [];

  for (const c of combatants) {
    // Check negative stats
    if (c.hp < 0) {
      issues.push({ type: "negative_stat", message: `${c.name} has negative HP (${c.hp})`, severity: "error" });
    }
    if (c.mp < 0) {
      issues.push({ type: "negative_stat", message: `${c.name} has negative MP (${c.mp})`, severity: "error" });
    }
    if (c.attack < 0) {
      issues.push({ type: "negative_stat", message: `${c.name} has negative attack (${c.attack})`, severity: "error" });
    }
    if (c.defense < 0) {
      issues.push({ type: "negative_stat", message: `${c.name} has negative defense (${c.defense})`, severity: "error" });
    }
  }

  // Check round consistency
  const hpByCombatant = new Map<string, number>();
  for (const c of combatants) {
    hpByCombatant.set(c.id, c.maxHp);
  }

  for (const round of rounds) {
    const { defenderId, damage, hpAfter, mpAfter } = round;
    // Track HP for consistency checks
    void hpByCombatant.get(defenderId);

    // HP should not go below 0
    if (hpAfter < 0) {
      issues.push({ type: "hp_overflow", message: `${defenderId} HP went negative (${hpAfter}) in round ${round.round}`, severity: "error" });
    }

    // HP should not exceed max
    const maxHp = combatants.find((c) => c.id === defenderId)?.maxHp ?? 0;
    if (hpAfter > maxHp) {
      issues.push({ type: "hp_overflow", message: `${defenderId} HP exceeded max (${hpAfter}/${maxHp}) in round ${round.round}`, severity: "error" });
    }

    // MP should not go negative
    if (mpAfter < 0) {
      issues.push({ type: "mp_overflow", message: `${defenderId} MP went negative (${mpAfter}) in round ${round.round}`, severity: "error" });
    }

    // Check damage consistency (accounting for crits)
    const expectedMax = Math.round(damage.rawDamage * 2.5); // generous cap for crits
    if (damage.finalDamage > expectedMax) {
      issues.push({ type: "damage_mismatch", message: `Final damage (${damage.finalDamage}) > raw damage (${damage.rawDamage}) in round ${round.round}`, severity: "error" });
    }

    hpByCombatant.set(defenderId, hpAfter);
  }

  // Check prose mentions
  for (const mention of proseDamageMentions) {
    const numbers = mention.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length > 0) {
      // Check if any number exceeds max HP
      for (const c of combatants) {
        for (const num of numbers) {
          if (num > c.maxHp * 2) {
            issues.push({ type: "damage_mismatch", message: `Prose mentions damage ${num} which seems too high for ${c.name} (max HP: ${c.maxHp})`, severity: "warning" });
          }
        }
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

  return { valid: errorCount === 0, issues, score };
}

// ---------------------------------------------------------------------------
// 5. Statusfenster-Layout
// ---------------------------------------------------------------------------

export interface StatusWindow {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critMultiplier: number;
  skills: string[];
  hpBarColor: string;
  mpBarColor: string;
}

export function generateStatusWindow(combatant: Combatant): StatusWindow {
  const hpPercent = combatant.maxHp > 0 ? (combatant.hp / combatant.maxHp) * 100 : 0;
  return {
    name: combatant.name,
    level: combatant.level,
    hp: combatant.hp,
    maxHp: combatant.maxHp,
    mp: combatant.mp,
    maxMp: combatant.maxMp,
    attack: combatant.attack,
    defense: combatant.defense,
    speed: combatant.speed,
    critChance: combatant.critChance,
    critMultiplier: combatant.critMultiplier,
    skills: combatant.skills,
    hpBarColor: hpPercent > 50 ? "#4caf50" : hpPercent > 25 ? "#ff9800" : "#f44336",
    mpBarColor: "#2196f3",
  };
}

// ---------------------------------------------------------------------------
// 6. Hilfsfunktionen
// ---------------------------------------------------------------------------

export function createSampleCombatant(id: string, name: string, level: number): Combatant {
  const base = 10 + level * 2;
  return {
    id, name, level,
    maxHp: base * 10, hp: base * 10,
    maxMp: base * 5, mp: base * 5,
    attack: base, defense: Math.round(base * 0.8),
    speed: 10 + Math.floor(level / 2),
    critChance: 0.1,
    critMultiplier: 1.5,
    skills: [],
  };
}

export function createSampleBoss(id: string, name: string, level: number): Combatant {
  const c = createSampleCombatant(id, name, level);
  c.maxHp = Math.round(c.maxHp * 1.5);
  c.hp = c.maxHp;
  c.attack = Math.round(c.attack * 1.3);
  c.defense = Math.round(c.defense * 1.2);
  c.critChance = 0.15;
  c.critMultiplier = 2.0;
  return c;
}
