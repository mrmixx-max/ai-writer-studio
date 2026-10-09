// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  LANGUAGE_STRATA,
  TERRAIN_MORPHEMES,
  buildPlaceName,
  simulateSoundShift,
  buildLayeredToponym,
  createSamplePlaceName,
  createSampleSoundShift,
} from "./toponymicEtymologyEngine";

const STRATUM_IDS = [
  "angloSaxon",
  "norseGermanic",
  "celticGaelic",
  "classicalRoman",
  "desertSemitic",
];

const TERRAIN_IDS = ["ford", "ridge", "clearing", "fortress", "water", "valley"];

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("ist deterministisch für gleiche Eingabe", () => {
    expect(hashString("Grimswick")).toBe(hashString("Grimswick"));
  });
  it("liefert für leeren String den FNV-Offset-Basiswert", () => {
    expect(hashString("")).toBe(2166136261);
  });
  it("liefert einen 32-Bit-Ganzzahlwert", () => {
    const h = hashString("Toponym");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBe(h >>> 0);
  });
  it("bleibt im vorzeichenlosen 32-Bit-Bereich", () => {
    for (const value of ["", "a", "Ärger", "Wadi", "x".repeat(1000)]) {
      const h = hashString(value);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(4294967295);
    }
  });
  it("unterscheidet verschiedene Strings", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
  it("unterscheidet Groß- und Kleinschreibung", () => {
    expect(hashString("Ald")).not.toBe(hashString("ald"));
  });
  it("unterscheidet Leerzeichen", () => {
    expect(hashString("a b")).not.toBe(hashString("ab"));
  });
  it("erzeugt für unterschiedliche Eingaben paarweise verschiedene Hashes", () => {
    const inputs = ["", "a", "b", "ab", "ba", "test", "Test", "test ", "Nord", "Süd"];
    const hashes = inputs.map(hashString);
    expect(new Set(hashes).size).toBe(inputs.length);
  });
  it("behandelt Unicode-Zeichen deterministisch", () => {
    expect(hashString("München")).toBe(hashString("München"));
  });
  it("unterscheidet Umlaut von ASCII-Variante", () => {
    expect(hashString("München")).not.toBe(hashString("Munchen"));
  });
  it("verarbeitet lange Eingaben ohne Fehler", () => {
    expect(() => hashString("a".repeat(10000))).not.toThrow();
  });
  it("liefert für Emojis einen gültigen 32-Bit-Wert", () => {
    const h = hashString("🏔️Berg");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(4294967295);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------
describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
  it("liefert 500 Werte im Bereich [0,1)", () => {
    const rng = createSeededRandom(1234);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("liefert für unterschiedliche Seeds unterschiedliche Sequenzen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
  it("erstes Element unterscheidet sich bei benachbarten Seeds", () => {
    expect(createSeededRandom(7)()).not.toBe(createSeededRandom(8)());
  });
  it("behandelt Seed 0 ohne Fehler", () => {
    const rng = createSeededRandom(0);
    expect(typeof rng()).toBe("number");
  });
  it("behandelt negative Seeds deterministisch", () => {
    const a = createSeededRandom(-5);
    const b = createSeededRandom(-5);
    expect(a()).toBe(b());
  });
  it("liefert keine konstanten Werte", () => {
    const rng = createSeededRandom(99);
    const values = Array.from({ length: 30 }, () => rng());
    expect(new Set(values).size).toBeGreaterThan(1);
  });
  it("funktioniert mit dem Maximal-Seed", () => {
    const rng = createSeededRandom(4294967295);
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// LANGUAGE_STRATA
// ---------------------------------------------------------------------------
describe("LANGUAGE_STRATA", () => {
  it("enthält genau fünf Sprachstämme", () => {
    expect(LANGUAGE_STRATA).toHaveLength(5);
  });
  it("hat die erwarteten IDs in Reihenfolge", () => {
    expect(LANGUAGE_STRATA.map((s) => s.id)).toEqual(STRATUM_IDS);
  });
  it("alle IDs sind eindeutig", () => {
    expect(new Set(LANGUAGE_STRATA.map((s) => s.id)).size).toBe(5);
  });

  LANGUAGE_STRATA.forEach((stratum) => {
    describe(`Stamm ${stratum.id}`, () => {
      it("hat nicht-leeren Namen", () => {
        expect(stratum.name.length).toBeGreaterThan(0);
      });
      it("hat nicht-leere Beschreibung", () => {
        expect(stratum.description.length).toBeGreaterThan(0);
      });
      it("hat nicht-leeren Beispielnamen", () => {
        expect(stratum.exampleName.length).toBeGreaterThan(0);
      });
      it("hat nicht-leeres Präfix-Array", () => {
        expect(Array.isArray(stratum.prefixes)).toBe(true);
        expect(stratum.prefixes.length).toBeGreaterThan(0);
      });
      it("hat nicht-leeres Suffix-Array", () => {
        expect(Array.isArray(stratum.suffixes)).toBe(true);
        expect(stratum.suffixes.length).toBeGreaterThan(0);
      });
      it("alle Präfixe sind nicht-leere Strings", () => {
        for (const p of stratum.prefixes) {
          expect(typeof p === "string" && p.length > 0).toBe(true);
        }
      });
      it("alle Suffixe sind nicht-leere Strings", () => {
        for (const s of stratum.suffixes) {
          expect(typeof s === "string" && s.length > 0).toBe(true);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// TERRAIN_MORPHEMES
// ---------------------------------------------------------------------------
describe("TERRAIN_MORPHEMES", () => {
  it("enthält mindestens vier Kategorien", () => {
    expect(TERRAIN_MORPHEMES.length).toBeGreaterThanOrEqual(4);
  });
  it("enthält die erwarteten IDs", () => {
    expect(TERRAIN_MORPHEMES.map((t) => t.id)).toEqual(TERRAIN_IDS);
  });
  it("alle IDs sind eindeutig", () => {
    expect(new Set(TERRAIN_MORPHEMES.map((t) => t.id)).size).toBe(TERRAIN_MORPHEMES.length);
  });

  TERRAIN_MORPHEMES.forEach((terrain) => {
    describe(`Gelände ${terrain.id}`, () => {
      it("hat nicht-leeren Namen", () => {
        expect(terrain.name.length).toBeGreaterThan(0);
      });
      it("hat nicht-leere Beschreibung", () => {
        expect(terrain.description.length).toBeGreaterThan(0);
      });
      it("hat nicht-leere Bedeutung", () => {
        expect(terrain.meaning.length).toBeGreaterThan(0);
      });
      it("hat nicht-leeres Morphem-Array", () => {
        expect(Array.isArray(terrain.morphemes)).toBe(true);
        expect(terrain.morphemes.length).toBeGreaterThan(0);
      });
      it("alle Morpheme sind nicht-leere Strings", () => {
        for (const m of terrain.morphemes) {
          expect(typeof m === "string" && m.length > 0).toBe(true);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// buildPlaceName
// ---------------------------------------------------------------------------
describe("buildPlaceName", () => {
  LANGUAGE_STRATA.forEach((stratum) => {
    TERRAIN_MORPHEMES.forEach((terrain) => {
      it(`baut gültigen Namen für ${stratum.id} + ${terrain.id}`, () => {
        const r = buildPlaceName({ stratumId: stratum.id, terrainId: terrain.id }, 7);
        expect(r.name.length).toBeGreaterThan(0);
        expect(r.stratum).toBe(stratum.name);
        expect(r.terrain).toBe(terrain.name);
        expect(Array.isArray(r.morphemes)).toBe(true);
        expect(r.morphemes.length).toBeGreaterThan(0);
        expect(r.meaning.length).toBeGreaterThan(0);
        expect(Array.isArray(r.layers)).toBe(true);
        expect(r.layers.length).toBeGreaterThan(0);
      });
    });
  });

  it("ist deterministisch für gleichen Seed", () => {
    const input = { stratumId: "norseGermanic", terrainId: "valley" };
    expect(buildPlaceName(input, 42)).toEqual(buildPlaceName(input, 42));
  });
  it("kann für unterschiedliche Seeds unterschiedliche Namen liefern", () => {
    const input = { stratumId: "celticGaelic", terrainId: "water" };
    const names = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => buildPlaceName(input, s).name));
    expect(names.size).toBeGreaterThan(1);
  });
  it("übernimmt und kapitalisiert einen übergebenen Root", () => {
    const r = buildPlaceName({ stratumId: "angloSaxon", terrainId: "ford", root: "ald" }, 3);
    expect(r.name.startsWith("Ald")).toBe(true);
    expect(r.morphemes[0]).toBe("Ald");
  });
  it("trimmt den Root", () => {
    const r = buildPlaceName({ stratumId: "angloSaxon", terrainId: "ford", root: "  Ald  " }, 3);
    expect(r.morphemes[0]).toBe("Ald");
  });
  it("behandelt leeren Root ohne Fehler", () => {
    const input = { stratumId: "classicalRoman", terrainId: "fortress", root: "" };
    expect(() => buildPlaceName(input, 1)).not.toThrow();
    expect(buildPlaceName(input, 1).name.length).toBeGreaterThan(0);
  });
  it("behandelt Whitespace-Root wie fehlenden Root", () => {
    const r = buildPlaceName({ stratumId: "desertSemitic", terrainId: "ridge", root: "   " }, 1);
    expect(r.morphemes.length).toBeGreaterThan(0);
    expect(r.name.length).toBeGreaterThan(0);
  });
  it("Bedeutung enthält den Root-Namen", () => {
    const r = buildPlaceName({ stratumId: "angloSaxon", terrainId: "water", root: "Ald" }, 5);
    expect(r.meaning).toContain("Ald");
  });
  it("Bedeutung enthält die Gelände-Bedeutung", () => {
    const terrain = TERRAIN_MORPHEMES.find((t) => t.id === "valley")!;
    const r = buildPlaceName({ stratumId: "angloSaxon", terrainId: "valley", root: "Ald" }, 5);
    expect(r.meaning).toContain(terrain.meaning);
  });
  it("Schichten sind nicht-leere Strings", () => {
    const r = buildPlaceName({ stratumId: "norseGermanic", terrainId: "clearing" }, 9);
    for (const layer of r.layers) expect(layer.length).toBeGreaterThan(0);
  });
  it("enthält zwei bis drei Schichten", () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = buildPlaceName({ stratumId: "norseGermanic", terrainId: "clearing" }, seed);
      expect(r.layers.length).toBeGreaterThanOrEqual(2);
      expect(r.layers.length).toBeLessThanOrEqual(3);
    }
  });
  it("enthält mindestens Grundwort und Morphem", () => {
    const r = buildPlaceName({ stratumId: "celticGaelic", terrainId: "ridge" }, 11);
    expect(r.morphemes.length).toBeGreaterThanOrEqual(2);
  });
  it("wirft bei unbekanntem Sprachstamm", () => {
    expect(() => buildPlaceName({ stratumId: "unknown", terrainId: "ford" }, 1)).toThrow();
  });
  it("wirft bei unbekannter Landschaftsform", () => {
    expect(() => buildPlaceName({ stratumId: "angloSaxon", terrainId: "unknown" }, 1)).toThrow();
  });
  it("Fehlermeldung nennt den unbekannten Sprachstamm", () => {
    expect(() => buildPlaceName({ stratumId: "atlantis", terrainId: "ford" }, 1)).toThrow(/atlantis/);
  });
  it("Fehlermeldung nennt die unbekannte Landschaftsform", () => {
    expect(() => buildPlaceName({ stratumId: "angloSaxon", terrainId: "vulkan" }, 1)).toThrow(/vulkan/);
  });
  it("Name ist ein einzelnes Wort ohne Leerzeichen", () => {
    for (const s of LANGUAGE_STRATA) {
      const r = buildPlaceName({ stratumId: s.id, terrainId: "water" }, 4);
      expect(r.name.includes(" ")).toBe(false);
    }
  });
  it("Name beginnt mit Großbuchstaben", () => {
    for (const s of LANGUAGE_STRATA) {
      const r = buildPlaceName({ stratumId: s.id, terrainId: "fortress" }, 4);
      expect(r.name.charAt(0)).toBe(r.name.charAt(0).toUpperCase());
    }
  });
  it("liefert für jeden Stamm einen nicht-leeren Namen", () => {
    for (const s of LANGUAGE_STRATA) {
      const r = buildPlaceName({ stratumId: s.id, terrainId: "ford" }, 2);
      expect(r.name.length).toBeGreaterThan(0);
    }
  });
  it("Schichten nennen den Sprachstamm", () => {
    const r = buildPlaceName({ stratumId: "desertSemitic", terrainId: "water", root: "Al" }, 6);
    expect(r.layers.join(" ")).toContain("Wüsten-Semitisch");
  });
});

// ---------------------------------------------------------------------------
// simulateSoundShift
// ---------------------------------------------------------------------------
describe("simulateSoundShift", () => {
  it("gibt den Originalnamen unverändert zurück", () => {
    const r = simulateSoundShift({ sourceName: "Aqua Alta", years: 500 }, 1);
    expect(r.original).toBe("Aqua Alta");
  });
  it("liefert einen nicht-leeren Endnamen für nicht-leeren Quellnamen", () => {
    const r = simulateSoundShift({ sourceName: "Grimswick", years: 300 }, 1);
    expect(r.final.length).toBeGreaterThan(0);
  });
  it("liefert eine nicht-leere Beschreibung", () => {
    const r = simulateSoundShift({ sourceName: "Grimswick", years: 300 }, 1);
    expect(r.description.length).toBeGreaterThan(0);
  });
  it("Schritte haben streng aufsteigende Jahreszahlen", () => {
    const r = simulateSoundShift({ sourceName: "Thorsholm", years: 500 }, 1);
    for (let i = 1; i < r.steps.length; i++) {
      expect(r.steps[i].year).toBeGreaterThan(r.steps[i - 1].year);
    }
  });
  it("letzter Schritt endet bei totalYears", () => {
    const r = simulateSoundShift({ sourceName: "Thorsholm", years: 500 }, 1);
    expect(r.steps[r.steps.length - 1].year).toBe(500);
  });
  it("totalYears entspricht der Eingabe", () => {
    expect(simulateSoundShift({ sourceName: "X", years: 700 }, 1).totalYears).toBe(700);
  });
  it("erzeugt eine Stufe je 100 Jahre", () => {
    expect(simulateSoundShift({ sourceName: "Grimswick", years: 500 }, 1).steps).toHaveLength(5);
  });
  it("einzelner Schritt bei 100 Jahren", () => {
    expect(simulateSoundShift({ sourceName: "Grimswick", years: 100 }, 1).steps).toHaveLength(1);
  });
  it("jeder Schritt hat eine Regel-Beschreibung", () => {
    const r = simulateSoundShift({ sourceName: "Castranum", years: 400 }, 1);
    for (const step of r.steps) expect(step.rule.length).toBeGreaterThan(0);
  });
  it("jeder Schritt hat eine nicht-leere Form", () => {
    const r = simulateSoundShift({ sourceName: "Castranum", years: 400 }, 1);
    for (const step of r.steps) expect(step.form.length).toBeGreaterThan(0);
  });
  it("ist deterministisch für gleichen Seed", () => {
    const input = { sourceName: "Dunmore", years: 600, stratumId: "celticGaelic" };
    expect(simulateSoundShift(input, 42)).toEqual(simulateSoundShift(input, 42));
  });
  it("nennt den Sprachstamm in der Beschreibung, wenn gültig", () => {
    const r = simulateSoundShift({ sourceName: "Aqua Alta", years: 500, stratumId: "classicalRoman" }, 42);
    expect(r.description).toContain("Klassisch-Römisch");
  });
  it("wirft nicht bei unbekanntem Sprachstamm", () => {
    expect(() => simulateSoundShift({ sourceName: "Test", years: 200, stratumId: "unknown" }, 1)).not.toThrow();
  });
  it("ohne Sprachstamm keine Stammesnotiz", () => {
    const r = simulateSoundShift({ sourceName: "Test", years: 200 }, 1);
    expect(r.description).not.toContain("Sprachstamm");
  });
  it("Jahre 0 liefert keine Schritte", () => {
    expect(simulateSoundShift({ sourceName: "Aqua", years: 0 }, 1).steps).toHaveLength(0);
  });
  it("Jahre 0 lässt Namen unverändert", () => {
    expect(simulateSoundShift({ sourceName: "Aqua", years: 0 }, 1).final).toBe("Aqua");
  });
  it("Jahre 0 setzt totalYears auf 0", () => {
    expect(simulateSoundShift({ sourceName: "Aqua", years: 0 }, 1).totalYears).toBe(0);
  });
  it("negative Jahre werden auf 0 begrenzt", () => {
    const r = simulateSoundShift({ sourceName: "Aqua", years: -50 }, 1);
    expect(r.totalYears).toBe(0);
    expect(r.steps).toHaveLength(0);
  });
  it("gebrochene Jahre werden abgerundet", () => {
    expect(simulateSoundShift({ sourceName: "Aqua", years: 250.9 }, 1).totalYears).toBe(250);
  });
  it("sehr große Jahre erzeugen viele Schritte", () => {
    const r = simulateSoundShift({ sourceName: "Aqua", years: 10000 }, 1);
    expect(r.steps).toHaveLength(100);
    expect(r.steps[r.steps.length - 1].year).toBe(10000);
  });
  it("leerer Quellname wird zurückgegeben", () => {
    expect(simulateSoundShift({ sourceName: "", years: 300 }, 1).original).toBe("");
  });
  it("leerer Quellname bleibt leer", () => {
    expect(simulateSoundShift({ sourceName: "", years: 300 }, 1).final).toBe("");
  });
  it("verarbeitet Umlaute", () => {
    const r = simulateSoundShift({ sourceName: "Mühlhausen", years: 400 }, 1);
    expect(r.original).toBe("Mühlhausen");
    expect(r.final.length).toBeGreaterThan(0);
  });
  it("Jahreszahlen sind nicht-absteigend über mehrere Eingaben", () => {
    for (const years of [100, 250, 333, 777, 1000]) {
      const r = simulateSoundShift({ sourceName: "Castranum", years }, 3);
      for (let i = 1; i < r.steps.length; i++) {
        expect(r.steps[i].year).toBeGreaterThanOrEqual(r.steps[i - 1].year);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildLayeredToponym
// ---------------------------------------------------------------------------
describe("buildLayeredToponym", () => {
  it("liefert einen nicht-leeren Endnamen", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    expect(r.finalName.length).toBeGreaterThan(0);
  });
  it("liefert eine Schicht je Sprachstamm", () => {
    const r = buildLayeredToponym(
      { baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic", "celticGaelic"] },
      1,
    );
    expect(r.layers).toHaveLength(3);
  });
  it("jede Schicht hat nicht-leeren Stamm", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    for (const l of r.layers) expect(l.stratum.length).toBeGreaterThan(0);
  });
  it("jede Schicht hat nicht-leeren Beitrag", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    for (const l of r.layers) expect(l.contribution.length).toBeGreaterThan(0);
  });
  it("jede Schicht hat nicht-leere Epoche", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    for (const l of r.layers) expect(l.era.length).toBeGreaterThan(0);
  });
  it("liefert eine nicht-leere Beschreibung", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon"] }, 1);
    expect(r.description.length).toBeGreaterThan(0);
  });
  it("ist deterministisch für gleichen Seed", () => {
    const input = { baseName: "Dun", strataIds: ["angloSaxon", "classicalRoman"], eras: [500, 1200] };
    expect(buildLayeredToponym(input, 42)).toEqual(buildLayeredToponym(input, 42));
  });
  it("nutzt Standard-Stamm bei leerer Stammesliste", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: [] }, 1);
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0].stratum).toBe("Klassisch-Römisch");
  });
  it("verwendet übergebene Epochen als Jahresangabe", () => {
    const r = buildLayeredToponym(
      { baseName: "Dun", strataIds: ["angloSaxon", "classicalRoman"], eras: [500, 1200] },
      1,
    );
    expect(r.layers[0].era).toBe("um 500");
    expect(r.layers[1].era).toBe("um 1200");
  });
  it("nummeriert Epochen ohne Angabe fortlaufend", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    expect(r.layers[0].era).toBe("Epoche 1");
    expect(r.layers[1].era).toBe("Epoche 2");
  });
  it("behandelt unbekannten Stamm ohne Wurf", () => {
    expect(() => buildLayeredToponym({ baseName: "Dun", strataIds: ["unknown"] }, 1)).not.toThrow();
  });
  it("markiert unbekannten Stamm als ohne Beitrag", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["unknown"] }, 1);
    expect(r.layers[0].contribution).toContain("Unbekannter Sprachstamm");
    expect(r.layers[0].stratum).toBe("unknown");
  });
  it("Endname ist mindestens so lang wie der Basisname", () => {
    for (const s of LANGUAGE_STRATA) {
      const r = buildLayeredToponym({ baseName: "Dun", strataIds: [s.id] }, 2);
      expect(r.finalName.length).toBeGreaterThanOrEqual("Dun".length);
    }
  });
  it("Beitrag nennt Präfix oder Suffix", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon"] }, 3);
    expect(r.layers[0].contribution).toMatch(/Präfix|Suffix/);
  });
  it("funktioniert für jeden Sprachstamm", () => {
    for (const s of LANGUAGE_STRATA) {
      const r = buildLayeredToponym({ baseName: "Base", strataIds: [s.id] }, 5);
      expect(r.layers).toHaveLength(1);
      expect(r.layers[0].stratum).toBe(s.name);
    }
  });
  it("behandelt leeren Basisnamen", () => {
    const r = buildLayeredToponym({ baseName: "", strataIds: ["angloSaxon"] }, 1);
    expect(r.finalName.length).toBeGreaterThan(0);
  });
  it("gemischte gültige und ungültige Stämme", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "unknown", "norseGermanic"] }, 1);
    expect(r.layers).toHaveLength(3);
    expect(r.layers[1].stratum).toBe("unknown");
  });
  it("Epochenarray kürzer als Stämme wird fortlaufend ergänzt", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"], eras: [800] }, 1);
    expect(r.layers[0].era).toBe("um 800");
    expect(r.layers[1].era).toBe("Epoche 2");
  });
  it("Beschreibung nennt die Anzahl der Sprachstufen", () => {
    const r = buildLayeredToponym({ baseName: "Dun", strataIds: ["angloSaxon", "norseGermanic"] }, 1);
    expect(r.description).toContain("2");
  });
});

// ---------------------------------------------------------------------------
// Beispiele
// ---------------------------------------------------------------------------
describe("createSamplePlaceName", () => {
  it("liefert ein gültiges Ergebnis", () => {
    const r = createSamplePlaceName();
    expect(r.name.length).toBeGreaterThan(0);
    expect(r.morphemes.length).toBeGreaterThan(0);
    expect(r.meaning.length).toBeGreaterThan(0);
    expect(r.layers.length).toBeGreaterThan(0);
  });
  it("ist deterministisch", () => {
    expect(createSamplePlaceName()).toEqual(createSamplePlaceName());
  });
  it("nutzt den angelsächsischen Stamm", () => {
    expect(createSamplePlaceName().stratum).toBe("Angelsächsisch");
  });
  it("nutzt die Furten-Landschaft", () => {
    expect(createSamplePlaceName().terrain).toBe("Furten");
  });
});

describe("createSampleSoundShift", () => {
  it("liefert ein gültiges Ergebnis", () => {
    const r = createSampleSoundShift();
    expect(r.original).toBe("Aqua Alta");
    expect(r.final.length).toBeGreaterThan(0);
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.description.length).toBeGreaterThan(0);
  });
  it("ist deterministisch", () => {
    expect(createSampleSoundShift()).toEqual(createSampleSoundShift());
  });
  it("umfasst 500 Jahre", () => {
    expect(createSampleSoundShift().totalYears).toBe(500);
  });
  it("hat fünf Schritte", () => {
    expect(createSampleSoundShift().steps).toHaveLength(5);
  });
});
