// Outliner-Engine (Sprint 22, Agent 5): Baumstruktur fuer manuelle Gliederungen
// mit Drag & Drop (via moveNode), Markdown Import/Export und Singleton-API
// fuer einfache Nutzung + OutlinerEngine-Klasse fuer isolierte Instanzen
// (z. B. OutlinerPanel).

export interface OutlineNode {
  id: string;
  title: string;
  content?: string;
  children: OutlineNode[];
  collapsed: boolean;
  order: number;
}

export interface Outline {
  id: string;
  title: string;
  nodes: OutlineNode[];
  createdAt: number;
  updatedAt: number;
}

let idCounter = 0;

function genId(prefix: string): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return `${prefix}-${c.randomUUID()}`;
  } catch {
    /* Fallback unten */
  }
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function touch(outline: Outline): void {
  outline.updatedAt = Date.now();
}

function reindex(nodes: OutlineNode[]): void {
  nodes.forEach((n, i) => {
    n.order = i;
  });
}

export interface NodeLocation {
  node: OutlineNode;
  /** Liste, die den Knoten direkt enthaelt (Roots oder children eines Elternknotens). */
  siblings: OutlineNode[];
  index: number;
  parent: OutlineNode | null;
}

function findIn(nodes: OutlineNode[], id: string, parent: OutlineNode | null): NodeLocation | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === id) return { node, siblings: nodes, index: i, parent };
    const deeper = findIn(node.children, id, node);
    if (deeper) return deeper;
  }
  return null;
}

/** Sucht einen Knoten im Outline (Tiefe zuerst). Gibt null zurueck, wenn unbekannt. */
export function findNode(outline: Outline, id: string): NodeLocation | null {
  return findIn(outline.nodes, id, null);
}

function containsNode(root: OutlineNode, id: string): boolean {
  if (root.id === id) return true;
  return root.children.some((c) => containsNode(c, id));
}

function makeNode(title: string, order: number, content?: string): OutlineNode {
  return {
    id: genId("node"),
    title,
    content,
    children: [],
    collapsed: false,
    order,
  };
}

// ---------------------------------------------------------------------------
// OutlinerEngine: isolierte Instanz (Panel nutzt diese Klasse).
// ---------------------------------------------------------------------------

export class OutlinerEngine {
  private outline: Outline;

  constructor(title = "Unbenannte Gliederung") {
    const now = Date.now();
    this.outline = { id: genId("outline"), title, nodes: [], createdAt: now, updatedAt: now };
  }

  getOutline(): Outline {
    return this.outline;
  }

  /** Ersetzt das komplette Outline (z. B. nach Markdown-Import). */
  loadOutline(outline: Outline): void {
    this.outline = outline;
  }

  setTitle(title: string): void {
    this.outline.title = title;
    touch(this.outline);
  }

  addNode(parentId: string | null, title: string, content?: string): OutlineNode {
    const target: OutlineNode[] =
      parentId === null
        ? this.outline.nodes
        : (() => {
            const loc = findIn(this.outline.nodes, parentId, null);
            if (!loc) throw new Error(`Unbekannter Elternknoten: ${parentId}`);
            return loc.node.children;
          })();
    const node = makeNode(title, target.length, content);
    target.push(node);
    reindex(target);
    touch(this.outline);
    return node;
  }

  removeNode(id: string): void {
    const loc = findIn(this.outline.nodes, id, null);
    if (!loc) return;
    loc.siblings.splice(loc.index, 1);
    reindex(loc.siblings);
    touch(this.outline);
  }

  /**
   * Verschiebt einen Knoten (Drag & Drop): an neue Elternliste + Position.
   * newParentId null = Wurzelebene. No-op bei unbekannter ID, Selbst-Drop
   * oder Drop auf einen eigenen Nachfahren (wuerde einen Zyklus erzeugen).
   */
  moveNode(id: string, newParentId: string | null, newOrder: number): void {
    const loc = findIn(this.outline.nodes, id, null);
    if (!loc) return;
    if (newParentId === id) return;
    let target: OutlineNode[];
    if (newParentId === null) {
      target = this.outline.nodes;
    } else {
      const parentLoc = findIn(this.outline.nodes, newParentId, null);
      if (!parentLoc) return;
      if (containsNode(loc.node, newParentId)) return;
      target = parentLoc.node.children;
    }
    loc.siblings.splice(loc.index, 1);
    reindex(loc.siblings);
    const at = Math.max(0, Math.min(newOrder, target.length));
    // Gleicher Listen-Insert nach Entnahme: Index bezieht sich auf die Liste
    // nach der Entnahme — exakt das, was Drag & Drop braucht.
    target.splice(at, 0, loc.node);
    reindex(target);
    touch(this.outline);
  }

  toggleCollapse(id: string): void {
    const loc = findIn(this.outline.nodes, id, null);
    if (!loc) return;
    loc.node.collapsed = !loc.node.collapsed;
    touch(this.outline);
  }

  renameNode(id: string, title: string): void {
    const loc = findIn(this.outline.nodes, id, null);
    if (!loc) return;
    loc.node.title = title;
    touch(this.outline);
  }

