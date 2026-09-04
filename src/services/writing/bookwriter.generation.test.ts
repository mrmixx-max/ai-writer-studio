// Tests: generateChapter mit Mock-Provider (B1 Kontextaufbau + B3 Nachsteuer).
//
// Mockt den OllamaProvider, um zu prüfen:
// - Kapitel-Prompt enthält Rolling Context (Glossar, Übergangsabsatz)
// - 400 Wörter bei Ziel 1000 → ein Nachsteuer-Call wird ausgelöst
// - Nachsteuer schlägt fehl → Status "needs_revision"
import { describe, it, expect, vi, beforeEach } from "vitest";

// OllamaProvider mocken — Verhalten pro Test konfigurierbar.
let mockResponses: string[] = [];
const chatCalls: { messages: { role: string; content: string }[]; options: Record<string, unknown> }[] = [];

vi.mock("@/services/llm/ollama", () => ({
  OllamaProvider: class {
    async *chat(messages: { role: string; content: string }[], options: Record<string, unknown>) {
      chatCalls.push({ messages: [...messages], options });
      const response = mockResponses[chatCalls.length - 1] ?? mockResponses[mockResponses.length - 1] ?? "";
      yield response;
    }
  },
}));

import { generateChapter, evaluateWordCount, type BookOutline } from "./bookwriter";

const config = {
  topic: "KI im Alltag",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapterCount: 8,
  model: "mock",
  baseUrl: "http://127.0.0.1:11434",
  language: "Deutsch",
  wordsPerChapter: 1000,
};

const outline: BookOutline = {
  title: "KI im Alltag",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapters: Array.from({ length: 3 }, (_, i) => ({
    number: i + 1,
    title: `Kapitel ${i + 1}`,
    summary: `Kapitel ${i + 1} behandelt das Thema KI im Alltag ausführlich mit Beispielen und praktischen Tipps für Einsteiger sowie Fortgeschrittene im Umgang mit künstlicher Intelligenz.`,
  })),
  entities: ["Dr. Weber"],
  chapterSummaries: ["Erste Zusammenfassung mit ausreichend Inhalt für den Kontext."],
};

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `Wort${i}`).join(" ");
}

beforeEach(() => {
  mockResponses = [];
  chatCalls.length = 0;
});

describe("generateChapter: Rolling Context", () => {
  it("Prompt enthält Glossar und Übergangsabsatz statt Vollkontext", async () => {
    mockResponses = [words(1000)];
    const prev = {
      number: 1,
      title: "Kapitel 1",
      content: `Einleitung mit Inhalt.\n\n${words(50)}`,
    };
    await generateChapter(config, outline, 2, [prev]);

    expect(chatCalls.length).toBe(1);
    const prompt = chatCalls[0].messages[0].content;
    expect(prompt).toContain("Kohärenz-Glossar");
    expect(prompt).toContain("Dr. Weber");
    expect(prompt).toContain("Letzter Absatz von Kapitel 1");
    // Übergang: NUR der letzte Absatz, nicht der ganze Vorkapitel-Text
    expect(prompt).toContain("Wort49");
    expect(prompt).not.toContain("Einleitung mit Inhalt.");
  });
});

describe("generateChapter: Nachsteuer bei Abweichung > 20%", () => {
  it("400 Wörter bei Ziel 1000 → ein Nachsteuer-Call, danach Erfolg", async () => {
    // Call 1: zu kurzes Kapitel (400 W.); Call 2 (Nachsteuer): Ergänzung.
    mockResponses = [words(400), words(600)];
    const result = await generateChapter(config, outline, 1, []);

    // 2 Calls: Generierung + EIN Nachsteuer-Call
    expect(chatCalls.length).toBe(2);
    expect(chatCalls[1].messages[0].content).toContain("zu kurz");
    expect(chatCalls[1].messages[0].content).toContain("ca. 600 Wörter");
    // 400 + 600 = 1000 ∈ [800, 1200] → draft
    expect(evaluateWordCount(result.content, 1000).wordCount).toBe(1000);
    expect(result.status).toBe("draft");
  });

  it("400 Wörter + Nachsteuer auf 850 Wörter → Status draft", async () => {
    // Nachsteuer liefert vollständigen Ersatz-Text? Nein: bei zu kurz wird ANGEHÄNGT.
    // 400 + 450 = 850 ∈ [800, 1200] → draft.
    mockResponses = [words(400), words(450)];
    const result = await generateChapter(config, outline, 1, []);
    expect(chatCalls.length).toBe(2);
    expect(result.content).toContain("Wort0");
    expect(result.status).toBe("draft");
    // Angehängt: 850 Wörter
    expect(evaluateWordCount(result.content, 1000).wordCount).toBe(850);
  });

  it("Nachsteuer reicht nicht → Status needs_revision statt blind weiter", async () => {
    mockResponses = [words(400), words(100)]; // 500 Wörter < 800 → needs_revision
    const result = await generateChapter(config, outline, 1, []);
    expect(chatCalls.length).toBe(2); // EIN Nachsteuer-Call, kein zweiter
    expect(result.status).toBe("needs_revision");
  });

  it("Kapitel innerhalb ±20% → kein Nachsteuer-Call", async () => {
    mockResponses = [words(1000)];
    const result = await generateChapter(config, outline, 1, []);
    expect(chatCalls.length).toBe(1);
    expect(result.status).toBe("draft");
  });

  it("zu langes Kapitel → Kürzungs-Call mit Ersetzung", async () => {
    mockResponses = [words(1500), words(1000)];
    const result = await generateChapter(config, outline, 1, []);
    expect(chatCalls.length).toBe(2);
    expect(chatCalls[1].messages[0].content).toContain("zu lang");
    expect(result.status).toBe("draft");
    expect(evaluateWordCount(result.content, 1000).wordCount).toBe(1000);
  });
});