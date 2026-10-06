/**
 * Tests: EldritchSensoryWeaver (WP 73.1)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  generateSensoryScene,
  generateSensoryScenes,
  formatSensoryScene,
  formatSensoryScenes,
  computeAverageIntensity,
  findMostIntenseEntry,
  isDreadful,
  pickTemplate,
  CATEGORY_LABELS,
  type SenseCategory,
} from "./eldritchSensoryWeaver";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });

  it("liefert unterschiedliche Werte für unterschiedliche Inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    expect(r1()).toBe(r2());
  });
});

describe("pickTemplate", () => {
  it("wählt deterministisch aus Vorlagen", () => {
    const templates = ["a", "b", "c", "d"];
    expect(pickTemplate(templates, 42, 0)).toBe(pickTemplate(templates, 42, 0));
  });

  it("liefert unterschiedliche Werte für verschiedene Indizes", () => {
    const templates = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const results = new Set<string>();
    for (let i = 0; i < 8; i++) {
      results.add(pickTemplate(templates, 42, i));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("generateSensoryScene", () => {
  it("generiert Szene mit 5 Einträgen", () => {
    const scene = generateSensoryScene("Test", 42);
    expect(scene.entries).toHaveLength(5);
  });

  it("verwendet alle Kategorien", () => {
    const scene = generateSensoryScene("Test", 42);
    const categories = scene.entries.map((e) => e.category);
    expect(categories).toContain("sound");
    expect(categories).toContain("smell");
    expect(categories).toContain("touch");
    expect(categories).toContain("sight");
    expect(categories).toContain("taste");
  });

  it("ist deterministisch für gleichen Seed", () => {
    const s1 = generateSensoryScene("Test", 42);
    const s2 = generateSensoryScene("Test", 42);
    expect(s1).toEqual(s2);
  });

  it("liefert unterschiedliche Szenen für verschiedene Seeds", () => {
    const s1 = generateSensoryScene("Test", 1);
    const s2 = generateSensoryScene("Test", 2);
    expect(s1).not.toEqual(s2);
  });

  it("berechnet Gesamtschrecken", () => {
    const scene = generateSensoryScene("Test", 42);
    expect(scene.overallDread).toBeGreaterThanOrEqual(0);
    expect(scene.overallDread).toBeLessThanOrEqual(100);
  });

  it("verwendet den Titel", () => {
    const scene = generateSensoryScene("Mein Titel", 42);
    expect(scene.title).toBe("Mein Titel");
  });

  it("hat Intensität zwischen 0 und 100", () => {
    const scene = generateSensoryScene("Test", 42);
    for (const entry of scene.entries) {
      expect(entry.intensity).toBeGreaterThanOrEqual(0);
      expect(entry.intensity).toBeLessThanOrEqual(100);
    }
  });
});

describe("generateSensoryScenes", () => {
  it("generiert mehrere Szenen", () => {
    const scenes = generateSensoryScenes(["A", "B", "C"], 42);
    expect(scenes).toHaveLength(3);
  });

  it("verwendet die Titel", () => {
    const scenes = generateSensoryScenes(["Erster", "Zweiter"], 42);
    expect(scenes[0].title).toBe("Erster");
    expect(scenes[1].title).toBe("Zweiter");
  });
});

describe("formatSensoryScene", () => {
  it("formatiert Szene als Text", () => {
    const scene = generateSensoryScene("Test", 42);
    const text = formatSensoryScene(scene);
    expect(text).toContain("Test");
    expect(text).toContain("Gesamtschrecken");
  });

  it("enthält alle Kategorien", () => {
    const scene = generateSensoryScene("Test", 42);
    const text = formatSensoryScene(scene);
    expect(text).toContain("Gehör");
    expect(text).toContain("Geruch");
    expect(text).toContain("Tastsinn");
    expect(text).toContain("Sehen");
    expect(text).toContain("Geschmack");
  });
});

describe("formatSensoryScenes", () => {
  it("formatiert mehrere Szenen", () => {
    const scenes = generateSensoryScenes(["A", "B"], 42);
    const text = formatSensoryScenes(scenes);
    expect(text).toContain("A");
    expect(text).toContain("B");
  });
});

describe("computeAverageIntensity", () => {
  it("berechnet Durchschnitt", () => {
    const scene = generateSensoryScene("Test", 42);
    const avg = computeAverageIntensity(scene);
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  });

  it("gibt 0 für leere Szene", () => {
    const emptyScene = { title: "Leer", entries: [], overallDread: 0 };
    expect(computeAverageIntensity(emptyScene)).toBe(0);
  });
});

describe("findMostIntenseEntry", () => {
  it("findet intensivsten Eintrag", () => {
    const scene = generateSensoryScene("Test", 42);
    const most = findMostIntenseEntry(scene);
    expect(most).not.toBeNull();
    expect(most!.intensity).toBeGreaterThanOrEqual(0);
  });

  it("gibt null für leere Szene", () => {
    const emptyScene = { title: "Leer", entries: [], overallDread: 0 };
    expect(findMostIntenseEntry(emptyScene)).toBeNull();
  });
});

describe("isDreadful", () => {
  it("erkennt beängstigende Szene", () => {
    const scene = { title: "Test", entries: [], overallDread: 80 };
    expect(isDreadful(scene)).toBe(true);
  });

  it("erkennt harmlose Szene", () => {
    const scene = { title: "Test", entries: [], overallDread: 30 };
    expect(isDreadful(scene)).toBe(false);
  });

  it("respektiert Schwellenwert", () => {
    const scene = { title: "Test", entries: [], overallDread: 60 };
    expect(isDreadful(scene, 70)).toBe(false);
    expect(isDreadful(scene, 50)).toBe(true);
  });
});

describe("CATEGORY_LABELS", () => {
  it("hat alle Kategorien", () => {
    const categories: SenseCategory[] = ["sound", "smell", "touch", "sight", "taste"];
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});
