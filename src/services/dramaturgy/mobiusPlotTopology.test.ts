// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  TOPOLOGY_MODELS,
  getTopologyModel,
  createPlotNode,
  findOrphanCauses,
  checkOuroborosLoop,
  checkPalindromeSymmetry,
  checkMobiusInversion,
  checkTimeParadox,
  analyzeTopology,
  renderMobiusCanvas,
  createSampleOuroborosTopology,
  createSamplePalindromeTopology,
  createSampleTopologyReport,
  createSampleMobiusCanvas,
  randomSampleTitle,
  type PlotTopology,
} from "./mobiusPlotTopology";

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

describe("TOPOLOGY_MODELS", () => {
  it("enthält vier topologische Modelle", () => {
    expect(TOPOLOGY_MODELS).toHaveLength(4);
  });
  it("jedes Modell hat Prinzip, Anforderung und Beispiele", () => {
    for (const m of TOPOLOGY_MODELS) {
      expect(m.principle.length).toBeGreaterThan(0);
      expect(m.requirement.length).toBeGreaterThan(0);
      expect(m.exemplars.length).toBeGreaterThan(0);
    }
  });
  it("getTopologyModel findet den Ouroboros-Zyklus", () => {
    expect(getTopologyModel("ouroboros")?.name).toContain("Ouroboros");
  });
  it("getTopologyModel liefert undefined für unbekannt", () => {
    expect(getTopologyModel("xyz" as never)).toBeUndefined();
  });
});

describe("findOrphanCauses", () => {
  it("meldet Verweise auf unbekannte Knoten", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "ouroboros",
      nodes: [createPlotNode("n1", "A", 1, 1, ["geist"])],
    };
    const issues = findOrphanCauses(topology);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("orphanCause");
    expect(issues[0].severity).toBe("error");
  });
  it("sauberes Modell liefert keine Waisen", () => {
    expect(findOrphanCauses(createSampleOuroborosTopology())).toHaveLength(0);
  });
});

describe("checkOuroborosLoop", () => {
  it("erkennt eine geschlossene Schleife", () => {
    expect(checkOuroborosLoop(createSampleOuroborosTopology())).toHaveLength(0);
  });
  it("meldet eine offene Schleife", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "ouroboros",
      nodes: [createPlotNode("n1", "A", 1, 1, []), createPlotNode("n2", "B", 2, 2, ["n1"])],
    };
    const issues = checkOuroborosLoop(topology);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("openLoop");
  });
  it("einzelner Knoten erzeugt kein Issue", () => {
    const topology: PlotTopology = { id: "t", title: "T", model: "ouroboros", nodes: [createPlotNode("n1", "A", 1, 1, [])] };
    expect(checkOuroborosLoop(topology)).toHaveLength(0);
  });
});

describe("checkPalindromeSymmetry", () => {
  it("erkennt die Symmetrie im Beispielplot", () => {
    expect(checkPalindromeSymmetry(createSamplePalindromeTopology())).toHaveLength(0);
  });
  it("meldet asymmetrische Szenen", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "palindrome",
      nodes: [
        createPlotNode("p1", "A", 1, 1, []),
        createPlotNode("p2", "B", 2, 5, ["p1"]),
        createPlotNode("p3", "C", 3, 9, ["p2"]),
      ],
    };
    const issues = checkPalindromeSymmetry(topology);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].kind).toBe("asymmetry");
  });
});

describe("checkMobiusInversion", () => {
  it("meldet Knoten ohne Gegenbild", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "mobius",
      nodes: [createPlotNode("n1", "A", 1, 1, [])],
    };
    const issues = checkMobiusInversion(topology);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("asymmetry");
  });
  it("gegenseitige Verweise sind konform", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "mobius",
      nodes: [createPlotNode("n1", "A", 1, 1, ["n2"]), createPlotNode("n2", "B", 2, 2, ["n1"])],
    };
    expect(checkMobiusInversion(topology)).toHaveLength(0);
  });
});

describe("checkTimeParadox", () => {
  it("meldet eine spätere Ursache ohne Schleife", () => {
    const topology: PlotTopology = {
      id: "t",
      title: "T",
      model: "ouroboros",
      nodes: [createPlotNode("n1", "A", 1, 1, ["n2"]), createPlotNode("n2", "B", 2, 9, [])],
    };
    const issues = checkTimeParadox(topology);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("timeParadox");
  });
  it("geschlossene Schleife ist kein Paradox", () => {
    expect(checkTimeParadox(createSampleOuroborosTopology())).toHaveLength(0);
  });
});

describe("analyzeTopology", () => {
  it("Beispiel-Ouroboros ist kohärent", () => {
    const r = analyzeTopology(createSampleOuroborosTopology());
    expect(r.coherent).toBe(true);
    expect(r.loopClosed).toBe(true);
    expect(r.nodeCount).toBe(4);
  });
  it("ist deterministisch", () => {
    expect(analyzeTopology(createSampleOuroborosTopology()).id).toBe(analyzeTopology(createSampleOuroborosTopology()).id);
  });
  it("wendet modellspezifische Prüfungen an", () => {
    const r = analyzeTopology(createSamplePalindromeTopology());
    expect(r.model.id).toBe("palindrome");
  });
});

describe("renderMobiusCanvas", () => {
  it("erzeugt SVG mit Design-Tokens", () => {
    const c = renderMobiusCanvas(createSampleOuroborosTopology());
    expect(c.svg).toContain("<svg");
    expect(c.svg).toContain("var(--accent)");
  });
  it("enthält keine Hex-Farben", () => {
    const c = renderMobiusCanvas(createSampleOuroborosTopology());
    expect(c.svg.match(/#[0-9a-fA-F]{3,8}/g)).toBeNull();
  });
  it("ist deterministisch", () => {
    expect(renderMobiusCanvas(createSampleOuroborosTopology()).svg).toBe(renderMobiusCanvas(createSampleOuroborosTopology()).svg);
  });
  it("rendert alle vier Modelle", () => {
    for (const m of TOPOLOGY_MODELS) {
      const c = renderMobiusCanvas({ id: "t", title: "T", model: m.id, nodes: [createPlotNode("n1", "A", 1, 1, [])] });
      expect(c.svg).toContain("<svg");
      expect(c.pathPoints).toBeGreaterThan(0);
    }
  });
});

describe("Beispiel-Fabriken", () => {
  it("createSampleTopologyReport liefert kohärenten Bericht", () => {
    expect(createSampleTopologyReport().coherent).toBe(true);
  });
  it("createSampleMobiusCanvas liefert SVG", () => {
    expect(createSampleMobiusCanvas().svg).toContain("<svg");
  });
  it("randomSampleTitle ist deterministisch", () => {
    expect(randomSampleTitle(42)).toBe(randomSampleTitle(42));
  });
});
