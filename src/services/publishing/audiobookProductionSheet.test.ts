/**
 * Tests: AudiobookProductionSheet (WP 73.2)
 */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  createNarratorProfile,
  estimateDuration,
  createChapter,
  createQCChecks,
  createProductionSheet,
  allCriticalChecksPassed,
  allChecksPassed,
  countPassedChecks,
  computeQCScore,
  formatProductionSheet,
  createSampleProductionSheet,
  type ProductionChapter,
} from "./audiobookProductionSheet";

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

describe("createNarratorProfile", () => {
  it("erstellt Profil", () => {
    const n = createNarratorProfile("n1", "Thomas", "narrator", "Tief", 150);
    expect(n.id).toBe("n1");
    expect(n.name).toBe("Thomas");
    expect(n.role).toBe("narrator");
    expect(n.pacingWpm).toBe(150);
  });

  it("verwendet Default-WPM", () => {
    const n = createNarratorProfile("n1", "Thomas", "narrator", "Tief");
    expect(n.pacingWpm).toBe(150);
  });
});

describe("estimateDuration", () => {
  it("berechnet Dauer korrekt", () => {
    expect(estimateDuration(1500, 150)).toBe(10);
  });

  it("verarbeitet 0 WPM", () => {
    expect(estimateDuration(1000, 0)).toBe(0);
  });

  it("rundet auf eine Dezimalstelle", () => {
    const d = estimateDuration(1000, 155);
    expect(d).toBeCloseTo(6.5, 1);
  });
});

describe("createChapter", () => {
  it("erstellt Kapitel", () => {
    const ch = createChapter(1, "Titel", 3000, ["n1"]);
    expect(ch.number).toBe(1);
    expect(ch.title).toBe("Titel");
    expect(ch.wordCount).toBe(3000);
    expect(ch.estimatedDurationMin).toBe(20);
  });

  it("verwendet Custom-WPM", () => {
    const ch = createChapter(1, "Titel", 3000, ["n1"], "", 200);
    expect(ch.estimatedDurationMin).toBe(15);
  });
});

describe("createQCChecks", () => {
  it("erstellt 8 Checks", () => {
    const checks = createQCChecks();
    expect(checks).toHaveLength(8);
  });

  it("hat kritische Checks", () => {
    const checks = createQCChecks();
    expect(checks.some((c) => c.severity === "critical")).toBe(true);
  });

  it("hat major Checks", () => {
    const checks = createQCChecks();
    expect(checks.some((c) => c.severity === "major")).toBe(true);
  });

  it("hat minor Checks", () => {
    const checks = createQCChecks();
    expect(checks.some((c) => c.severity === "minor")).toBe(true);
  });
});

describe("createProductionSheet", () => {
  it("erstellt vollständigen Bogen", () => {
    const narrator = createNarratorProfile("n1", "Thomas", "narrator", "Tief");
    const chapters = [createChapter(1, "A", 3000, ["n1"]), createChapter(2, "B", 4000, ["n1"])];
    const sheet = createProductionSheet("Titel", "Autor", narrator, chapters);
    expect(sheet.title).toBe("Titel");
    expect(sheet.author).toBe("Autor");
    expect(sheet.chapters).toHaveLength(2);
    expect(sheet.totalWordCount).toBe(7000);
  });

  it("berechnet Gesamtdauer", () => {
    const narrator = createNarratorProfile("n1", "Thomas", "narrator", "Tief");
    const chapters = [createChapter(1, "A", 3000, ["n1"]), createChapter(2, "B", 3000, ["n1"])];
    const sheet = createProductionSheet("Titel", "Autor", narrator, chapters);
    expect(sheet.totalDurationMin).toBe(40);
  });

  it("erstellt ACX-Metadaten", () => {
    const narrator = createNarratorProfile("n1", "Thomas", "narrator", "Tief");
    const chapters = [createChapter(1, "A", 3000, ["n1"])];
    const sheet = createProductionSheet("Titel", "Autor", narrator, chapters);
    expect(sheet.acxMetadata.title).toBe("Titel");
    expect(sheet.acxMetadata.narrator).toBe("Thomas");
    expect(sheet.acxMetadata.language).toBe("Deutsch");
  });
});

describe("allCriticalChecksPassed", () => {
  it("gibt true wenn alle kritischen bestanden", () => {
    const sheet = createSampleProductionSheet();
    expect(allCriticalChecksPassed(sheet)).toBe(true);
  });
});

describe("allChecksPassed", () => {
  it("gibt true wenn alle bestanden", () => {
    const sheet = createSampleProductionSheet();
    expect(allChecksPassed(sheet)).toBe(true);
  });
});

describe("countPassedChecks", () => {
  it("zählt bestandene Checks", () => {
    const sheet = createSampleProductionSheet();
    expect(countPassedChecks(sheet)).toBe(8);
  });
});

describe("computeQCScore", () => {
  it("berechnet Score", () => {
    const sheet = createSampleProductionSheet();
    expect(computeQCScore(sheet)).toBe(100);
  });

  it("gibt 0 für leere Checkliste", () => {
    const narrator = createNarratorProfile("n1", "Thomas", "narrator", "Tief");
    const chapters: ProductionChapter[] = [];
    const sheet = createProductionSheet("T", "A", narrator, chapters);
    sheet.qcChecks = [];
    expect(computeQCScore(sheet)).toBe(0);
  });
});

describe("formatProductionSheet", () => {
  it("formatiert Bogen", () => {
    const sheet = createSampleProductionSheet();
    const text = formatProductionSheet(sheet);
    expect(text).toContain("HOERBUCH-REGIEBOGEN");
    expect(text).toContain("KAPITEL");
    expect(text).toContain("QC-CHECKLISTE");
  });

  it("enthält QC-Score", () => {
    const sheet = createSampleProductionSheet();
    const text = formatProductionSheet(sheet);
    expect(text).toContain("QC-SCORE");
  });
});

describe("createSampleProductionSheet", () => {
  it("erstellt Beispiel-Bogen", () => {
    const sheet = createSampleProductionSheet();
    expect(sheet.chapters.length).toBeGreaterThan(0);
    expect(sheet.qcChecks.length).toBeGreaterThan(0);
    expect(sheet.totalWordCount).toBeGreaterThan(0);
  });

  it("hat Sprecher", () => {
    const sheet = createSampleProductionSheet();
    expect(sheet.narrator.name).toBeTruthy();
  });
});
