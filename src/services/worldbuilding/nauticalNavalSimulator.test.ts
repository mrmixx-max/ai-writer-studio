// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  POINTS_OF_SAIL,
  getPointOfSail,
  pointOfSailForAngle,
  RIGS,
  getRig,
  calculateSailing,
  AMMO_TYPES,
  getAmmoType,
  fireBroadside,
  generateBattlePassage,
  simulateEngagement,
  createSampleSailingState,
  createSampleEngagement,
} from "./nauticalNavalSimulator";

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
    const r = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("POINTS_OF_SAIL", () => {
  it("enthält fünf Segelkurse", () => {
    expect(POINTS_OF_SAIL).toHaveLength(5);
  });
  it("Kurse sind nach Winkel aufsteigend geordnet", () => {
    for (let i = 1; i < POINTS_OF_SAIL.length; i++) {
      expect(POINTS_OF_SAIL[i].angleDegrees).toBeGreaterThan(POINTS_OF_SAIL[i - 1].angleDegrees);
    }
  });
  it("Hart am Wind krängt stärker als Vor dem Wind", () => {
    expect(getPointOfSail("closeHauled")!.heelDegrees).toBeGreaterThan(getPointOfSail("running")!.heelDegrees);
  });
  it("Halber Wind ist der schnellste Kurs", () => {
    const beam = getPointOfSail("beamReach")!.speedFactor;
    for (const p of POINTS_OF_SAIL) {
      if (p.id !== "beamReach") expect(beam).toBeGreaterThanOrEqual(p.speedFactor);
    }
  });
  it("getPointOfSail liefert undefined für unbekannt", () => {
    expect(getPointOfSail("xyz" as never)).toBeUndefined();
  });
});

describe("pointOfSailForAngle", () => {
  it("45° ist Hart am Wind", () => {
    expect(pointOfSailForAngle(45).id).toBe("closeHauled");
  });
  it("90° ist Halber Wind", () => {
    expect(pointOfSailForAngle(90).id).toBe("beamReach");
  });
  it("180° ist Vor dem Wind", () => {
    expect(pointOfSailForAngle(180).id).toBe("running");
  });
  it("spiegelt Winkel über 180° (Steuerbord/Backbord)", () => {
    expect(pointOfSailForAngle(315).id).toBe(pointOfSailForAngle(45).id);
  });
  it("0° fällt auf Hart am Wind (im Wind)", () => {
    expect(pointOfSailForAngle(0).id).toBe("closeHauled");
  });
});

describe("RIGS", () => {
  it("enthält vier Schiffstypen", () => {
    expect(RIGS).toHaveLength(4);
  });
  it("Linienschiff hat die meisten Geschütze", () => {
    const sol = getRig("shipOfTheLine")!.gunsPerBroadside;
    for (const r of RIGS) {
      if (r.id !== "shipOfTheLine") expect(sol).toBeGreaterThan(r.gunsPerBroadside);
    }
  });
  it("Schaluppe ist am kürzesten", () => {
    const sloop = getRig("sloop")!.lengthMeters;
    for (const r of RIGS) {
      if (r.id !== "sloop") expect(sloop).toBeLessThan(r.lengthMeters);
    }
  });
  it("jeder Rigg nennt Takelage", () => {
    for (const r of RIGS) {
      expect(r.sails.length).toBeGreaterThan(0);
    }
  });
  it("getRig liefert undefined für unbekannt", () => {
    expect(getRig("xyz" as never)).toBeUndefined();
  });
});

describe("calculateSailing", () => {
  it("ist deterministisch", () => {
    expect(calculateSailing("frigate", 90, 18).speedKnots).toBe(calculateSailing("frigate", 90, 18).speedKnots);
  });
  it("überschreitet nie die Rumpfgeschwindigkeit", () => {
    const s = calculateSailing("sloop", 90, 40);
    expect(s.speedKnots).toBeLessThanOrEqual(s.rig.hullSpeedKnots);
  });
  it("mehr Wind erhöht die Krängung", () => {
    expect(calculateSailing("frigate", 45, 30).heelDegrees).toBeGreaterThan(calculateSailing("frigate", 45, 10).heelDegrees);
  });
  it("Krängung bleibt unter 45°", () => {
    expect(calculateSailing("sloop", 45, 60).heelDegrees).toBeLessThanOrEqual(45);
  });
  it("rechnet Knoten in km/h um", () => {
    const s = calculateSailing("frigate", 90, 18);
    expect(s.speedKmh).toBeCloseTo(Math.round(s.speedKnots * 1.852 * 10) / 10, 1);
  });
  it("kein Wind ergibt keine Fahrt", () => {
    expect(calculateSailing("frigate", 90, 0).speedKnots).toBe(0);
  });
  it("negativer Wind wird auf 0 begrenzt", () => {
    expect(calculateSailing("frigate", 90, -10).windSpeedKnots).toBe(0);
  });
});

