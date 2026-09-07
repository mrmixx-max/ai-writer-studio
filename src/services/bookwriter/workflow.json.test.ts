// Sprint 19e, Agent 1: JSON-Robustheit für LFM2-24B (Wort-Salat statt JSON).
// Testet parseJson (Markdown-Extraktion, Isolation, Reparatur),
// appendJsonOnlyInstruction und resolveOutlineJson (Retry + Fallback-Error).
import { describe, it, expect } from "vitest";
import {
  parseJson,
  appendJsonOnlyInstruction,
  resolveOutlineJson,
  OUTLINE_MAX_ATTEMPTS,
  OUTLINE_RETRY_TEMPERATURE,
} from "@/services/bookwriter/workflow";

const WORD_SALAD =
  "horizon horizon margin Marg Marg margins margins Marg Marg margins margins " +
  "automation agents dispat automated discrete discre";

describe("parseJson", () => {
  it("parst valides JSON direkt", () => {
    const raw = JSON.stringify([{ title: "A", estimatedWords: 100 }]);
    expect(parseJson<{ title: string }[]>(raw)).toEqual([{ title: "A", estimatedWords: 100 }]);
  });

  it("extrahiert JSON aus ```json-Markdown-Block", () => {
    const raw =
      `Hier die Gliederung:\n` +
      "```json\n" +
      `[{"title": "Kapitel 1"}]` +
      "\n```\nBitte sehr!";
    expect(parseJson<{ title: string }[]>(raw)).toEqual([{ title: "Kapitel 1" }]);
  });

  it("extrahiert JSON aus plain ```-Block und isoliert aus Fließtext", () => {
    const plainFence = "Erklärung davor\n```\n[{\"title\": \"X\"}]\n```\nnachher";
    expect(parseJson<{ title: string }[]>(plainFence)).toEqual([{ title: "X" }]);

    const inline = `Hier ist sie: [{"title": "Y", "goal": "Z"}] — viel Erfolg!`;
    expect(parseJson<{ title: string; goal: string }[]>(inline)).toEqual([
      { title: "Y", goal: "Z" },
    ]);
  });

  it("repariert fehlende Anführungszeichen, Single-Quotes und Trailing-Commas", () => {
    const missingQuotes = `[{title: Anfang, estimatedWords: 1500,}]`;
    expect(parseJson<{ title: string; estimatedWords: number }[]>(missingQuotes)).toEqual([
      { title: "Anfang", estimatedWords: 1500 },
    ]);

    const singleQuotes = `[{'title': 'Mitte'}]`;
    expect(parseJson<{ title: string }[]>(singleQuotes)).toEqual([{ title: "Mitte" }]);
  });

  it("gibt null bei LFM2-Wort-Salat zurück", () => {
    expect(parseJson(WORD_SALAD)).toBeNull();
    expect(parseJson("")).toBeNull();
    expect(parseJson("   ")).toBeNull();
  });
});

describe("appendJsonOnlyInstruction", () => {
  it("fordert explizit NUR-JSON mit Kapitelzahl", () => {
    const out = appendJsonOnlyInstruction("Basis-Prompt", 7);
    expect(out).toContain("Basis-Prompt");
    expect(out).toMatch(/NUR valides JSON/i);
    expect(out).toContain("7");
    expect(out).toMatch(/keine Erkl/i);
  });
});

describe("resolveOutlineJson", () => {
  it("Retry: Wort-Salat zuerst, dann valides JSON — mit niedriger Temperatur", async () => {
    const seenTemps: Array<number | undefined> = [];
    const good = JSON.stringify([{ title: "K1" }]);
    const { value, attempts } = await resolveOutlineJson<{ title: string }[]>(
      async (_attempt, temperature) => {
        seenTemps.push(temperature);
        return seenTemps.length === 1 ? WORD_SALAD : good;
      },
      0.7,
    );
    expect(value).toEqual([{ title: "K1" }]);
    expect(attempts).toBe(2);
    expect(seenTemps).toEqual([0.7, OUTLINE_RETRY_TEMPERATURE]);
    expect(OUTLINE_RETRY_TEMPERATURE).toBe(0.1);
  });

  it("wirft nach allen Versuchen hilfreichen Error mit Modell-Hinweis", async () => {
    let calls = 0;
    await expect(
      resolveOutlineJson(async () => {
        calls++;
        return WORD_SALAD;
      }, 0.7),
    ).rejects.toThrow(/Gliederung konnte nicht als JSON gelesen werden.*llama3\.2/s);
    expect(calls).toBe(OUTLINE_MAX_ATTEMPTS);
  });

  it("Error enthält den Anfang der Modellantwort", async () => {
    await expect(resolveOutlineJson(async () => WORD_SALAD, 0.7)).rejects.toThrow(/horizon/);
  });
});
