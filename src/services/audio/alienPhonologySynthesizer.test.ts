// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  VOCAL_APPARATUS,
  getVocalApparatus,
  getPhonemeBank,
  generateAlienWord,
  buildLexicon,
  synthesizeUtterance,
  buildWebAudioPatch,
  analyzePhonology,
  createSamplePhonologyReport,
} from "./alienPhonologySynthesizer";

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
    const r = createSeededRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("VOCAL_APPARATUS", () => {
  it("enthält drei Lautapparate", () => {
    expect(VOCAL_APPARATUS).toHaveLength(3);
  });
  it("Insektoid nutzt Rechteck-Oszillator", () => {
    expect(getVocalApparatus("insectoid")?.oscillator).toBe("square");
  });
  it("Hydro-Akustik nutzt Sinus", () => {
    expect(getVocalApparatus("hydroAcoustic")?.oscillator).toBe("sine");
  });
  it("Kristallin nutzt Dreieck", () => {
    expect(getVocalApparatus("crystalline")?.oscillator).toBe("triangle");
  });
  it("jeder Apparat nennt einen Mechanismus", () => {
    for (const a of VOCAL_APPARATUS) {
      expect(a.mechanism.length).toBeGreaterThan(0);
      expect(a.baseFrequencyHz).toBeGreaterThan(0);
    }
  });
  it("getVocalApparatus liefert undefined für unbekannt", () => {
    expect(getVocalApparatus("xyz" as never)).toBeUndefined();
  });
});

describe("getPhonemeBank", () => {
  it("liefert einen nicht-leeren Vorrat", () => {
    for (const a of VOCAL_APPARATUS) {
      expect(getPhonemeBank(a.id).length).toBeGreaterThan(0);
    }
  });
  it("Vorräte unterscheiden sich je Apparat", () => {
    expect(getPhonemeBank("insectoid")).not.toEqual(getPhonemeBank("crystalline"));
  });
  it("liefert eine Kopie, nicht die Originalreferenz", () => {
    const a = getPhonemeBank("insectoid");
    const b = getPhonemeBank("insectoid");
    expect(a).toEqual(b);
    a.push("MUTATION");
    expect(getPhonemeBank("insectoid")).not.toContain("MUTATION");
  });
});

describe("generateAlienWord", () => {
  it("ist deterministisch", () => {
    expect(generateAlienWord("insectoid", 0, 42).native).toBe(generateAlienWord("insectoid", 0, 42).native);
  });
  it("verschiedene Seeds erzeugen verschiedene Wörter", () => {
    expect(generateAlienWord("insectoid", 0, 1).native).not.toBe(generateAlienWord("insectoid", 0, 2).native);
  });
  it("hat native Form, Translation und Betonung", () => {
    const w = generateAlienWord("hydroAcoustic", 3, 42);
    expect(w.native.length).toBeGreaterThan(0);
    expect(w.translation.length).toBeGreaterThan(0);
    expect(w.stress.length).toBeGreaterThan(0);
  });
  it("Betonung ist Großschreibung der nativen Form", () => {
    const w = generateAlienWord("crystalline", 5, 42);
    expect(w.stress.toUpperCase()).toBe(w.stress);
  });
  it("nutzt die Konzepte des Pools zyklisch", () => {
    const w1 = generateAlienWord("insectoid", 0, 42);
    const w2 = generateAlienWord("insectoid", 12, 42);
    expect(w1.translation).toBe(w2.translation);
  });
});

describe("buildLexicon", () => {
  it("erzeugt die angeforderte Wortzahl", () => {
    expect(buildLexicon("insectoid", 8, 42).words).toHaveLength(8);
  });
  it("begrenzt auf Poolgröße", () => {
    expect(buildLexicon("insectoid", 999, 42).words.length).toBeLessThanOrEqual(12);
  });
  it("ist deterministisch", () => {
    expect(buildLexicon("hydroAcoustic", 5, 7).words.map((w) => w.native)).toEqual(
      buildLexicon("hydroAcoustic", 5, 7).words.map((w) => w.native)
    );
  });
  it("trägt den Lautapparat", () => {
    expect(buildLexicon("crystalline", 3, 42).apparatus.id).toBe("crystalline");
  });
  it("unbekannter Apparat fällt auf den ersten zurück", () => {
    expect(buildLexicon("xyz" as never, 3, 42).apparatus.id).toBe("insectoid");
  });
});

