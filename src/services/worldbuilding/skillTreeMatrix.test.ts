// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SKILL_TREES,
  CLASS_EVOLUTIONS,
  validateSkillPath,
  calculateOptimalPath,
  generateSkillTreeSVG,
  getSkillTreeById,
  getSkillNodeById,
  getAllSkillTrees,
  getClassEvolutionById,
  getAllClassEvolutions,
} from "./skillTreeMatrix";

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
// SKILL_TREES
// ---------------------------------------------------------------------------

describe("SKILL_TREES", () => {
  it("has 4 skill trees", () => {
    expect(SKILL_TREES).toHaveLength(4);
  });

  it("has unique ids", () => {
    const ids = SKILL_TREES.map((t) => t.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("each tree has nodes", () => {
    for (const tree of SKILL_TREES) {
      expect(tree.nodes.length).toBeGreaterThan(0);
    }
  });

  it("each node has required fields", () => {
    for (const tree of SKILL_TREES) {
      for (const node of tree.nodes) {
        expect(node).toHaveProperty("id");
        expect(node).toHaveProperty("name");
        expect(node).toHaveProperty("description");
        expect(node).toHaveProperty("type");
        expect(node).toHaveProperty("tier");
        expect(node).toHaveProperty("cost");
        expect(node).toHaveProperty("cooldown");
        expect(node).toHaveProperty("prerequisites");
        expect(node).toHaveProperty("synergies");
        expect(node).toHaveProperty("exclusions");
        expect(node).toHaveProperty("icon");
      }
    }
  });

  it("has valid skill types", () => {
    const validTypes = ["active", "passive", "ultimate"];
    for (const tree of SKILL_TREES) {
      for (const node of tree.nodes) {
        expect(validTypes).toContain(node.type);
      }
    }
  });

  it("has tiers between 1 and 5", () => {
    for (const tree of SKILL_TREES) {
      for (const node of tree.nodes) {
        expect(node.tier).toBeGreaterThanOrEqual(1);
        expect(node.tier).toBeLessThanOrEqual(5);
      }
    }
  });

  it("has positive cost", () => {
    for (const tree of SKILL_TREES) {
      for (const node of tree.nodes) {
        expect(node.cost).toBeGreaterThan(0);
      }
    }
  });

  it("has non-negative cooldown", () => {
    for (const tree of SKILL_TREES) {
      for (const node of tree.nodes) {
        expect(node.cooldown).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("prerequisites reference existing nodes", () => {
    for (const tree of SKILL_TREES) {
      const nodeIds = new Set(tree.nodes.map((n) => n.id));
      for (const node of tree.nodes) {
        for (const prereq of node.prerequisites) {
          expect(nodeIds.has(prereq)).toBe(true);
        }
      }
    }
  });

  it("exclusions reference existing nodes", () => {
    for (const tree of SKILL_TREES) {
      const nodeIds = new Set(tree.nodes.map((n) => n.id));
      for (const node of tree.nodes) {
        for (const exclusion of node.exclusions) {
          expect(nodeIds.has(exclusion)).toBe(true);
        }
      }
    }
  });

  it("synergies reference existing nodes", () => {
    for (const tree of SKILL_TREES) {
      const nodeIds = new Set(tree.nodes.map((n) => n.id));
      for (const node of tree.nodes) {
        for (const synergy of node.synergies) {
          expect(nodeIds.has(synergy)).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// CLASS_EVOLUTIONS
// ---------------------------------------------------------------------------

describe("CLASS_EVOLUTIONS", () => {
  it("has 9 class evolutions", () => {
    expect(CLASS_EVOLUTIONS).toHaveLength(9);
  });

  it("has unique ids", () => {
    const ids = CLASS_EVOLUTIONS.map((e) => e.id);
    expect(new Set(ids).size).toBe(9);
  });

  it("has all required fields", () => {
    for (const evo of CLASS_EVOLUTIONS) {
      expect(evo).toHaveProperty("id");
      expect(evo).toHaveProperty("name");
      expect(evo).toHaveProperty("fromClass");
      expect(evo).toHaveProperty("toClass");
      expect(evo).toHaveProperty("levelRequired");
      expect(evo).toHaveProperty("prerequisites");
      expect(evo).toHaveProperty("description");
    }
  });

  it("has positive levelRequired", () => {
    for (const evo of CLASS_EVOLUTIONS) {
      expect(evo.levelRequired).toBeGreaterThan(0);
    }
  });

  it("prerequisites reference existing skills", () => {
    const allSkillIds = new Set(SKILL_TREES.flatMap((t) => t.nodes.map((n) => n.id)));
    for (const evo of CLASS_EVOLUTIONS) {
      for (const prereq of evo.prerequisites) {
        expect(allSkillIds.has(prereq)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// validateSkillPath
// ---------------------------------------------------------------------------

describe("validateSkillPath", () => {
  it("returns valid for empty selection", () => {
    const result = validateSkillPath("pyromancer", []);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("returns valid for single skill without prerequisites", () => {
    const result = validateSkillPath("pyromancer", ["firebolt"]);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for skill with missing prerequisite", () => {
    const result = validateSkillPath("pyromancer", ["inferno"]);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("returns valid for skill with prerequisite met", () => {
    const result = validateSkillPath("pyromancer", ["firebolt", "inferno"]);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for excluded skills", () => {
    const result = validateSkillPath("cryomancer", ["frostbolt", "ice_armor"]);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("excludes"))).toBe(true);
  });

  it("returns valid for non-excluded skills", () => {
    const result = validateSkillPath("pyromancer", ["firebolt", "inferno"]);
    expect(result.valid).toBe(true);
  });

  it("collects synergies", () => {
    const result = validateSkillPath("pyromancer", ["firebolt", "inferno"]);
    expect(result.valid).toBe(true);
    expect(result.synergies.length).toBeGreaterThan(0);
  });

  it("throws for unknown tree", () => {
    expect(() => validateSkillPath("unknown", [])).toThrow();
  });

  it("handles complex path with multiple prerequisites", () => {
    const result = validateSkillPath("pyromancer", ["firebolt", "flame_shield", "inferno", "phoenix"]);
    expect(result.valid).toBe(true);
  });

  it("detects multiple violations", () => {
    const result = validateSkillPath("cryomancer", ["blizzard", "permafrost"]);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// calculateOptimalPath
// ---------------------------------------------------------------------------

describe("calculateOptimalPath", () => {
  it("returns path for root skill", () => {
    const path = calculateOptimalPath("pyromancer", "firebolt");
    expect(path.nodes).toHaveLength(1);
    expect(path.nodes[0].id).toBe("firebolt");
    expect(path.totalCost).toBe(1);
  });

  it("returns path with prerequisites", () => {
    const path = calculateOptimalPath("pyromancer", "inferno");
    expect(path.nodes.length).toBeGreaterThan(1);
    expect(path.nodes.some((n) => n.id === "firebolt")).toBe(true);
    expect(path.nodes.some((n) => n.id === "inferno")).toBe(true);
  });

  it("calculates correct total cost", () => {
    const path = calculateOptimalPath("pyromancer", "solar_archon");
    const expectedCost = path.nodes.reduce((sum, n) => sum + n.cost, 0);
    expect(path.totalCost).toBe(expectedCost);
  });

  it("calculates correct total cooldown", () => {
    const path = calculateOptimalPath("pyromancer", "solar_archon");
    const expectedCooldown = path.nodes.reduce((sum, n) => sum + n.cooldown, 0);
    expect(path.totalCooldown).toBe(expectedCooldown);
  });

  it("has correct max tier", () => {
    const path = calculateOptimalPath("pyromancer", "solar_archon");
    expect(path.maxTier).toBe(5);
  });

  it("throws for unknown tree", () => {
    expect(() => calculateOptimalPath("unknown", "firebolt")).toThrow();
  });

  it("throws for unknown skill", () => {
    expect(() => calculateOptimalPath("pyromancer", "unknown")).toThrow();
  });

  it("path includes all prerequisites recursively", () => {
    const path = calculateOptimalPath("pyromancer", "solar_archon");
    const nodeIds = path.nodes.map((n) => n.id);
    expect(nodeIds).toContain("firebolt");
    expect(nodeIds).toContain("flame_shield");
    expect(nodeIds).toContain("inferno");
    expect(nodeIds).toContain("phoenix");
    expect(nodeIds).toContain("solar_archon");
  });
});

// ---------------------------------------------------------------------------
// generateSkillTreeSVG
// ---------------------------------------------------------------------------

describe("generateSkillTreeSVG", () => {
  it("generates SVG data for pyromancer tree", () => {
    const svg = generateSkillTreeSVG("pyromancer");
    expect(svg.nodes.length).toBeGreaterThan(0);
    expect(svg.edges.length).toBeGreaterThan(0);
    expect(svg.width).toBeGreaterThan(0);
    expect(svg.height).toBeGreaterThan(0);
  });

  it("generates SVG data for all trees", () => {
    for (const tree of SKILL_TREES) {
      const svg = generateSkillTreeSVG(tree.id);
      expect(svg.nodes.length).toBe(tree.nodes.length);
      expect(svg.edges.length).toBeGreaterThan(0);
    }
  });

  it("nodes have valid coordinates", () => {
    const svg = generateSkillTreeSVG("pyromancer");
    for (const node of svg.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it("edges reference existing nodes", () => {
    const svg = generateSkillTreeSVG("pyromancer");
    const nodeIds = new Set(svg.nodes.map((n) => n.id));
    for (const edge of svg.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it("throws for unknown tree", () => {
    expect(() => generateSkillTreeSVG("unknown")).toThrow();
  });

  it("nodes have valid colors", () => {
    const svg = generateSkillTreeSVG("pyromancer");
    for (const node of svg.nodes) {
      expect(node.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("getSkillTreeById", () => {
  it("returns correct tree", () => {
    expect(getSkillTreeById("pyromancer").name).toBe("Pyromant");
    expect(getSkillTreeById("cryomancer").name).toBe("Kryomant");
  });

  it("throws for unknown id", () => {
    expect(() => getSkillTreeById("unknown")).toThrow();
  });
});

describe("getSkillNodeById", () => {
  it("returns correct node", () => {
    const node = getSkillNodeById("pyromancer", "firebolt");
    expect(node.name).toBe("Feuerblitz");
  });

  it("throws for unknown tree", () => {
    expect(() => getSkillNodeById("unknown", "firebolt")).toThrow();
  });

  it("throws for unknown skill", () => {
    expect(() => getSkillNodeById("pyromancer", "unknown")).toThrow();
  });
});

describe("getAllSkillTrees", () => {
  it("returns all 4 trees", () => {
    expect(getAllSkillTrees()).toHaveLength(4);
  });

  it("returns a copy", () => {
    const all = getAllSkillTrees();
    all.pop();
    expect(getAllSkillTrees()).toHaveLength(4);
  });
});

describe("getClassEvolutionById", () => {
  it("returns correct evolution", () => {
    const evo = getClassEvolutionById("apprentice_pyromancer");
    expect(evo.name).toBe("Lehrling des Feuers");
  });

  it("throws for unknown id", () => {
    expect(() => getClassEvolutionById("unknown")).toThrow();
  });
});

describe("getAllClassEvolutions", () => {
  it("returns all 9 evolutions", () => {
    expect(getAllClassEvolutions()).toHaveLength(9);
  });

  it("returns a copy", () => {
    const all = getAllClassEvolutions();
    all.pop();
    expect(getAllClassEvolutions()).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// Integration: full skill tree workflow
// ---------------------------------------------------------------------------

describe("integration: full skill tree workflow", () => {
  it("validates a complete pyromancer build", () => {
    const build = ["firebolt", "flame_shield", "inferno", "phoenix", "solar_archon"];
    const result = validateSkillPath("pyromancer", build);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("calculates optimal path for ultimate skill", () => {
    const path = calculateOptimalPath("pyromancer", "solar_archon");
    expect(path.nodes.length).toBe(5);
    expect(path.maxTier).toBe(5);
    expect(path.totalCost).toBeGreaterThan(0);
  });

  it("generates SVG for all trees", () => {
    for (const tree of SKILL_TREES) {
      const svg = generateSkillTreeSVG(tree.id);
      expect(svg.nodes.length).toBe(tree.nodes.length);
      expect(svg.edges.length).toBeGreaterThan(0);
      expect(svg.width).toBeGreaterThan(0);
      expect(svg.height).toBeGreaterThan(0);
    }
  });

  it("detects frost/armor exclusion", () => {
    const result = validateSkillPath("cryomancer", ["frostbolt", "ice_armor"]);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("excludes"))).toBe(true);
  });

  it("detects frost/armor exclusion", () => {
    const result = validateSkillPath("cryomancer", ["frostbolt", "ice_armor"]);
    expect(result.valid).toBe(false);
  });
});
