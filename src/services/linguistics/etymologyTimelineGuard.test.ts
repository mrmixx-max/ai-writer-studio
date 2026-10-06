/**
 * Tests: EtymologyTimelineGuard (WP 76.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  scanForAnachronisms,
  getEpochStart,
  getEpochEnd,
  suggestSynonym,
  formatAnachronismReport,
  createSampleReport,
  EPOCH_LABELS,
  ANACHRONISMS,
} from "./etymologyTimelineGuard";

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

describe("scanForAnachronisms", () => {
  it("findet Anachronismen im Mittelalter", () => {
    const text = "Der Ritter nahm das Telefon und fuhr mit dem Auto zum Schloss.";
    const found = scanForAnachronisms(text, "medieval");
    expect(found.length).toBeGreaterThan(0);
  });

  it("findet keine Anachronismen in moderner Zeit", () => {
    const text = "Der Ritter nahm das Telefon und fuhr mit dem Auto zum Schloss.";
    const found = scanForAnachronisms(text, "1920s");
    expect(found.length).toBe(0);
  });

  it("findet keine Anachronismen in leerem Text", () => {
    expect(scanForAnachronisms("", "medieval")).toEqual([]);
  });
});

describe("getEpochStart", () => {
  it("gibt Startjahr zurück", () => {
    expect(getEpochStart("medieval")).toBe(500);
    expect(getEpochStart("renaissance")).toBe(1400);
  });
});

describe("getEpochEnd", () => {
  it("gibt Endjahr zurück", () => {
    expect(getEpochEnd("medieval")).toBe(1500);
    expect(getEpochEnd("victorian")).toBe(1901);
  });
});

describe("suggestSynonym", () => {
  it("schlägt Synonym vor", () => {
    const syn = suggestSynonym("telefon");
    expect(syn.length).toBeGreaterThan(0);
  });

  it("gibt Standardtext für unbekanntes Wort", () => {
    expect(suggestSynonym("xyz")).toBe("Kein Synonym gefunden");
  });
});

describe("formatAnachronismReport", () => {
  it("formatiert Bericht", () => {
    const text = "Der Ritter nahm das Telefon.";
    const anachronisms = scanForAnachronisms(text, "medieval");
    const report = formatAnachronismReport(anachronisms, "medieval");
    expect(report).toContain("ETYMOLOGIE-WÄCHTER");
  });

  it("verarbeitet leere Liste", () => {
    const report = formatAnachronismReport([], "medieval");
    expect(report).toContain("Keine Anachronismen");
  });
});

describe("createSampleReport", () => {
  it("erstellt Beispiel-Bericht", () => {
    const report = createSampleReport();
    expect(report).toContain("ETYMOLOGIE-WÄCHTER");
  });
});

describe("EPOCH_LABELS", () => {
  it("hat alle Epochen-Labels", () => {
    expect(Object.keys(EPOCH_LABELS)).toHaveLength(6);
  });
});

describe("ANACHRONISMS", () => {
  it("hat mindestens 10 Einträge", () => {
    expect(ANACHRONISMS.length).toBeGreaterThanOrEqual(10);
  });

  it("hat einzigartige Wörter", () => {
    const words = ANACHRONISMS.map((a) => a.word);
    expect(new Set(words).size).toBe(ANACHRONISMS.length);
  });
});
