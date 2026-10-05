// Concept-Mind-Map-Service Tests (WP 50.1).
// Lokal, deterministisch, kein LLM / keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  createMindMap,
  addNode,
  connectNodes,
  autoLayout,
  exportToSvg,
  KIND_COLORS,
  LAYOUT_ITERATIONS,
  type MindMap,
  type MindNode,
} from "./conceptMindMap";

function makeNode(overrides: Partial<MindNode> = {}): MindNode {
  return {
    id: "n1",
    label: "Idee",
    kind: "idea",
    x: 0,
    y: 0,
    color: "accent",
    ...overrides,
  };
}

function buildMap(): MindMap {
  let map = createMindMap("Testmap");
  map = addNode(map, makeNode({ id: "a", label: "Held", kind: "character", color: "success" }));
  map = addNode(map, makeNode({ id: "b", label: "Motiv", kind: "motive", color: "warn" }));
  map = connectNodes(map, "a", "b", "treibt an");
  return map;
}

describe("createMindMap", () => {
  it("erstellt eine leere Map mit Titel", () => {
    const map = createMindMap("Mein Roman");
    expect(map.title).toBe("Mein Roman");
    expect(map.nodes).toEqual([]);
    expect(map.connections).toEqual([]);
    expect(map.id.length).toBeGreaterThan(0);
  });

  it("vergibt für denselben Titel dieselbe id (deterministisch)", () => {
    expect(createMindMap("Gleicher Titel").id).toBe(
      createMindMap("Gleicher Titel").id,
    );
  });

  it("fällt bei leerem Titel auf einen Standardtitel zurück", () => {
    const map = createMindMap("   ");
    expect(map.title.length).toBeGreaterThan(0);
    expect(map.nodes).toEqual([]);
  });

  it("ist unempfindlich gegenüber Nicht-String-Titeln", () => {
    const map = createMindMap(undefined as unknown as string);
    expect(map.title.length).toBeGreaterThan(0);
  });
});

describe("addNode", () => {
  it("fügt einen Knoten hinzu, ohne die Original-Map zu verändern", () => {
    const map = createMindMap("M");
    const next = addNode(map, makeNode({ id: "x", label: "Figur" }));
    expect(map.nodes).toHaveLength(0);
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0].id).toBe("x");
  });

  it("ersetzt einen Knoten mit gleicher id", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "x", label: "Alt" }));
    map = addNode(map, makeNode({ id: "x", label: "Neu" }));
    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0].label).toBe("Neu");
  });

  it("vergibt eine deterministische id, wenn keine angegeben ist", () => {
    const map1 = addNode(createMindMap("M"), makeNode({ id: "", label: "Ohne Id" }));
    const map2 = addNode(createMindMap("M"), makeNode({ id: "", label: "Ohne Id" }));
    expect(map1.nodes[0].id).toBe(map2.nodes[0].id);
    expect(map1.nodes[0].id.length).toBeGreaterThan(0);
  });

  it("normalisiert eine unbekannte Knotenart auf 'idea'", () => {
    const map = addNode(
      createMindMap("M"),
      makeNode({ id: "z", kind: "quatsch" as MindNode["kind"] }),
    );
    expect(map.nodes[0].kind).toBe("idea");
  });

  it("ignoriert ungültige Knoten defensiv", () => {
    const map = createMindMap("M");
    const next = addNode(map, null as unknown as MindNode);
    expect(next.nodes).toHaveLength(0);
  });
});

describe("connectNodes", () => {
  it("verbindet zwei vorhandene Knoten", () => {
    const map = buildMap();
    expect(map.connections).toHaveLength(1);
    expect(map.connections[0].fromId).toBe("a");
    expect(map.connections[0].toId).toBe("b");
    expect(map.connections[0].relation).toBe("treibt an");
  });

  it("leitet die Verbindungsfarbe vom Zielknoten ab", () => {
    const map = buildMap();
    expect(map.connections[0].color).toBe("warn");
  });

  it("ignoriert Verbindungen zu unbekannten Knoten", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "a" }));
    const next = connectNodes(map, "a", "gibtsnicht", "x");
    expect(next.connections).toHaveLength(0);
  });

  it("ignoriert Selbstverbindungen", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "a" }));
    const next = connectNodes(map, "a", "a", "selbst");
    expect(next.connections).toHaveLength(0);
  });

  it("ersetzt eine bestehende Verbindung zwischen demselben Paar", () => {
    let map = buildMap();
    map = connectNodes(map, "a", "b", "neue Beziehung");
    expect(map.connections).toHaveLength(1);
    expect(map.connections[0].relation).toBe("neue Beziehung");
  });

  it("vergibt bei gleicher Eingabe dieselbe Verbindungs-id (deterministisch)", () => {
    const m1 = buildMap();
    const m2 = buildMap();
    expect(m1.connections[0].id).toBe(m2.connections[0].id);
  });

  it("fällt bei leerer Beziehung auf einen Standardwert zurück", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "a" }));
    map = addNode(map, makeNode({ id: "b" }));
    map = connectNodes(map, "a", "b", "   ");
    expect(map.connections[0].relation.length).toBeGreaterThan(0);
  });
});

