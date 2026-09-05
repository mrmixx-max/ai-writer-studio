// Cover-Prompt-Generator: 3-5 hochdetaillierte Prompts für
// Midjourney / Stable Diffusion aus der finalen Buch-Zusammenfassung.
//
// Rein deterministisch (kein LLM-Call): Die Zusammenfassung wird zu
// Themen/Motiven verdichtet, Genre-Bestimmung liefert Stimmung/Palette,
// 5 Stil-Spuren liefern die Varianten.

import { describe, it, expect } from "vitest";
import {
  extractThemes,
  generateCoverPrompts,
  inferMood,
  type CoverPromptInput,
} from "./coverPrompts";

const SUMMARY = `Die junge Kartografin Mara Voss entdeckt in den Tiefen der
Stadtbibliothek eine Karte, die sich nachts selbst neu zeichnet. Als ihr
Bruder verschwindet, folgt sie der Karte in ein verborgenes Labyrinth unter
der Stadt. Ein Wettlauf gegen die Zeit beginnt, denn die Karte zeigt auch
den Tag ihres eigenen Todes. Atmosphärischer urbaner Fantasy-Roman über
Erinnerung, Verlust und den Mut, den eigenen Weg zu zeichnen.`;

const baseInput = (over: Partial<CoverPromptInput> = {}): CoverPromptInput => ({
  title: "Die Karte der Nächte",
  genre: "Urban Fantasy",
  summary: SUMMARY,
  targetAudience: "Erwachsene Fantasy-Leser",
  language: "de",
  ...over,
});

describe("extractThemes", () => {
  it("extrahiert inhaltsreiche Schlüsselwörter ohne Stoppwörter", () => {
    const themes = extractThemes(SUMMARY, 8);
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.length).toBeLessThanOrEqual(8);
    const lower = themes.map((t) => t.toLowerCase());
    expect(lower).toContain("karte");
    expect(lower).not.toContain("und");
    expect(lower).not.toContain("der");
  });

  it("dedupliziert case-insensitive und erhält Reihenfolge nach Häufigkeit", () => {
    const themes = extractThemes("Karte Karte Karte Hund Hund Katze", 5);
    expect(themes[0].toLowerCase()).toBe("karte");
    const lower = themes.map((t) => t.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it("liefert leeres Array bei leerem/Stopwort-Text", () => {
    expect(extractThemes("", 8)).toEqual([]);
    expect(extractThemes("und oder der die das", 8)).toEqual([]);
  });
});

describe("inferMood", () => {
  it("mappt bekannte Genres auf Stimmung/Palette", () => {
    const mood = inferMood("Urban Fantasy");
    expect(mood.mood).toBeTruthy();
    expect(mood.palette).toBeTruthy();
    expect(mood.lighting).toBeTruthy();
  });

  it("nutzt Themes als Hinweis bei unbekanntem Genre", () => {
    const dark = inferMood("Sonstiges", ["Tod", "Schatten", "Verlust"]);
    const bright = inferMood("Sonstiges", ["Freude", "Garten", "Frühling"]);
    expect(dark.palette).not.toBe(bright.palette);
  });
});

describe("generateCoverPrompts", () => {
  it("erzeugt standardmäßig 5 detaillierte Prompts", () => {
    const prompts = generateCoverPrompts(baseInput());
    expect(prompts).toHaveLength(5);
    for (const p of prompts) {
      expect(p.fullPrompt.length).toBeGreaterThan(200);
      expect(p.style).toBeTruthy();
      expect(p.negativePrompt).toContain("text");
    }
  });

  it("respektiert count 3-5 (clamp) und liefert unterschiedliche Varianten", () => {
    expect(generateCoverPrompts(baseInput(), { count: 2 })).toHaveLength(3);
    expect(generateCoverPrompts(baseInput(), { count: 9 })).toHaveLength(5);
    const four = generateCoverPrompts(baseInput(), { count: 4 });
    expect(four).toHaveLength(4);
    const styles = new Set(four.map((p) => p.style));
    expect(styles.size).toBe(4);
  });

  it("enthält Motive und Genre-Stimmung aus der Zusammenfassung", () => {
    const [first] = generateCoverPrompts(baseInput(), { count: 1 });
    expect(first.fullPrompt.toLowerCase()).toContain("fantasy");
    expect(first.fullPrompt.toLowerCase()).toContain("karte");
  });

  it("baut Midjourney-Parameter (--ar 2:3) bzw. SD-Negative-Prompt ein", () => {
    const mj = generateCoverPrompts(baseInput(), { count: 1, engine: "midjourney" })[0];
    const sd = generateCoverPrompts(baseInput(), { count: 1, engine: "stable-diffusion" })[0];
    expect(mj.fullPrompt).toContain("--ar 2:3");
    expect(sd.fullPrompt).not.toContain("--ar");
    expect(sd.negativePrompt.length).toBeGreaterThan(20);
  });

  it("funktioniert mit leerer Zusammenfassung (Fallback auf Titel/Genre)", () => {
    const prompts = generateCoverPrompts(baseInput({ summary: "  " }), { count: 3 });
    expect(prompts).toHaveLength(3);
    expect(prompts[0].fullPrompt).toContain("Die Karte der Nächte");
  });

  it("alle Prompts enthalten eine Title-Area-Anweisung (Buchcover-Kontext)", () => {
    const prompts = generateCoverPrompts(baseInput());
    for (const p of prompts) {
      expect(p.fullPrompt).toMatch(/title area|Titelfläche/i);
    }
  });
});
