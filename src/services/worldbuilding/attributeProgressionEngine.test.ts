// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  ATTRIBUTE_DEFS,
  scaleAttribute,
  generateProgressionTable,
  getTierForLevel,
  getNextTier,
  getPhysicsEquivalent,
  analyzePowerCreep,
  createSampleAttribute,
  getAllAttributes,
  getAttributeById,
  compareCurves,
  type AttributeId,
  type ScalingCurve,
} from "./attributeProgressionEngine";

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

  it("handles unicode", () => {
    expect(typeof hashString("äöüß")).toBe("number");
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
// pick
// ---------------------------------------------------------------------------

describe("pick (internal)", () => {
  it("is used internally by createSeededRandom consumers", () => {
    // pick is internal but exercised indirectly via scaleAttribute
    const r = scaleAttribute(10, 2, 5, "linear");
    expect(r.value).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ATTRIBUTE_DEFS
// ---------------------------------------------------------------------------

describe("ATTRIBUTE_DEFS", () => {
  it("has 8 attributes", () => {
    expect(ATTRIBUTE_DEFS).toHaveLength(8);
  });

  it("has unique ids", () => {
    const ids = ATTRIBUTE_DEFS.map((a) => a.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("has all required fields", () => {
    for (const attr of ATTRIBUTE_DEFS) {
      expect(attr).toHaveProperty("id");
      expect(attr).toHaveProperty("name");
      expect(attr).toHaveProperty("short");
      expect(attr).toHaveProperty("description");
      expect(attr).toHaveProperty("baseValue");
      expect(attr).toHaveProperty("growthRate");
    }
  });

  it("has positive baseValue and growthRate", () => {
    for (const attr of ATTRIBUTE_DEFS) {
      expect(attr.baseValue).toBeGreaterThan(0);
      expect(attr.growthRate).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// scaleAttribute - Linear
// ---------------------------------------------------------------------------

describe("scaleAttribute - linear", () => {
  it("returns baseValue at level 1", () => {
    const r = scaleAttribute(10, 2, 1, "linear");
    expect(r.value).toBe(10);
    expect(r.delta).toBe(0);
    expect(r.percentIncrease).toBe(0);
  });

  it("scales linearly", () => {
    const r = scaleAttribute(10, 2, 5, "linear");
    expect(r.value).toBe(18); // 10 + 2*4
  });

  it("calculates correct delta", () => {
    const r = scaleAttribute(10, 2, 3, "linear");
    expect(r.delta).toBe(2);
  });

  it("calculates correct percentIncrease", () => {
    const r = scaleAttribute(10, 2, 3, "linear");
    // delta = 2, prev = 12, percent = 2/12 * 100 = 16.67
    expect(r.percentIncrease).toBeCloseTo(16.67, 1);
  });

  it("throws for level < 1", () => {
    expect(() => scaleAttribute(10, 2, 0, "linear")).toThrow();
  });

  it("handles large levels", () => {
    const r = scaleAttribute(5, 1.2, 100, "linear");
    expect(r.value).toBeGreaterThan(0);
    expect(Number.isFinite(r.value)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scaleAttribute - Exponential
// ---------------------------------------------------------------------------

describe("scaleAttribute - exponential", () => {
  it("returns baseValue at level 1", () => {
    const r = scaleAttribute(10, 2, 1, "exponential");
    expect(r.value).toBe(10);
  });

  it("grows faster than linear at higher levels", () => {
    const exp = scaleAttribute(10, 5, 20, "exponential").value;
    const lin = scaleAttribute(10, 5, 20, "linear").value;
    expect(exp).toBeGreaterThan(lin);
  });

  it("produces increasing values", () => {
    const r1 = scaleAttribute(10, 3, 5, "exponential").value;
    const r2 = scaleAttribute(10, 3, 10, "exponential").value;
    const r3 = scaleAttribute(10, 3, 15, "exponential").value;
    expect(r1).toBeLessThan(r2);
    expect(r2).toBeLessThan(r3);
  });

  it("handles zero growth rate", () => {
    const r = scaleAttribute(10, 0, 50, "exponential");
    expect(r.value).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// scaleAttribute - Logarithmic
// ---------------------------------------------------------------------------

describe("scaleAttribute - logarithmic", () => {
  it("returns baseValue at level 1", () => {
    const r = scaleAttribute(10, 2, 1, "logarithmic");
    expect(r.value).toBe(10);
  });

  it("has diminishing returns (soft-cap)", () => {
    // Per-level delta should decrease as level increases
    const r1 = scaleAttribute(10, 5, 1, "logarithmic");
    const r2 = scaleAttribute(10, 5, 2, "logarithmic");
    const r50 = scaleAttribute(10, 5, 50, "logarithmic");
    const r51 = scaleAttribute(10, 5, 51, "logarithmic");
    // Delta from level 1->2 should be larger than delta from 50->51
    expect(r2.value - r1.value).toBeGreaterThan(r51.value - r50.value);
  });

  it("grows slower than linear at high levels", () => {
    const log = scaleAttribute(10, 5, 50, "logarithmic").value;
    const lin = scaleAttribute(10, 5, 50, "linear").value;
    expect(log).toBeLessThan(lin);
  });
});

// ---------------------------------------------------------------------------
// generateProgressionTable
// ---------------------------------------------------------------------------

describe("generateProgressionTable", () => {
  it("generates correct number of entries", () => {
    const table = generateProgressionTable(10, 2, 50, "linear");
    expect(table).toHaveLength(50);
  });

  it("starts at level 1", () => {
    const table = generateProgressionTable(10, 2, 10, "linear");
    expect(table[0].level).toBe(1);
  });

  it("ends at maxLevel", () => {
    const table = generateProgressionTable(10, 2, 10, "linear");
    expect(table[table.length - 1].level).toBe(10);
  });

  it("produces monotonically increasing values", () => {
    const table = generateProgressionTable(5, 1, 30, "linear");
    for (let i = 1; i < table.length; i++) {
      expect(table[i].value).toBeGreaterThan(table[i - 1].value);
    }
  });

  it("handles maxLevel of 1", () => {
    const table = generateProgressionTable(10, 2, 1, "linear");
    expect(table).toHaveLength(1);
    expect(table[0].value).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

describe("getTierForLevel", () => {
  it("returns mortal for level 1", () => {
    expect(getTierForLevel(1).id).toBe("mortal");
  });

  it("returns mortal for level 20", () => {
    expect(getTierForLevel(20).id).toBe("mortal");
  });

  it("returns iron for level 21", () => {
    expect(getTierForLevel(21).id).toBe("iron");
  });

  it("returns iron for level 40", () => {
    expect(getTierForLevel(40).id).toBe("iron");
  });

  it("returns gold for level 41", () => {
    expect(getTierForLevel(41).id).toBe("gold");
  });

  it("returns gold for level 60", () => {
    expect(getTierForLevel(60).id).toBe("gold");
  });

  it("returns ascended for level 61", () => {
    expect(getTierForLevel(61).id).toBe("ascended");
  });

  it("returns ascended for level 80", () => {
    expect(getTierForLevel(80).id).toBe("ascended");
  });

  it("returns demigod for level 81", () => {
    expect(getTierForLevel(81).id).toBe("demigod");
  });

  it("returns demigod for level 100", () => {
    expect(getTierForLevel(100).id).toBe("demigod");
  });

  it("throws for level 0", () => {
    expect(() => getTierForLevel(0)).toThrow();
  });

  it("throws for level 101", () => {
    expect(() => getTierForLevel(101)).toThrow();
  });
});

describe("getNextTier", () => {
  it("returns iron for level 1", () => {
    expect(getNextTier(1)?.id).toBe("iron");
  });

  it("returns null for level 100", () => {
    expect(getNextTier(100)).toBeNull();
  });

  it("returns gold for level 21", () => {
    expect(getNextTier(21)?.id).toBe("gold");
  });

  it("returns ascended for level 41", () => {
    expect(getNextTier(41)?.id).toBe("ascended");
  });

  it("returns demigod for level 61", () => {
    expect(getNextTier(61)?.id).toBe("demigod");
  });
});

// ---------------------------------------------------------------------------
// Physics Equivalents
// ---------------------------------------------------------------------------

describe("getPhysicsEquivalent", () => {
  it("returns strength description with kN", () => {
    const r = getPhysicsEquivalent("strength", 42);
    expect(r.description).toContain("Stärke 42");
    expect(r.description).toContain("kN");
  });

  it("returns dexterity description with reaction time", () => {
    const r = getPhysicsEquivalent("dexterity", 30);
    expect(r.description).toContain("Reaktionszeit");
  });

  it("returns constitution description with HP", () => {
    const r = getPhysicsEquivalent("constitution", 50);
    expect(r.description).toContain("Lebenspunkte");
  });

  it("returns intelligence description with IQ", () => {
    const r = getPhysicsEquivalent("intelligence", 60);
    expect(r.description).toContain("IQ");
  });

  it("returns luck description with crit chance", () => {
    const r = getPhysicsEquivalent("luck", 40);
    expect(r.description).toContain("Kritische Treffer");
  });

  it("returns mana description with MP", () => {
    const r = getPhysicsEquivalent("mana", 80);
    expect(r.description).toContain("MP");
  });

  it("returns wisdom description", () => {
    const r = getPhysicsEquivalent("wisdom", 25);
    expect(r.description).toContain("Weisheit");
  });

  it("returns charisma description", () => {
    const r = getPhysicsEquivalent("charisma", 25);
    expect(r.description).toContain("Charisma");
  });

  it("has realWorldComparison", () => {
    for (const attr of ATTRIBUTE_DEFS) {
      const r = getPhysicsEquivalent(attr.id, 50);
      expect(r.realWorldComparison).toBeTruthy();
    }
  });

  it("comparison changes with value", () => {
    const low = getPhysicsEquivalent("strength", 5);
    const high = getPhysicsEquivalent("strength", 90);
    expect(low.realWorldComparison).not.toBe(high.realWorldComparison);
  });
});

// ---------------------------------------------------------------------------
// Power Creep Analysis
// ---------------------------------------------------------------------------

describe("analyzePowerCreep", () => {
  it("returns analysis for linear curve", () => {
    const r = analyzePowerCreep(10, 1, "linear");
    expect(r.curve).toBe("linear");
    expect(r.level10).toBeGreaterThan(0);
    expect(r.level50).toBeGreaterThan(0);
    expect(r.level100).toBeGreaterThan(0);
    expect(r.ratio10to100).toBeGreaterThan(0);
  });

  it("returns analysis for exponential curve", () => {
    const r = analyzePowerCreep(10, 2, "exponential");
    expect(r.curve).toBe("exponential");
    expect(r.verdict).toBeDefined();
    expect(r.recommendation).toBeTruthy();
  });

  it("returns analysis for logarithmic curve", () => {
    const r = analyzePowerCreep(10, 2, "logarithmic");
    expect(r.curve).toBe("logarithmic");
  });

  it("identifies severe power creep for high exponential growth", () => {
    const r = analyzePowerCreep(10, 15, "exponential");
    expect(r.verdict).toBe("severe");
  });

  it("identifies balanced for low linear growth", () => {
    const r = analyzePowerCreep(10, 0.5, "linear");
    expect(r.verdict).toBe("balanced");
  });

  it("ratio10to100 is correct", () => {
    const r = analyzePowerCreep(10, 1, "linear");
    const expected = Math.round((r.level100 / r.level10) * 100) / 100;
    expect(r.ratio10to100).toBe(expected);
  });

  it("exponential has higher ratio than linear", () => {
    const exp = analyzePowerCreep(10, 5, "exponential");
    const lin = analyzePowerCreep(10, 5, "linear");
    expect(exp.ratio10to100).toBeGreaterThan(lin.ratio10to100);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("createSampleAttribute", () => {
  it("returns a valid attribute", () => {
    const attr = createSampleAttribute();
    expect(attr).toHaveProperty("id");
    expect(attr).toHaveProperty("name");
  });
});

describe("getAllAttributes", () => {
  it("returns all 8 attributes", () => {
    expect(getAllAttributes()).toHaveLength(8);
  });

  it("returns a copy (not the original array)", () => {
    const all = getAllAttributes();
    all.pop();
    expect(getAllAttributes()).toHaveLength(8);
  });
});

describe("getAttributeById", () => {
  it("returns correct attribute", () => {
    expect(getAttributeById("strength").name).toBe("Stärke");
    expect(getAttributeById("mana").name).toBe("Mana");
  });

  it("throws for unknown id", () => {
    expect(() => getAttributeById("unknown" as AttributeId)).toThrow();
  });
});

describe("compareCurves", () => {
  it("returns all 3 curves", () => {
    const result = compareCurves(10, 2, 50);
    expect(result).toHaveProperty("linear");
    expect(result).toHaveProperty("exponential");
    expect(result).toHaveProperty("logarithmic");
  });

  it("exponential > linear at high levels", () => {
    const result = compareCurves(10, 5, 50);
    expect(result.exponential).toBeGreaterThan(result.linear);
  });

  it("logarithmic < linear at high levels", () => {
    const result = compareCurves(10, 5, 50);
    expect(result.logarithmic).toBeLessThan(result.linear);
  });

  it("all curves equal at level 1", () => {
    const result = compareCurves(10, 2, 1);
    expect(result.linear).toBe(result.exponential);
    expect(result.exponential).toBe(result.logarithmic);
  });
});

// ---------------------------------------------------------------------------
// Integration: full progression workflow
// ---------------------------------------------------------------------------

describe("integration: full progression workflow", () => {
  it("generates a complete character progression", () => {
    const attr = getAttributeById("strength");
    const table = generateProgressionTable(attr.baseValue, attr.growthRate, 100, "linear");
    expect(table).toHaveLength(100);

    // Check tier transitions
    const tier1 = getTierForLevel(table[0].level);
    const tier20 = getTierForLevel(table[19].level);
    const tier21 = getTierForLevel(table[20].level);
    const tier100 = getTierForLevel(table[99].level);

    expect(tier1.id).toBe("mortal");
    expect(tier20.id).toBe("mortal");
    expect(tier21.id).toBe("iron");
    expect(tier100.id).toBe("demigod");
  });

  it("physics equivalents scale with attribute values", () => {
    const low = getPhysicsEquivalent("strength", 10);
    const mid = getPhysicsEquivalent("strength", 50);
    const high = getPhysicsEquivalent("strength", 90);

    expect(low.realWorldComparison).not.toBe(mid.realWorldComparison);
    expect(mid.realWorldComparison).not.toBe(high.realWorldComparison);
  });

  it("power creep analysis covers all curves", () => {
    const curves: ScalingCurve[] = ["linear", "exponential", "logarithmic"];
    for (const curve of curves) {
      const analysis = analyzePowerCreep(10, 3, curve);
      expect(analysis.verdict).toBeDefined();
      expect(analysis.recommendation).toBeTruthy();
      expect(analysis.ratio10to100).toBeGreaterThan(0);
    }
  });
});