describe("synthesizeUtterance", () => {
  it("ist deterministisch", () => {
    expect(synthesizeUtterance("insectoid", [0, 3, 9], 42).nativeText).toBe(
      synthesizeUtterance("insectoid", [0, 3, 9], 42).nativeText
    );
  });
  it("erzeugt native Text und Translation", () => {
    const u = synthesizeUtterance("hydroAcoustic", [0, 1], 42);
    expect(u.nativeText).toContain("…");
    expect(u.translation).toContain(";");
    expect(u.wordCount).toBe(2);
  });
  it("Prosodiekurve hat einen Wert je Wort im Bereich 0..1", () => {
    const u = synthesizeUtterance("crystalline", [0, 1, 2, 3], 42);
    expect(u.prosody).toHaveLength(4);
    for (const p of u.prosody) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
  it("leere Konzepte liefern leere Äußerung", () => {
    expect(synthesizeUtterance("insectoid", [], 42).wordCount).toBe(0);
  });
});

describe("buildWebAudioPatch", () => {
  it("ist deterministisch", () => {
    expect(buildWebAudioPatch("insectoid", 3, 42).fmIndex).toBe(buildWebAudioPatch("insectoid", 3, 42).fmIndex);
  });
  it("Kristallin hat den höchsten FM-Index", () => {
    const c = buildWebAudioPatch("crystalline", 3, 42).fmIndex;
    const h = buildWebAudioPatch("hydroAcoustic", 3, 42).fmIndex;
    expect(c).toBeGreaterThan(h);
  });
  it("Hydro-Akustik hat den höchsten Infraschall-Anteil", () => {
    const h = buildWebAudioPatch("hydroAcoustic", 3, 42).infrasoundMix;
    const i = buildWebAudioPatch("insectoid", 3, 42).infrasoundMix;
    expect(h).toBeGreaterThan(i);
  });
  it("erzeugt eine lesbare Synthese-Anweisung", () => {
    const p = buildWebAudioPatch("insectoid", 3, 42);
    expect(p.instruction).toContain("Hz");
    expect(p.durationSeconds).toBeGreaterThan(0);
  });
  it("Infraschall bleibt im Bereich 0..1", () => {
    for (const a of VOCAL_APPARATUS) {
      const p = buildWebAudioPatch(a.id, 3, 42);
      expect(p.infrasoundMix).toBeGreaterThanOrEqual(0);
      expect(p.infrasoundMix).toBeLessThanOrEqual(1);
    }
  });
});

describe("analyzePhonology", () => {
  it("ist deterministisch", () => {
    expect(analyzePhonology("insectoid", [0, 3], 42).id).toBe(analyzePhonology("insectoid", [0, 3], 42).id);
  });
  it("enthält Lexikon, Äußerung und Patch", () => {
    const r = analyzePhonology("crystalline", [0, 1, 2], 42);
    expect(r.apparatus.id).toBe("crystalline");
    expect(r.lexicon.words.length).toBe(8);
    expect(r.utterance.wordCount).toBe(3);
    expect(r.patch.oscillator).toBe("triangle");
  });
  it("unbekannter Apparat fällt auf den ersten zurück", () => {
    expect(analyzePhonology("xyz" as never, [0], 42).apparatus.id).toBe("insectoid");
  });
});

describe("createSamplePhonologyReport", () => {
  it("erzeugt einen insektoiden Beispielbericht", () => {
    const r = createSamplePhonologyReport();
    expect(r.apparatus.id).toBe("insectoid");
    expect(r.utterance.wordCount).toBe(4);
  });
});
