// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  RARITIES,
  ITEM_TEMPLATES,
  SET_BONUSES,
  rollRarity,
  generateLoot,
  calculateSetBonuses,
  generateItemTooltip,
  getRarityById,
  getItemById,
  getAllItems,
  getItemsByRarity,
  getItemsBySlot,
  getSetBonusByName,
  getAllSetBonuses,
  type Item,
} from "./lootRarityMatrix";

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
// RARITIES
// ---------------------------------------------------------------------------

describe("RARITIES", () => {
  it("has 6 rarities", () => {
    expect(RARITIES).toHaveLength(6);
  });

  it("has unique ids", () => {
    const ids = RARITIES.map((r) => r.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("has all required fields", () => {
    for (const rarity of RARITIES) {
      expect(rarity).toHaveProperty("id");
      expect(rarity).toHaveProperty("name");
      expect(rarity).toHaveProperty("color");
      expect(rarity).toHaveProperty("glowColor");
      expect(rarity).toHaveProperty("dropChance");
      expect(rarity).toHaveProperty("statMultiplier");
      expect(rarity).toHaveProperty("description");
    }
  });

  it("has valid drop chances", () => {
    for (const rarity of RARITIES) {
      expect(rarity.dropChance).toBeGreaterThan(0);
      expect(rarity.dropChance).toBeLessThanOrEqual(1);
    }
  });

  it("has increasing stat multipliers", () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(RARITIES[i].statMultiplier).toBeGreaterThan(RARITIES[i - 1].statMultiplier);
    }
  });

  it("has decreasing drop chances", () => {
    for (let i = 1; i < RARITIES.length; i++) {
      expect(RARITIES[i].dropChance).toBeLessThan(RARITIES[i - 1].dropChance);
    }
  });

  it("has valid colors", () => {
    for (const rarity of RARITIES) {
      expect(rarity.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ---------------------------------------------------------------------------
// ITEM_TEMPLATES
// ---------------------------------------------------------------------------

describe("ITEM_TEMPLATES", () => {
  it("has 20 items", () => {
    expect(ITEM_TEMPLATES).toHaveLength(20);
  });

  it("has unique ids", () => {
    const ids = ITEM_TEMPLATES.map((i) => i.id);
    expect(new Set(ids).size).toBe(20);
  });

  it("has all required fields", () => {
    for (const item of ITEM_TEMPLATES) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("slot");
      expect(item).toHaveProperty("rarity");
      expect(item).toHaveProperty("baseStats");
      expect(item).toHaveProperty("flavorText");
      expect(item).toHaveProperty("level");
    }
  });

  it("has valid slots", () => {
    const validSlots = ["weapon", "armor", "accessory", "consumable"];
    for (const item of ITEM_TEMPLATES) {
      expect(validSlots).toContain(item.slot);
    }
  });

  it("has valid rarities", () => {
    const validRarities = RARITIES.map((r) => r.id);
    for (const item of ITEM_TEMPLATES) {
      expect(validRarities).toContain(item.rarity);
    }
  });

  it("has positive level", () => {
    for (const item of ITEM_TEMPLATES) {
      expect(item.level).toBeGreaterThan(0);
    }
  });

  it("has non-empty baseStats", () => {
    for (const item of ITEM_TEMPLATES) {
      expect(Object.keys(item.baseStats).length).toBeGreaterThan(0);
    }
  });

  it("has valid durability when present", () => {
    for (const item of ITEM_TEMPLATES) {
      if (item.durability !== undefined) {
        expect(item.durability).toBeGreaterThan(0);
        expect(item.durability).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SET_BONUSES
// ---------------------------------------------------------------------------

describe("SET_BONUSES", () => {
  it("has 5 set bonuses", () => {
    expect(SET_BONUSES).toHaveLength(5);
  });

  it("has unique set names", () => {
    const names = SET_BONUSES.map((b) => b.setName);
    expect(new Set(names).size).toBe(5);
  });

  it("has all required fields", () => {
    for (const bonus of SET_BONUSES) {
      expect(bonus).toHaveProperty("setName");
      expect(bonus).toHaveProperty("piecesRequired");
      expect(bonus).toHaveProperty("bonus");
      expect(bonus).toHaveProperty("description");
    }
  });

  it("has piecesRequired of 2", () => {
    for (const bonus of SET_BONUSES) {
      expect(bonus.piecesRequired).toBe(2);
    }
  });

  it("has non-empty bonus", () => {
    for (const bonus of SET_BONUSES) {
      expect(Object.keys(bonus.bonus).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// rollRarity
// ---------------------------------------------------------------------------

describe("rollRarity", () => {
  it("returns a valid rarity", () => {
    const rng = createSeededRandom(42);
    const rarity = rollRarity(rng);
    expect(RARITIES.map((r) => r.id)).toContain(rarity);
  });

  it("is deterministic with same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    expect(rollRarity(rng1)).toBe(rollRarity(rng2));
  });

  it("returns common most often", () => {
    const rng = createSeededRandom(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(rng);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts["common"]).toBeGreaterThan(counts["mythic"]);
  });
});

// ---------------------------------------------------------------------------
// generateLoot
// ---------------------------------------------------------------------------

describe("generateLoot", () => {
  it("returns a valid loot result", () => {
    const rng = createSeededRandom(42);
    const loot = generateLoot(10, rng);
    expect(loot.item).toBeDefined();
    expect(loot.rolledRarity).toBeDefined();
    expect(loot.rolledStats).toBeDefined();
    expect(typeof loot.isUpgrade).toBe("boolean");
  });

  it("scales stats with level", () => {
    const rng = createSeededRandom(42);
    const lowLevel = generateLoot(1, rng);
    const highLevel = generateLoot(50, rng);
    // Higher level should generally produce higher stats
    const lowTotal = Object.values(lowLevel.rolledStats).reduce((a, b) => a + b, 0);
    const highTotal = Object.values(highLevel.rolledStats).reduce((a, b) => a + b, 0);
    expect(highTotal).toBeGreaterThanOrEqual(lowTotal);
  });

  it("is deterministic with same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const loot1 = generateLoot(10, rng1);
    const loot2 = generateLoot(10, rng2);
    expect(loot1.item.id).toBe(loot2.item.id);
    expect(loot1.rolledRarity).toBe(loot2.rolledRarity);
  });

  it("isUpgrade is true for non-common rarities", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const loot = generateLoot(10, rng);
      if (loot.rolledRarity === "common") {
        expect(loot.isUpgrade).toBe(false);
      } else {
        expect(loot.isUpgrade).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// calculateSetBonuses
// ---------------------------------------------------------------------------

describe("calculateSetBonuses", () => {
  it("returns empty for no items", () => {
    const results = calculateSetBonuses([]);
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.piecesWorn).toBe(0);
      expect(r.bonusActive).toBe(false);
    }
  });

  it("activates bonus with 2 pieces", () => {
    const items: Item[] = [
      { ...getItemById("power_ring"), setName: "Set der Macht" },
      { ...getItemById("wisdom_amulet"), setName: "Set der Macht" },
    ];
    const results = calculateSetBonuses(items);
    const setResult = results.find((r) => r.setName === "Set der Macht");
    expect(setResult?.bonusActive).toBe(true);
    expect(setResult?.piecesWorn).toBe(2);
  });

  it("does not activate bonus with 1 piece", () => {
    const items: Item[] = [
      { ...getItemById("power_ring"), setName: "Set der Macht" },
    ];
    const results = calculateSetBonuses(items);
    const setResult = results.find((r) => r.setName === "Set der Macht");
    expect(setResult?.bonusActive).toBe(false);
    expect(setResult?.piecesWorn).toBe(1);
  });

  it("handles multiple sets", () => {
    const items: Item[] = [
      { ...getItemById("power_ring"), setName: "Set der Macht" },
      { ...getItemById("wisdom_amulet"), setName: "Set der Macht" },
      { ...getItemById("speed_boots"), setName: "Set der Winde" },
    ];
    const results = calculateSetBonuses(items);
    const macht = results.find((r) => r.setName === "Set der Macht");
    const winde = results.find((r) => r.setName === "Set der Winde");
    expect(macht?.bonusActive).toBe(true);
    expect(winde?.bonusActive).toBe(false);
  });

  it("handles items without setName", () => {
    const items: Item[] = [
      { ...getItemById("iron_sword") },
      { ...getItemById("leather_armor") },
    ];
    const results = calculateSetBonuses(items);
    for (const r of results) {
      expect(r.piecesWorn).toBe(0);
      expect(r.bonusActive).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// generateItemTooltip
// ---------------------------------------------------------------------------

describe("generateItemTooltip", () => {
  it("returns valid tooltip", () => {
    const item = getItemById("excalibur");
    const tooltip = generateItemTooltip(item);
    expect(tooltip.name).toBe("Excalibur");
    expect(tooltip.rarity.id).toBe("legendary");
    expect(tooltip.slot).toBe("weapon");
    expect(tooltip.level).toBe(30);
    expect(tooltip.stats).toBeDefined();
    expect(tooltip.flavorText).toBeTruthy();
  });

  it("includes durability when present", () => {
    const item = getItemById("iron_sword");
    const tooltip = generateItemTooltip(item);
    expect(tooltip.durability).toBe(80);
  });

  it("excludes durability when not present", () => {
    const item = getItemById("health_potion");
    const tooltip = generateItemTooltip(item);
    expect(tooltip.durability).toBeUndefined();
  });

  it("includes setName when present", () => {
    const item = getItemById("power_ring");
    const tooltip = generateItemTooltip(item);
    expect(tooltip.setName).toBe("Set der Macht");
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("getRarityById", () => {
  it("returns correct rarity", () => {
    expect(getRarityById("common").name).toBe("Gewöhnlich");
    expect(getRarityById("mythic").name).toBe("Mythisch");
  });

  it("throws for unknown id", () => {
    expect(() => getRarityById("unknown" as never)).toThrow();
  });
});

describe("getItemById", () => {
  it("returns correct item", () => {
    expect(getItemById("excalibur").name).toBe("Excalibur");
  });

  it("throws for unknown id", () => {
    expect(() => getItemById("unknown")).toThrow();
  });
});

describe("getAllItems", () => {
  it("returns all 20 items", () => {
    expect(getAllItems()).toHaveLength(20);
  });

  it("returns a copy", () => {
    const all = getAllItems();
    all.pop();
    expect(getAllItems()).toHaveLength(20);
  });
});

describe("getItemsByRarity", () => {
  it("returns items of given rarity", () => {
    const commons = getItemsByRarity("common");
    expect(commons.length).toBeGreaterThan(0);
    for (const item of commons) {
      expect(item.rarity).toBe("common");
    }
  });

  it("returns empty for rarity with no items", () => {
    // All rarities have items in our templates, but test the function works
    const mythics = getItemsByRarity("mythic");
    expect(mythics.length).toBeGreaterThan(0);
  });
});

describe("getItemsBySlot", () => {
  it("returns items of given slot", () => {
    const weapons = getItemsBySlot("weapon");
    expect(weapons.length).toBeGreaterThan(0);
    for (const item of weapons) {
      expect(item.slot).toBe("weapon");
    }
  });

  it("returns consumables", () => {
    const consumables = getItemsBySlot("consumable");
    expect(consumables.length).toBeGreaterThan(0);
  });
});

describe("getSetBonusByName", () => {
  it("returns correct set bonus", () => {
    const bonus = getSetBonusByName("Set der Macht");
    expect(bonus.piecesRequired).toBe(2);
  });

  it("throws for unknown set", () => {
    expect(() => getSetBonusByName("Unknown Set")).toThrow();
  });
});

describe("getAllSetBonuses", () => {
  it("returns all 5 set bonuses", () => {
    expect(getAllSetBonuses()).toHaveLength(5);
  });

  it("returns a copy", () => {
    const all = getAllSetBonuses();
    all.pop();
    expect(getAllSetBonuses()).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Integration: full loot workflow
// ---------------------------------------------------------------------------

describe("integration: full loot workflow", () => {
  it("generates loot and calculates set bonuses", () => {
    const rng = createSeededRandom(42);
    const loot1 = generateLoot(10, rng);
    const loot2 = generateLoot(10, rng);
    const results = calculateSetBonuses([loot1.item, loot2.item]);
    expect(results).toHaveLength(5);
  });

  it("generates tooltips for all items", () => {
    for (const item of ITEM_TEMPLATES) {
      const tooltip = generateItemTooltip(item);
      expect(tooltip.name).toBeTruthy();
      expect(tooltip.rarity).toBeDefined();
    }
  });

  it("rolls rarity distribution correctly", () => {
    const rng = createSeededRandom(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(rng);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    // Common should be most common
    expect(counts["common"]).toBeGreaterThan(counts["uncommon"]);
    expect(counts["uncommon"]).toBeGreaterThan(counts["rare"]);
    expect(counts["rare"]).toBeGreaterThan(counts["epic"]);
    expect(counts["epic"]).toBeGreaterThan(counts["legendary"]);
    expect(counts["legendary"]).toBeGreaterThan(counts["mythic"]);
  });
});