  setContent(id: string, content: string): void {
    const loc = findIn(this.outline.nodes, id, null);
    if (!loc) return;
    loc.node.content = content;
    touch(this.outline);
  }

  toMarkdown(): string {
    return toMarkdown(this.outline);
  }

  importMarkdown(markdown: string): void {
    const parsed = fromMarkdown(markdown);
    // ID des bestehenden Outlines behalten, damit Referenzen stabil bleiben.
    parsed.id = this.outline.id;
    parsed.createdAt = this.outline.createdAt;
    this.outline = parsed;
  }
}

// ---------------------------------------------------------------------------
// Singleton-API (schlanke Nutzung ohne eigene Instanz).
// ---------------------------------------------------------------------------

let active: Outline | null = null;
let defaultEngine: OutlinerEngine | null = null;

function activeEngine(): OutlinerEngine {
  if (!defaultEngine) {
    defaultEngine = new OutlinerEngine();
    active = defaultEngine.getOutline();
  }
  return defaultEngine;
}

/** Legt ein neues Outline an und macht es zum aktiven. */
export function createOutline(title: string): Outline {
  defaultEngine = new OutlinerEngine(title);
  active = defaultEngine.getOutline();
  return active;
}

/** Gibt das aktive Outline zurueck (null, wenn noch keines angelegt wurde). */
export function getActiveOutline(): Outline | null {
  return active;
}

export function addNode(parentId: string | null, title: string, content?: string): OutlineNode {
  return activeEngine().addNode(parentId, title, content);
}

export function removeNode(id: string): void {
  if (!defaultEngine) return;
  defaultEngine.removeNode(id);
}

export function moveNode(id: string, newParentId: string | null, newOrder: number): void {
  if (!defaultEngine) return;
  defaultEngine.moveNode(id, newParentId, newOrder);
}

export function toggleCollapse(id: string): void {
  if (!defaultEngine) return;
  defaultEngine.toggleCollapse(id);
}

export function renameNode(id: string, title: string): void {
  if (!defaultEngine) return;
  defaultEngine.renameNode(id, title);
}

// ---------------------------------------------------------------------------
// Markdown Export / Import.
// Format: `# Titel` + verschachtelte `- `-Listen (2 Leerzeichen pro Ebene).
// Notiz-/Inhaltszeilen stehen eingerueckt als Fliesstext unter ihrem Knoten,
// `> `-Zitate werden als Inhalt an den letzten Knoten angehaengt.
// `## `-Überschriften (Ebene >= 2) werden als Knoten gelesen.
// ---------------------------------------------------------------------------

function nodeToLines(node: OutlineNode, depth: number, out: string[]): void {
  const indent = "  ".repeat(depth);
  out.push(`${indent}- ${node.title}`);
  if (node.content) {
    for (const line of node.content.split("\n")) {
      out.push(`${indent}  ${line}`);
    }
  }
  for (const child of node.children) {
    nodeToLines(child, depth + 1, out);
  }
}

export function toMarkdown(outline: Outline): string {
  const out: string[] = [`# ${outline.title}`, ""];
  for (const node of outline.nodes) {
    nodeToLines(node, 0, out);
  }
  return out.join("\n").trimEnd() + "\n";
}

export function fromMarkdown(markdown: string): Outline {
  const now = Date.now();
  const outline: Outline = {
    id: genId("outline"),
    title: "Unbenannte Gliederung",
    nodes: [],
    createdAt: now,
    updatedAt: now,
  };
  // Stack aus { Tiefe, Kindliste } — Wurzel startet bei Tiefe -1.
  const stack: { depth: number; list: OutlineNode[] }[] = [{ depth: -1, list: outline.nodes }];
  let lastNode: OutlineNode | null = null;
  let titleSet = false;
  let headingDepth = -1; // Tiefe der aktuellen ##-Überschrift (fuer Listen darunter)

  const depthOf = (depth: number): { depth: number; list: OutlineNode[] } => {
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    return stack[stack.length - 1];
  };

  const pushNode = (depth: number, title: string): OutlineNode => {
    const parent = depthOf(depth);
    const node = makeNode(title, parent.list.length);
    parent.list.push(node);
    reindex(parent.list);
    stack.push({ depth, list: node.children });
    return node;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !titleSet) {
        outline.title = text || outline.title;
        titleSet = true;
        continue;
      }
      headingDepth = Math.max(0, level - 2);
      // Überschrift oberhalb evtl. tieferer Listen-Knoten: Stack zuruecksetzen.
      while (stack.length > 1) stack.pop();
      lastNode = pushNode(headingDepth, text);
      continue;
    }

    const bullet = line.match(/^(\s*)(?:[-*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const indent = bullet[1].replace(/\t/g, "  ").length;
      const base = headingDepth >= 0 ? headingDepth + 1 : 0;
      lastNode = pushNode(base + Math.floor(indent / 2), bullet[2].trim());
      continue;
    }

    // Fliesstext / Zitat gehoert zum letzten Knoten als Inhalt.
    if (lastNode) {
      const text = line.trim().replace(/^>\s?/, "");
      lastNode.content = lastNode.content ? `${lastNode.content}\n${text}` : text;
    }
  }

  outline.updatedAt = Date.now();
  return outline;
}
