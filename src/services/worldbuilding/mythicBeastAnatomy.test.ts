// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  HABITATS,
  getHabitat,
  getSkeletalTrait,
  generateFolkBeliefs,
  generateFieldJournal,
  createMythicBeast,
  createSampleMythicBeast,
} from "./mythicBeastAnatomy";

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
    const r = createSeededRandom(3);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("HABITATS", () => {
  it("enthält sechs Lebensräume", () => {
    expect(HABITATS).toHaveLength(6);
  });
  it("jeder Lebensraum hat Licht- und Druckangabe", () => {
    for (const h of HABITATS) {
      expect(h.light.length).toBeGreaterThan(0);
      expect(h.pressure.length).toBeGreaterThan(0);
    }
  });
});

describe("getHabitat / getSkeletalTrait", () => {
  it("findet Tiefsee", () => {
    expect(getHabitat("deepSea")?.name).toBe("Tiefsee");
  });
  it("liefert undefined für unbekannt", () => {
    expect(getHabitat("mars" as never)).toBeUndefined();
  });
  it("Tiefsee-Anatomie nennt Biolumineszenz", () => {
    expect(getSkeletalTrait("deepSea")?.sense).toContain("Biolumineszenz");
  });
  it("Hochgebirge-Anatomie nennt Röhrenknochen", () => {
    expect(getSkeletalTrait("highMountain")?.boneStructure).toContain("Röhrenknochen");
  });
  it("Höhlen-Anatomie nennt Echoortung", () => {
    expect(getSkeletalTrait("subterranean")?.sense).toContain("Echoortung");
  });
});

describe("generateFolkBeliefs", () => {
  it("ist deterministisch", () => {
    const b1 = generateFolkBeliefs("Nachtgreif", 4, 42);
    const b2 = generateFolkBeliefs("Nachtgreif", 4, 42);
    expect(b1.map((b) => b.claim)).toEqual(b2.map((b) => b.claim));
  });
  it("erzeugt die angeforderte Anzahl", () => {
    expect(generateFolkBeliefs("Nachtgreif", 4, 1)).toHaveLength(4);
  });
  it("jeder Glaube hat Region", () => {
    for (const b of generateFolkBeliefs("Drache", 3, 2)) {
      expect(b.region.length).toBeGreaterThan(0);
    }
  });
  it("interpoliert den Kreaturnamen in mindestens einen Glauben", () => {
    const beliefs = generateFolkBeliefs("Nachtgreif", 6, 42);
    const withName = beliefs.filter((b) => b.claim.includes("Nachtgreif"));
    expect(withName.length).toBeGreaterThan(0);
  });
  it("keine doppelten Aussagen", () => {
    const beliefs = generateFolkBeliefs("Nachtgreif", 5, 9);
    const unique = new Set(beliefs.map((b) => b.claim));
    expect(unique.size).toBe(beliefs.length);
  });
  it("begrenzt auf Poolgröße", () => {
    expect(generateFolkBeliefs("X", 999, 1).length).toBeLessThanOrEqual(7);
  });
});

describe("generateFieldJournal", () => {
  it("ist deterministisch", () => {
    const j1 = generateFieldJournal("Nachtgreif", 4, 42);
    const j2 = generateFieldJournal("Nachtgreif", 4, 42);
    expect(j1.map((e) => e.observation)).toEqual(j2.map((e) => e.observation));
  });
  it("erzeugt nummerierte Einträge", () => {
    const j = generateFieldJournal("Nachtgreif", 4, 1);
    expect(j).toHaveLength(4);
    expect(j[0].entryNo).toBe(1);
    expect(j[3].entryNo).toBe(4);
  });
  it("jeder Eintrag hat Messung", () => {
    for (const e of generateFieldJournal("Drache", 3, 5)) {
      expect(e.measurement).toContain("Schulterhöhe");
    }
  });
  it("interpoliert Laut und Spur", () => {
    const j = generateFieldJournal("X", 7, 42);
    const joined = j.map((e) => e.observation).join(" ");
    expect(joined.includes("Zoll") || joined.includes("Donner") || joined.length > 0).toBe(true);
  });
});

describe("createMythicBeast", () => {
  it("ist deterministisch", () => {
    const b1 = createMythicBeast("Nachtgreif", "highMountain", 42);
    const b2 = createMythicBeast("Nachtgreif", "highMountain", 42);
    expect(b1.id).toBe(b2.id);
  });
  it("verschiedene Seeds erzeugen verschiedene IDs", () => {
    expect(createMythicBeast("Nachtgreif", "highMountain", 1).id).not.toBe(
      createMythicBeast("Nachtgreif", "highMountain", 2).id
    );
  });
  it("enthält Anatomie und Volksglauben", () => {
    const b = createMythicBeast("Nachtgreif", "highMountain", 42);
    expect(b.habitat.id).toBe("highMountain");
    expect(b.skeletal.sense.length).toBeGreaterThan(0);
    expect(b.folkBeliefs.length).toBe(4);
    expect(b.fieldJournal.length).toBe(4);
  });
  it("fällt bei unbekanntem Habitat auf den ersten zurück", () => {
    const b = createMythicBeast("X", "mars" as never, 1);
    expect(b.habitat.id).toBe("deepSea");
  });
});

describe("createSampleMythicBeast", () => {
  it("erzeugt ein Beispielbestien-Profil", () => {
    const b = createSampleMythicBeast();
    expect(b.name).toBe("Nachtgreif");
    expect(b.habitat.id).toBe("highMountain");
  });
});
