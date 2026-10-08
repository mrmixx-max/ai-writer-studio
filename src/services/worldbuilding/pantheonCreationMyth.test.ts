// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  COSMOGONIES,
  getCosmogony,
  createDeity,
  createPantheon,
  describeGeneration,
  generateSacredVerse,
  createSamplePantheon,
} from "./pantheonCreationMyth";

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
    const r = createSeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("COSMOGONIES", () => {
  it("enthält vier Kosmogonien", () => {
    expect(COSMOGONIES).toHaveLength(4);
  });
  it("jede hat erste Zeile, Mechanismus und Echo", () => {
    for (const c of COSMOGONIES) {
      expect(c.firstLine.length).toBeGreaterThan(0);
      expect(c.mechanism.length).toBeGreaterThan(0);
      expect(c.echo.length).toBeGreaterThan(0);
    }
  });
  it("getCosmogony findet slainTitan", () => {
    expect(getCosmogony("slainTitan")?.name).toContain("Titanen");
  });
  it("getCosmogony liefert undefined für unbekannt", () => {
    expect(getCosmogony("nope" as never)).toBeUndefined();
  });
});

describe("createDeity", () => {
  it("ist deterministisch", () => {
    expect(createDeity("Aurel", 42).id).toBe(createDeity("Aurel", 42).id);
  });
  it("verschiedene Seeds erzeugen verschiedene IDs", () => {
    expect(createDeity("Aurel", 1).id).not.toBe(createDeity("Aurel", 2).id);
  });
  it("hat Domäne, Tier, Sakrament und Fluch", () => {
    const d = createDeity("Mordis", 42);
    expect(d.domain.length).toBeGreaterThan(0);
    expect(d.sacredAnimal.length).toBeGreaterThan(0);
    expect(d.sacrament.length).toBeGreaterThan(0);
    expect(d.curse.length).toBeGreaterThan(0);
  });
  it("übernimmt Eltern-IDs", () => {
    const d = createDeity("Kind", 42, ["DEUS-ABC"]);
    expect(d.parentIds).toContain("DEUS-ABC");
  });
  it("Eltern-Array wird kopiert, nicht geteilt", () => {
    const parents = ["P1"];
    const d = createDeity("Kind", 42, parents);
    parents.push("P2");
    expect(d.parentIds).toHaveLength(1);
  });
  it("hat mindestens ein Attribut", () => {
    expect(createDeity("X", 1).attributes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("createPantheon", () => {
  it("ist deterministisch", () => {
    const p1 = createPantheon("Zwölfgestirn", "slainTitan", 42);
    const p2 = createPantheon("Zwölfgestirn", "slainTitan", 42);
    expect(p1.id).toBe(p2.id);
    expect(p1.deities.map((d) => d.name)).toEqual(p2.deities.map((d) => d.name));
  });
  it("enthält mindestens zwei Urgötter plus Kinder", () => {
    const p = createPantheon("Zwölfgestirn", "slainTitan", 42);
    expect(p.deities.length).toBeGreaterThanOrEqual(4);
  });
  it("Kinder referenzieren einen Urgott als Elternteil", () => {
    const p = createPantheon("X", "worldEgg", 7);
    const parentIds = p.deities.filter((d) => d.parentIds.length > 0);
    expect(parentIds.length).toBeGreaterThan(0);
    const allIds = new Set(p.deities.map((d) => d.id));
    for (const child of parentIds) {
      for (const pid of child.parentIds) {
        expect(allIds.has(pid)).toBe(true);
      }
    }
  });
  it("hat Kosmogonie und Generationen", () => {
    const p = createPantheon("X", "primalSong", 3);
    expect(p.cosmogony.id).toBe("primalSong");
    expect(p.generations).toBe(3);
  });
  it("fällt bei unbekannter Kosmogonie auf die erste zurück", () => {
    const p = createPantheon("X", "nope" as never, 1);
    expect(p.cosmogony.id).toBe("worldEgg");
  });
});

describe("describeGeneration", () => {
  it("beschreibt Generation 0 als erste Götter", () => {
    const p = createPantheon("X", "worldEgg", 1);
    expect(describeGeneration(p, 0)).toContain("ersten");
  });
  it("beschreibt Generation 1 als Kinder", () => {
    const p = createPantheon("X", "worldEgg", 1);
    expect(describeGeneration(p, 1)).toContain("Kinder");
  });
  it("behandelt Index außerhalb des Bereichs", () => {
    const p = createPantheon("X", "worldEgg", 1);
    expect(describeGeneration(p, 99).length).toBeGreaterThan(0);
  });
});

describe("generateSacredVerse", () => {
  it("ist deterministisch", () => {
    expect(generateSacredVerse("worldEgg", 42).lines).toEqual(generateSacredVerse("worldEgg", 42).lines);
  });
  it("beginnt mit der ersten Zeile der Kosmogonie", () => {
    const v = generateSacredVerse("worldEgg", 42);
    expect(v.lines[0]).toBe(getCosmogony("worldEgg")?.firstLine);
  });
  it("erzeugt die angeforderte Zeilenzahl", () => {
    expect(generateSacredVerse("primalSong", 1, 5).lines.length).toBeGreaterThanOrEqual(2);
  });
  it("hat eine Inschrift", () => {
    expect(generateSacredVerse("slainTitan", 3).inscription.length).toBeGreaterThan(0);
  });
  it("keine doppelten Verse", () => {
    const v = generateSacredVerse("eternalBreath", 9, 6);
    expect(new Set(v.lines).size).toBe(v.lines.length);
  });
});

describe("createSamplePantheon", () => {
  it("erzeugt ein Beispielpantheon", () => {
    const p = createSamplePantheon();
    expect(p.name).toBe("Das Zwölfgestirn");
    expect(p.cosmogony.id).toBe("slainTitan");
  });
});
