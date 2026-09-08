// Tests: Plot-Analyzer-Engine (Sprint 25, Agent 5).
import { describe, it, expect } from "vitest";
import {
  analyzePlot,
  extractPlotPoints,
  generateTensionCurve,
  identifyClimax,
  suggestImprovements,
  buildArc,
  localPlotPoints,
  type PlotPoint,
  type PlotAnalysis,
} from "./plotAnalyzer";

const TEXT =
  "Eines Tages fand Anna einen geheimnisvollen Brief. " +
  "Sie folgte den Hinweisen durch den dunklen Wald. " +
  "Plötzlich stellte sich ihr der Wächter zum Kampf! " +
  "Verletzt floh sie zurück ins Dorf. " +
  "Am Ende versöhnte sie sich mit dem Wächter und fand Frieden.";

const LLM_JSON = JSON.stringify({
  points: [
    {
      id: "p1",
      title: "Der Brief",
      description: "Anna findet den Brief.",
      position: 10,
      type: "inciting-incident",
      characters: ["Anna"],
      tension: 5,
    },
    {
      id: "p2",
      title: "Showdown",
      description: "Kampf mit dem Wächter.",
      position: 75,
      type: "climax",
      characters: ["Anna", "Wächter"],
      tension: 9,
    },
    {
      id: "p3",
      title: "Versöhnung",
      description: "Frieden mit dem Wächter.",
      position: 95,
      type: "resolution",
      characters: ["Anna"],
      tension: 2,
    },
  ],
  pacing: "medium",
  suggestions: ["Stärke die Mitte mit einer zweiten Komplikation."],
});

function mkPoint(over: Partial<PlotPoint> = {}): PlotPoint {
  return {
    id: "p-x",
    title: "Point",
    description: "Beschreibung.",
    position: 50,
    type: "rising-action",
    characters: ["Anna"],
    tension: 5,
    ...over,
  };
}

describe("analyzePlot", () => {
  it("mockt das LLM und liefert eine PlotAnalysis", async () => {
    const client = async () => LLM_JSON;
    const res = await analyzePlot(TEXT, { client });
    expect(res.pacing).toBe("medium");
    expect(res.suggestions).toEqual(["Stärke die Mitte mit einer zweiten Komplikation."]);
    expect(res.arc.exposition).toHaveLength(1);
    expect(res.arc.climax).toHaveLength(1);
    expect(res.arc.resolution).toHaveLength(1);
    expect(res.tensionCurve.length).toBeGreaterThanOrEqual(3);
    expect(res.tensionCurve[0].position).toBe(0);
    expect(res.tensionCurve[res.tensionCurve.length - 1].position).toBe(100);
  });

  it("fällt bei Provider-Fehler auf die lokale Heuristik zurück", async () => {
    const client = async () => {
      throw new Error("offline");
    };
    const res = await analyzePlot(TEXT, { client });
    const total =
      res.arc.exposition.length +
      res.arc.risingAction.length +
      res.arc.climax.length +
      res.arc.fallingAction.length +
      res.arc.resolution.length;
    expect(total).toBeGreaterThan(0);
    expect(res.suggestions.length).toBeGreaterThan(0);
  });

  it("liefert bei leerem Text eine leere Analyse", async () => {
    const res = await analyzePlot("   ", { client: async () => LLM_JSON });
    expect(res.tensionCurve).toEqual([]);
    expect(res.suggestions).toHaveLength(1);
  });
});

