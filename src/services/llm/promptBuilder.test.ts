// Tests: Sprint 14, Agent 6 — Bild-Prompt-Kette (ADDITIV).
// ALLE Tests pure/gemockt: keine LLM-Calls, kein Netzwerk, kein Disk-Zugriff.
import { describe, it, expect, vi } from "vitest";
import {
  buildCaptionPrompt,
  buildImagePrompt,
  extractKeyScene,
  refineImagePrompt,
  resolveImageStyle,
  EMPTY_SCENE_FALLBACK,
  IMAGE_PROMPT_SUFFIX,
  MAX_SCENE_CHARS,
} from "./promptBuilder";

describe("Sprint 14 Agent 6: Szenen-Extraktion", () => {
  it("wählt den visuell stärksten Satz (Ankerwörter schlagen Länge)", () => {
    const text =
      "Er ging zur Tür und sagte etwas Unwichtiges in aller Ausführlichkeit. " +
      "Der Wald brannte im Mondlicht, Nebel kroch zwischen den Bäumen.";
    const scene = extractKeyScene(text);
    expect(scene).toContain("Mondlicht");
  });

  it("leerer Input -> Fallback, nie leer/throw", () => {
    expect(extractKeyScene("")).toBe(EMPTY_SCENE_FALLBACK);
    expect(extractKeyScene("   \n\t  ")).toBe(EMPTY_SCENE_FALLBACK);
  });

  it("lange Szene wird an Wortgrenze auf MAX_SCENE_CHARS gekürzt", () => {
    const long = "Der alte Leuchtturm stand golden im Abendlicht. ".repeat(20);
    const scene = extractKeyScene(long);
    expect(scene.length).toBeLessThanOrEqual(MAX_SCENE_CHARS + 1);
    expect(scene).toContain("Leuchtturm");
  });

  it("Single-Sentence ohne Satzzeichen liefert gekürzten Text", () => {
    const scene = extractKeyScene("eine neblige Hafenstadt bei Nacht");
    expect(scene).toContain("Hafenstadt");
  });
});

describe("Sprint 14 Agent 6: buildImagePrompt", () => {
  it("enthält Szene + Qualitäts-Suffix", () => {
    const p = buildImagePrompt("Der Wald brannte im Mondlicht.");
    expect(p).toContain("Mondlicht");
    expect(p).toContain(IMAGE_PROMPT_SUFFIX);
  });

  it("Default-Stil ist cinematic", () => {
    const p = buildImagePrompt("Ein stiller See bei Nacht.");
    expect(p).toContain("cinematic lighting");
  });

  it("explizites Preset (noir) wird injiziert", () => {
    const p = buildImagePrompt("Ein stiller See bei Nacht.", "noir");
    expect(p).toContain("film noir");
    expect(p).not.toContain("watercolor");
  });

  it("unbekannter Stil wird wörtlich übernommen", () => {
    const p = buildImagePrompt("Ein stiller See bei Nacht.", "ukiyo-e woodblock");
    expect(p).toContain("ukiyo-e woodblock");
  });

  it("leeres Kapitel -> Fallback-Prompt, kein Throw", () => {
    const p = buildImagePrompt("", "watercolor");
    expect(p).toContain(EMPTY_SCENE_FALLBACK);
    expect(p).toContain("watercolor");
  });
});

describe("Sprint 14 Agent 6: Stil-Auflösung", () => {
  it("case-insensitiv + Whitespace-tolerant", () => {
    expect(resolveImageStyle("  Noir ")).toContain("film noir");
    expect(resolveImageStyle("")).toContain("cinematic");
    expect(resolveImageStyle(undefined)).toContain("cinematic");
  });
});

describe("Sprint 14 Agent 6: buildCaptionPrompt", () => {
  it("enthält Beschreibung + Constraints (ein Satz, 140 Zeichen, keine Spoiler)", () => {
    const p = buildCaptionPrompt("A burning forest under moonlight.");
    expect(p).toContain("A burning forest under moonlight.");
    expect(p).toContain("one-sentence");
    expect(p).toContain("140");
    expect(p.toLowerCase()).toContain("no spoilers");
  });

  it("leere Beschreibung -> Platzhalter, deterministisch", () => {
    const a = buildCaptionPrompt("");
    const b = buildCaptionPrompt("   ");
    expect(a).toBe(b);
    expect(a).toContain("no description provided");
  });
});

describe("Sprint 14 Agent 6: refineImagePrompt (gemockt)", () => {
  it("ruft complete mit Instruktion auf und gibt getrimmte Antwort zurück", async () => {
    const complete = vi.fn(async (_prompt: string) => `  refined scene, vivid  `);
    const out = await refineImagePrompt("a forest, cinematic", complete);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0]).toContain("a forest, cinematic");
    expect(out).toBe("refined scene, vivid");
  });

  it("leere LLM-Antwort -> Original-Prompt als Fallback", async () => {
    const complete = vi.fn(async () => "   ");
    const out = await refineImagePrompt("a forest, cinematic", complete);
    expect(out).toBe("a forest, cinematic");
  });
});
