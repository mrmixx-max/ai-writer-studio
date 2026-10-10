// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  calculateDamage,
  simulateCombat,
  scanCombatForPlausibility,
  generateStatusWindow,
  createSampleCombatant,
  createSampleBoss,
  type Combatant,
} from "./litRpgCombatLedger";

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe("hashString", () => {
  it("returns a deterministic number for the same input", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("returns a number", () => {
    expect(typeof hashString("hello")).toBe("number");
  });

  it("returns different hashes for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("returns FNV-1a offset basis for empty string", () => {
    expect(hashString("")).toBe(0x811c9dc5);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("returns deterministic sequence for same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it("returns different sequences for different seeds", () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    expect(rng1()).not.toBe(rng2());
  });

  it("returns values between 0 and 1", () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateDamage
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
  it("calculates damage correctly", () => {
    const attacker = createSampleCombatant("a1", "Hero", 10);
    const defender = createSampleCombatant("d1", "Goblin", 5);
    const rng = createSeededRandom(42);
    const result = calculateDamage(attacker, defender, rng);
    expect(result.rawDamage).toBeGreaterThan(0);
    expect(result.mitigation).toBeGreaterThanOrEqual(0);
    expect(result.finalDamage).toBeGreaterThan(0);
    expect(result.hpRemaining).toBeGreaterThanOrEqual(0);
    expect(typeof result.isCrit).toBe("boolean");
    expect(result.description).toBeTruthy();
  });

  it("is deterministic with same seed", () => {
    const attacker = createSampleCombatant("a1", "Hero", 10);
    const defender = createSampleCombatant("d1", "Goblin", 5);
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const result1 = calculateDamage(attacker, defender, rng1);
    const result2 = calculateDamage(attacker, defender, rng2);
    expect(result1.finalDamage).toBe(result2.finalDamage);
    expect(result1.isCrit).toBe(result2.isCrit);
  });

  it("crit increases damage", () => {
    const attacker = { ...createSampleCombatant("a1", "Hero", 10), critChance: 1.0, critMultiplier: 2.0 };
    const defender = createSampleCombatant("d1", "Goblin", 5);
    const rng = createSeededRandom(42);
    const result = calculateDamage(attacker, defender, rng);
    expect(result.isCrit).toBe(true);
    expect(result.finalDamage).toBeGreaterThan(result.rawDamage);
  });

  it("defense reduces damage", () => {
    const attacker = createSampleCombatant("a1", "Hero", 10);
    const weakDefender = { ...createSampleCombatant("d1", "Goblin", 5), defense: 0 };
    const strongDefender = { ...createSampleCombatant("d1", "Goblin", 5), defense: 1000 };
    const rng = createSeededRandom(42);
    const weakResult = calculateDamage(attacker, weakDefender, rng);
    const strongResult = calculateDamage(attacker, strongDefender, rng);
    expect(strongResult.finalDamage).toBeLessThan(weakResult.finalDamage);
  });

  it("final damage is at least 1", () => {
    const attacker = createSampleCombatant("a1", "Hero", 1);
    const defender = { ...createSampleCombatant("d1", "Goblin", 100), defense: 10000 };
    const rng = createSeededRandom(42);
    const result = calculateDamage(attacker, defender, rng);
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });

  it("hpRemaining never goes below 0", () => {
    const attacker = createSampleCombatant("a1", "Hero", 100);
    const defender = { ...createSampleCombatant("d1", "Goblin", 1), hp: 5 };
    const rng = createSeededRandom(42);
    const result = calculateDamage(attacker, defender, rng);
    expect(result.hpRemaining).toBe(0);
  });

  it("mpRemaining never goes below 0", () => {
    const attacker = createSampleCombatant("a1", "Hero", 100);
    const defender = { ...createSampleCombatant("d1", "Goblin", 1), mp: 0 };
    const rng = createSeededRandom(42);
    const result = calculateDamage(attacker, defender, rng);
    expect(result.mpRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// simulateCombat
// ---------------------------------------------------------------------------

describe("simulateCombat", () => {
  it("simulates combat between two combatants", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const rng = createSeededRandom(42);
    const result = simulateCombat(c1, c2, 20, rng);
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.winner).toBeDefined();
    expect(result.totalDamageDealt).toBeDefined();
    expect(result.totalDamageTaken).toBeDefined();
  });

  it("is deterministic with same seed", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const result1 = simulateCombat(c1, c2, 20, rng1);
    const result2 = simulateCombat(c1, c2, 20, rng2);
    expect(result1.winner).toBe(result2.winner);
    expect(result1.rounds.length).toBe(result2.rounds.length);
  });

  it("stops when one combatant is defeated", () => {
    const c1 = createSampleCombatant("c1", "Hero", 50);
    const c2 = createSampleCombatant("c2", "Goblin", 1);
    const rng = createSeededRandom(42);
    const result = simulateCombat(c1, c2, 100, rng);
    expect(result.winner).toBe("c1");
    expect(result.rounds.length).toBeLessThan(100);
  });

  it("respects maxRounds", () => {
    const c1 = createSampleCombatant("c1", "Hero", 1);
    const c2 = createSampleCombatant("c2", "Goblin", 1);
    const rng = createSeededRandom(42);
    const result = simulateCombat(c1, c2, 5, rng);
    expect(result.rounds.length).toBeLessThanOrEqual(10); // 5 rounds * 2 combatants
  });

  it("tracks total damage correctly", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const rng = createSeededRandom(42);
    const result = simulateCombat(c1, c2, 20, rng);
    expect(result.totalDamageDealt["c1"]).toBeGreaterThan(0);
    expect(result.totalDamageDealt["c2"]).toBeGreaterThan(0);
  });

  it("faster combatant attacks first", () => {
    const c1 = { ...createSampleCombatant("c1", "Fast", 10), speed: 100 };
    const c2 = { ...createSampleCombatant("c2", "Slow", 10), speed: 1 };
    const rng = createSeededRandom(42);
    const result = simulateCombat(c1, c2, 1, rng);
    expect(result.rounds[0].attackerId).toBe("c1");
  });

  it("handles boss combat", () => {
    const hero = createSampleCombatant("hero", "Hero", 15);
    const boss = createSampleBoss("boss", "Dragon", 20);
    const rng = createSeededRandom(42);
    const result = simulateCombat(hero, boss, 50, rng);
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(["hero", "boss", "draw"]).toContain(result.winner);
  });
});

// ---------------------------------------------------------------------------
// scanCombatForPlausibility
// ---------------------------------------------------------------------------

describe("scanCombatForPlausibility", () => {
  it("returns valid for clean combat", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const rng = createSeededRandom(42);
    const combat = simulateCombat(c1, c2, 20, rng);
    const result = scanCombatForPlausibility([c1, c2], combat.rounds);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("detects negative HP", () => {
    const c1 = { ...createSampleCombatant("c1", "Hero", 10), hp: -5 };
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const result = scanCombatForPlausibility([c1, c2], []);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "negative_stat")).toBe(true);
  });

  it("detects negative MP", () => {
    const c1 = { ...createSampleCombatant("c1", "Hero", 10), mp: -10 };
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const result = scanCombatForPlausibility([c1, c2], []);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "negative_stat")).toBe(true);
  });

  it("detects negative attack", () => {
    const c1 = { ...createSampleCombatant("c1", "Hero", 10), attack: -5 };
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const result = scanCombatForPlausibility([c1, c2], []);
    expect(result.valid).toBe(false);
  });

  it("detects HP overflow in rounds", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const fakeRound = {
      round: 1, attackerId: "c1", defenderId: "c2", action: "attack",
      damage: { rawDamage: 100, mitigation: 0, finalDamage: 100, isCrit: false, isDodged: false, hpRemaining: -10, mpRemaining: 0, description: "" },
      hpAfter: -10, mpAfter: 0,
    };
    const result = scanCombatForPlausibility([c1, c2], [fakeRound]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "hp_overflow")).toBe(true);
  });

  it("detects damage mismatch", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const fakeRound = {
      round: 1, attackerId: "c1", defenderId: "c2", action: "attack",
      damage: { rawDamage: 10, mitigation: 0, finalDamage: 50, isCrit: false, isDodged: false, hpRemaining: 0, mpRemaining: 0, description: "" },
      hpAfter: 0, mpAfter: 0,
    };
    const result = scanCombatForPlausibility([c1, c2], [fakeRound]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "damage_mismatch")).toBe(true);
  });

  it("detects prose damage mismatch", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const result = scanCombatForPlausibility([c1, c2], [], ["Boss hat 5000 HP und erleidet 2000 Schaden"]);
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("score decreases with issues", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const cleanResult = scanCombatForPlausibility([c1, c2], []);
    const dirtyResult = scanCombatForPlausibility([{ ...c1, hp: -5 }, c2], []);
    expect(dirtyResult.score).toBeLessThan(cleanResult.score);
  });
});