describe("extractPlotPoints", () => {
  it("erkennt Plot-Points aus der LLM-Antwort", async () => {
    const chapters = [
      { title: "Anfang", content: TEXT },
      { title: "Ende", content: "Am Ende fand Anna Frieden und Versöhnung." },
    ];
    const points = await extractPlotPoints(chapters, { client: async () => LLM_JSON });
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.position)).toEqual([10, 75, 95]);
    expect(points[1].type).toBe("climax");
    expect(points[1].characters).toContain("Wächter");
  });

  it("verteilt heuristische Points pro Kapitel nach Position", async () => {
    const chapters = [
      { title: "K1", content: "Eines Tages fand Anna einen Brief. Sie brach sofort auf." },
      { title: "K2", content: "Plötzlich griff der Wächter an! Anna floh in Panik." },
    ];
    const client = async () => {
      throw new Error("offline");
    };
    const points = await extractPlotPoints(chapters, { client });
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(4);
    const positions = points.map((p) => p.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...positions)).toBeLessThanOrEqual(100);
    expect(points.some((p) => p.title.startsWith("K1:"))).toBe(true);
  });

  it("liefert [] bei leeren Kapiteln", async () => {
    const points = await extractPlotPoints(
      [{ title: "", content: "   " }],
      { client: async () => LLM_JSON },
    );
    expect(points).toEqual([]);
  });
});

describe("generateTensionCurve", () => {
  it("erzeugt eine sortierte Kurve mit 0/100-Ankern", () => {
    const curve = generateTensionCurve([
      mkPoint({ position: 75, tension: 9 }),
      mkPoint({ position: 10, tension: 4 }),
    ]);
    expect(curve).toEqual([
      { position: 0, tension: 4 },
      { position: 10, tension: 4 },
      { position: 75, tension: 9 },
      { position: 100, tension: 9 },
    ]);
  });

  it("liefert [] ohne Points", () => {
    expect(generateTensionCurve([])).toEqual([]);
  });
});

describe("identifyClimax", () => {
  it("bevorzugt den Climax-Point, sonst hoechste Tension", () => {
    const points = [
      mkPoint({ id: "a", position: 90, type: "falling-action", tension: 9 }),
      mkPoint({ id: "b", position: 75, type: "climax", tension: 8 }),
      mkPoint({ id: "c", position: 40, type: "rising-action", tension: 6 }),
    ];
    expect(identifyClimax(points)?.id).toBe("b");
    const noClimax = points.filter((p) => p.type !== "climax");
    expect(identifyClimax(noClimax)?.id).toBe("a");
  });

  it("liefert undefined bei leerer Liste", () => {
    expect(identifyClimax([])).toBeUndefined();
  });
});

describe("suggestImprovements", () => {
  it("meldet fehlende Phasen und schwachen Hoehepunkt", () => {
    const analysis: PlotAnalysis = {
      arc: buildArc([mkPoint({ type: "rising-action", tension: 4 })]),
      pacing: "slow",
      tensionCurve: [{ position: 0, tension: 4 }, { position: 100, tension: 4 }],
      suggestions: [],
    };
    const s = suggestImprovements(analysis);
    expect(s.some((x) => x.includes("Hoehepunkt"))).toBe(true);
    expect(s.some((x) => x.includes("Aufloesung"))).toBe(true);
    expect(s.some((x) => x.includes("Tempo"))).toBe(true);
  });

  it("bestaetigt einen soliden Arc", () => {
    const points = [
      mkPoint({ type: "inciting-incident", position: 10, tension: 5 }),
      mkPoint({ type: "rising-action", position: 40, tension: 6 }),
      mkPoint({ type: "rising-action", position: 60, tension: 7 }),
      mkPoint({ type: "climax", position: 80, tension: 9 }),
      mkPoint({ type: "resolution", position: 95, tension: 3 }),
    ];
    const analysis: PlotAnalysis = {
      arc: buildArc(points),
      pacing: "medium",
      tensionCurve: generateTensionCurve(points),
      suggestions: [],
    };
    expect(suggestImprovements(analysis)).toHaveLength(1);
  });
});

describe("localPlotPoints", () => {
  it("extrahiert markante Saetze als Points", () => {
    const points = localPlotPoints(TEXT);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(6);
    expect(points.every((p) => p.position >= 0 && p.position <= 100)).toBe(true);
    expect(points.every((p) => p.tension >= 0 && p.tension <= 10)).toBe(true);
  });
});
