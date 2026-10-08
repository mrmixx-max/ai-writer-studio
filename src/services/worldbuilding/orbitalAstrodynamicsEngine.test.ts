// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  CELESTIAL_BODIES,
  getCelestialBody,
  radioDelayMinutes,
  radioDelaySeconds,
  calculateFlight,
  generateCockpitLog,
  createFlightPlan,
  createSampleFlightPlan,
} from "./orbitalAstrodynamicsEngine";

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
    const r = createSeededRandom(23);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("CELESTIAL_BODIES", () => {
  it("enthält sechs Himmelskörper", () => {
    expect(CELESTIAL_BODIES).toHaveLength(6);
  });
  it("Erde hat null Lichtlaufzeit", () => {
    expect(getCelestialBody("earth")!.lightTimeMinutes).toBe(0);
  });
  it("Mars hat ~12,5 Minuten Lichtlaufzeit", () => {
    expect(getCelestialBody("mars")!.lightTimeMinutes).toBe(12.5);
  });
  it("Saturn hat die längste Lichtlaufzeit", () => {
    const saturn = getCelestialBody("saturn")!;
    for (const b of CELESTIAL_BODIES) {
      if (b.id !== "saturn") expect(saturn.lightTimeMinutes).toBeGreaterThanOrEqual(b.lightTimeMinutes);
    }
  });
  it("getCelestialBody liefert undefined für unbekannt", () => {
    expect(getCelestialBody("xyz" as never)).toBeUndefined();
  });
});

describe("radioDelayMinutes", () => {
  it("Erde zu Erde ist 0", () => {
    expect(radioDelayMinutes("earth", "earth")).toBe(0);
  });
  it("Erde zu Mond ~0,02 Minuten (1,28 Sekunden)", () => {
    expect(radioDelayMinutes("earth", "moon")).toBeCloseTo(0.02, 1);
  });
  it("Erde zu Mars ~12,5 Minuten", () => {
    expect(radioDelayMinutes("earth", "mars")).toBeCloseTo(12.5, 1);
  });
  it("ist symmetrisch", () => {
    expect(radioDelayMinutes("earth", "mars")).toBe(radioDelayMinutes("mars", "earth"));
  });
});

describe("radioDelaySeconds", () => {
  it("Erde zu Mond ~1,28 Sekunden", () => {
    expect(radioDelaySeconds("earth", "moon")).toBeCloseTo(1, 0);
  });
  it("ist 60x der Minutenwert", () => {
    expect(radioDelaySeconds("earth", "mars")).toBeCloseTo(radioDelayMinutes("earth", "mars") * 60, 0);
  });
});

describe("calculateFlight", () => {
  it("Brachistochron hat künstliche Schwerkraft", () => {
    const f = calculateFlight("earth", "mars", "brachistochrone");
    expect(f.artificialGravity).toBe(1);
  });
  it("Hohmann hat keine künstliche Schwerkraft", () => {
    const f = calculateFlight("earth", "mars", "hohmann");
    expect(f.artificialGravity).toBe(0);
  });
  it("Brachistochron ist schneller als Hohmann", () => {
    const b = calculateFlight("earth", "mars", "brachistochrone");
    const h = calculateFlight("earth", "mars", "hohmann");
    expect(b.flightTimeHours).toBeLessThan(h.flightTimeHours);
  });
  it("Hohmann verbraucht weniger Treibstoff", () => {
    const b = calculateFlight("earth", "mars", "brachistochrone");
    const h = calculateFlight("earth", "mars", "hohmann");
    expect(h.fuelTons).toBeLessThan(b.fuelTons);
  });
  it("Delta-v ist positiv", () => {
    expect(calculateFlight("earth", "mars", "brachistochrone").deltaV).toBeGreaterThan(0);
    expect(calculateFlight("earth", "mars", "hohmann").deltaV).toBeGreaterThan(0);
  });
  it("Flugzeit ist positiv", () => {
    expect(calculateFlight("earth", "mars", "brachistochrone").flightTimeHours).toBeGreaterThan(0);
  });
  it("unbekanntes Profil fällt auf Hohmann zurück", () => {
    expect(calculateFlight("earth", "mars", "xyz" as never).id).toBe("hohmann");
  });
});

describe("generateCockpitLog", () => {
  it("ist deterministisch", () => {
    expect(generateCockpitLog(5, 42)[0].message).toBe(generateCockpitLog(5, 42)[0].message);
  });
  it("erzeugt die angeforderte Anzahl Einträge", () => {
    expect(generateCockpitLog(5, 42)).toHaveLength(5);
  });
  it("jeder Eintrags hat Zeitstempel, Meldung und Typ", () => {
    for (const e of generateCockpitLog(5, 42)) {
      expect(e.timestamp.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
      expect(["info", "warning", "critical"]).toContain(e.type);
    }
  });
  it("begrenzt auf 20 Einträge", () => {
    expect(generateCockpitLog(999, 42).length).toBeLessThanOrEqual(20);
  });
});

describe("createFlightPlan", () => {
  it("ist deterministisch", () => {
    expect(createFlightPlan("earth", "mars", "brachistochrone", 10, 42).id).toBe(
      createFlightPlan("earth", "mars", "brachistochrone", 10, 42).id
    );
  });
  it("enthält Route, Profil, Funkverzögerung und Log", () => {
    const p = createFlightPlan("earth", "mars", "brachistochrone", 10, 42);
    expect(p.from.id).toBe("earth");
    expect(p.to.id).toBe("mars");
    expect(p.profile.id).toBe("brachistochrone");
    expect(p.radioDelayMinutes).toBeGreaterThan(0);
    expect(p.cockpitLog.length).toBeGreaterThan(0);
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleFlightPlan liefert Erde zu Mars", () => {
    const p = createSampleFlightPlan();
    expect(p.from.id).toBe("earth");
    expect(p.to.id).toBe("mars");
  });
});
