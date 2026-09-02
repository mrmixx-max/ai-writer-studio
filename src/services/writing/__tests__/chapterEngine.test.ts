import { describe, it, expect } from "vitest";
import { planChunks } from "../chapterEngine";
import type { Chapter } from "@/types/project";

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "ch_1",
    projectId: "p1",
    title: "Test",
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

describe("planChunks", () => {
  it("plant keine Chunks wenn Ziel erreicht", () => {
    const ch = makeChapter({ content: "a ".repeat(2000), targetWordCount: 100 });
    // countWords("a ".repeat(2000)) ≈ 2000, also > targetWordCount
    const chunks = planChunks(ch, "a ".repeat(2000));
    expect(chunks.length).toBe(0);
  });

  it("plant Chunks für 2000 Wörter Ziel", () => {
    const ch = makeChapter({ targetWordCount: 2000 });
    const chunks = planChunks(ch, "", { chunkTargetWords: 800 });
    // 2000 / 800 = 2.5 → 3 Chunks (800 + 800 + 400)
    expect(chunks.length).toBe(3);
    expect(chunks[0].targetWords).toBe(800);
    expect(chunks[1].targetWords).toBe(800);
    expect(chunks[2].targetWords).toBe(400);
  });

  it("berücksichtigt bereits existierenden Content", () => {
    const ch = makeChapter({ targetWordCount: 2000 });
    // 500 Wörter schon da
    const existing = "Wort ".repeat(500);
    const chunks = planChunks(ch, existing, { chunkTargetWords: 800 });
    // 1500 übrig → 2 Chunks (800 + 700)
    expect(chunks.length).toBe(2);
    expect(chunks[0].targetWords).toBe(800);
    expect(chunks[1].targetWords).toBe(700);
  });

  it("erste Chunk hat purpose aus Kapitel", () => {
    const ch = makeChapter({ purpose: "Spannung aufbauen" });
    const chunks = planChunks(ch, "", { chunkTargetWords: 500 });
    expect(chunks[0].purpose).toBe("Spannung aufbauen");
  });
});
