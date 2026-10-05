/**
 * Tests: atmosphereProseGenerator (WP 55.1 — Schauplatz- & Sensorik-Generator)
 */

import { describe, it, expect } from "vitest";
import {
  generateAtmosphere,
  checkSensoryCoverage,
  generateTransition,
  type Mood,
} from "./atmosphereProseGenerator";

describe("atmosphereProseGenerator — generateAtmosphere", () => {
  it("erzeugt Text", () => {
    const r = generateAtmosphere({ location: "Hafenkai" });
    expect(r.text.length).toBeGreaterThan(50);
    expect(r.wordCount).toBeGreaterThan(10);
  });

  it("nennt den Ort", () => {
    const r = generateAtmosphere({ location: "Alte Mühle" });
    expect(r.text).toContain("Alte Mühle");
  });

  it("bedient mindestens 4 der 5 Sinne", () => {
    const r = generateAtmosphere({ location: "Hafenkai", mood: "threatening" });
    expect(r.senseCount).toBeGreaterThanOrEqual(4);
  });

  it("ist deterministisch", () => {
    const a = generateAtmosphere({ location: "Hafenkai", mood: "threatening" });
    const b = generateAtmosphere({ location: "Hafenkai", mood: "threatening" });
    expect(a.text).toBe(b.text);
  });

  it("unterschiedliche Stimmungen erzeugen unterschiedlichen Text", () => {
    const a = generateAtmosphere({ location: "X", mood: "serene" });
    const b = generateAtmosphere({ location: "X", mood: "claustrophobic" });
    expect(a.text).not.toBe(b.text);
    expect(a.mood).toBe("serene");
    expect(b.mood).toBe("claustrophobic");
  });

  it("verarbeitet alle fünf Stimmungen", () => {
    const moods: Mood[] = ["threatening", "melancholic", "sublime", "claustrophobic", "serene"];
    moods.forEach((mood) => {
      const r = generateAtmosphere({ location: "Test", mood });
      expect(r.mood).toBe(mood);
      expect(r.text.length).toBeGreaterThan(20);
    });
  });

  it("bindet Tageszeit ein", () => {
    const r = generateAtmosphere({ location: "X", timeOfDay: "night" });
    expect(r.text).toContain("Nacht");
  });

  it("bindet Wetter ein", () => {
    const r = generateAtmosphere({ location: "X", weather: "fog" });
    expect(r.text.toLowerCase()).toContain("nebel");
  });

  it("fällt bei ungültiger Stimmung auf serene zurück", () => {
    const r = generateAtmosphere({ location: "X", mood: "unbekannt" as never });
    expect(r.mood).toBe("serene");
  });

  it("kommt ohne Eingabe zurecht", () => {
    const r = generateAtmosphere();
    expect(r.text.length).toBeGreaterThan(20);
    expect(r.senseCount).toBeGreaterThanOrEqual(4);
  });

  it("kommt mit null/undefined zurecht", () => {
    expect(generateAtmosphere(null).text.length).toBeGreaterThan(20);
    expect(generateAtmosphere(undefined).wordCount).toBeGreaterThan(5);
  });

  it("endet mit Satzzeichen", () => {
    const r = generateAtmosphere({ location: "X" });
    expect(/[.!?]$/.test(r.text.trim())).toBe(true);
  });

  it("mutiert die Eingabe nicht", () => {
    const input = { location: "X", mood: "serene" as Mood };
    const copy = { ...input };
    generateAtmosphere(input);
    expect(input).toEqual(copy);
  });
});

describe("atmosphereProseGenerator — checkSensoryCoverage", () => {
  it("erkennt Sinne im erzeugten Text", () => {
    const r = generateAtmosphere({ location: "Hafenkai", mood: "threatening" });
    const coverage = checkSensoryCoverage(r.text);
    expect(coverage.senseCount).toBeGreaterThanOrEqual(4);
    expect(coverage.meetsTarget).toBe(true);
  });

  it("erkennt einen einzelnen Sinn", () => {
    const c = checkSensoryCoverage("Der Wind war eisig kalt auf der Haut.");
    expect(c.senses).toContain("touch");
  });

  it("meldet fehlende Sinne", () => {
    const c = checkSensoryCoverage("Der Wind war kalt.");
    expect(c.missing.length).toBeGreaterThan(0);
  });

  it("meetsTarget ist false bei wenig Sinnen", () => {
    const c = checkSensoryCoverage("Kalt.");
    expect(c.meetsTarget).toBe(false);
  });

  it("kommt mit leerem Input zurecht", () => {
    const c = checkSensoryCoverage("");
    expect(c.senseCount).toBe(0);
    expect(c.missing.length).toBe(5);
    expect(checkSensoryCoverage(null).meetsTarget).toBe(false);
  });
});

describe("atmosphereProseGenerator — generateTransition", () => {
  it("erzeugt einen Übergang", () => {
    const t = generateTransition({ timeSkip: "drei Tage später" });
    expect(t.length).toBeGreaterThan(30);
  });

  it("nennt den Zeitsprung", () => {
    const t = generateTransition({ timeSkip: "drei Tage später" });
    expect(t).toContain("drei Tage später");
  });

  it("nennt den Zielort", () => {
    const t = generateTransition({ toLocation: "Das Kloster" });
    expect(t).toContain("Das Kloster");
  });

  it("ist deterministisch", () => {
    const a = generateTransition({ timeSkip: "später", mood: "melancholic" });
    const b = generateTransition({ timeSkip: "später", mood: "melancholic" });
    expect(a).toBe(b);
  });

  it("folgt der Zielstimmung", () => {
    const a = generateTransition({ mood: "sublime" });
    const b = generateTransition({ mood: "claustrophobic" });
    expect(a).not.toBe(b);
  });

  it("kommt ohne Optionen zurecht", () => {
    expect(generateTransition().length).toBeGreaterThan(20);
    expect(generateTransition(null).length).toBeGreaterThan(20);
    expect(generateTransition(undefined).length).toBeGreaterThan(20);
  });

  it("endet mit Satzzeichen", () => {
    const t = generateTransition({ timeSkip: "am Morgen" });
    expect(/[.!?]$/.test(t.trim())).toBe(true);
  });
});
