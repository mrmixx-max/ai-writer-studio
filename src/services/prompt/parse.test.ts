// Unit-Tests: robustes Prompt-Parsing (JSON + Fallback).
import { describe, it, expect } from "vitest";
import { parsePrompts } from "@/services/prompt/parse";
import type { PromptFilters } from "@/services/prompt/types";

const filters: PromptFilters = {
  genres: ["Fantasy"],
  promptType: "Story-Starter",
  tone: "neutral",
  targetLength: "Kurzgeschichte",
  count: 3,
};

describe("parsePrompts", () => {
  it("parst gültiges JSON-Array", () => {
    const raw = JSON.stringify([
      { text: "Ein Drache erwacht", genre: "Fantasy", type: "Story-Starter", hook: "Spannend" },
      { text: "Eine Stadt aus Glas", genre: "Fantasy", type: "Szenen-Idee", hook: "Visuell" },
    ]);
    const out = parsePrompts(raw, filters);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("Ein Drache erwacht");
  });

  it("ignoriert Einleitungstext vor dem Array", () => {
    const arr = [{ text: "X", genre: "Fantasy", type: "Story-Starter", hook: "h" }];
    const raw = `Hier sind deine Prompts:\n${JSON.stringify(arr)}`;
    const out = parsePrompts(raw, filters);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("X");
  });

  it("Fallback: jede Zeile wird ein Prompt bei ungültigem JSON", () => {
    const raw = "Erster Prompt über einen Wald\nZweiter über ein Meer\nDritter über Feuer";
    const out = parsePrompts(raw, filters);
    expect(out).toHaveLength(3);
    expect(out[0].text).toBe("Erster Prompt über einen Wald");
    expect(out[0].genre).toBe("Fantasy");
  });

  it("Fallback: ignoriert [ ] { } Zeilen", () => {
    const raw = "[\nErster Prompt\n]\n{ kein json }";
    const out = parsePrompts(raw, filters);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Erster Prompt");
  });

  it("begrenzt auf count", () => {
    const raw = "eins\nzwei\ndrei\nvier\nfünf";
    const out = parsePrompts(raw, { ...filters, count: 2 });
    expect(out).toHaveLength(2);
  });

  it("leerer Input → leeres Array, kein Absturz", () => {
    expect(parsePrompts("", filters)).toEqual([]);
    expect(parsePrompts("   ", filters)).toEqual([]);
  });
});
