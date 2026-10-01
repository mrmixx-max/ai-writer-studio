// Integrations-Test: Kontext-Budget im echten Generierungspfad (WP1.3).
//
// Belegt, dass generateChapterChunked den Prompt an das Kontextfenster des
// Modells anpasst — vorher war die Kontextlänge fest (200 Zeichen je Chunk,
// Konzept hart auf 4000 Zeichen beschnitten), unabhängig vom Modell.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Provider mocken: wir prüfen den PROMPT, nicht das Modell.
const capturedPrompts: string[] = [];
vi.mock("@/services/llm/ollama", () => ({
  OllamaProvider: class {
    async *chat(messages: Array<{ content: string }>) {
      capturedPrompts.push(messages.map((m) => m.content).join("\n"));
      yield "Ein generierter Absatz. ";
    }
  },
}));

import { generateChapterChunked, type BookContext } from "./chapterEngine";
import { availablePromptTokens } from "@/services/llm/contextBudget";
import { estimateTokens } from "@/services/knowledge/chunking";
import { getLocalModelProfile } from "@/services/llm/localModelProfiles";
import type { Chapter } from "@/types/project";

function makeChapter(over: Partial<Chapter> = {}): Chapter {
  return {
    id: "c1",
    projectId: "p1",
    title: "Der Bruch",
    content: "",
    currentWordCount: 0,
    targetWordCount: 200,
    minimumWordCount: 100,
    maximumWordCount: 400,
    status: "planned",
    synopsis: "",
    purpose: "",
    orderIndex: 1,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Chapter;
}

const baseBook: BookContext = {
  title: "Testbuch",
  genre: "Roman",
  targetAudience: "Erwachsene",
  language: "Deutsch",
};

beforeEach(() => {
  capturedPrompts.length = 0;
});

describe("generateChapterChunked — Kontext-Budget", () => {
  it("hält den Prompt im Kontextfenster eines kleinen Modells", async () => {
    // Bewusst sehr großer Kontext: ohne Budgetierung würde der Prompt das
    // 4096-Token-Fenster von llama3.2 deutlich sprengen.
    const hugeContext = "Weltregel: " + "Die Erinnerung kostet einen Preis. ".repeat(2000);
    const book: BookContext = { ...baseBook, extraContext: hugeContext };

    await generateChapterChunked(
      makeChapter(),
      book,
      { model: "llama3.2:latest", baseUrl: "http://127.0.0.1:11434" },
    );

    expect(capturedPrompts.length).toBeGreaterThan(0);
    const budget = availablePromptTokens("llama3.2:latest");
    for (const p of capturedPrompts) {
      expect(estimateTokens(p)).toBeLessThanOrEqual(budget);
    }
  });

  it("nutzt bei großem Modell mehr Kontext als bei kleinem", async () => {
    const bigContext = "Weltregel: " + "Ein langer Welttext. ".repeat(400);
    const book: BookContext = { ...baseBook, extraContext: bigContext };

    await generateChapterChunked(makeChapter(), book, {
      model: "llama3.2:latest",
      baseUrl: "http://x",
    });
    const smallPrompt = capturedPrompts[0] ?? "";
    capturedPrompts.length = 0;

    await generateChapterChunked(makeChapter(), book, {
      model: "qwen2.5:72b",
      baseUrl: "http://x",
    });
    const largePrompt = capturedPrompts[0] ?? "";

    // Das große Modell hat mehr Platz — es darf nicht WENIGER Kontext bekommen.
    expect(estimateTokens(largePrompt)).toBeGreaterThanOrEqual(estimateTokens(smallPrompt));
  });

  it("nimmt Welt-Kontext in den Prompt auf", async () => {
    const book: BookContext = {
      ...baseBook,
      extraContext: "Welt-Kontext (verbindlich):\n- Magie kostet Erinnerung.",
    };
    await generateChapterChunked(makeChapter(), book, {
      model: "qwen2.5:72b",
      baseUrl: "http://x",
    });
    expect(capturedPrompts[0]).toContain("Magie kostet Erinnerung");
  });

  it("kommt ohne Welt-Kontext aus (kein leeres Gerüst im Prompt)", async () => {
    await generateChapterChunked(makeChapter(), baseBook, {
      model: "llama3.2:latest",
      baseUrl: "http://x",
    });
    expect(capturedPrompts[0]).not.toContain("Welt-Kontext");
    expect(capturedPrompts[0]).toContain("Schreibe einen Abschnitt");
  });

  it("hält den Rolling Context auch bei vielen Chunks im Budget", async () => {
    // 3 Chunks à 800 Wörter. Kontext bewusst so groß, dass er ohne
    // Budgetierung über das Fenster läuft — sonst prüft der Test nichts.
    const chapter = makeChapter({ targetWordCount: 2400, maximumWordCount: 3000 });
    const book: BookContext = {
      ...baseBook,
      concept: "Konzept. ".repeat(1200),
      extraContext: "Weltregel: " + "Ein langer Welttext. ".repeat(600),
    };

    await generateChapterChunked(chapter, book, {
      model: "llama3.2:latest",
      baseUrl: "http://x",
      chunkTargetWords: 800,
    });

    expect(capturedPrompts.length).toBeGreaterThan(1);
    const budget = availablePromptTokens("llama3.2:latest");
    for (const p of capturedPrompts) {
      expect(estimateTokens(p)).toBeLessThanOrEqual(budget);
    }
    // Und es muss tatsächlich gekürzt worden sein.
    expect(capturedPrompts.some((p) => p.includes("[…gekürzt]"))).toBe(true);
  });

  it("der Prompt bleibt auch bei sehr kleinem Kontextfenster gültig", async () => {
    // Ein Modell mit winzigem Fenster darf den Prompt nicht zerstören:
    // Aufgabe und Ziel müssen erhalten bleiben, nur Kontext fällt weg.
    const profile = getLocalModelProfile("llama3.2:latest");
    expect(profile.contextTokens).toBeGreaterThan(0);

    const book: BookContext = {
      ...baseBook,
      concept: "Konzept. ".repeat(2000),
      extraContext: "Welt. ".repeat(2000),
    };
    await generateChapterChunked(makeChapter(), book, {
      model: "llama3.2:latest",
      baseUrl: "http://x",
    });

    const p = capturedPrompts[0];
    expect(p).toContain("Schreibe einen Abschnitt");
    expect(p).toContain("Aufgabe für diesen Abschnitt");
    expect(p).toContain("Ziel: ca.");
  });
});
