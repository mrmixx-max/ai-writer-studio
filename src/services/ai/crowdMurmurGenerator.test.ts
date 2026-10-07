// @vitest-environment jsdom
/** Tests: CrowdMurmurGenerator (WP 89.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createCrowdMurmur,
  generateCrowdSnippets,
  formatCrowdMurmur,
  createSampleMurmur,
  createSampleSnippets,
  type CrowdMurmur as _CrowdMurmur,
  type CrowdSnippet as _CrowdSnippet,
  type CrowdMood as _CrowdMood,
} from "./crowdMurmurGenerator";

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

describe("createCrowdMurmur", () => {
  it("erzeugt Mengenmurmel mit allen Feldern", () => {
    const murmur = createCrowdMurmur("Marktplatz", "festive", "morning", 42);
    expect(murmur.id).toContain("CROWD-");
    expect(murmur.location).toBe("Marktplatz");
    expect(murmur.mood).toBe("festive");
    expect(murmur.timeOfDay).toBe("morning");
    expect(murmur.layers.length).toBe(3);
    expect(murmur.overallVolume).toBeGreaterThan(0);
  });

  it("hat drei Schichten", () => {
    const murmur = createCrowdMurmur("Test", "neutral", "noon", 123);
    const distances = murmur.layers.map(l => l.distance).sort();
    expect(distances).toEqual(["background", "foreground", "middleground"]);
  });

  it("ist deterministisch", () => {
    const m1 = createCrowdMurmur("Ort", "tense", "evening", 999);
    const m2 = createCrowdMurmur("Ort", "tense", "evening", 999);
    expect(m1).toEqual(m2);
  });

  it("verschiedene Stimmungen erzeugen unterschiedliche Lautstärken", () => {
    const festive = createCrowdMurmur("Ort", "festive", "noon", 1);
    const reverent = createCrowdMurmur("Ort", "reverent", "noon", 1);
    const panic = createCrowdMurmur("Ort", "panic", "noon", 1);
    
    expect(panic.overallVolume).toBeGreaterThan(festive.overallVolume);
    expect(festive.overallVolume).toBeGreaterThan(reverent.overallVolume);
  });

  it("erzeugt dominantes Thema", () => {
    const murmur = createCrowdMurmur("Marktplatz", "festive", "morning", 42);
    expect(murmur.dominantTopic).toBeDefined();
  });
});

describe("generateCrowdSnippets", () => {
  it("erzeugt Snippets aus allen Schichten", () => {
    const murmur = createSampleMurmur();
    const snippets = generateCrowdSnippets(murmur, 5);
    expect(snippets.length).toBeLessThanOrEqual(5);
    expect(snippets.every(s => s.text && s.layer && s.mood)).toBe(true);
  });

  it("enthält alle drei Schichten", () => {
    const murmur = createSampleMurmur();
    const snippets = generateCrowdSnippets(murmur, 20);
    const layers = new Set(snippets.map(s => s.layer));
    expect(layers.has("foreground")).toBe(true);
    expect(layers.has("middleground")).toBe(true);
    expect(layers.has("background")).toBe(true);
  });

  it("ist deterministisch", () => {
    const murmur = createSampleMurmur();
    const s1 = generateCrowdSnippets(murmur, 5);
    const s2 = generateCrowdSnippets(murmur, 5);
    expect(s1).toEqual(s2);
  });
});

describe("formatCrowdMurmur", () => {
  it("formatiert als Text mit allen Schichten", () => {
    const murmur = createSampleMurmur();
    const text = formatCrowdMurmur(murmur);
    expect(text).toContain("MENGENMURMEL");
    expect(text).toContain("Vordergrund");
    expect(text).toContain("Mittelgrund");
    expect(text).toContain("Hintergrund");
    expect(text).toContain("🎉 Festlich");
  });
});

describe("createSampleMurmur", () => {
  it("erzeugt Beispiel-Murmur", () => {
    const murmur = createSampleMurmur();
    expect(murmur.location).toBe("Marktplatz");
    expect(murmur.mood).toBe("festive");
    expect(murmur.timeOfDay).toBe("morning");
  });
});

describe("createSampleSnippets", () => {
  it("erzeugt Beispiel-Snippets", () => {
    const snippets = createSampleSnippets();
    expect(snippets.length).toBe(5);
    expect(snippets.every(s => s.text)).toBe(true);
  });
});