// Cover-Generator: Tests für Prompt-Optimizer, Varianten, Analyse.
import { describe, it, expect } from "vitest";
import {
  optimizeCoverPrompt,
  generateVariants,
  analyzeCoverInput,
  sharpenPrompt,
  makeMainstream,
  makePremium,
  makeMoreGenre,
} from "@/services/llm/covergen";
import type { CoverGenInput } from "@/services/llm/covergen";

const BASE_INPUT: CoverGenInput = {
  title: "NEON PROTOCOL",
  genre: "science fiction",
  target: "ebook",
  provider: "openai-dalle",
};

describe("cover generator", () => {
  it("erzeugt aus Minimal-Input einen verwendbaren Prompt", () => {
    const result = optimizeCoverPrompt(BASE_INPUT);
    expect(result.fullPrompt).toContain("book cover");
    expect(result.providerOptimizedPrompt.length).toBeGreaterThan(80);
    expect(result.negativePrompt).toContain("watermark");
  });

  it("liefert Genre-Hinweise für Thriller", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      title: "Black Harbor",
      genre: "thriller",
      provider: "sd-webui",
    });
    expect(result.fullPrompt.toLowerCase()).toContain("tension");
  });

  it("liefert Genre-Hinweise für Fantasy", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      title: "The Crystal Throne",
      genre: "fantasy",
    });
    expect(result.fullPrompt.toLowerCase()).toContain("epic");
  });

  it("liefert Markt-Hinweise für ebook thumbnail", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      target: "ebook",
    });
    expect(result.fullPrompt.toLowerCase()).toContain("thumbnail");
  });

  it("liefert negativePrompt mit Basis-Sicherungen", () => {
    const result = optimizeCoverPrompt(BASE_INPUT);
    expect(result.negativePrompt).toContain("blurry");
    expect(result.negativePrompt).toContain("watermark");
    expect(result.negativePrompt).toContain("logo");
  });

  it("erzeugt 3 Varianten mit unterscheidbaren Schwerpunkten", () => {
    const variants = generateVariants(BASE_INPUT);
    expect(variants).toHaveLength(3);
    expect(variants[0].variant).toBe("commercial");
    expect(variants[1].variant).toBe("bold");
    expect(variants[2].variant).toBe("minimalist");
    // Each should have different content
    expect(variants[0].prompt).not.toBe(variants[1].prompt);
    expect(variants[1].prompt).not.toBe(variants[2].prompt);
  });

  it("warnt bei zu langem Titel", () => {
    const warnings = analyzeCoverInput({
      ...BASE_INPUT,
      title: "Das unglaubliche und erstaunlich komplizierte Vermächtnis der letzten Maschine",
    });
    expect(warnings.some((w) => w.code === "title-too-long")).toBe(true);
  });

  it("warnt bei zu vielen Motiven", () => {
    const warnings = analyzeCoverInput({
      ...BASE_INPUT,
      motifs: "Schwert, Drache, Burg, Magie, Kristall, Schatten",
    });
    expect(warnings.some((w) => w.code === "too-many-motives")).toBe(true);
  });

  it("warnt bei fehlendem Fokus", () => {
    const warnings = analyzeCoverInput({
      ...BASE_INPUT,
      motifs: "",
      figureDescription: "",
      setting: "",
    });
    expect(warnings.some((w) => w.code === "no-clear-focus")).toBe(true);
  });

  it("providerOptimizedPrompt unterscheidet sich je nach Provider", () => {
    const dalle = optimizeCoverPrompt({
      ...BASE_INPUT,
      provider: "openai-dalle",
    });
    const flux = optimizeCoverPrompt({
      ...BASE_INPUT,
      provider: "openrouter-flux",
    });
    const sd = optimizeCoverPrompt({
      ...BASE_INPUT,
      provider: "sd-webui",
    });
    expect(dalle.providerOptimizedPrompt).not.toBe(flux.providerOptimizedPrompt);
    expect(flux.providerOptimizedPrompt).not.toBe(sd.providerOptimizedPrompt);
  });

  it("sharpenPrompt fügt Schärfe hinzu", () => {
    const base = "A book cover";
    const sharpened = sharpenPrompt(base);
    expect(sharpened).toContain("razor sharp focus");
    expect(sharpened.length).toBeGreaterThan(base.length);
  });

  it("makeMainstream fügt Mainstream-Elemente hinzu", () => {
    const base = "A book cover";
    const result = makeMainstream(base);
    expect(result).toContain("mainstream commercial appeal");
  });

  it("makePremium fügt Premium-Elemente hinzu", () => {
    const base = "A book cover";
    const result = makePremium(base);
    expect(result).toContain("premium quality");
  });

  it("makeMoreGenre fügt Genre-Hinweise hinzu", () => {
    const base = "A book cover";
    const result = makeMoreGenre(base, "thriller");
    expect(result).toContain("tension");
  });

  it("berücksichtigt Untertitel und Autor", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      subtitle: "Die letzte Entscheidung",
      authorName: "Max Mustermann",
    });
    expect(result.fullPrompt).toContain("Die letzte Entscheidung");
    expect(result.fullPrompt).toContain("Max Mustermann");
  });

  it("berücksichtigt Cover-Stil", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      coverStyle: "minimal",
    });
    expect(result.fullPrompt).toContain("minimal");
  });

  it("berücksichtigt Sprache", () => {
    const result = optimizeCoverPrompt({
      ...BASE_INPUT,
      language: "de",
    });
    expect(result.fullPrompt).toContain("Buchcover");
  });
});
