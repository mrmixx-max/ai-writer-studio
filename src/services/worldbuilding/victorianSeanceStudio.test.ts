// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  SEANCE_APPARATUS,
  getSeanceApparatus,
  generateSupernaturalPhenomena,
  generateSpiritWriting,
  createSeanceSession,
  createSampleSeanceSession,
  createSampleSpiritMessage,
} from "./victorianSeanceStudio";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("Planchette")).toBe(hashString("Planchette"));
    expect(hashString("phenomena:42")).toBe(hashString("phenomena:42"));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("planchette")).not.toBe(hashString("slateWriting"));
    expect(hashString("spirit:42")).not.toBe(hashString("spirit:43"));
  });

  it("liefert eine nicht-negative 32-Bit-Ganzzahl", () => {
    const h = hashString("Geistertuba");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("behandelt den leeren String ohne Fehler", () => {
    expect(typeof hashString("")).toBe("number");
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) expect(r1()).toBe(r2());
  });

  it("liefert unterschiedliche Sequenzen für unterschiedliche Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(3);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("SEANCE_APPARATUS", () => {
  it("enthält vier Apparaturen", () => {
    expect(SEANCE_APPARATUS).toHaveLength(4);
  });

  it("enthält genau die erwarteten Apparatur-IDs", () => {
    const ids = SEANCE_APPARATUS.map((a) => a.id).sort();
    expect(ids).toEqual([
      "planchette",
      "slateWriting",
      "spiritTrumpet",
      "tranceState",
    ]);
  });

  it("jede Apparatur besitzt die vollständige Struktur", () => {
    for (const app of SEANCE_APPARATUS) {
      expect(typeof app.id).toBe("string");
      expect(app.id.length).toBeGreaterThan(0);
      expect(typeof app.name).toBe("string");
      expect(app.name.length).toBeGreaterThan(0);
      expect(typeof app.description).toBe("string");
      expect(app.description.length).toBeGreaterThan(0);
      expect(app.era).toBe("victorian");
      expect(typeof app.authenticity).toBe("number");
    }
  });

  it("jede Apparatur hat eine plausible authenticity zwischen 0 und 1", () => {
    for (const app of SEANCE_APPARATUS) {
      expect(app.authenticity).toBeGreaterThanOrEqual(0);
      expect(app.authenticity).toBeLessThanOrEqual(1);
    }
  });

  it("Apparatur-IDs sind eindeutig", () => {
    const ids = SEANCE_APPARATUS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getSeanceApparatus", () => {
  it("findet einen Apparat per ID", () => {
    const planchette = getSeanceApparatus("planchette");
    expect(planchette).toBeDefined();
    expect(planchette!.id).toBe("planchette");
    expect(planchette!.name.length).toBeGreaterThan(0);
  });

  it("findet jede der vier Apparaturen", () => {
    for (const app of SEANCE_APPARATUS) {
      expect(getSeanceApparatus(app.id)).toEqual(app);
    }
  });

  it("liefert undefined für eine unbekannte ID", () => {
    expect(getSeanceApparatus("ouija" as never)).toBeUndefined();
    expect(getSeanceApparatus("" as never)).toBeUndefined();
  });
});

describe("generateSupernaturalPhenomena", () => {
  it("liefert ein phenomena-Array mit zwei bis vier Einträgen", () => {
    const result = generateSupernaturalPhenomena(42);
    expect(Array.isArray(result.phenomena)).toBe(true);
    expect(result.phenomena.length).toBeGreaterThanOrEqual(2);
    expect(result.phenomena.length).toBeLessThanOrEqual(4);
  });

  it("jedes Phänomen besitzt type, description und intensity", () => {
    const result = generateSupernaturalPhenomena(7);
    for (const p of result.phenomena) {
      expect([
        "coldSpot",
        "gasLampFlicker",
        "wallKnocking",
        "temperatureDrop",
      ]).toContain(p.type);
      expect(typeof p.description).toBe("string");
      expect(p.description.length).toBeGreaterThan(0);
      expect(typeof p.intensity).toBe("number");
      expect(p.intensity).toBeGreaterThanOrEqual(1);
      expect(p.intensity).toBeLessThanOrEqual(10);
    }
  });

  it("enthält keine doppelten Phänomen-Arten", () => {
    const result = generateSupernaturalPhenomena(13);
    const types = result.phenomena.map((p) => p.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("liefert eine nicht-leere summary als String", () => {
    const result = generateSupernaturalPhenomena(42);
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Phänomene");
  });

  it("ist deterministisch für gleichen Seed", () => {
    expect(generateSupernaturalPhenomena(42)).toEqual(
      generateSupernaturalPhenomena(42)
    );
  });
});

describe("generateSpiritWriting", () => {
  it("liefert message, language, translation und urgency", () => {
    const result = generateSpiritWriting(42);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.language).toBe("archaic");
    expect(typeof result.translation).toBe("string");
    expect(result.translation.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(result.urgency);
  });

  it("ist deterministisch für gleichen Seed", () => {
    expect(generateSpiritWriting(42)).toEqual(generateSpiritWriting(42));
  });

  it("liefert für verschiedene Seeds gültige Botschaften", () => {
    for (const seed of [0, 1, 7, 99, 12345]) {
      const result = generateSpiritWriting(seed);
      expect(result.language).toBe("archaic");
      expect(["low", "medium", "high"]).toContain(result.urgency);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe("createSeanceSession", () => {
  it("liefert eine gültige Session mit allen Feldern", () => {
    const session = createSeanceSession(["planchette", "tranceState"], 42);
    expect(typeof session.id).toBe("string");
    expect(session.id.length).toBeGreaterThan(0);
    expect(Array.isArray(session.apparatus)).toBe(true);
    expect(Array.isArray(session.phenomena)).toBe(true);
    expect(typeof session.summary).toBe("string");
    expect(session.summary.length).toBeGreaterThan(0);
    expect(typeof session.spiritMessage).toBe("object");
  });

  it("bildet die angeforderten Apparaturen ab", () => {
    const session = createSeanceSession(["planchette", "spiritTrumpet"], 42);
    expect(session.apparatus.map((a) => a.id)).toEqual([
      "planchette",
      "spiritTrumpet",
    ]);
  });

  it("ignoriert unbekannte Apparatur-IDs", () => {
    const session = createSeanceSession(["planchette", "ouija" as never], 42);
    expect(session.apparatus.map((a) => a.id)).toEqual(["planchette"]);
  });

  it("id beginnt mit SEANCE-", () => {
    const session = createSeanceSession(["planchette"], 42);
    expect(session.id.startsWith("SEANCE-")).toBe(true);
  });

  it("ist deterministisch für gleiche Apparaturen und gleichen Seed", () => {
    const a = createSeanceSession(["planchette", "tranceState"], 42);
    const b = createSeanceSession(["planchette", "tranceState"], 42);
    expect(a).toEqual(b);
  });
});

describe("createSampleSeanceSession", () => {
  it("liefert eine gültige Session", () => {
    const session = createSampleSeanceSession();
    expect(session).toBeDefined();
    expect(session.id.startsWith("SEANCE-")).toBe(true);
    expect(session.apparatus.length).toBeGreaterThan(0);
    expect(session.phenomena.length).toBeGreaterThanOrEqual(2);
    expect(session.summary.length).toBeGreaterThan(0);
    expect(session.spiritMessage.language).toBe("archaic");
  });

  it("ist deterministisch", () => {
    expect(createSampleSeanceSession()).toEqual(createSampleSeanceSession());
  });
});

describe("createSampleSpiritMessage", () => {
  it("liefert eine gültige Botschaft", () => {
    const result = createSampleSpiritMessage();
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.language).toBe("archaic");
    expect(result.translation.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(result.urgency);
  });

  it("ist deterministisch", () => {
    expect(createSampleSpiritMessage()).toEqual(createSampleSpiritMessage());
  });
});
