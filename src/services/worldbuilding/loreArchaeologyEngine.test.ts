// @vitest-environment jsdom
/** Tests: LoreArchaeologyEngine (WP 86.1) */

import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  generateEras,
  createStratigraphy,
  createArchaeologicalSite,
  generateArtifact,
  decipherInscription,
  createSampleSite,
  createSampleArtifact,
  createSampleDeciphering,
  type Era as _Era,
  type StratigraphyLayer as _StratigraphyLayer,
  type ArchaeologicalSite as _ArchaeologicalSite,
  type Artifact as _Artifact,
  type DecipheredText as _DecipheredText,
} from "./loreArchaeologyEngine";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("")).toBe(0x811c9dc5 >>> 0);
  });

  it("unterschiedliche Eingaben → unterschiedliche Hashes (meistens)", () => {
    const h1 = hashString("a");
    const h2 = hashString("b");
    expect(h1).not.toBe(h2);
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("unterschiedliche Seeds → unterschiedliche Sequenzen", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    expect(r1()).not.toBe(r2());
  });

  it("Werte in [0, 1)", () => {
    const r = createSeededRandom(999);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generateEras", () => {
  it("gibt Standard-Epochen zurück", () => {
    const eras = generateEras(123);
    expect(eras.length).toBe(4);
    expect(eras.map(e => e.name)).toEqual(expect.arrayContaining([
      "Bronzezeitliche Götter-Ära",
      "Goldenes Kaiserreich",
      "Glas-Kataklysmus",
      "Feudale Gegenwart",
    ]));
  });

  it("ist deterministisch", () => {
    const e1 = generateEras(456);
    const e2 = generateEras(456);
    expect(e1).toEqual(e2);
  });

  it("akzeptiert benutzerdefinierte Epochen", () => {
      const custom: _Era[] = [{ name: "Test-Ära", startYear: 0, endYear: 100, culture: "Test", techLevel: "antik", signatureMaterials: ["Stein"], typicalStructures: ["Hütte"], scriptStyle: "Striche" }];
      const eras = generateEras(789, custom);
      expect(eras.length).toBe(1);
      expect(eras[0].name).toBe("Test-Ära");
    });
});

describe("createStratigraphy", () => {
  it("erzeugt Schichten für alle Epochen", () => {
    const layers = createStratigraphy("Testort", 42);
    expect(layers.length).toBe(4);
    expect(layers.every(l => l.thickness > 0)).toBe(true);
    expect(layers.every(l => l.artifacts.length > 0)).toBe(true);
    expect(layers.every(l => l.structures.length > 0)).toBe(true);
  });

  it("Schichten haben aufsteigende Tiefe", () => {
    const layers = createStratigraphy("Testort", 42);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].depth).toBeGreaterThan(layers[i - 1].depth);
    }
  });

  it("Erhaltungszustand ist gültig", () => {
    const layers = createStratigraphy("Testort", 42);
    const valid = ["intakt", "verwittert", "fragmentarisch", "verschüttet"];
    expect(layers.every(l => valid.includes(l.preservation))).toBe(true);
  });

  it("ist deterministisch", () => {
    const l1 = createStratigraphy("Ort", 1);
    const l2 = createStratigraphy("Ort", 1);
    expect(l1).toEqual(l2);
  });
});

describe("createArchaeologicalSite", () => {
  it("erzeugt vollständige Site", () => {
    const site = createArchaeologicalSite("Testruine", 999, 100, 200);
    expect(site.id).toContain("site-");
    expect(site.name).toBe("Testruine");
    expect(site.location).toEqual({ x: 100, y: 200 });
    expect(site.layers.length).toBe(4);
    expect(site.mysteryLevel).toBeGreaterThanOrEqual(0);
    expect(site.mysteryLevel).toBeLessThan(100);
  });

  it("ist deterministisch", () => {
    const s1 = createArchaeologicalSite("X", 1, 0, 0);
    const s2 = createArchaeologicalSite("X", 1, 0, 0);
    expect(s1).toEqual(s2);
  });
});

describe("generateArtifact", () => {
  it("erzeugt Artefakt mit allen Feldern", () => {
    const art = generateArtifact("Ort", 42, 0);
    expect(art.id).toContain("art-");
    expect(["waffe", "werkzeug", "schmuck", "schrifttafel", "keramik", "bauwerk", "relikt"]).toContain(art.type);
    expect(["neuwertig", "gebraucht", "beschädigt", "stark verwittert", "fragment"]).toContain(art.condition);
  });

  it("kann Umwidmung haben", () => {
    const art = generateArtifact("Ort", 42, 2);
    if (art.repurposedFrom) {
      expect(art.repurposedTo).toBeDefined();
    }
  });

  it("ist deterministisch", () => {
    const a1 = generateArtifact("Ort", 1, 0);
    const a2 = generateArtifact("Ort", 1, 0);
    expect(a1).toEqual(a2);
  });
});

describe("decipherInscription", () => {
  it("entschlüsselt Text mit Lücken", () => {
    const result = decipherInscription("König Aelindor errichtete dies", 123);
    expect(result.original).toBe("König Aelindor errichtete dies");
    expect(result.reconstructed).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.language).toBe("Alt-Elfisch");
  });

  it("findet Lücken und schlägt Ergänzungen vor", () => {
    const result = decipherInscription("[König] [errichtete] [Tempel]", 42);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps.every(g => g.suggestion)).toBe(true);
  });

  it("ist deterministisch", () => {
    const d1 = decipherInscription("Test [Lücke] Text", 777);
    const d2 = decipherInscription("Test [Lücke] Text", 777);
    expect(d1).toEqual(d2);
  });
});

describe("createSampleSite", () => {
  it("erzeugt Beispiel-Site", () => {
    const site = createSampleSite();
    expect(site.name).toBe("Ruinen von Aelindor");
    expect(site.location).toEqual({ x: 1250, y: 3400 });
  });
});

describe("createSampleArtifact", () => {
  it("erzeugt Beispiel-Artefakt", () => {
    const art = createSampleArtifact();
    expect(art.id).toContain("art-");
    expect(art.era).toBeDefined();
  });
});

describe("createSampleDeciphering", () => {
  it("erzeugt Beispiel-Entschlüsselung", () => {
    const dec = createSampleDeciphering();
    expect(dec.original).toContain("Aelindor");
    expect(dec.reconstructed).toContain("[...]");
  });
});