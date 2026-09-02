import { describe, it, expect } from "vitest";
import {
  countWords,
  deriveMinMax,
  computeWordStats,
  validateChapterPlan,
  createDefaultChapter,
} from "../chapterPlan";
import type { Chapter } from "@/types/project";

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "test_1",
    projectId: "proj_1",
    title: "Test Kapitel",
    content: "",
    orderIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "planned",
    targetWordCount: 2000,
    minimumWordCount: 1600,
    maximumWordCount: 2400,
    currentWordCount: 0,
    ...overrides,
  };
}

describe("countWords", () => {
  it("zählt einfache Wörter", () => {
    expect(countWords("Hallo Welt")).toBe(2);
  });

  it("handhabt leeren String", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  it("entfernt Markdown-Syntax", () => {
    const text = "# Überschrift\n\nDies ist **fetter** Text mit `Code`.";
    // "Überschrift Dies ist fetter Text mit Code" = 7
    expect(countWords(text)).toBe(7);
  });

  it("zählt deutsche Umlaute korrekt", () => {
    expect(countWords("Ärger über Öl und Übungen")).toBe(5);
  });

  it("entfernt Code-Blöcke", () => {
    const text = "Hier ist Text.\n```\nconst x = 1;\n```\nMehr Text.";
    // "Hier ist Text Mehr Text" = 5
    expect(countWords(text)).toBe(5);
  });
});

describe("deriveMinMax", () => {
  it("leitet mit 20% Toleranz ab", () => {
    const { min, max } = deriveMinMax(2000);
    expect(min).toBe(1600);
    expect(max).toBe(2400);
  });

  it("leitet mit 30% Toleranz ab", () => {
    const { min, max } = deriveMinMax(1000, 30);
    expect(min).toBe(700);
    expect(max).toBe(1300);
  });

  it("Mindestwert ist immer >= 100", () => {
    const { min } = deriveMinMax(100);
    expect(min).toBeGreaterThanOrEqual(100);
  });
});

describe("computeWordStats", () => {
  it("berechnet Fortschritt korrekt", () => {
    const stats = computeWordStats(makeChapter({ currentWordCount: 1000, targetWordCount: 2000 }));
    expect(stats.progressPercent).toBe(50);
    expect(stats.remaining).toBe(1000);
    expect(stats.isUnderMinimum).toBe(true);
  });

  it("erkennt Innerhalb des Bereichs", () => {
    const stats = computeWordStats(makeChapter({ currentWordCount: 1800 }));
    expect(stats.isWithinRange).toBe(true);
    expect(stats.isUnderMinimum).toBe(false);
    expect(stats.isOverMaximum).toBe(false);
  });

  it("erkennt Überlänge", () => {
    const stats = computeWordStats(makeChapter({ currentWordCount: 3000 }));
    expect(stats.isOverMaximum).toBe(true);
  });
});

describe("validateChapterPlan", () => {
  it("akzeptiert valide Pläne", () => {
    expect(validateChapterPlan(makeChapter())).toEqual([]);
  });

  it("lehnt Zielwortzahl < 100 ab", () => {
    const errors = validateChapterPlan(makeChapter({ targetWordCount: 50 }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("lehnt Zielwortzahl > 50000 ab", () => {
    const errors = validateChapterPlan(makeChapter({ targetWordCount: 60000 }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("lehnt Min > Max ab", () => {
    const errors = validateChapterPlan(
      makeChapter({ minimumWordCount: 3000, maximumWordCount: 1000 }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("createDefaultChapter", () => {
  it("erstellt Kapitel mit Defaults", () => {
    const ch = createDefaultChapter("proj_1", 0);
    expect(ch.targetWordCount).toBe(2000);
    expect(ch.minimumWordCount).toBe(1600);
    expect(ch.maximumWordCount).toBe(2400);
    expect(ch.status).toBe("planned");
  });

  it("respektiert Overrides", () => {
    const ch = createDefaultChapter("proj_1", 2, {
      title: "Mein Kapitel",
      targetWordCount: 5000,
      purpose: "Einleitung",
    });
    expect(ch.title).toBe("Mein Kapitel");
    expect(ch.targetWordCount).toBe(5000);
    expect(ch.purpose).toBe("Einleitung");
    expect(ch.orderIndex).toBe(2);
  });
});
