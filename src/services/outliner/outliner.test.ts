// Outliner-Engine-Tests (Sprint 22, Agent 5): Anlegen, Einfuegen, Verschieben,
// Auf/Zuklappen, Markdown-Export/Import (Roundtrip) — Singleton + Klasse.
import { describe, it, expect, beforeEach } from "vitest";
import {
  OutlinerEngine,
  createOutline,
  addNode,
  getActiveOutline,
  removeNode,
  moveNode,
  toggleCollapse,
  renameNode,
  findNode,
  fromMarkdown,
} from "./outliner";

beforeEach(() => {
  createOutline("Test-Gliederung");
});

describe("createOutline", () => {
  it("erzeugt ein leeres Outline mit Titel", () => {
    const outline = createOutline("Mein Buch");
    expect(outline.title).toBe("Mein Buch");
    expect(outline.nodes).toEqual([]);
    expect(outline.id).toBeTruthy();
    expect(outline.createdAt).toBeLessThanOrEqual(outline.updatedAt);
  });
});

describe("addNode / removeNode", () => {
  it("fuegt Wurzel- und Kindknoten mit aufsteigender order ein", () => {
    const engine = new OutlinerEngine("Engine-Buch");
    const root = engine.addNode(null, "Akt 1");
    const child = engine.addNode(root.id, "Szene 1");
    expect(engine.getOutline().nodes).toHaveLength(1);
    expect(root.order).toBe(0);
    expect(child.order).toBe(0);
    expect(engine.getOutline().nodes[0].children[0].title).toBe("Szene 1");
  });

  it("Singleton-addNode haengt an den Elternknoten an", () => {
    const root = addNode(null, "Kapitel 1");
    const child = addNode(root.id, "Abschnitt 1.1");
    const loc = findNode(createOutlineRef(), child.id);
    expect(loc?.parent?.id).toBe(root.id);
  });

  it("removeNode entfernt Knoten samt Teilbaum und indiziert neu", () => {
    const a = addNode(null, "A");
    addNode(a.id, "A.1");
    const b = addNode(null, "B");
    removeNode(a.id);
    const outline = createOutlineRef();
    expect(outline.nodes.map((n) => n.title)).toEqual(["B"]);
    expect(outline.nodes[0].order).toBe(0);
    expect(findNode(outline, b.id)).not.toBeNull();
  });

  it("removeNode mit unbekannter ID ist ein No-op", () => {
    addNode(null, "Bleibt");
    expect(() => removeNode("gibt-es-nicht")).not.toThrow();
    expect(createOutlineRef().nodes).toHaveLength(1);
  });
});

describe("moveNode", () => {
  it("aendert die Reihenfolge auf Wurzelebene", () => {
    const a = addNode(null, "A");
    const b = addNode(null, "B");
    const c = addNode(null, "C");
    moveNode(c.id, null, 0);
    expect(createOutlineRef().nodes.map((n) => n.id)).toEqual([c.id, a.id, b.id]);
    expect(createOutlineRef().nodes[0].order).toBe(0);
  });

  it("haengt einen Knoten per Drop unter einen neuen Elternknoten", () => {
    const parent = addNode(null, "Eltern");
    const child = addNode(null, "Kind");
    moveNode(child.id, parent.id, 0);
    const outline = createOutlineRef();
    expect(outline.nodes).toHaveLength(1);
    expect(outline.nodes[0].children.map((n) => n.id)).toEqual([child.id]);
  });

  it("verhindert Drop auf sich selbst oder eigene Nachfahren", () => {
    const engine = new OutlinerEngine("Zyklus-Test");
    const p = engine.addNode(null, "P");
    const k = engine.addNode(p.id, "K");
    engine.moveNode(p.id, k.id, 0); // wuerde Zyklus erzeugen
    engine.moveNode(p.id, p.id, 0); // Selbst-Drop
    expect(engine.getOutline().nodes.map((n) => n.id)).toEqual([p.id]);
    expect(engine.getOutline().nodes[0].children.map((n) => n.id)).toEqual([k.id]);
  });
});

describe("toggleCollapse / renameNode", () => {
  it("klappt Knoten auf und zu", () => {
    const n = addNode(null, "Klapp");
    expect(createOutlineRef().nodes[0].collapsed).toBe(false);
    toggleCollapse(n.id);
    expect(createOutlineRef().nodes[0].collapsed).toBe(true);
    toggleCollapse(n.id);
    expect(createOutlineRef().nodes[0].collapsed).toBe(false);
  });

  it("benennt Knoten um", () => {
    const n = addNode(null, "Alt");
    renameNode(n.id, "Neu");
    expect(createOutlineRef().nodes[0].title).toBe("Neu");
  });
});

describe("toMarkdown / fromMarkdown", () => {
  it("erzeugt korrektes Markdown mit Einrueckung", () => {
    const engine = new OutlinerEngine("Roman");
    const akt = engine.addNode(null, "Akt 1");
    engine.addNode(akt.id, "Szene 1");
    expect(engine.toMarkdown()).toBe("# Roman\n\n- Akt 1\n  - Szene 1\n");
  });

  it("parst Markdown zurueck in die Baumstruktur (Roundtrip)", () => {
    const engine = new OutlinerEngine("Roman");
    const akt = engine.addNode(null, "Akt 1");
    engine.addNode(akt.id, "Szene 1");
    engine.addNode(null, "Akt 2");
    const parsed = fromMarkdown(engine.toMarkdown());
    expect(parsed.title).toBe("Roman");
    expect(parsed.nodes.map((n) => n.title)).toEqual(["Akt 1", "Akt 2"]);
    expect(parsed.nodes[0].children.map((n) => n.title)).toEqual(["Szene 1"]);
  });

  it("liest ##-Überschriften als Knoten und Fliesstext als Inhalt", () => {
    const parsed = fromMarkdown("# Buch\n\n## Teil 1\n\n- Kapitel 1\n  Notiz zum Kapitel\n");
    expect(parsed.title).toBe("Buch");
    expect(parsed.nodes[0].title).toBe("Teil 1");
    expect(parsed.nodes[0].children[0].title).toBe("Kapitel 1");
    expect(parsed.nodes[0].children[0].content).toContain("Notiz zum Kapitel");
  });
});

// Hilfsfunktion: liest das aktive Singleton-Outline (von beforeEach angelegt).
function createOutlineRef() {
  const outline = getActiveOutline();
  if (!outline) throw new Error("Kein aktives Outline");
  return outline;
}
