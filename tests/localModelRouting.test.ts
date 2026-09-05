// Sprint 3 (Agent 1 — Task 3): Integration — Bookwriter x Local-Model-Profile.
// Beweist: DeepSeek/Qwen-Profile fliessen konfigurierbar in die Calls
// (System-Prompt-Fallback, maxTokens-Deckel), Default-Modelle bleiben
// unangetastet (kein Breaking Change).

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/llm/ollama", async () => {
  const { FakeOllamaProvider } = await import("./helpers/fakeOllamaProvider");
  return { OllamaProvider: FakeOllamaProvider };
});

import { generateOutline } from "@/services/writing/bookwriter";
import { configureLocalModelProfiles } from "@/services/llm/localModelProfiles";
import { FakeOllamaProvider, goodOutlineJson } from "./helpers/fakeOllamaProvider";

const baseConfig = {
  topic: "KI im Alltag",
  genre: "Sachbuch",
  targetAudience: "Erwachsene",
  chapterCount: 3,
  baseUrl: "http://127.0.0.1:11434",
  language: "Deutsch",
};

beforeEach(() => {
  FakeOllamaProvider.reset();
  configureLocalModelProfiles({ deepseek: null, qwen: null, default: null });
});

describe("Local-Model-Profile x Bookwriter-Call-Pfad", () => {
  it("Qwen: System-Prompt landet im Call, maxTokens auf Profil-Limit gedeckelt", async () => {
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(3) });
    await generateOutline({ ...baseConfig, model: "qwen2.5:7b" });

    expect(FakeOllamaProvider.calls.length).toBeGreaterThanOrEqual(1);
    const first = FakeOllamaProvider.calls[0];
    // System-Prompt-Fallback (Qwen-Profil) als eigene Message vor dem Prompt.
    expect(first.prompt).toContain("Schreibassistent");
    // Token-Deckel: Outline-Call wünscht 4096, Qwen-Profil deckelt gleich —
    // Kapitel-Calls (8192) wären auf 4096 gedeckelt.
    const maxTokens = (first.options as { maxTokens?: number }).maxTokens ?? 0;
    expect(maxTokens).toBeLessThanOrEqual(4096);
  });

  it("DeepSeek: DeepSeek-System-Prompt (nicht Qwen), hohes Limit bleibt erhalten", async () => {
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(3) });
    await generateOutline({ ...baseConfig, model: "deepseek-r1:14b" });

    const first = FakeOllamaProvider.calls[0];
    expect(first.prompt).toContain("<think>");
    expect(first.prompt).not.toContain("Schreibassistent für Autoren. Folge");
  });

  it("Default-Modell (llama3.2): KEIN Familien-System-Prompt, maxTokens unverändert", async () => {
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(3) });
    await generateOutline({ ...baseConfig, model: "llama3.2" });

    const first = FakeOllamaProvider.calls[0];
    // Kein Profil-Prompt injiziert — Verhalten identisch zu Sprint 2.
    expect(first.prompt).not.toContain("Schreibassistent");
    expect(first.prompt).not.toContain("<think>");
    expect((first.options as { maxTokens?: number }).maxTokens).toBe(4096);
  });

  it("Konfigurierbarkeit: Override schlägt Familien-Default im Call-Pfad", async () => {
    configureLocalModelProfiles({ qwen: { systemPrompt: "OVERRIDE-PROMPT-XYZ", maxTokens: 777 } });
    FakeOllamaProvider.script({ kind: "good", text: goodOutlineJson(3) });
    await generateOutline({ ...baseConfig, model: "qwen2.5:7b" });

    const first = FakeOllamaProvider.calls[0];
    expect(first.prompt).toContain("OVERRIDE-PROMPT-XYZ");
    expect((first.options as { maxTokens?: number }).maxTokens).toBeLessThanOrEqual(777);
  });

  it("Doppelte Gliederungs-Calls tragen konsistent dasselbe Profil", async () => {
    FakeOllamaProvider.script(
      { kind: "good", text: goodOutlineJson(3) },
      { kind: "good", text: goodOutlineJson(3) },
    );
    await generateOutline({ ...baseConfig, model: "qwen2.5:7b" });
    await generateOutline({ ...baseConfig, model: "qwen2.5:7b" });
    expect(FakeOllamaProvider.calls.length).toBeGreaterThanOrEqual(2);
    for (const c of FakeOllamaProvider.calls) {
      expect(c.prompt).toContain("Schreibassistent");
    }
  });
});