// ---------------------------------------------------------------------------
// generateStatusWindow
// ---------------------------------------------------------------------------

describe("generateStatusWindow", () => {
  it("generates status window for combatant", () => {
    const c = createSampleCombatant("c1", "Hero", 10);
    const status = generateStatusWindow(c);
    expect(status.name).toBe("Hero");
    expect(status.level).toBe(10);
    expect(status.hp).toBe(c.hp);
    expect(status.maxHp).toBe(c.maxHp);
    expect(status.mp).toBe(c.mp);
    expect(status.maxMp).toBe(c.maxMp);
  });

  it("has correct HP bar color for high HP", () => {
    const c = { ...createSampleCombatant("c1", "Hero", 10), hp: 90, maxHp: 100 };
    const status = generateStatusWindow(c);
    expect(status.hpBarColor).toBe("#4caf50");
  });

  it("has correct HP bar color for medium HP", () => {
    const c = { ...createSampleCombatant("c1", "Hero", 10), hp: 30, maxHp: 100 };
    const status = generateStatusWindow(c);
    expect(status.hpBarColor).toBe("#ff9800");
  });

  it("has correct HP bar color for low HP", () => {
    const c = { ...createSampleCombatant("c1", "Hero", 10), hp: 10, maxHp: 100 };
    const status = generateStatusWindow(c);
    expect(status.hpBarColor).toBe("#f44336");
  });

  it("has blue MP bar color", () => {
    const c = createSampleCombatant("c1", "Hero", 10);
    const status = generateStatusWindow(c);
    expect(status.mpBarColor).toBe("#2196f3");
  });

  it("includes all combat stats", () => {
    const c = createSampleCombatant("c1", "Hero", 10);
    const status = generateStatusWindow(c);
    expect(status.attack).toBe(c.attack);
    expect(status.defense).toBe(c.defense);
    expect(status.speed).toBe(c.speed);
    expect(status.critChance).toBe(c.critChance);
    expect(status.critMultiplier).toBe(c.critMultiplier);
  });
});

