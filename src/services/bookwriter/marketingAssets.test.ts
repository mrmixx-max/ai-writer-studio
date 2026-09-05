// Marketing-Assets: Klappentext, 7 Amazon-Keywords, Kategorien-Vorschläge.
//
// Wird parallel zum KDP-Preflight aus der finalen Buch-Zusammenfassung
// generiert. Deterministisch (blurbgen + Theme-Extraktion), optional
// LLM-Prompt-Bau für die Manuelle Nachschärfung.

import { describe, it, expect } from "vitest";
import {
  buildKeywords,
  suggestCategories,
  generateMarketingAssets,
  buildMarketingLlmPrompt,
  type MarketingInput,
} from "./marketingAssets";

const SUMMARY = `Die junge Kartografin Mara Voss entdeckt in einer alten
Bibliothek eine Karte, die sich nachts selbst neu zeichnet. Als ihr Bruder
verschwindet, folgt sie dem Labyrinth unter der Stadt — und erkennt, dass
die Karte auch den Tag ihres eigenen Todes zeigt. Ein atmosphärischer
Urban-Fantasy-Roman über Erinnerung, Verlust und Mut.`;

const baseInput = (over: Partial<MarketingInput> = {}): MarketingInput => ({
  title: "Die Karte der Nächte",
  genre: "Urban Fantasy",
  summary: SUMMARY,
  targetAudience: "Erwachsene Fantasy-Leser",
  language: "de",
  ...over,
});

describe("buildKeywords", () => {
  it("liefert genau 7 Keywords, je max. 50 Zeichen", () => {
    const kws = buildKeywords(baseInput());
    expect(kws).toHaveLength(7);
    for (const k of kws) {
      expect(k.length).toBeGreaterThan(0);
      expect(k.length).toBeLessThanOrEqual(50);
      expect(k).toBe(k.toLowerCase());
    }
  });

  it("enthält Genre- und Zielgruppen-Signale", () => {
    const kws = buildKeywords(baseInput());
    const joined = kws.join(" ");
    expect(joined.toLowerCase()).toContain("fantasy");
  });

  it("dedupliziert", () => {
    const kws = buildKeywords(baseInput({ summary: "Fantasy Fantasy Fantasy Stadt" }));
    expect(new Set(kws).size).toBe(kws.length);
  });
});

describe("suggestCategories", () => {
  it("liefert 3-5 Kategorien mit Pfad", () => {
    const cats = suggestCategories(baseInput());
    expect(cats.length).toBeGreaterThanOrEqual(3);
    expect(cats.length).toBeLessThanOrEqual(5);
    for (const c of cats) {
      expect(c.path).toMatch(/>/);
      expect(c.store).toBe("amazon-kdp");
    }
  });

  it("mappt bekannte Genres auf passende Kategorien", () => {
    const cats = suggestCategories(baseInput({ genre: "Krimi" }));
    expect(cats.some((c) => /Krimi|Thriller/i.test(c.path))).toBe(true);
  });

  it("hat einen Fallback für unbekannte Genres", () => {
    const cats = suggestCategories(baseInput({ genre: "Xenolinguistik" }));
    expect(cats.length).toBeGreaterThanOrEqual(3);
  });
});

describe("generateMarketingAssets", () => {
  it("erzeugt Klappentext + 7 Keywords + Kategorien in einem Ergebnis", () => {
    const assets = generateMarketingAssets(baseInput());
    expect(assets.blurb.amazonDescription.length).toBeGreaterThan(50);
    expect(assets.keywords).toHaveLength(7);
    expect(assets.categories.length).toBeGreaterThanOrEqual(3);
    expect(assets.source).toBe("deterministic");
  });

  it("funktioniert ohne Zielgruppe/Untertitel (optionale Felder)", () => {
    const assets = generateMarketingAssets(
      baseInput({ targetAudience: undefined, subtitle: undefined }),
    );
    expect(assets.blurb.amazonDescription).toBeTruthy();
    expect(assets.keywords).toHaveLength(7);
  });
});

describe("buildMarketingLlmPrompt", () => {
  it("fordert JSON mit description/keywords/categories an", () => {
    const prompt = buildMarketingLlmPrompt(baseInput());
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("keywords");
    expect(prompt).toContain("categories");
    expect(prompt).toContain("Die Karte der Nächte");
  });
});
