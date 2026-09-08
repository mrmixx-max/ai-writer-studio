// Tests: Kurzprosa-Engine — `complete` ist in allen Tests gemockt,
// kein Netzwerk, keine Seiteneffekte.

import { describe, it, expect } from "vitest";
import {
  buildShortprosePrompt,
  countWords,
  estimateReadingTime,
  generateShortprose,
  SHORTPROSE_MAX_WORDS,
  type CompleteFn,
  type ShortproseRequest,
} from "@/services/bookwriter/shortprose";

const BASE_REQUEST: ShortproseRequest = {
  prompt: "Ein Leuchtturm, der nachts erlischt",
  genre: "flash-fiction",
  style: "literary",
  length: "very-short",
  perspective: "third-limited",
  language: "de",
};

function mockComplete(returnValue: string): { fn: CompleteFn; calls: string[] } {
  const calls: string[] = [];
  const fn: CompleteFn = async (prompt: string) => {
    calls.push(prompt);
    return returnValue;
  };
  return { fn, calls };
}

describe("generateShortprose — Erfolg (gemockter LLM-Call)", () => {
  it("liefert Ergebnis mit Text, Genre, Style und wordCount", async () => {
    const { fn, calls } = mockComplete(
      "Der Leuchtturm schwieg. In jener Nacht blieb sein Licht aus.",
    );
    const res = await generateShortprose(BASE_REQUEST, { complete: fn });
    expect(calls).toHaveLength(1);
    expect(res.text).toContain("Leuchtturm");
    expect(res.genre).toBe("flash-fiction");
    expect(res.style).toBe("literary");
    expect(res.wordCount).toBe(countWords(res.text));
    expect(res.wordCount).toBeGreaterThan(0);
    expect(res.characterCount).toBe(res.text.length);
    expect(res.estimatedReadingTime).toBeGreaterThanOrEqual(1);
  });

  it("uebergibt Seed und Prompt an das LLM", async () => {
    const { fn, calls } = mockComplete("Es war einmal ein Schatten.");
    await generateShortprose(BASE_REQUEST, { complete: fn });
    expect(calls[0]).toContain("Leuchtturm");
  });

  it("wirft bei leerem Seed, ohne das LLM zu rufen", async () => {
    const { fn, calls } = mockComplete("sollte nie kommen");
    await expect(
      generateShortprose({ ...BASE_REQUEST, prompt: "   " }, { complete: fn }),
    ).rejects.toThrow(/leer/i);
    expect(calls).toHaveLength(0);
  });

  it("wirft bei leerer LLM-Antwort", async () => {
    const { fn } = mockComplete("   \n  ");
    await expect(
      generateShortprose(BASE_REQUEST, { complete: fn }),
    ).rejects.toThrow(/leere Antwort/);
  });

  it("reicht LLM-Fehler mit Kontext weiter", async () => {
    const failing: CompleteFn = async () => {
      throw new Error("Provider offline");
    };
    await expect(
      generateShortprose(BASE_REQUEST, { complete: failing }),
    ).rejects.toThrow(/LLM-Aufruf fehlgeschlagen.*Provider offline/);
  });
});

describe("buildShortprosePrompt — Genre/Style/Length", () => {
  it("enthaelt Genre-Namen und Laengen-Limit (very-short = 500)", () => {
    const prompt = buildShortprosePrompt(BASE_REQUEST);
    expect(prompt).toContain("flash-fiction");
    expect(prompt).toContain("500");
  });

  it("enthaelt Genre-Namen und Laengen-Limit (medium = 3000)", () => {
    const prompt = buildShortprosePrompt({
      ...BASE_REQUEST,
      genre: "fable",
      length: "medium",
    });
    expect(prompt).toContain("fable");
    expect(prompt).toContain("3000");
  });

  it("nutzt das Flash-Fiction-Twist-Template", () => {
    const prompt = buildShortprosePrompt(BASE_REQUEST);
    expect(prompt).toContain("Twist ending preferred");
    expect(prompt).toContain("beginning, middle, end");
  });

  it("nutzt das deutsche Kurzgeschichten-Template mit Perspektive", () => {
    const prompt = buildShortprosePrompt({
      ...BASE_REQUEST,
      genre: "kurzgeschichte",
      perspective: "first",
      language: "de",
    });
    expect(prompt).toContain("Deutsche Kurzgeschichte");
    expect(prompt).toContain("first");
    expect(prompt).toContain("Deutsch");
  });

  it("setzt die englische Sprachzeile fuer language 'en'", () => {
    const prompt = buildShortprosePrompt({
      ...BASE_REQUEST,
      genre: "snapshot",
      language: "en",
    });
    expect(prompt).toContain("snapshot");
    expect(prompt).toContain("Write in English");
  });

  it("mappt short auf 1500 Woerter", () => {
    expect(SHORTPROSE_MAX_WORDS["short"]).toBe(1500);
    const prompt = buildShortprosePrompt({ ...BASE_REQUEST, length: "short" });
    expect(prompt).toContain("1500");
  });

  it("wirft bei unbekanntem Genre", () => {
    expect(() =>
      buildShortprosePrompt({
        ...BASE_REQUEST,
        genre: "roman" as unknown as ShortproseRequest["genre"],
      }),
    ).toThrow(/Unbekanntes Genre/);
  });
});

describe("countWords — DE + EN", () => {
  it("zaehlt deutsche Woerter", () => {
    expect(countWords("Der alte Leuchtturm schwieg die ganze Nacht")).toBe(7);
  });

  it("zaehlt englische Woerter", () => {
    expect(countWords("The old lighthouse stayed dark all night")).toBe(7);
  });

  it("ignoriert mehrfache Whitespaces und Umbrueche", () => {
    expect(countWords("  Es   war\neinmal\n\n  ein  Wald.  ")).toBe(5);
  });

  it("gibt 0 fuer leere Eingabe zurueck", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("estimateReadingTime — ~200 Woerter/Minute", () => {
  it("200 Woerter = 1 Minute", () => {
    expect(estimateReadingTime(200)).toBe(1);
  });

  it("rundet auf (201 Woerter = 2 Minuten)", () => {
    expect(estimateReadingTime(201)).toBe(2);
  });

  it("0 Woerter = 0 Minuten", () => {
    expect(estimateReadingTime(0)).toBe(0);
  });
});
