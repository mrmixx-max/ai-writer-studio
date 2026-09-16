// Tests: Buchkonzept-Generator (KI + Offline-Fallback).
import { describe, expect, it, vi } from "vitest";
import {
  buildConceptSuggestPrompt,
  suggestConcept,
  suggestConceptOffline,
} from "./conceptSuggest";

vi.mock("@/services/settings", () => ({
  loadSettings: () => ({ model: "mock", maxTokens: 1024 }),
}));

vi.mock("@/services/llm", () => ({
  createProvider: () => ({
    healthCheck: async () => true,
    chat: async function* () {
      yield "Prämisse: Ein Roboter lernt kochen.\nFiguren/Welt: Küche als Welt.\n";
    },
  }),
}));

describe("suggestConceptOffline", () => {
  it("baut Template aus Formulardaten", () => {
    const c = suggestConceptOffline({
      topic: "KI kocht",
      genre: "Roman",
      targetAudience: "Erwachsene",
    });
    expect(c).toContain("KI kocht");
    expect(c).toContain("Roman");
    expect(c).toContain("Spannungsbogen");
    expect(c).toContain("Figuren/Welt");
  });

  it("leeres Thema → Platzhalter", () => {
    expect(suggestConceptOffline({ topic: "" })).toContain("Unbenanntes Buch");
  });
});

describe("buildConceptSuggestPrompt", () => {
  it("enthält Thema/Genre + 6 Abschnitte", () => {
    const p = buildConceptSuggestPrompt({
      topic: "Mars",
      genre: "SciFi",
      targetAudience: "Jugend",
    });
    expect(p).toContain("Mars");
    expect(p).toContain("SciFi");
    expect(p).toContain("Spannungsbogen");
    expect(p).toContain("Stil-Vorgaben");
  });
});

describe("suggestConcept (LLM-Mock)", () => {
  it("liefert Modell-Konzept mit usedLLM=true", async () => {
    const { concept, usedLLM } = await suggestConcept({ topic: "Mars" });
    expect(usedLLM).toBe(true);
    expect(concept).toContain("Roboter");
  });
});
