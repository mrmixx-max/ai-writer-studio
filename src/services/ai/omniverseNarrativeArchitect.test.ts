// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  terrainSpeed,
  estimateTravelHours,
  detectInconsistencies,
  linkSystems,
  synchronizePlotStrands,
  analyzeOmniverse,
  createSampleWorldModel,
  type WorldModel,
} from "./omniverseNarrativeArchitect";

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

describe("terrainSpeed", () => {
  it("Straße ist schneller als Sumpf", () => {
    expect(terrainSpeed("strasse")).toBeGreaterThan(terrainSpeed("sumpf"));
  });
  it("unbekanntes Gelände fällt auf 9 zurück", () => {
    expect(terrainSpeed("mars" as never)).toBe(9);
  });
});

describe("estimateTravelHours", () => {
  const model = createSampleWorldModel();
  it("gleicher Ort = 0 Stunden", () => {
    expect(estimateTravelHours(model, "n1", "n1")).toBe(0);
  });
  it("berechnet Reisezeit über eine Kante", () => {
    const h = estimateTravelHours(model, "n1", "n2");
    expect(h).not.toBeNull();
    expect(h as number).toBeGreaterThan(0);
  });
  it("liefert null für unbekannte Knoten", () => {
    expect(estimateTravelHours(model, "n1", "zzz")).toBeNull();
  });
  it("liefert null ohne Kante", () => {
    expect(estimateTravelHours(model, "n1", "n3")).toBeNull();
  });
});

describe("detectInconsistencies", () => {
  it("findet zu schnelles Reiten", () => {
    const model = createSampleWorldModel();
    const issues = detectInconsistencies(model);
    expect(issues.some((i) => i.kind === "travelTooFast")).toBe(true);
  });
  it("findet Zahlung mit gefallener Währung", () => {
    const model = createSampleWorldModel();
    const issues = detectInconsistencies(model);
    expect(issues.some((i) => i.kind === "fallenCurrency")).toBe(true);
  });
  it("meldet unbekannte Figur", () => {
    const model = createSampleWorldModel();
    const m: WorldModel = { ...model, passages: [{ id: "px", chapter: 1, text: "x", characterId: "geist" }] };
    expect(detectInconsistencies(m).some((i) => i.kind === "unknownCharacter")).toBe(true);
  });
  it("meldet fehlenden Kartenknoten", () => {
    const model = createSampleWorldModel();
    const m: WorldModel = { ...model, passages: [{ id: "py", chapter: 1, text: "x", fromNodeId: "nirgendwo" }] };
    expect(detectInconsistencies(m).some((i) => i.kind === "missingNode")).toBe(true);
  });
  it("sauberes Modell liefert keine Fehler", () => {
    const clean: WorldModel = {
      nodes: [{ id: "a", name: "A", terrain: "strasse", x: 0, y: 0 }, { id: "b", name: "B", terrain: "strasse", x: 1, y: 1 }],
      edges: [{ from: "a", to: "b", distanceKm: 12 }],
      characters: [{ id: "c", name: "C", voiceProfile: "warm" }],
      currencies: [],
      passages: [{ id: "p", chapter: 1, text: "x", characterId: "c", fromNodeId: "a", toNodeId: "b", travelTimeHours: 2 }],
    };
    expect(detectInconsistencies(clean)).toHaveLength(0);
  });
});

describe("linkSystems", () => {
  it("verknüpft Karte, Stammbaum, Währung und Stimmen", () => {
    const links = linkSystems(createSampleWorldModel());
    const systems = new Set(links.map((l) => l.system));
    expect(systems.has("map")).toBe(true);
    expect(systems.has("economy")).toBe(true);
    expect(systems.has("genealogy")).toBe(true);
    expect(systems.has("voices")).toBe(true);
  });
});

describe("synchronizePlotStrands", () => {
  it("hebt zu kurze Reisezeiten an", () => {
    const { report } = synchronizePlotStrands(createSampleWorldModel());
    expect(report.adjustments.length).toBeGreaterThan(0);
    expect(report.after).toBeLessThan(report.before);
  });
  it("ist deterministisch", () => {
    const a = synchronizePlotStrands(createSampleWorldModel()).report.id;
    const b = synchronizePlotStrands(createSampleWorldModel()).report.id;
    expect(a).toBe(b);
  });
  it("mutiert das Eingabemodell nicht", () => {
    const model = createSampleWorldModel();
    const original = model.passages[0].travelTimeHours;
    synchronizePlotStrands(model);
    expect(model.passages[0].travelTimeHours).toBe(original);
  });
});

describe("analyzeOmniverse", () => {
  it("liefert Zählungen und Health-Score", () => {
    const r = analyzeOmniverse(createSampleWorldModel());
    expect(r.nodeCount).toBe(4);
    expect(r.characterCount).toBe(2);
    expect(r.healthScore).toBeGreaterThanOrEqual(0);
    expect(r.healthScore).toBeLessThanOrEqual(100);
  });
  it("sauberes Modell ist synchronisiert", () => {
    const clean: WorldModel = {
      nodes: [{ id: "a", name: "A", terrain: "strasse", x: 0, y: 0 }],
      edges: [],
      characters: [],
      currencies: [],
      passages: [],
    };
    const r = analyzeOmniverse(clean);
    expect(r.synchronized).toBe(true);
    expect(r.healthScore).toBe(100);
  });
  it("ist deterministisch", () => {
    expect(analyzeOmniverse(createSampleWorldModel()).id).toBe(analyzeOmniverse(createSampleWorldModel()).id);
  });
});

describe("createSampleWorldModel", () => {
  it("erzeugt ein Modell mit allen Systemen", () => {
    const m = createSampleWorldModel();
    expect(m.nodes.length).toBeGreaterThan(0);
    expect(m.edges.length).toBeGreaterThan(0);
    expect(m.characters.length).toBeGreaterThan(0);
    expect(m.currencies.length).toBeGreaterThan(0);
    expect(m.passages.length).toBeGreaterThan(0);
  });
});