describe("AMMO_TYPES", () => {
  it("enthält vier Munitionsarten", () => {
    expect(AMMO_TYPES).toHaveLength(4);
  });
  it("Vollkugel hat den höchsten Rumpfschaden", () => {
    const round = getAmmoType("roundShot")!.hullDamage;
    for (const a of AMMO_TYPES) {
      if (a.id !== "roundShot") expect(round).toBeGreaterThanOrEqual(a.hullDamage);
    }
  });
  it("Kettengeschoss hat den höchsten Takelageschaden", () => {
    expect(getAmmoType("chainShot")!.riggingDamage).toBe(1);
  });
  it("Kartätsche hat den höchsten Personenschaden", () => {
    expect(getAmmoType("grapeshot")!.crewDamage).toBe(1);
  });
  it("getAmmoType liefert undefined für unbekannt", () => {
    expect(getAmmoType("xyz" as never)).toBeUndefined();
  });
});

describe("fireBroadside", () => {
  it("ist deterministisch", () => {
    expect(fireBroadside("frigate", "roundShot", 400, 42).hullDamagePercent).toBe(
      fireBroadside("frigate", "roundShot", 400, 42).hullDamagePercent
    );
  });
  it("Reichweitenabfall sinkt jenseits der effektiven Reichweite", () => {
    const near = fireBroadside("frigate", "roundShot", 400, 42);
    const far = fireBroadside("frigate", "roundShot", 1300, 42);
    expect(far.rangeEffect).toBeLessThan(near.rangeEffect);
  });
  it("Schäden bleiben im Bereich 0..100", () => {
    const r = fireBroadside("shipOfTheLine", "roundShot", 50, 42);
    expect(r.hullDamagePercent).toBeGreaterThanOrEqual(0);
    expect(r.hullDamagePercent).toBeLessThanOrEqual(100);
    expect(r.riggingDamagePercent).toBeLessThanOrEqual(100);
  });
  it("Kettengeschoss verursacht mehr Takelage- als Rumpfschaden", () => {
    const r = fireBroadside("frigate", "chainShot", 200, 42);
    expect(r.riggingDamagePercent).toBeGreaterThan(r.hullDamagePercent);
  });
  it("Linienschiff richtet mehr Schaden an als Schaluppe", () => {
    expect(fireBroadside("shipOfTheLine", "roundShot", 300, 42).hullDamagePercent).toBeGreaterThan(
      fireBroadside("sloop", "roundShot", 300, 42).hullDamagePercent
    );
  });
  it("jenseits doppelter Reichweite fällt die Kugel kurz", () => {
    const r = fireBroadside("frigate", "roundShot", 2500, 42);
    expect(r.summary).toContain("kurz");
  });
  it("negativer Abstand wird auf 0 begrenzt", () => {
    expect(fireBroadside("frigate", "roundShot", -100, 42).distanceMeters).toBe(0);
  });
});

describe("generateBattlePassage", () => {
  it("ist deterministisch", () => {
    expect(generateBattlePassage(3, 42).text).toBe(generateBattlePassage(3, 42).text);
  });
  it("erzeugt die angeforderte Bildzahl ohne Duplikate", () => {
    const p = generateBattlePassage(4, 7);
    expect(p.imagesUsed).toHaveLength(4);
    expect(new Set(p.imagesUsed).size).toBe(4);
  });
  it("begrenzt auf die Poolgröße", () => {
    expect(generateBattlePassage(999, 1).imagesUsed.length).toBeLessThanOrEqual(8);
  });
  it("nennt Pulverqualm oder Splitter", () => {
    const p = generateBattlePassage(8, 42);
    expect(p.text.includes("Pulverqualm") || p.text.includes("Splitterndes")).toBe(true);
  });
});

describe("simulateEngagement", () => {
  it("ist deterministisch", () => {
    expect(simulateEngagement("frigate", "brig", "roundShot", 400, 18, 42).id).toBe(
      simulateEngagement("frigate", "brig", "roundShot", 400, 18, 42).id
    );
  });
  it("enthält Angreifer, Verteidiger, Salve und Prosa", () => {
    const e = simulateEngagement("frigate", "brig", "roundShot", 400, 18, 42);
    expect(e.attacker.rig.id).toBe("frigate");
    expect(e.defender.rig.id).toBe("brig");
    expect(e.broadside.hullDamagePercent).toBeGreaterThanOrEqual(0);
    expect(e.passage.text.length).toBeGreaterThan(20);
  });
  it("benennt einen Vorteil", () => {
    expect(["attacker", "defender", "even"]).toContain(simulateEngagement("shipOfTheLine", "sloop", "roundShot", 100, 20, 42).advantage);
  });
  it("Linienschiff gegen Schaluppe begünstigt den Angreifer", () => {
    expect(simulateEngagement("shipOfTheLine", "sloop", "roundShot", 50, 25, 42).advantage).toBe("attacker");
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleSailingState liefert eine Fregatte am halben Wind", () => {
    const s = createSampleSailingState();
    expect(s.rig.id).toBe("frigate");
    expect(s.pointOfSail.id).toBe("beamReach");
  });
  it("createSampleEngagement liefert eine Schlacht", () => {
    expect(createSampleEngagement().passage.text.length).toBeGreaterThan(20);
  });
});