describe("autoLayout", () => {
  it("liefert für dieselbe Eingabe identische Koordinaten (deterministisch)", () => {
    const map = buildMap();
    const first = autoLayout(map);
    const second = autoLayout(map);
    expect(first.nodes.map((n) => [n.x, n.y])).toEqual(
      second.nodes.map((n) => [n.x, n.y]),
    );
  });

  it("verschiebt alle Knoten in den positiven Bereich", () => {
    const laidOut = autoLayout(buildMap());
    for (const node of laidOut.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it("verteilt Knoten aus identischer Startposition heraus", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "a", x: 0, y: 0 }));
    map = addNode(map, makeNode({ id: "b", x: 0, y: 0 }));
    map = addNode(map, makeNode({ id: "c", x: 0, y: 0 }));
    const laidOut = autoLayout(map);
    const positions = new Set(laidOut.nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(3);
  });

  it("verändert eine leere Map nicht", () => {
    const laidOut = autoLayout(createMindMap("leer"));
    expect(laidOut.nodes).toEqual([]);
  });

  it("zentriert einen einzelnen Knoten", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "only" }));
    const laidOut = autoLayout(map);
    expect(laidOut.nodes).toHaveLength(1);
    expect(Number.isFinite(laidOut.nodes[0].x)).toBe(true);
    expect(Number.isFinite(laidOut.nodes[0].y)).toBe(true);
  });

  it("erhält die Knoten- und Verbindungsanzahl", () => {
    const laidOut = autoLayout(buildMap());
    expect(laidOut.nodes).toHaveLength(2);
    expect(laidOut.connections).toHaveLength(1);
  });

  it("nutzt die feste Iterationszahl 50", () => {
    expect(LAYOUT_ITERATIONS).toBe(50);
  });
});

describe("exportToSvg", () => {
  it("erzeugt ein valides SVG-Grundgerüst", () => {
    const svg = exportToSvg(buildMap());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("enthält alle Knotenlabels", () => {
    const svg = exportToSvg(buildMap());
    expect(svg).toContain("Held");
    expect(svg).toContain("Motiv");
  });

  it("löst Farb-Token zu Hex-Werten auf", () => {
    const svg = exportToSvg(buildMap());
    expect(svg).toContain("#22c55e"); // success
    expect(svg).toContain("#f59e0b"); // warn
  });

  it("gibt für dieselbe Eingabe identisches SVG aus (deterministisch)", () => {
    const map = buildMap();
    expect(exportToSvg(map)).toBe(exportToSvg(map));
  });

  it("entfernt Sonderzeichen aus Labels (XML-Sicherheit)", () => {
    let map = createMindMap("M");
    map = addNode(map, makeNode({ id: "a", label: "<b>Held</b> & Co" }));
    const svg = exportToSvg(map);
    expect(svg).toContain("&lt;b&gt;");
    expect(svg).not.toContain("<b>Held</b>");
  });

  it("liefert auch für eine leere Map gültiges SVG", () => {
    const svg = exportToSvg(createMindMap("leer"));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("Keine Knoten");
  });

  it("überspringt Verbindungen zu fehlenden Knoten defensiv", () => {
    const map: MindMap = {
      id: "m",
      title: "M",
      nodes: [makeNode({ id: "a", label: "A" })],
      connections: [
        { id: "c", fromId: "a", toId: "fehlt", relation: "x", color: "accent" },
      ],
    };
    const svg = exportToSvg(map);
    expect(svg).toContain("A");
    expect(svg).not.toContain("fehlt");
  });

  it("enthält die Verbindungsrelation als Text", () => {
    const svg = exportToSvg(buildMap());
    expect(svg).toContain("treibt an");
  });
});

describe("Farbzuordnung", () => {
  it("ordnet jeder Knotenart das richtige Farb-Token zu", () => {
    expect(KIND_COLORS.idea).toBe("accent");
    expect(KIND_COLORS.character).toBe("success");
    expect(KIND_COLORS.motive).toBe("warn");
    expect(KIND_COLORS.conflict).toBe("error");
  });
});
