// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  COMMENTATORS,
  buildFootnoteLabyrinth,
  assignCommentators,
  generateReadingPaths,
  createSampleFootnoteNode,
  createSampleReadingPath,
  type FootnoteNode,
  type ReadingPath,
} from "./ergodicFootnoteLabyrinth";

/** Sammelt alle Nicht-Wurzel-Knoten (Tiefensuche, stabil). */
function collectNodes(root: FootnoteNode): FootnoteNode[] {
  const out: FootnoteNode[] = [];
  const walk = (node: FootnoteNode): void => {
    for (const child of node.children) {
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
    expect(hashString("ergodic-labyrinth:1242")).toBe(hashString("ergodic-labyrinth:1242"));
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("librarian")).not.toBe(hashString("psychiatrist"));
    expect(hashString("1")).not.toBe(hashString("1a"));
  });

  it("liefert eine vorzeichenlose 32-Bit-Ganzzahl", () => {
    const h = hashString("beliebiger Text");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("behandelt den leeren String deterministisch", () => {
    expect(hashString("")).toBe(hashString(""));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) expect(r1()).toBe(r2());
  });

  it("liefert unterschiedliche Werte für unterschiedliche Seeds", () => {
    const r1 = createSeededRandom(1);
    const r2 = createSeededRandom(2);
    const a = Array.from({ length: 10 }, () => r1());
    const b = Array.from({ length: 10 }, () => r2());
    expect(a).not.toEqual(b);
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("COMMENTATORS", () => {
  it("enthält genau vier Stimmen", () => {
    expect(COMMENTATORS).toHaveLength(4);
  });

  it("enthält die erwarteten IDs", () => {
    const ids = COMMENTATORS.map((c) => c.id);
    expect(ids).toEqual(["librarian", "psychiatrist", "editor", "ghost"]);
  });

  it("jede Stimme hat id, name, description und tone", () => {
    for (const c of COMMENTATORS) {
      expect(typeof c.id).toBe("string");
      expect(c.id.length).toBeGreaterThan(0);
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe("string");
      expect(c.description.length).toBeGreaterThan(0);
      expect(typeof c.tone).toBe("string");
      expect(c.tone.length).toBeGreaterThan(0);
    }
  });

  it("alle IDs sind eindeutig", () => {
    const ids = COMMENTATORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildFootnoteLabyrinth", () => {
  it("baut eine rekursive Struktur mit Kindern", () => {
    const root = buildFootnoteLabyrinth(1242, 3);
    expect(root.children.length).toBeGreaterThanOrEqual(3);
    expect(root.children.length).toBeLessThanOrEqual(5);
    // mindestens ein Kind hat selbst Kinder (rekursiv)
    const all = collectNodes(root);
    expect(all.some((n) => n.children.length > 0)).toBe(true);
  });

  it("hat eine Wurzel mit stabiler ID und Label", () => {
    const root = buildFootnoteLabyrinth(1, 3);
    expect(root.id).toBe("fn-root");
    expect(root.label).toBe("Manuskript");
    expect(root.content.length).toBeGreaterThan(0);
  });

  it("ist deterministisch für gleichen Seed", () => {
    const a = buildFootnoteLabyrinth(1242, 3);
    const b = buildFootnoteLabyrinth(1242, 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("respektiert die maximale Verschachtelungstiefe", () => {
    // Die Wurzel ist der Haupttext; die Fußnoten-Ebenen beginnen bei ihren Kindern.
    const root = buildFootnoteLabyrinth(1242, 2);
    const depthOf = (node: FootnoteNode): number => {
      if (node.children.length === 0) return 1;
      return 1 + Math.max(...node.children.map(depthOf));
    };
    // Verschachtelungstiefe der Fußnoten = Ebenen unterhalb der Wurzel.
    expect(depthOf(root) - 1).toBeLessThanOrEqual(2);
  });

  it("jeder Knoten hat id, label und content", () => {
    const root = buildFootnoteLabyrinth(99, 3);
    for (const node of collectNodes(root)) {
      expect(typeof node.id).toBe("string");
      expect(node.id.length).toBeGreaterThan(0);
      expect(typeof node.label).toBe("string");
      expect(node.label.length).toBeGreaterThan(0);
      expect(typeof node.content).toBe("string");
      expect(node.content.length).toBeGreaterThan(0);
      expect(Array.isArray(node.children)).toBe(true);
    }
  });

  it("erzeugt unterschiedliche Bäume für unterschiedliche Seeds", () => {
    const a = buildFootnoteLabyrinth(1, 3);
    const b = buildFootnoteLabyrinth(2, 3);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("assignCommentators", () => {
  it("weist Kommentatoren zu, ohne die Eingabe zu mutieren", () => {
    const original = buildFootnoteLabyrinth(1242, 3);
    const snapshot = JSON.stringify(original);
    const assigned = assignCommentators(original, 1242);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(JSON.stringify(assigned)).not.toBe(snapshot);
  });

  it("die Wurzel erhält keinen Kommentator", () => {
    const assigned = assignCommentators(buildFootnoteLabyrinth(1242, 3), 1242);
    expect(assigned.commentator).toBeUndefined();
  });

  it("weist mindestens einem Knoten eine gültige Stimme zu", () => {
    const assigned = assignCommentators(buildFootnoteLabyrinth(1242, 3), 1242);
    const validIds = COMMENTATORS.map((c) => c.id) as string[];
    const nodes = collectNodes(assigned);
    const withVoice = nodes.filter((n) => n.commentator !== undefined);
    expect(withVoice.length).toBeGreaterThan(0);
    for (const n of withVoice) {
      expect(validIds).toContain(n.commentator);
    }
  });

  it("ist deterministisch für gleichen Seed", () => {
    const base = buildFootnoteLabyrinth(1242, 3);
    const a = assignCommentators(base, 1242);
    const b = assignCommentators(base, 1242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("behält Struktur und IDs bei", () => {
    const base = buildFootnoteLabyrinth(1242, 3);
    const assigned = assignCommentators(base, 1242);
    expect(assigned.id).toBe(base.id);
    expect(assigned.label).toBe(base.label);
    expect(collectNodes(assigned).map((n) => n.id)).toEqual(
      collectNodes(base).map((n) => n.id)
    );
  });
});

describe("generateReadingPaths", () => {
  it("liefert ein Array gültiger Lese-Pfade", () => {
    const labyrinth = buildFootnoteLabyrinth(1242, 3);
    const paths = generateReadingPaths(labyrinth, 1242);
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths.length).toBeLessThanOrEqual(4);
    for (const p of paths) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
      expect(typeof p.description).toBe("string");
      expect(p.description.length).toBeGreaterThan(0);
      expect(Array.isArray(p.steps)).toBe(true);
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      expect(p.steps.length).toBeLessThanOrEqual(6);
      for (const s of p.steps) expect(typeof s).toBe("string");
    }
  });

  it("ist deterministisch für gleichen Seed", () => {
    const labyrinth = buildFootnoteLabyrinth(1242, 3);
    const a = generateReadingPaths(labyrinth, 1242);
    const b = generateReadingPaths(labyrinth, 1242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("Pfad-IDs beginnen mit path-", () => {
    const labyrinth = buildFootnoteLabyrinth(1242, 3);
    for (const p of generateReadingPaths(labyrinth, 1242)) {
      expect(p.id.startsWith("path-")).toBe(true);
    }
  });

  it("verweist ausschließlich auf Labels des Labyrinths", () => {
    const labyrinth = buildFootnoteLabyrinth(1242, 3);
    const validLabels = new Set(collectNodes(labyrinth).map((n) => n.label));
    for (const p of generateReadingPaths(labyrinth, 1242)) {
      for (const s of p.steps) {
        expect(validLabels.has(s)).toBe(true);
      }
    }
  });

  it("erzeugt bei leerem Labyrinth einen Degenerat-Pfad an der Wurzel", () => {
    const empty: FootnoteNode = {
      id: "fn-root",
      label: "Manuskript",
      content: "leer",
      children: [],
    };
    const paths = generateReadingPaths(empty, 1242);
    expect(paths).toHaveLength(1);
    expect(paths[0].steps).toEqual(["Manuskript"]);
  });
});

describe("createSampleFootnoteNode", () => {
  it("liefert ein gültiges Labyrinth", () => {
    const node = createSampleFootnoteNode();
    expect(node.id).toBe("fn-root");
    expect(node.label).toBe("Manuskript");
    expect(Array.isArray(node.children)).toBe(true);
    expect(node.children.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(JSON.stringify(createSampleFootnoteNode())).toBe(
      JSON.stringify(createSampleFootnoteNode())
    );
  });
});

describe("createSampleReadingPath", () => {
  it("liefert einen gültigen Lese-Pfad", () => {
    const path: ReadingPath = createSampleReadingPath();
    expect(typeof path.id).toBe("string");
    expect(path.id.length).toBeGreaterThan(0);
    expect(typeof path.label).toBe("string");
    expect(path.label.length).toBeGreaterThan(0);
    expect(typeof path.description).toBe("string");
    expect(path.description.length).toBeGreaterThan(0);
    expect(Array.isArray(path.steps)).toBe(true);
    expect(path.steps.length).toBeGreaterThan(0);
  });

  it("ist deterministisch", () => {
    expect(JSON.stringify(createSampleReadingPath())).toBe(
      JSON.stringify(createSampleReadingPath())
    );
  });
});
