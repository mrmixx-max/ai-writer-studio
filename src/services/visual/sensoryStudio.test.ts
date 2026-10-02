// Sensorisches Szenen- & Moodboard-Studio Tests (WP 23.1).
// Lokal, deterministisch, kein LLM.
import { describe, it, expect } from "vitest";
import {
  generateSensoryCompass,
  extractColorPalette,
  generateMoodboard,
} from "./sensoryStudio";

const HEX = /^#[0-9a-f]{6}$/;

describe("generateSensoryCompass", () => {
  it("liefert alle vier Felder mit nicht-leeren Inhalten", () => {
    const compass = generateSensoryCompass("Ein einsamer Wald bei Nacht.");
    expect(Array.isArray(compass.smell)).toBe(true);
    expect(compass.smell.length).toBeGreaterThan(0);
    expect(compass.light.length).toBeGreaterThan(0);
    expect(compass.haptik.length).toBeGreaterThan(0);
    expect(typeof compass.temperature).toBe("string");
    expect(compass.temperature.length).toBeGreaterThan(0);
  });

  it("erkennt einen Wald und liefert passende Geruchs-/Haptikanker", () => {
    const compass = generateSensoryCompass("Tiefer Wald, Moos und Harz.");
    expect(compass.smell).toContain("Moos");
    expect(compass.haptik).toContain("raue Rinde");
    expect(compass.temperature).toBe("kühl und feucht");
  });

  it("erkennt ein Krankenhaus trotz Kompositum/Kleinschreibung", () => {
    const compass = generateSensoryCompass("krankenhaus-flur, nachts");
    expect(compass.smell).toContain("Desinfektionsmittel");
    expect(compass.temperature).toBe("kühl und steril");
  });

  it("ist deterministisch: identische Eingabe -> identische Ausgabe", () => {
    const input = "Ein Strand am Meer im Sommer mit Regen.";
    const a = generateSensoryCompass(input);
    const b = generateSensoryCompass(input);
    expect(a).toEqual(b);
    // Kein geteilter Array-Referenzzustand.
    a.smell.push("mutiert");
    expect(generateSensoryCompass(input).smell).not.toContain("mutiert");
  });

  it("fällt bei leerem String auf den neutralen Standard zurück", () => {
    const compass = generateSensoryCompass("   ");
    expect(compass.smell.length).toBeGreaterThan(0);
    expect(compass.temperature).toBe("unbestimmt, mild");
  });

  it("fällt defensiv zurück, wenn kein Schauplatz erkannt wird", () => {
    const compass = generateSensoryCompass("Ein Gespräch über Zahlen und Tabellen.");
    expect(compass.temperature).toBe("unbestimmt, mild");
    expect(compass.light.length).toBeGreaterThan(0);
  });

  it("übersteht Nicht-String-Eingaben ohne Ausnahme", () => {
    // Bewusst defensiv: Laufzeitdaten können unerwartete Typen liefern.
    const compass = generateSensoryCompass(undefined as unknown as string);
    expect(compass.temperature).toBe("unbestimmt, mild");
    const compass2 = generateSensoryCompass(null as unknown as string);
    expect(compass2.smell.length).toBeGreaterThan(0);
  });

  it("begrenzt die Anker-Listen auch bei gemischten Schauplätzen", () => {
    const compass = generateSensoryCompass(
      "Wald am Meer, in der Stadt, bei Nacht und im Winter mit Regen.",
    );
    expect(compass.smell.length).toBeLessThanOrEqual(6);
    expect(compass.light.length).toBeLessThanOrEqual(5);
    expect(compass.haptik.length).toBeLessThanOrEqual(6);
  });
});

describe("extractColorPalette", () => {
  it("liefert gültige Hex-Farben in allen drei Gruppen", () => {
    const palette = extractColorPalette("Eine warme Küche am Morgen.");
    expect(palette.primary.length).toBeGreaterThan(0);
    expect(palette.secondary.length).toBeGreaterThan(0);
    expect(palette.accent.length).toBeGreaterThan(0);
    for (const hex of [...palette.primary, ...palette.secondary, ...palette.accent]) {
      expect(hex).toMatch(HEX);
    }
  });

  it("erzeugt unterschiedliche Paletten für unterschiedliche Schauplätze", () => {
    const wald = extractColorPalette("Ein stiller Wald im Nebel.");
    const wueste = extractColorPalette("Eine heiße Wüste unter der Sonne.");
    expect(wald.primary).not.toEqual(wueste.primary);
    expect(wald.accent).not.toEqual(wueste.accent);
  });

  it("ist deterministisch", () => {
    const input = "Der Hafen bei Nacht.";
    expect(extractColorPalette(input)).toEqual(extractColorPalette(input));
  });

  it("liefert bei unbekanntem Schauplatz eine neutrale, gültige Palette", () => {
    const palette = extractColorPalette("Völlig unbestimmte Beschreibung.");
    for (const hex of [...palette.primary, ...palette.secondary, ...palette.accent]) {
      expect(hex).toMatch(HEX);
    }
  });

  it("übersteht Nicht-String-Eingaben ohne Ausnahme", () => {
    const palette = extractColorPalette(42 as unknown as string);
    expect(palette.primary.every((hex) => HEX.test(hex))).toBe(true);
  });
});

describe("generateMoodboard", () => {
  it("kombiniert Farben, Sensorik und Keywords", () => {
    const board = generateMoodboard("Ein dunkler Keller voller Moder.");
    expect(board.colors.primary.length).toBeGreaterThan(0);
    expect(board.sensory.temperature).toBe("kalt und klamm");
    expect(board.keywords.length).toBeGreaterThan(0);
    expect(board.keywords).toContain("keller");
  });

  it("nennt den erkannten Schauplatz und filtert Stoppwörter", () => {
    const board = generateMoodboard("Die alte Bibliothek ist ruhig und warm.");
    expect(board.keywords).toContain("bibliothek");
    expect(board.keywords).not.toContain("die");
    expect(board.keywords).not.toContain("und");
  });

  it("begrenzt die Keyword-Liste auf maximal 12 Einträge", () => {
    const board = generateMoodboard(
      "Wald Meer Wüste Berge Stadt Nacht Winter Regen Garten Keller Küche Bar Büro " +
        "Bibliothek Krankenhaus Kirche Sommer sonnenbrand grill urlaub hitze strand ozean",
    );
    expect(board.keywords.length).toBeLessThanOrEqual(12);
    expect(board.keywords.length).toBeGreaterThan(0);
  });

  it("ist vollständig deterministisch", () => {
    const input = "Der Bahnhof bei strömendem Regen.";
    expect(generateMoodboard(input)).toEqual(generateMoodboard(input));
  });

  it("fällt bei leerer Eingabe auf ein neutrales Moodboard zurück", () => {
    const board = generateMoodboard("");
    expect(board.keywords).toEqual([]);
    expect(board.sensory.temperature).toBe("unbestimmt, mild");
    expect(board.colors.primary.every((hex) => HEX.test(hex))).toBe(true);
  });
});
