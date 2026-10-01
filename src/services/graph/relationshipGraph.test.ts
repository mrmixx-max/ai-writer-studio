// Tests für den Relationship Graph Service (WP 6.1).
import { describe, it, expect } from "vitest";
import {
  buildGraph,
  applyForceLayout,
  getRelationshipsAtChapter,
  type CharacterNode,
  type RelationshipEdge,
} from "./relationshipGraph";

// ---------------------------------------------------------------------------
// Test-Helpers
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  name: string,
  type: CharacterNode["type"] = "character",
  x?: number,
  y?: number,
): CharacterNode {
  return x !== undefined && y !== undefined ? { id, name, type, x, y } : { id, name, type };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  type: RelationshipEdge["type"] = "friendship",
  startChapter = 1,
  endChapter?: number,
): RelationshipEdge {
  return endChapter !== undefined
    ? { id, from, to, type, startChapter, endChapter }
    : { id, from, to, type, startChapter };
}

// ---------------------------------------------------------------------------
// buildGraph
// ---------------------------------------------------------------------------

describe("buildGraph", () => {
  it("leere Eingabe ergibt leeren Graph", () => {
    const result = buildGraph([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("Knoten ohne Koordinaten erhalten deterministische Kreis-Positionen", () => {
    const chars = [makeNode("a", "Anna"), makeNode("b", "Bernd"), makeNode("c", "Clara")];
    const result = buildGraph(chars, []);
    expect(result.nodes).toHaveLength(3);
    for (const n of result.nodes) {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
      expect(typeof n.x).toBe("number");
      expect(typeof n.y).toBe("number");
    }
    // Alle Positionen sollten unterschiedlich sein (Kreis-Anordnung)
    const positions = result.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(3);
  });

  it("Knoten mit bestehenden Koordinaten bleiben unverändert", () => {
    const chars = [makeNode("a", "Anna", "character", 10, 20)];
    const result = buildGraph(chars, []);
    expect(result.nodes[0].x).toBe(10);
    expect(result.nodes[0].y).toBe(20);
  });

  it("Kanten auf nicht-existente Knoten werden verworfen", () => {
    const chars = [makeNode("a", "Anna")];
    const edges = [makeEdge("e1", "a", "ghost"), makeEdge("e2", "ghost", "a")];
    const result = buildGraph(chars, edges);
    expect(result.edges).toEqual([]);
  });

  it("duplikate Kanten (gleiche from/to/type) werden entfernt", () => {
    const chars = [makeNode("a", "Anna"), makeNode("b", "Bernd")];
    const edges = [
      makeEdge("e1", "a", "b", "friendship"),
      makeEdge("e2", "a", "b", "friendship"),
      makeEdge("e3", "a", "b", "rivalry"),
    ];
    const result = buildGraph(chars, edges);
    expect(result.edges).toHaveLength(2);
    const types = result.edges.map((e) => e.type).sort();
    expect(types).toEqual(["friendship", "rivalry"]);
  });
});

// ---------------------------------------------------------------------------
// applyForceLayout
// ---------------------------------------------------------------------------

describe("applyForceLayout", () => {
  it("leere Graph-Eingabe ergibt leeren Graph", () => {
    const result = applyForceLayout({ nodes: [], edges: [] });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("Knoten-Positionen ändern sich nach Layout", () => {
    const chars = [makeNode("a", "Anna", "character", 0, 0), makeNode("b", "Bernd", "character", 0, 0)];
    const edges = [makeEdge("e1", "a", "b")];
    const graph = buildGraph(chars, edges);
    const result = applyForceLayout(graph, 50);
    // Mindestens ein Knoten sollte sich bewegt haben
    const moved = result.nodes.some(
      (n, i) => n.x !== graph.nodes[i].x || n.y !== graph.nodes[i].y,
    );
    expect(moved).toBe(true);
  });

  it("verbundene Knoten nähern sich an", () => {
    // Zwei Knoten mit großer Distanz, verbunden durch eine Kante
    const chars = [makeNode("a", "Anna", "character", 0, 0), makeNode("b", "Bernd", "character", 1000, 0)];
    const edges = [makeEdge("e1", "a", "b")];
    const graph = buildGraph(chars, edges);
    const result = applyForceLayout(graph, 100);

    const distBefore = Math.sqrt(
      (graph.nodes[1].x! - graph.nodes[0].x!) ** 2 + (graph.nodes[1].y! - graph.nodes[0].y!) ** 2,
    );
    const distAfter = Math.sqrt(
      (result.nodes[1].x! - result.nodes[0].x!) ** 2 + (result.nodes[1].y! - result.nodes[0].y!) ** 2,
    );
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("Layout ist deterministisch (gleiche Eingabe → gleiche Ausgabe)", () => {
    const chars = [makeNode("a", "Anna", "character", 0, 0), makeNode("b", "Bernd", "character", 100, 0), makeNode("c", "Clara", "character", 50, 50)];
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")];
    const graph = buildGraph(chars, edges);

    const result1 = applyForceLayout(graph, 50);
    const result2 = applyForceLayout(graph, 50);

    expect(result1.nodes).toEqual(result2.nodes);
  });

  it("mehrere Iterationen führen zu stabileren Positionen", () => {
    const chars = [makeNode("a", "Anna", "character", 0, 0), makeNode("b", "Bernd", "character", 10, 0)];
    const edges = [makeEdge("e1", "a", "b")];
    const graph = buildGraph(chars, edges);

    const result10 = applyForceLayout(graph, 10);
    const result100 = applyForceLayout(graph, 100);

    // Nach 100 Iterationen sollten die Knoten näher beieinander liegen als nach 10
    const dist10 = Math.sqrt(
      (result10.nodes[1].x! - result10.nodes[0].x!) ** 2 +
      (result10.nodes[1].y! - result10.nodes[0].y!) ** 2,
    );
    const dist100 = Math.sqrt(
      (result100.nodes[1].x! - result100.nodes[0].x!) ** 2 +
      (result100.nodes[1].y! - result100.nodes[0].y!) ** 2,
    );
    expect(dist100).toBeLessThanOrEqual(dist10);
  });
});

// ---------------------------------------------------------------------------
// getRelationshipsAtChapter
// ---------------------------------------------------------------------------

describe("getRelationshipsAtChapter", () => {
  it("filtert Beziehungen nach startChapter", () => {
    const edges = [
      makeEdge("e1", "a", "b", "friendship", 1),
      makeEdge("e2", "a", "c", "rivalry", 3),
      makeEdge("e3", "b", "c", "family", 5),
    ];
    const result = getRelationshipsAtChapter(edges, 3);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toContain("e1");
    expect(result.map((e) => e.id)).toContain("e2");
  });

  it("berücksichtigt endChapter (Beziehung endet)", () => {
    const edges = [
      makeEdge("e1", "a", "b", "friendship", 1, 3),
      makeEdge("e2", "a", "c", "rivalry", 2, 4),
    ];
    // Kapitel 2: beide aktiv
    expect(getRelationshipsAtChapter(edges, 2)).toHaveLength(2);
    // Kapitel 4: nur e2 noch aktiv
    const at4 = getRelationshipsAtChapter(edges, 4);
    expect(at4).toHaveLength(1);
    expect(at4[0].id).toBe("e2");
    // Kapitel 5: keine aktiv
    expect(getRelationshipsAtChapter(edges, 5)).toHaveLength(0);
  });

  it("endChapter undefined = Beziehung immer aktiv", () => {
    const edges = [makeEdge("e1", "a", "b", "friendship", 1)];
    expect(getRelationshipsAtChapter(edges, 1)).toHaveLength(1);
    expect(getRelationshipsAtChapter(edges, 100)).toHaveLength(1);
  });

  it("leere Beziehungsliste ergibt leere Ergebnisliste", () => {
    expect(getRelationshipsAtChapter([], 1)).toEqual([]);
  });
});
