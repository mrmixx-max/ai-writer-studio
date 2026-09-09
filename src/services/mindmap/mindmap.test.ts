// Mindmap Engine Tests (Sprint 25, Agent 2)
import { describe, it, expect } from "vitest";
import {
  generateFromText,
  generateFromOutline,
  addNode,
  removeNode,
  updateNode,
  exportToMermaid,
  exportToSVG,
  exportToJSON,
  importFromJSON,
  localMindmap,
  type Mindmap,
} from "./mindmap";

describe("Mindmap Engine", () => {
  it("generateFromText creates a mindmap with nodes and edges", async () => {
    const text = "Machine learning uses data to train models for predictions";
    const map = await generateFromText(text, { client: async () => '{"root": "AI", "branches": [{"label": "ML", "children": ["Neural Networks"]}]}' });
    expect(map.nodes.length).toBeGreaterThan(0);
    expect(map.edges.length).toBeGreaterThan(0);
  });

  it("generateFromText falls back to local heuristic on empty response", async () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const map = await generateFromText(text, { client: async () => 'no json here' });
    expect(map.nodes.length).toBeGreaterThan(0);
  });

  it("generateFromOutline creates mindmap from outline", () => {
    const map = generateFromOutline({ title: "My Book", chapters: ["Ch1", "Ch2", "Ch3"] });
    expect(map.nodes.length).toBe(1);
    expect(map.nodes[0].children.length).toBe(3);
    expect(map.edges.length).toBe(3);
  });

  it("addNode adds a child node to parent", () => {
    const map: Mindmap = { nodes: [{ id: "1", label: "Root", children: [] }], edges: [] };
    const node = addNode(map, "1", "Child");
    expect(node.label).toBe("Child");
    expect(map.nodes[0].children.length).toBe(1);
    expect(map.edges.length).toBe(1);
  });

  it("removeNode removes node and its edges", () => {
    const map: Mindmap = {
      nodes: [
        { id: "1", label: "Root", children: [{ id: "2", label: "Child", children: [] }] },
      ],
      edges: [{ from: "1", to: "2" }],
    };
    removeNode(map, "2");
    expect(map.nodes[0].children.length).toBe(0);
    expect(map.edges.length).toBe(0);
  });

  it("updateNode changes node label", () => {
    const map: Mindmap = { nodes: [{ id: "1", label: "Old", children: [] }], edges: [] };
    updateNode(map, "1", "New");
    expect(map.nodes[0].label).toBe("New");
  });

  it("exportToMermaid returns valid mermaid string", () => {
    const map: Mindmap = {
      nodes: [{ id: "1", label: "AI", children: [{ id: "2", label: "ML", children: [] }] }],
      edges: [{ from: "1", to: "2" }],
    };
    const mermaid = exportToMermaid(map);
    expect(mermaid).toContain("mindmap");
    expect(mermaid).toContain("AI");
    expect(mermaid).toContain("ML");
  });

  it("exportToSVG returns valid SVG string", () => {
    const map: Mindmap = {
      nodes: [{ id: "1", label: "Root", children: [] }],
      edges: [],
    };
    const svg = exportToSVG(map);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Root");
  });

  it("exportToJSON and importFromJSON roundtrip", () => {
    const map: Mindmap = {
      nodes: [{ id: "1", label: "Root", children: [{ id: "2", label: "Child", children: [] }] }],
      edges: [{ from: "1", to: "2" }],
    };
    const json = exportToJSON(map);
    const restored = importFromJSON(json);
    expect(restored.nodes.length).toBe(1);
    expect(restored.edges.length).toBe(1);
  });

  it("localMindmap creates mindmap from plain text", () => {
    const map = localMindmap("First sentence. Second sentence. Third sentence.");
    expect(map.nodes.length).toBeGreaterThan(0);
  });
});
