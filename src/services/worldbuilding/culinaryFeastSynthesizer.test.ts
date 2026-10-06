/**
 * Tests: CulinaryFeastSynthesizer (WP 78.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  generateDish,
  generateFeast,
  formatFeast,
  createSampleFeast,
  BIOME_LABELS,
  CLASS_LABELS,
} from "./culinaryFeastSynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("generateDish", () => {
  it("generiert Gericht", () => {
    const dish = generateDish("forest", "royal", 42);
    expect(dish.name).toBeTruthy();
    expect(dish.ingredients.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const d1 = generateDish("forest", "royal", 42);
    const d2 = generateDish("forest", "royal", 42);
    expect(d1).toEqual(d2);
  });

  it("hat Zutaten, Geschmack und Textur", () => {
    const dish = generateDish("coastal", "peasant", 42);
    expect(dish.ingredients.length).toBeGreaterThan(0);
    expect(dish.flavors.length).toBeGreaterThan(0);
    expect(dish.textures.length).toBeGreaterThan(0);
  });
});

describe("generateFeast", () => {
  it("generiert Festmahl", () => {
    const feast = generateFeast("Test", "forest", "royal", 42);
    expect(feast.name).toBe("Test");
    expect(feast.dishes.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const f1 = generateFeast("Test", "forest", "royal", 42);
    const f2 = generateFeast("Test", "forest", "royal", 42);
    expect(f1).toEqual(f2);
  });

  it("hat 3-6 Gänge", () => {
    const feast = generateFeast("Test", "forest", "royal", 42);
    expect(feast.totalCourses).toBeGreaterThanOrEqual(3);
    expect(feast.totalCourses).toBeLessThanOrEqual(6);
  });
});

describe("formatFeast", () => {
  it("formatiert Festmahl als Text", () => {
    const feast = createSampleFeast();
    const text = formatFeast(feast);
    expect(text).toContain("FESTMAHL");
    expect(text).toContain("Gänge:");
  });
});

describe("createSampleFeast", () => {
  it("erstellt Beispiel-Festmahl", () => {
    const feast = createSampleFeast();
    expect(feast.name).toBeTruthy();
    expect(feast.dishes.length).toBeGreaterThan(0);
  });
});

describe("BIOME_LABELS", () => {
  it("hat alle Biom-Labels", () => {
    expect(Object.keys(BIOME_LABELS)).toHaveLength(5);
  });
});

describe("CLASS_LABELS", () => {
  it("hat alle Standes-Labels", () => {
    expect(Object.keys(CLASS_LABELS)).toHaveLength(4);
  });
});
