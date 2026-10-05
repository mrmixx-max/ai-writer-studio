/**
 * Tests: climaxCatharsisSynthesizer (WP 59.2 — Klimax- & Katharsis-Synthesizer)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizeClimax,
  analyzeCatharsis,
  extractCharacterFlaw,
  FLAW_LABELS,
  type CharacterFlaw,
} from "./climaxCatharsisSynthesizer";

const OPTS = {
  protagonist: "Mira",
  antagonist: "Der Wächter",
  location: "auf der Brücke",
  danger: "Das Seil begann zu reißen",
};

describe("climaxCatharsisSynthesizer — synthesizeClimax", () => {
  it("erzeugt Klimax und Katharsis", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.climax.length).toBeGreaterThan(50);
    expect(c.catharsis.length).toBeGreaterThan(30);
  });

  it("trennt Klimax und Katharsis mit Leerzeile", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.text.split("\n\n").length).toBe(2);
  });

  it("unterstützt alle fünf Schwächen", () => {
    const flaws: CharacterFlaw[] = ["pride", "fear", "guilt", "isolation", "revenge"];
    flaws.forEach((f) => {
      const c = synthesizeClimax({ ...OPTS, flaw: f });
      expect(c.flaw).toBe(f);
      expect(c.flawLabel).toBe(FLAW_LABELS[f]);
    });
  });

  it("liefert die innere Wandlung", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.transformation.length).toBeGreaterThan(15);
  });

  it("nennt den Helden in der Wandlung", () => {
    const flaws: CharacterFlaw[] = ["pride", "fear", "guilt", "isolation", "revenge"];
    flaws.forEach((f) => {
      const c = synthesizeClimax({ ...OPTS, flaw: f });
      expect(c.transformation).toContain("Mira");
    });
  });

  it("nennt den Helden in der Klimax", () => {
    const c = synthesizeClimax({ ...OPTS, flaw: "fear" });
    expect(c.climax).toContain("Mira");
  });

  it("übernimmt die äußere Gefahr", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.climax).toContain("Seil begann zu reißen");
  });

  it("übernimmt den Ort", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.climax).toContain("Brücke");
  });

  it("ist deterministisch", () => {
    const a = synthesizeClimax({ ...OPTS, flaw: "pride" });
    const b = synthesizeClimax({ ...OPTS, flaw: "pride" });
    expect(a.text).toBe(b.text);
  });

  it("liefert eine Intensitätskurve", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.intensityCurve.length).toBeGreaterThan(3);
  });

  it("Kurve startet hoch und endet niedriger", () => {
    const c = synthesizeClimax(OPTS);
    const first = c.intensityCurve[0];
    const last = c.intensityCurve[c.intensityCurve.length - 1];
    expect(first).toBeGreaterThan(last);
  });

  it("Kurvenwerte liegen zwischen 0 und 1", () => {
    const c = synthesizeClimax(OPTS);
    c.intensityCurve.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("berechnet die Wortzahl", () => {
    const c = synthesizeClimax(OPTS);
    expect(c.wordCount).toBeGreaterThan(40);
  });

  it("wählt ohne Vorgabe deterministisch eine Schwäche", () => {
    const a = synthesizeClimax(OPTS);
    const b = synthesizeClimax(OPTS);
    expect(a.flaw).toBe(b.flaw);
  });

  it("fällt bei unbekannter Schwäche auf auto zurück", () => {
    const c = synthesizeClimax({ ...OPTS, flaw: "unbekannt" as never });
    expect(c.flawLabel).toBeTruthy();
  });

  it("kommt ohne Optionen zurecht", () => {
    const c = synthesizeClimax();
    expect(c.climax.length).toBeGreaterThan(30);
  });

  it("kommt mit null zurecht", () => {
    expect(synthesizeClimax(null).text.length).toBeGreaterThan(50);
    expect(synthesizeClimax(undefined).wordCount).toBeGreaterThan(20);
  });

  it("mutiert die Optionen nicht", () => {
    const copy = { ...OPTS };
    synthesizeClimax(OPTS);
    expect(OPTS).toEqual(copy);
  });

  it("exportiert die Schwächen-Labels", () => {
    expect(FLAW_LABELS.pride).toBe("Hochmut");
    expect(FLAW_LABELS.revenge).toBe("Rachsucht");
  });
});

describe("climaxCatharsisSynthesizer — analyzeCatharsis", () => {
  it("erkennt eine ausgeprägte Spitze", () => {
    const r = analyzeCatharsis("Der Schlag kam. Das Blut riss. Dann war es still.");
    expect(r.peak).toBeGreaterThan(0.3);
  });

  it("berechnet den Abfall", () => {
    const r = analyzeCatharsis("Der Schlag kam und das Blut floss. Dann war es still und das Licht kam.");
    expect(r.resolutionDrop).toBeGreaterThan(0);
  });

  it("meldet wohlgeformt bei Spitze und Abfall", () => {
    const r = analyzeCatharsis(
      "Der Schlag riss alles entzwei und das Blut brannte. Danach war es still und der Morgen kam und die Narben blieben.",
    );
    expect(r.wellFormed).toBe(true);
  });

  it("meldet nicht wohlgeformt ohne Abfall", () => {
    const r = analyzeCatharsis("Der Schlag. Das Blut. Der Schmerz. Der Schuss.");
    expect(r.wellFormed).toBe(false);
  });

  it("findet den Spitzenindex", () => {
    const r = analyzeCatharsis("Der Schlag kam. Dann war es still.");
    expect(r.peakIndex).toBeGreaterThanOrEqual(0);
  });

  it("Werte bleiben zwischen 0 und 1", () => {
    const r = analyzeCatharsis("Der Schlag. Die Stille. Das Licht.");
    expect(r.peak).toBeLessThanOrEqual(1);
    expect(r.ending).toBeGreaterThanOrEqual(0);
    expect(r.resolutionDrop).toBeLessThanOrEqual(1);
  });

  it("analysiert die eigene Ausgabe", () => {
    const c = synthesizeClimax(OPTS);
    const r = analyzeCatharsis(c.text);
    expect(r.peak).toBeGreaterThan(0);
    expect(r.resolutionDrop).toBeGreaterThanOrEqual(0);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzeCatharsis("");
    expect(r.peak).toBe(0);
    expect(r.wellFormed).toBe(false);
    expect(analyzeCatharsis(null).resolutionDrop).toBe(0);
    expect(analyzeCatharsis(undefined).peakIndex).toBe(0);
  });
});

describe("climaxCatharsisSynthesizer — extractCharacterFlaw", () => {
  it("erkennt Hochmut", () => {
    const r = extractCharacterFlaw("Er war zu stolz, um Hilfe zu bitten.");
    expect(r.flaw).toBe("pride");
    expect(r.label).toBe("Hochmut");
  });

  it("erkennt Angst", () => {
    const r = extractCharacterFlaw("Die Angst ließ ihn fliehen.");
    expect(r.flaw).toBe("fear");
  });

  it("erkennt Schuld", () => {
    const r = extractCharacterFlaw("Er wollte für sein Versagen büßen.");
    expect(r.flaw).toBe("guilt");
  });

  it("erkennt Selbstisolation", () => {
    const r = extractCharacterFlaw("Sie ließ niemanden an sich heran und blieb einsam.");
    expect(r.flaw).toBe("isolation");
  });

  it("erkennt Rachsucht", () => {
    const r = extractCharacterFlaw("Rache war alles, was blieb.");
    expect(r.flaw).toBe("revenge");
  });

  it("liefert die Signalwörter mit", () => {
    const r = extractCharacterFlaw("Er war zu stolz.");
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it("findet nichts in neutralem Text", () => {
    const r = extractCharacterFlaw("Der Himmel war grau und der Fluss floss ruhig.");
    expect(r.flaw).toBeNull();
    expect(r.label).toBeNull();
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(extractCharacterFlaw("").flaw).toBeNull();
    expect(extractCharacterFlaw(null).signals).toEqual([]);
    expect(extractCharacterFlaw(undefined).label).toBeNull();
  });

  it("erkennt die Schwäche in der eigenen Klimax", () => {
    const c = synthesizeClimax({ ...OPTS, flaw: "pride" });
    expect(c.flaw).toBe("pride");
  });
});
