/**
 * Tests: ConcordanceIndexMatrix (WP 79.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  extractNames,
  extractBattles,
  extractArtifacts,
  extractTerms,
  createConcordanceIndex,
  formatConcordanceIndex,
  createSampleIndex,
  TYPE_LABELS,
} from "./concordanceIndexMatrix";

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

describe("extractNames", () => {
  it("extrahiert Eigennamen", () => {
    const names = extractNames("Der Held Falkenstein zog in die Schlacht.");
    expect(names.length).toBeGreaterThan(0);
  });

  it("verarbeitet leeren Text", () => {
    expect(extractNames("")).toEqual([]);
  });
});

describe("extractBattles", () => {
  it("extrahiert Schlachten", () => {
    const battles = extractBattles("Die Schlacht von Düsterwald war blutig.");
    expect(battles.length).toBeGreaterThan(0);
  });

  it("findet keine Schlachten ohne Muster", () => {
    expect(extractBattles("Es war ein schöner Tag.")).toEqual([]);
  });
});

describe("extractArtifacts", () => {
  it("extrahiert Artefakte", () => {
    const artifacts = extractArtifacts("Er trug das Schwert Klinge des Lichts.");
    expect(artifacts.length).toBeGreaterThan(0);
  });
});

describe("extractTerms", () => {
  it("extrahiert Fachbegriffe", () => {
    const terms = extractTerms('Das „Klinge des Lichts" war mächtig.');
    expect(terms.length).toBeGreaterThan(0);
  });
});

describe("createConcordanceIndex", () => {
  it("erstellt vollständigen Index", () => {
    const text = "Der Held Falkenstein zog in die Schlacht von Düsterwald.";
    const index = createConcordanceIndex("Test", text);
    expect(index.title).toBe("Test");
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    const text = "Der Held Falkenstein zog in die Schlacht von Düsterwald.";
    const i1 = createConcordanceIndex("Test", text);
    const i2 = createConcordanceIndex("Test", text);
    expect(i1).toEqual(i2);
  });
});

describe("formatConcordanceIndex", () => {
  it("formatiert Index als Text", () => {
    const index = createSampleIndex();
    const text = formatConcordanceIndex(index);
    expect(text).toContain("KONKORDANZ");
  });
});

describe("createSampleIndex", () => {
  it("erstellt Beispiel-Index", () => {
    const index = createSampleIndex();
    expect(index.title).toBeTruthy();
    expect(index.entries.length).toBeGreaterThan(0);
  });
});

describe("TYPE_LABELS", () => {
  it("hat alle Typ-Labels", () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(5);
  });
});
