// @vitest-environment jsdom
/** Tests: StageLightingDirector (WP 88.2) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createLightSource,
  createLightCue,
  createLightingScene,
  generateLightingScript,
  getKelvinMood,
  createSampleScene,
  createSampleScript,
  type LightSource as _LightSource,
  type LightCue as _LightCue,
  type LightingScene as _LightingScene,
  type LightType as _LightType,
} from "./stageLightingDirector";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
});

describe("getKelvinMood", () => {
  it("ordnet Kelvin Stimmungen zu", () => {
    expect(getKelvinMood(1900).mood).toBe("Intim, romantisch, nostalgisch");
    expect(getKelvinMood(2500).mood).toBe("Warm, gemütlich, intim");
    expect(getKelvinMood(3000).mood).toBe("Einladend, behaglich");
    expect(getKelvinMood(3500).mood).toBe("Neutral, natürlich");
    expect(getKelvinMood(4500).mood).toBe("Klar, aktiv, konzentriert");
    expect(getKelvinMood(5500).mood).toBe("Kühl, steril, klinisch");
    expect(getKelvinMood(8000).mood).toBe("Extrem kühl, surreal, unwirklich");
  });

  it("gibt Beschreibung zurück", () => {
    const mood = getKelvinMood(3500);
    expect(mood.description).toContain("Morgen");
  });
});

describe("createLightSource", () => {
  it("erzeugt Lichtquelle mit allen Eigenschaften", () => {
    const light = createLightSource("key", 42);
    expect(light.id).toContain("LS-");
    expect(["key", "fill", "back", "rim", "background", "special", "practical"]).toContain(light.type);
    expect(light.kelvin).toBeGreaterThanOrEqual(1800);
    expect(light.kelvin).toBeLessThanOrEqual(10000);
    expect(light.intensity).toBeGreaterThanOrEqual(10);
    expect(light.intensity).toBeLessThanOrEqual(100);
    expect(light.position).toHaveProperty("x");
    expect(light.position).toHaveProperty("y");
    expect(light.position).toHaveProperty("z");
    expect(light.angle).toBeGreaterThanOrEqual(10);
    expect(light.angle).toBeLessThanOrEqual(90);
    expect(light.focus).toBeGreaterThanOrEqual(0);
    expect(light.focus).toBeLessThanOrEqual(100);
    expect(light.colorFilter).toBeDefined();
    expect(light.gelName).toBeDefined();
  });

  it("erzeugt verschiedene Lichttypen", () => {
    const types: _LightType[] = ["key", "fill", "back", "rim", "background", "special", "practical"];
    for (const type of types) {
      const light = createLightSource(type, 123);
      expect(light.type).toBe(type);
    }
  });

  it("ist deterministisch", () => {
    const l1 = createLightSource("key", 42);
    const l2 = createLightSource("key", 42);
    expect(l1).toEqual(l2);
  });

  it("akzeptiert benutzerdefinierten Kelvin", () => {
    const light = createLightSource("fill", 100, 4500);
    expect(light.kelvin).toBeGreaterThanOrEqual(1800);
    expect(light.kelvin).toBeLessThanOrEqual(10000);
  });
});

describe("createLightCue", () => {
  it("erzeugt Cue mit mehreren Lichtern", () => {
    const cue = createLightCue("Opening", "00:01:30", 42);
    expect(cue.id).toContain("CUE-");
    expect(cue.name).toBe("Opening");
    expect(cue.timecode).toBe("00:01:30");
    expect(cue.lights.length).toBeGreaterThanOrEqual(2);
    expect(cue.lights.length).toBeLessThanOrEqual(5);
    expect(cue.duration).toBeGreaterThanOrEqual(1);
    expect(cue.duration).toBeLessThanOrEqual(5);
    expect(cue.script).toContain("[LICHT:");
    expect(cue.description).toContain("K");
  });

  it("ist deterministisch", () => {
    const c1 = createLightCue("Test", "00:00:00", 42);
    const c2 = createLightCue("Test", "00:00:00", 42);
    expect(c1).toEqual(c2);
  });
});

describe("createLightingScene", () => {
  it("erzeugt Szene mit mehreren Cues", () => {
    const scene = createLightingScene("Test Scene", 42, 4);
    expect(scene.id).toContain("SCENE-");
    expect(scene.name).toBe("Test Scene");
    expect(scene.cues.length).toBe(4);
    expect(scene.overallMood).toBeDefined();
    expect(scene.dominantKelvin).toBeGreaterThan(1800);
  });

  it("ist deterministisch", () => {
    const s1 = createLightingScene("Scene", 42, 3);
    const s2 = createLightingScene("Scene", 42, 3);
    expect(s1).toEqual(s2);
  });
});

describe("generateLightingScript", () => {
  it("generiert vollständiges Regie-Skript", () => {
    const scene = createSampleScene();
    const script = generateLightingScript(scene);
    expect(script).toContain("LICHTREGIE:");
    expect(script).toContain("Cue");
    expect(script).toContain("KEY");
    expect(script).toContain("FILL");
    expect(script).toContain("LICHT:");
  });
});

describe("createSampleScene", () => {
  it("erzeugt Beispiel-Szene", () => {
    const scene = createSampleScene();
    expect(scene.name).toContain("Schlosshof");
    expect(scene.cues.length).toBe(3);
  });
});

describe("createSampleScript", () => {
  it("erzeugt Beispiel-Skript", () => {
    const script = createSampleScript();
    expect(script).toContain("LICHTREGIE:");
    expect(script).toContain("Schlosshof");
  });
});