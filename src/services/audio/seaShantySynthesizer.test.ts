// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SHANTY_GENRES,
  getShantyGenre,
  generateShanty,
  buildShantyAudioPatch,
  analyzeShanty,
  createSampleShanty,
  createSampleShantyReport,
  MAJOR_SCALE,
  MINOR_SCALE,
} from "./seaShantySynthesizer";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(9);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("SHANTY_GENRES", () => {
  it("enthält drei Shanty-Gattungen", () => {
    expect(SHANTY_GENRES).toHaveLength(3);
  });
  it("Halyard akzentuiert die Zählzeiten 2 und 4", () => {
    expect(getShantyGenre("halyard")!.accentBeats).toEqual([2, 4]);
  });
  it("Capstan akzentuiert die Zählzeiten 1 und 3", () => {
    expect(getShantyGenre("capstan")!.accentBeats).toEqual([1, 3]);
  });
  it("Walfänger-Ballade steht im Moll und 3/4-Takt", () => {
    const w = getShantyGenre("whaling")!;
    expect(w.mode).toBe("moll");
    expect(w.timeSignature).toBe("3/4");
  });
  it("getShantyGenre liefert undefined für unbekannt", () => {
    expect(getShantyGenre("xyz" as never)).toBeUndefined();
  });
});

describe("generateShanty", () => {
  it("ist deterministisch", () => {
    expect(generateShanty("halyard", 4, 42).id).toBe(generateShanty("halyard", 4, 42).id);
  });
  it("erzeugt die angeforderte Verszahl", () => {
    expect(generateShanty("capstan", 4, 42).verses).toHaveLength(4);
  });
  it("jeder Vers hat Vorsänger, Kehrreim und Fachbegriff", () => {
    for (const v of generateShanty("whaling", 3, 5).verses) {
      expect(v.shantyman.length).toBeGreaterThan(0);
      expect(v.chorus.length).toBeGreaterThan(0);
      expect(v.term.length).toBeGreaterThan(0);
    }
  });
  it("keine doppelten Kehrreime", () => {
    const s = generateShanty("halyard", 4, 9);
    const choruses = s.verses.map((v) => v.chorus);
    expect(new Set(choruses).size).toBe(choruses.length);
  });
  it("Akzentschema entspricht den betonten Zählzeiten", () => {
    const s = generateShanty("halyard", 2, 42);
    // 4/4-Takt mit Akzenten auf 2 und 4 => [0, 1, 0, 1]
    expect(s.accentPattern).toEqual([0, 1, 0, 1]);
  });
  it("Capstan-Akzentschema ist [1, 0, 1, 0]", () => {
    expect(generateShanty("capstan", 2, 42).accentPattern).toEqual([1, 0, 1, 0]);
  });
  it("Walfänger-Takt hat drei Schläge", () => {
    expect(generateShanty("whaling", 2, 42).accentPattern).toHaveLength(3);
  });
  it("Tempo bestimmt die Schlagdauer", () => {
    const s = generateShanty("whaling", 2, 42);
    expect(s.beatMs).toBeCloseTo(60000 / 60, 1);
  });
  it("begrenzt auf die Poolgröße", () => {
    expect(generateShanty("halyard", 999, 1).verses.length).toBeLessThanOrEqual(8);
  });
  it("unbekannte Gattung fällt auf die erste zurück", () => {
    expect(generateShanty("xyz" as never, 2, 1).genre.id).toBe("halyard");
  });
});

describe("buildShantyAudioPatch", () => {
  it("Dur-Shanties nutzen die Dur-Tonleiter", () => {
    const p = buildShantyAudioPatch(generateShanty("halyard", 2, 42));
    expect(p.scaleIntervals).toEqual([...MAJOR_SCALE]);
  });
  it("Walfänger-Ballade nutzt die Moll-Tonleiter", () => {
    const p = buildShantyAudioPatch(generateShanty("whaling", 2, 42));
    expect(p.scaleIntervals).toEqual([...MINOR_SCALE]);
  });
  it("Capstan hat die tiefste Klickfrequenz", () => {
    const capstan = buildShantyAudioPatch(generateShanty("capstan", 2, 42)).clickFrequencyHz;
    const halyard = buildShantyAudioPatch(generateShanty("halyard", 2, 42)).clickFrequencyHz;
    expect(capstan).toBeLessThan(halyard);
  });
  it("Chor- und Vorsänger-Pegel bleiben im Bereich 0..1", () => {
    for (const g of SHANTY_GENRES) {
      const p = buildShantyAudioPatch(generateShanty(g.id, 2, 42));
      expect(p.chorusGain).toBeGreaterThanOrEqual(0);
      expect(p.chorusGain).toBeLessThanOrEqual(1);
      expect(p.shantymanGain).toBeGreaterThanOrEqual(0);
      expect(p.shantymanGain).toBeLessThanOrEqual(1);
    }
  });
  it("Anweisung nennt Taktart und Tempo", () => {
    const p = buildShantyAudioPatch(generateShanty("halyard", 2, 42));
    expect(p.instruction).toContain("4/4");
    expect(p.instruction).toContain("96");
  });
  it("ist deterministisch", () => {
    const s = generateShanty("capstan", 2, 42);
    expect(buildShantyAudioPatch(s).instruction).toBe(buildShantyAudioPatch(s).instruction);
  });
});

describe("analyzeShanty", () => {
  it("ist deterministisch", () => {
    expect(analyzeShanty("halyard", 4, 42).id).toBe(analyzeShanty("halyard", 4, 42).id);
  });
  it("enthält Shanty, Patch und Verszahl", () => {
    const r = analyzeShanty("capstan", 4, 42);
    expect(r.shanty.genre.id).toBe("capstan");
    expect(r.verseCount).toBe(4);
    expect(r.patch.tempoBpm).toBe(72);
  });
  it("zählt die Gesamtschläge", () => {
    const r = analyzeShanty("halyard", 4, 42);
    // 4/4 × 4 Takte × 4 Verse = 64 Schläge
    expect(r.totalBeats).toBe(64);
  });
});

describe("Tonleitern", () => {
  it("Dur-Tonleiter hat 7 Intervalle", () => {
    expect(MAJOR_SCALE).toHaveLength(7);
  });
  it("Moll-Tonleiter hat eine kleine Terz", () => {
    expect(MINOR_SCALE[2]).toBe(3);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleShanty liefert ein Halyard Shanty", () => {
    expect(createSampleShanty().genre.id).toBe("halyard");
  });
  it("createSampleShantyReport liefert ein Capstan-Shanty", () => {
    expect(createSampleShantyReport().shanty.genre.id).toBe("capstan");
  });
});
