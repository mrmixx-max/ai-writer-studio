// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  HAUNTED_ROOM_ZONES,
  getHauntedZone,
  detectArchitecturalAnomalies,
  generateDecayProse,
  createSampleHauntedZone,
  createSampleAnomalies,
} from "./hauntedArchitectureEngine";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("Spukhaus")).toBe(hashString("Spukhaus"));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("crypt")).not.toBe(hashString("attic"));
    expect(hashString("anomaly:crypt:42")).not.toBe(hashString("anomaly:attic:42"));
  });

  it("liefert eine nicht-negative 32-Bit-Ganzzahl", () => {
    const h = hashString("Modrige Krypta");
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

describe("HAUNTED_ROOM_ZONES", () => {
  it("enthält vier gotische Raumzonen", () => {
    expect(HAUNTED_ROOM_ZONES).toHaveLength(4);
  });

  it("enthält genau die erwarteten Zonen-IDs", () => {
    const ids = HAUNTED_ROOM_ZONES.map((z) => z.id).sort();
    expect(ids).toEqual(["ancestralGallery", "attic", "crypt", "servantPassage"]);
  });

  it("jede Zone besitzt die vollständige Struktur", () => {
    for (const zone of HAUNTED_ROOM_ZONES) {
      expect(typeof zone.id).toBe("string");
      expect(zone.id.length).toBeGreaterThan(0);
      expect(typeof zone.name).toBe("string");
      expect(zone.name.length).toBeGreaterThan(0);
      expect(typeof zone.description).toBe("string");
      expect(zone.description.length).toBeGreaterThan(0);
      expect(typeof zone.atmosphere).toBe("string");
      expect(zone.atmosphere.length).toBeGreaterThan(0);
      expect(Array.isArray(zone.features)).toBe(true);
      expect(zone.features.length).toBeGreaterThan(0);
      for (const f of zone.features) {
        expect(typeof f).toBe("string");
        expect(f.length).toBeGreaterThan(0);
      }
    }
  });

  it("jede Zone hat einen plausiblen dangerLevel zwischen 1 und 10", () => {
    for (const zone of HAUNTED_ROOM_ZONES) {
      expect(typeof zone.dangerLevel).toBe("number");
      expect(zone.dangerLevel).toBeGreaterThanOrEqual(1);
      expect(zone.dangerLevel).toBeLessThanOrEqual(10);
    }
  });

  it("Zonen-IDs sind eindeutig", () => {
    const ids = HAUNTED_ROOM_ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getHauntedZone", () => {
  it("findet eine Zone per ID", () => {
    const crypt = getHauntedZone("crypt");
    expect(crypt).toBeDefined();
    expect(crypt!.id).toBe("crypt");
    expect(crypt!.name.length).toBeGreaterThan(0);
  });

  it("findet jede der vier Zonen", () => {
    for (const zone of HAUNTED_ROOM_ZONES) {
      expect(getHauntedZone(zone.id)).toEqual(zone);
    }
  });

  it("liefert undefined für eine unbekannte ID", () => {
    expect(getHauntedZone("cellar" as never)).toBeUndefined();
    expect(getHauntedZone("" as never)).toBeUndefined();
  });
});

describe("detectArchitecturalAnomalies", () => {
  it("liefert ein anomalies-Array mit mindestens zwei Einträgen", () => {
    const result = detectArchitecturalAnomalies("crypt", 42);
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(result.anomalies.length).toBeGreaterThanOrEqual(2);
    expect(result.anomalies.length).toBeLessThanOrEqual(5);
  });

  it("alle Anomalien sind nicht-leere Strings", () => {
    const result = detectArchitecturalAnomalies("attic", 7);
    for (const a of result.anomalies) {
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(0);
    }
  });

  it("enthält keine doppelten Anomalien", () => {
    const result = detectArchitecturalAnomalies("ancestralGallery", 13);
    expect(new Set(result.anomalies).size).toBe(result.anomalies.length);
  });

  it("severity ist einer der vier erlaubten Werte", () => {
    const allowed = ["low", "medium", "high", "extreme"];
    for (const zone of HAUNTED_ROOM_ZONES) {
      const result = detectArchitecturalAnomalies(zone.id, 99);
      expect(allowed).toContain(result.severity);
    }
  });

  it("description ist ein nicht-leerer String und nennt die Schwere", () => {
    const result = detectArchitecturalAnomalies("crypt", 42);
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
    expect(result.description).toContain(result.severity);
  });

  it("ist deterministisch für gleiche Zone und gleichen Seed", () => {
    const a = detectArchitecturalAnomalies("crypt", 42);
    const b = detectArchitecturalAnomalies("crypt", 42);
    expect(a).toEqual(b);
  });

  it("akzeptiert auch unbekannte Zonen-IDs ohne zu werfen", () => {
    const result = detectArchitecturalAnomalies("unknown", 5);
    expect(result.anomalies.length).toBeGreaterThanOrEqual(2);
    expect(["low", "medium", "high", "extreme"]).toContain(result.severity);
  });
});

describe("generateDecayProse", () => {
  it("liefert einen nicht-leeren String", () => {
    const prose = generateDecayProse("crypt", 42);
    expect(typeof prose).toBe("string");
    expect(prose.length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleiche Zone und gleichen Seed", () => {
    expect(generateDecayProse("attic", 42)).toBe(generateDecayProse("attic", 42));
    expect(generateDecayProse("crypt", 1)).toBe(generateDecayProse("crypt", 1));
  });

  it("liefert für alle vier Zonen gültige Prosa", () => {
    for (const zone of HAUNTED_ROOM_ZONES) {
      const prose = generateDecayProse(zone.id, 3);
      expect(prose.length).toBeGreaterThan(0);
    }
  });
});

describe("createSampleHauntedZone", () => {
  it("liefert eine gültige Zone", () => {
    const zone = createSampleHauntedZone();
    expect(zone).toBeDefined();
    expect(typeof zone.id).toBe("string");
    expect(zone.name.length).toBeGreaterThan(0);
    expect(zone.description.length).toBeGreaterThan(0);
    expect(zone.atmosphere.length).toBeGreaterThan(0);
    expect(zone.features.length).toBeGreaterThan(0);
    expect(zone.dangerLevel).toBeGreaterThanOrEqual(1);
    expect(zone.dangerLevel).toBeLessThanOrEqual(10);
  });

  it("entspricht einer der definierten Zonen", () => {
    const zone = createSampleHauntedZone();
    expect(HAUNTED_ROOM_ZONES).toContain(zone);
  });
});

describe("createSampleAnomalies", () => {
  it("liefert ein gültiges Anomalie-Ergebnis", () => {
    const result = createSampleAnomalies();
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(result.anomalies.length).toBeGreaterThanOrEqual(2);
    expect(["low", "medium", "high", "extreme"]).toContain(result.severity);
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(createSampleAnomalies()).toEqual(createSampleAnomalies());
  });
});
