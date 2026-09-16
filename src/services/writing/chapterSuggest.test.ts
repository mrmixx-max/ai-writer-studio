// Tests: Kapitel-Vorschläge (Titel + Stil + Wortzahl, mit Offline-Fallback).
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildChapterSuggestPrompt,
  parseChapterSuggestion,
  suggestChapter,
  suggestChapterOffline,
} from "./chapterSuggest";

vi.mock("@/services/settings", () => ({
  loadSettings: () => ({ model: "mock", maxTokens: 1024 }),
}));

vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    healthCheck: async () => true,
    chat: async function* () {
      yield JSON.stringify({
        titles: [
          { title: "Der stille Aufbruch", reason: "Stimmungsvoll" },
          { title: "Kapitel der Entscheidung", reason: "Spannung" },
          { title: "Was bleibt", reason: "Nachklang" },
        ],
        style: { style: "lyrisch, dicht", reason: "Passt zum Thema" },
        length: { words: 1800, reason: "Szene braucht Raum" },
      });
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("suggestChapterOffline", () => {
  it("liefert 3 Titel + Stil + Wortzahl ohne Modell", () => {
    const s = suggestChapterOffline({
      topic: "KI im Alltag",
      synopsis: "Ein Roboter lernt kochen",
      purpose: "Szene",
    });
    expect(s.titles).toHaveLength(3);
    expect(s.usedLLM).toBe(false);
    expect(s.length.words).toBe(2000);
    expect(s.style.style.length).toBeGreaterThan(0);
  });

  it("unbekannter Typ → Standard-Wortzahl 2000", () => {
    const s = suggestChapterOffline({ topic: "X" });
    expect(s.length.words).toBe(2000);
  });
});

describe("parseChapterSuggestion", () => {
  it("parst gültiges JSON mit 3 Titeln", () => {
    const raw = JSON.stringify({
      titles: [
        { title: "A", reason: "r1" },
        { title: "B", reason: "r2" },
        { title: "C", reason: "r3" },
        { title: "D", reason: "zu viel" },
      ],
      style: { style: "knapp", reason: "ok" },
      length: { words: 1500, reason: "ok" },
    });
    const p = parseChapterSuggestion(`Vorwort\n${raw}\nNachwort`);
    expect(p.titles).toHaveLength(3);
    expect(p.titles[0].title).toBe("A");
    expect(p.length.words).toBe(1500);
  });

  it("deckelt Wortzahl auf 200–8000", () => {
    const raw = JSON.stringify({
      titles: [{ title: "A", reason: "" }],
      style: { style: "x", reason: "" },
      length: { words: 99999, reason: "" },
    });
    expect(parseChapterSuggestion(raw).length.words).toBe(8000);
  });

  it("wirft ohne Titel", () => {
    expect(() =>
      parseChapterSuggestion(JSON.stringify({ titles: [] })),
    ).toThrow();
    expect(() => parseChapterSuggestion("kein json hier")).toThrow();
  });
});

describe("buildChapterSuggestPrompt", () => {
  it("enthält Thema/Synopsis/Typ + JSON-Schema", () => {
    const p = buildChapterSuggestPrompt({
      topic: "Mars",
      synopsis: "Erste Landung",
      purpose: "Höhepunkt",
      genre: "SciFi",
    });
    expect(p).toContain("Mars");
    expect(p).toContain("Erste Landung");
    expect(p).toContain("Höhepunkt");
    expect(p).toContain("SciFi");
    expect(p).toContain('"titles"');
  });
});

describe("suggestChapter (LLM-Mock)", () => {
  it("liefert Modell-Vorschläge mit usedLLM=true", async () => {
    const s = await suggestChapter({ topic: "Mars", synopsis: "Landung" });
    expect(s.usedLLM).toBe(true);
    expect(s.titles).toHaveLength(3);
    expect(s.titles[0].title).toBe("Der stille Aufbruch");
    expect(s.length.words).toBe(1800);
  });
});
