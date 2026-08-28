// Blurb-Generator: Tests für Blurb-Builder, KDP-Format, Varianten, Analyse.
import { describe, it, expect } from "vitest";
import {
  generateBlurb,
  generateBlurbVariants,
  analyzeBlurbInput,
  sharpenBlurb,
  makeBlurbMainstream,
  makeBlurbPremium,
  makeBlurbEmotional,
  makeBlurbMoreGenre,
  makeBlurbShorter,
  formatKdpDescription,
} from "@/services/marketing/blurbgen";
import type { BlurbGenInput } from "@/services/marketing/blurbgen";

const BASE_INPUT: BlurbGenInput = {
  title: "Neon Protokoll",
  type: "fiction",
  genre: "science fiction",
  audience: "Leser von Techno-Thrillern",
  format: "amazon-description",
  protagonist: "eine Hackerin",
  conflict: "eine Mordserie mit politischer Sprengkraft",
  stakes: "geht um Leben und Tod",
};

describe("blurb generator", () => {
  it("erzeugt aus Minimal-Input einen Hook", () => {
    const result = generateBlurb(BASE_INPUT);
    expect(result.shortHook.length).toBeGreaterThan(20);
  });

  it("fiction-blurb enthält Konflikt und Stakes", () => {
    const result = generateBlurb(BASE_INPUT);
    expect(result.standardBlurb.toLowerCase()).toContain("mordserie");
    expect(result.standardBlurb.toLowerCase()).toContain("leben");
  });

  it("nonfiction-output enthält Problem, Nutzen und Ergebnis", () => {
    const result = generateBlurb({
      ...BASE_INPUT,
      type: "nonfiction",
      genre: "Ratgeber",
    });
    expect(result.standardBlurb.toLowerCase()).toContain("buch");
    expect(result.standardBlurb.toLowerCase()).toContain("zeigt");
  });

  it("amazonDescription bleibt im Zielbereich", () => {
    const result = generateBlurb(BASE_INPUT);
    const words = result.amazonDescription.split(/\s+/).length;
    expect(words).toBeLessThan(300);
  });

  it("backCoverBlurb enthält keine Auflösung", () => {
    const result = generateBlurb({
      ...BASE_INPUT,
      format: "back-cover",
    });
    expect(result.backCoverBlurb).not.toContain("Auflösung");
    expect(result.backCoverBlurb).not.toContain("Ende");
  });

  it("generiert 3 Varianten mit unterschiedlichem Ton", () => {
    const variants = generateBlurbVariants(BASE_INPUT);
    expect(variants).toHaveLength(3);
    expect(variants[0].variant).toBe("commercial");
    expect(variants[1].variant).toBe("bold");
    expect(variants[2].variant).toBe("minimalist");
    expect(variants[0].blurb).not.toBe(variants[1].blurb);
  });

  it("warnt bei zu vielen Namen", () => {
    const warnings = analyzeBlurbInput({
      ...BASE_INPUT,
      conflict: "Anna, Bert, Clara, Dora, Erich und Felix streiten sich.",
    });
    expect(warnings.some((w) => w.code === "too-many-names")).toBe(true);
  });

  it("warnt bei zu langem Input", () => {
    const warnings = analyzeBlurbInput({
      ...BASE_INPUT,
      conflict: "a".repeat(350),
    });
    expect(warnings.some((w) => w.code === "too-many-details")).toBe(true);
  });

  it("warnt bei fehlendem Konflikt", () => {
    const warnings = analyzeBlurbInput({
      ...BASE_INPUT,
      conflict: "",
    });
    expect(warnings.some((w) => w.code === "no-conflict")).toBe(true);
  });

  it("formatKdpDescription erzeugt gültige einfache HTML-Struktur", () => {
    const result = generateBlurb(BASE_INPUT);
    const html = formatKdpDescription(result);
    expect(html).toContain("<p>");
    expect(html).toContain("</p>");
  });

  it("sharpenBlurb fügt Schärfe hinzu", () => {
    const base = "Ein Blurb.";
    const sharpened = sharpenBlurb(base);
    expect(sharpened).toContain("Schärfer");
  });

  it("makeBlurbMainstream fügt Mainstream-Elemente hinzu", () => {
    const base = "Ein Blurb.";
    const result = makeBlurbMainstream(base);
    expect(result).toContain("Mainstream-appeal");
  });

  it("makeBlurbPremium fügt Premium-Elemente hinzu", () => {
    const base = "Ein Blurb.";
    const result = makeBlurbPremium(base);
    expect(result).toContain("Premium-Qualität");
  });

  it("makeBlurbEmotional fügt Emotion hinzu", () => {
    const base = "Ein Blurb.";
    const result = makeBlurbEmotional(base);
    expect(result).toContain("Emotional");
  });

  it("makeBlurbMoreGenre fügt Genre-Signale hinzu", () => {
    const base = "Ein Blurb.";
    const result = makeBlurbMoreGenre(base, "thriller");
    expect(result).toContain("thriller");
  });

  it("makeBlurbSchrter kürzt den Text", () => {
    const base = "Eins zwei drei vier fünf sechs sieben acht neun zehn.";
    const result = makeBlurbShorter(base);
    expect(result.split(/\s+/).length).toBeLessThan(base.split(/\s+/).length);
  });
});
