// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  PLATFORMS,
  getPlatform,
  formatLitRPGStatus,
  analyzeCliffhanger,
  exportChapter,
  analyzeSerial,
  createSampleLitRPGStatus,
  createSampleCliffhangerAnalysis,
  createSampleChapterExport,
  createSampleSerialReport,
} from "./webSerialPublisher";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(37);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("PLATFORMS", () => {
  it("enthält vier Plattformen", () => {
    expect(PLATFORMS).toHaveLength(4);
  });
  it("Royal Road zielt auf 2000 Wörter", () => {
    expect(getPlatform("royalRoad")!.targetWordCount).toBe(2000);
  });
  it("Patreon hat die höchste Cliffhanger-Skala", () => {
    const patreon = getPlatform("patreon")!;
    for (const p of PLATFORMS) {
      if (p.id !== "patreon") expect(patreon.cliffhangerScale).toBeGreaterThanOrEqual(p.cliffhangerScale);
    }
  });
  it("getPlatform lieferv undefined für unbekannt", () => {
    expect(getPlatform("xyz" as never)).toBeUndefined();
  });
});

describe("formatLitRPGStatus", () => {
  it("enthält Namen, Level und Klasse", () => {
    const s = createSampleLitRPGStatus();
    const out = formatLitRPGStatus(s);
    expect(out).toContain(s.name);
    expect(out).toContain(String(s.level));
    expect(out).toContain(s.class);
  });
  it("enthält HP und MP", () => {
    const out = formatLitRPGStatus(createSampleLitRPGStatus());
    expect(out).toContain("HP:");
    expect(out).toContain("MP:");
  });
  it("enthält Attribute, Fähigkeiten und Inventar", () => {
    const s = createSampleLitRPGStatus();
    const out = formatLitRPGStatus(s);
    for (const a of s.attributes) {
      expect(out).toContain(a.name);
    }
    expect(out).toContain("Fähigkeiten:");
    expect(out).toContain("Inventar:");
  });
});

describe("analyzeCliffhanger", () => {
  it("ist deterministisch", () => {
    expect(analyzeCliffhanger("Test", 3, 7, 8, 42).score).toBe(
      analyzeCliffhanger("Test", 3, 7, 8, 42).score
    );
  });
  it("Score bleibt im Bereich 0..10", () => {
    const a = analyzeCliffhanger("Test", 3, 7, 8, 42);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(10);
  });
  it("Openness, Tension und Emotional Impact bleiben im Bereich 0..10", () => {
    const a = analyzeCliffhanger("Test", 3, 7, 8, 42);
    expect(a.openness).toBeGreaterThanOrEqual(0);
    expect(a.openness).toBeLessThanOrEqual(10);
    expect(a.tension).toBeGreaterThanOrEqual(0);
    expect(a.tension).toBeLessThanOrEqual(10);
    expect(a.emotionalImpact).toBeGreaterThanOrEqual(0);
    expect(a.emotionalImpact).toBeLessThanOrEqual(10);
  });
  it("starker Cliffhanger erhält Patreon-Empfehlung", () => {
    const a = analyzeCliffhanger("Test", 5, 9, 10, 42);
    expect(a.patreonRecommendation).toContain("Patreon");
  });
  it("schwacher Cliffhanger wird nicht empfohlen", () => {
    const a = analyzeCliffhanger("Test", 0, 1, 1, 42);
    expect(a.patreonRecommendation).toContain("nicht empfohlen");
  });
});

describe("exportChapter", () => {
  it("ist deterministisch", () => {
    expect(exportChapter("royalRoad", "T", "Inhalt", 42).id).toBe(
      exportChapter("royalRoad", "T", "Inhalt", 42).id
    );
  });
  it("erzeugt Markdown und HTML", () => {
    const e = exportChapter("royalRoad", "T", "Inhalt", 42);
    expect(e.markdown).toContain("# T");
    expect(e.html).toContain("<h1>T</h1>");
  });
  it("zählt Wörter", () => {
    const e = exportChapter("royalRoad", "T", "Eins zwei drei", 42);
    expect(e.wordCount).toBe(3);
  });
  it("berechnet Lesezeit", () => {
    const e = exportChapter("royalRoad", "T", "Eins zwei drei", 42);
    expect(e.readingMinutes).toBeGreaterThanOrEqual(1);
  });
  it("Plattform ist gesetzt", () => {
    expect(exportChapter("wattpad", "T", "Inhalt", 42).platform.id).toBe("wattpad");
  });
});

describe("analyzeSerial", () => {
  it("ist deterministisch", () => {
    const chapters = [{ title: "K1", content: "Eins zwei drei" }];
    expect(analyzeSerial("royalRoad", chapters, 42).id).toBe(
      analyzeSerial("royalRoad", chapters, 42).id
    );
  });
  it("zählt Kapitel und Wörter", () => {
    const chapters = [
      { title: "K1", content: "Eins zwei" },
      { title: "K2", content: "Drei vier fünf" },
    ];
    const r = analyzeSerial("royalRoad", chapters, 42);
    expect(r.chapterCount).toBe(2);
    expect(r.totalWords).toBe(5);
    expect(r.avgWordsPerChapter).toBe(3);
  });
  it("enthält Cliffhanger-Analyse und Export", () => {
    const r = analyzeSerial("royalRoad", [{ title: "K1", content: "Inhalt" }], 42);
    expect(r.cliffhangerAnalysis.score).toBeGreaterThanOrEqual(0);
    expect(r.export.wordCount).toBeGreaterThanOrEqual(0);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleLitRPGStatus liefert Kael", () => {
    expect(createSampleLitRPGStatus().name).toBe("Kael");
  });
  it("createSampleCliffhangerAnalysis liefert eine Analyse", () => {
    expect(createSampleCliffhangerAnalysis().score).toBeGreaterThanOrEqual(0);
  });
  it("createSampleChapterExport liefert einen Export", () => {
    expect(createSampleChapterExport().wordCount).toBeGreaterThan(0);
  });
  it("createSampleSerialReport liefert einen Bericht", () => {
    expect(createSampleSerialReport().chapterCount).toBe(1);
  });
});
