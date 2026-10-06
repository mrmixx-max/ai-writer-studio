/**
 * Tests: UniversalFormatTransmuter (WP 80.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  parseScenes,
  extractCharacters,
  extractDialogue,
  proseToScreenplay,
  proseToGamebook,
  proseToComic,
  proseToStageplay,
  transmute,
  formatTransmuted,
  createSampleTransmutation,
  FORMAT_LABELS,
} from "./universalFormatTransmuter";

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

describe("parseScenes", () => {
  it("zerlegt Text in Szenen", () => {
    const scenes = parseScenes("Erster Absatz.\n\nZweiter Absatz.");
    expect(scenes).toHaveLength(2);
  });

  it("verarbeitet leeren Text", () => {
    expect(parseScenes("")).toEqual([]);
  });
});

describe("extractCharacters", () => {
  it("extrahiert Figurennamen", () => {
    const chars = extractCharacters("Der Held Falkenstein zog in die Schlacht.");
    expect(chars.length).toBeGreaterThan(0);
  });
});

describe("extractDialogue", () => {
  it("extrahiert Dialoge", () => {
    const dialogues = extractDialogue('Er sagte: „Ich muss handeln".');
    expect(dialogues.length).toBeGreaterThan(0);
  });
});

describe("proseToScreenplay", () => {
  it("konvertiert zu Screenplay", () => {
    const result = proseToScreenplay("Der Held stand auf dem Dach.");
    expect(result).toContain("SZENE");
  });
});

describe("proseToGamebook", () => {
  it("konvertiert zu Gamebook", () => {
    const result = proseToGamebook("Der Held stand auf dem Dach.");
    expect(result).toContain("Abschnitt");
  });
});

describe("proseToComic", () => {
  it("konvertiert zu Comic", () => {
    const result = proseToComic("Der Held stand auf dem Dach.");
    expect(result).toContain("Seite");
  });
});

describe("proseToStageplay", () => {
  it("konvertiert zu Theaterstück", () => {
    const result = proseToStageplay("Der Held stand auf dem Dach.");
    expect(result).toContain("Auftritt");
  });
});

describe("transmute", () => {
  it("transmutiert Dokument", () => {
    const doc = transmute("Der Held stand auf dem Dach.", "prose", "screenplay");
    expect(doc.sourceFormat).toBe("prose");
    expect(doc.targetFormat).toBe("screenplay");
  });

  it("ist deterministisch", () => {
    const d1 = transmute("Test", "prose", "screenplay");
    const d2 = transmute("Test", "prose", "screenplay");
    expect(d1).toEqual(d2);
  });

  it("erkennt identische Formate", () => {
    const doc = transmute("Test", "prose", "prose");
    expect(doc.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatTransmuted", () => {
  it("formatiert Dokument als Text", () => {
    const doc = createSampleTransmutation();
    const text = formatTransmuted(doc);
    expect(text).toContain("TRANSMUTATION");
  });
});

describe("createSampleTransmutation", () => {
  it("erstellt Beispiel-Transmutation", () => {
    const doc = createSampleTransmutation();
    expect(doc.sourceFormat).toBe("prose");
  });
});

describe("FORMAT_LABELS", () => {
  it("hat alle Formate", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(5);
  });
});