// ---------------------------------------------------------------------------
// createSampleCombatant / createSampleBoss
// ---------------------------------------------------------------------------

describe("createSampleCombatant", () => {
  it("creates a valid combatant", () => {
    const c = createSampleCombatant("c1", "Hero", 10);
    expect(c.id).toBe("c1");
    expect(c.name).toBe("Hero");
    expect(c.level).toBe(10);
    expect(c.maxHp).toBeGreaterThan(0);
    expect(c.hp).toBe(c.maxHp);
    expect(c.maxMp).toBeGreaterThan(0);
    expect(c.mp).toBe(c.maxMp);
    expect(c.attack).toBeGreaterThan(0);
    expect(c.defense).toBeGreaterThanOrEqual(0);
    expect(c.speed).toBeGreaterThan(0);
  });

  it("scales with level", () => {
    const low = createSampleCombatant("c1", "Hero", 1);
    const high = createSampleCombatant("c2", "Hero", 50);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.attack).toBeGreaterThan(low.attack);
  });
});

describe("createSampleBoss", () => {
  it("creates a stronger combatant", () => {
    const normal = createSampleCombatant("c1", "Hero", 10);
    const boss = createSampleBoss("b1", "Dragon", 10);
    expect(boss.maxHp).toBeGreaterThan(normal.maxHp);
    expect(boss.attack).toBeGreaterThan(normal.attack);
    expect(boss.defense).toBeGreaterThan(normal.defense);
  });

  it("has higher crit chance", () => {
    const normal = createSampleCombatant("c1", "Hero", 10);
    const boss = createSampleBoss("b1", "Dragon", 10);
    expect(boss.critChance).toBeGreaterThan(normal.critChance);
    expect(boss.critMultiplier).toBeGreaterThan(normal.critMultiplier);
  });
});

// ---------------------------------------------------------------------------
// Integration: full combat workflow
// ---------------------------------------------------------------------------

describe("integration: full combat workflow", () => {
  it("simulates combat and scans for plausibility", () => {
    const c1 = createSampleCombatant("c1", "Hero", 15);
    const c2 = createSampleCombatant("c2", "Orc", 12);
    const rng = createSeededRandom(42);
    const combat = simulateCombat(c1, c2, 30, rng);
    const scan = scanCombatForPlausibility([c1, c2], combat.rounds);
    expect(scan.valid).toBe(true);
    expect(scan.score).toBe(100);
  });

  it("generates status windows for all combatants", () => {
    const c1 = createSampleCombatant("c1", "Hero", 10);
    const c2 = createSampleCombatant("c2", "Goblin", 5);
    const s1 = generateStatusWindow(c1);
    const s2 = generateStatusWindow(c2);
    expect(s1.name).toBe("Hero");
    expect(s2.name).toBe("Goblin");
  });

  it("full boss fight workflow", () => {
    const hero = createSampleCombatant("hero", "Hero", 20);
    const boss = createSampleBoss("boss", "Dragon", 25);
    const rng = createSeededRandom(42);
    const combat = simulateCombat(hero, boss, 50, rng);
    const scan = scanCombatForPlausibility([hero, boss], combat.rounds);
    const status = generateStatusWindow(hero);
    expect(combat.rounds.length).toBeGreaterThan(0);
    expect(scan.valid).toBe(true);
    expect(status.name).toBe("Hero");
  });
});
