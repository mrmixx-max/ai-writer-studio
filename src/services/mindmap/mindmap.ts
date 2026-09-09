// Mindmap-Engine (Sprint 25, Agent 2): visuelle Darstellung von Textstruktur.
//
// - generateFromText(): LLM-Mindmap via Provider (JSON-Antwort), mit lokaler
//   Heuristik als Offline-Fallback (Muster: feedback.ts localReview).
// - Der LLM-Client ist injizierbar (opts.client) — so bleibt die Funktion
//   ohne Provider-Mock testbar (Muster: BilingualPanel `chat`-Prop).
// - generateFromOutline(): rein, synchron, ohne LLM.
// - exportToSVG()/exportToJSON()/importFromJSON(): rein, synchron.

import { createProvider } from "@/services/llm";
import { loadSettings } from "@/services/settings";

export interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
  color?: string;
}

export interface Mindmap {
  nodes: MindmapNode[];
  edges: { from: string; to: string; label?: string }[];
}

export type MindmapLayout = "radial" | "tree" | "linear";

export interface MindmapOutline {
  title: string;
  chapters: string[];
}

/** Injizierbarer LLM-Client: Prompt rein, Rohtext raus. Default nutzt den Provider. */
export type MindmapClient = (prompt: string, signal?: AbortSignal) => Promise<string>;

export interface MindmapOptions {
  client?: MindmapClient;
  signal?: AbortSignal;
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

function makeNode(label: string, color?: string): MindmapNode {
  return { id: genId("mm"), label, children: [], ...(color ? { color } : {}) };
}

/** Baut den Mindmap-Prompt für das LLM (inkl. JSON-Antwortschema). */
export function buildMindmapPrompt(text: string): string {
  return (
    `Du bist ein Strukturierungs-Assistent. Erstelle aus dem folgenden Text eine Mindmap ` +
    `mit einem zentralen Wurzelknoten und thematischen Zweigen (max. 6 Hauptzweige, max. 4 Unterknoten je Zweig). ` +
    `Halte Labels kurz (max. 6 Wörter).\n\nTEXT:\n${text}\n\n` +
    `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Vorwort) im Format:\n` +
    `{"root": "Zentralthema", "branches": [{"label": "Zweig", "children": ["Unterknoten", "..."]}]}`
  );
}

/** Extrahiert das erste JSON-Objekt aus einer LLM-Rohantwort (toleriert Code-Fences). */
export function extractJsonObject(raw: string): unknown | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeLabel(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  return fallback;
}

/** Normalisiert eine geparste LLM-Antwort zu Mindmap (defensiv, nie Throw). */
export function normalizeMindmap(parsed: unknown, fallbackText: string): Mindmap {
  if (typeof parsed !== "object" || parsed === null) return localMindmap(fallbackText);
  const p = parsed as Record<string, unknown>;
  const rawBranches = Array.isArray(p.branches) ? p.branches : [];
  if (rawBranches.length === 0) return localMindmap(fallbackText);
  const root = makeNode(sanitizeLabel(p.root, "Mindmap"));
  const edges: Mindmap["edges"] = [];
  for (const b of rawBranches.slice(0, 8)) {
    if (typeof b !== "object" || b === null) continue;
    const br = b as Record<string, unknown>;
    const branch = makeNode(sanitizeLabel(br.label, "Zweig"));
    const rawChildren = Array.isArray(br.children) ? br.children : [];
    for (const c of rawChildren.slice(0, 6)) {
      const label = typeof c === "string" ? c : typeof (c as Record<string, unknown>)?.label === "string" ? String((c as Record<string, unknown>).label) : "";
      if (!label.trim()) continue;
      const child = makeNode(sanitizeLabel(label, "Knoten"));
      branch.children.push(child);
      edges.push({ from: branch.id, to: child.id });
    }
    root.children.push(branch);
    edges.push({ from: root.id, to: branch.id });
  }
  if (root.children.length === 0) return localMindmap(fallbackText);
  return { nodes: [root], edges };
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

function shortLabel(s: string, maxWords = 6): string {
  const words = s.replace(/^#+\s*/, "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Lokale, LLM-freie Heuristik (Offline-Fallback): Markdown-Headings werden zu
 * Zweigen, sonst die ersten Sätze je Absatz. Deterministisch, nie Throw.
 */
export function localMindmap(text: string): Mindmap {
  const trimmed = text.trim();
  if (!trimmed) return { nodes: [], edges: [] };
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const headings = lines.filter((l) => /^#{1,3}\s+\S/.test(l));
  const rootLabel = headings.length > 0 ? shortLabel(headings[0]) : shortLabel(sentencesOf(trimmed)[0] ?? trimmed.slice(0, 60), 6);
  const root = makeNode(rootLabel || "Mindmap");
  const edges: Mindmap["edges"] = [];
  const branchSources: string[] =
    headings.length > 1
      ? headings.slice(1, 7).map((h) => shortLabel(h))
      : trimmed.split(/\n\s*\n/).slice(headings.length > 0 ? 0 : 1, 7).flatMap((para) => {
          const first = sentencesOf(para)[0];
          return first ? [shortLabel(first)] : [];
        });
  const unique = [...new Set(branchSources.filter(Boolean))].slice(0, 6);
  const sentences = sentencesOf(trimmed).slice(1);
  let si = 0;
  for (const label of unique.length > 0 ? unique : ["Inhalt"]) {
    if (unique.length === 0 && sentences.length === 0) break;
    const branch = makeNode(label);
    // Bis zu 3 Folgesätze als Unterknoten anhängen.
    for (let k = 0; k < 3 && si < sentences.length; k += 1, si += 1) {
      const s = shortLabel(sentences[si]);
      if (s && s !== label && s !== root.label) {
        const child = makeNode(s);
        branch.children.push(child);
        edges.push({ from: branch.id, to: child.id });
      }
    }
    root.children.push(branch);
    edges.push({ from: root.id, to: branch.id });
  }
  return { nodes: [root], edges };
}

/** Default-Client über den konfigurierten LLM-Provider (streamt, sammelt, gibt Rohtext zurück). */
async function providerClient(prompt: string, signal?: AbortSignal): Promise<string> {
  const settings = loadSettings();
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) throw new Error("Provider nicht erreichbar");
  let raw = "";
  for await (
    const token of provider.chat(
      [
        { role: "system" as const, content: "Du bist ein Strukturierungs-Assistent. Antworte ausschließlich mit dem verlangten JSON." },
        { role: "user" as const, content: prompt },
      ],
      { model: settings.model, temperature: 0.4, maxTokens: settings.maxTokens },
      signal,
    )
  ) {
    raw += token;
  }
  return raw;
}

/**
 * Erzeugt eine Mindmap aus freiem Text. Nutzt opts.client (Tests/Panel-Mock)
 * oder den konfigurierten Provider; bei Fehlern greift die lokale Heuristik
 * (außer bei explizitem Abort — der wird weitergereicht). Leerer Text ergibt
 * eine leere Mindmap.
 */
export async function generateFromText(text: string, opts?: MindmapOptions): Promise<Mindmap> {
  if (!text.trim()) return { nodes: [], edges: [] };
  const client = opts?.client ?? providerClient;
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    const raw = await client(buildMindmapPrompt(text), opts?.signal);
    const parsed = extractJsonObject(raw);
    if (!parsed) return localMindmap(text);
    return normalizeMindmap(parsed, text);
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || opts?.signal?.aborted) throw e;
    return localMindmap(text);
  }
}

/**
 * Erzeugt eine Mindmap aus einer Gliederung: Titel wird Wurzel, jedes Kapitel
 * ein Zweig. Rein, synchron, ohne LLM.
 */
export function generateFromOutline(outline: MindmapOutline): Mindmap {
  const title = outline.title.trim() || "Unbenannte Gliederung";
  const root = makeNode(title);
  const edges: Mindmap["edges"] = [];
  for (const chapter of outline.chapters.map((c) => c.trim()).filter(Boolean).slice(0, 50)) {
    const branch = makeNode(shortLabel(chapter, 8));
    root.children.push(branch);
    edges.push({ from: root.id, to: branch.id });
  }
  return { nodes: [root], edges };
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface PlacedNode {
  node: MindmapNode;
  x: number;
  y: number;
  depth: number;
}

const NODE_W = 150;
const NODE_H = 34;
const GAP_X = 60;
const GAP_Y = 22;
const ACCENT = "#ffa028";

function flattenLevels(mindmap: Mindmap): MindmapNode[][] {
  const levels: MindmapNode[][] = [];
  const visit = (nodes: MindmapNode[], depth: number): void => {
    for (const n of nodes) {
      (levels[depth] ??= []).push(n);
      if (n.children.length > 0) visit(n.children, depth + 1);
    }
  };
  visit(mindmap.nodes, 0);
  return levels;
}

function layoutNodes(mindmap: Mindmap, layout: MindmapLayout): { placed: PlacedNode[]; width: number; height: number } {
  const levels = flattenLevels(mindmap);
  const placed: PlacedNode[] = [];
  if (layout === "linear") {
    // Lineare Kette: alle Knoten in einer Zeile (Breitensuche-Reihenfolge).
    const all = levels.flat();
    all.forEach((node, i) => {
      placed.push({ node, x: 20 + i * (NODE_W + GAP_X), y: 60, depth: 0 });
    });
    return { placed, width: Math.max(320, 40 + all.length * (NODE_W + GAP_X)), height: 160 };
  }
  if (layout === "radial") {
    // Radial: Wurzel zentriert, Zweige auf Kreis, Unterknoten auf äußerem Ring.
    const roots = levels[0] ?? [];
    const branches = levels[1] ?? [];
    const leaves = levels.slice(2).flat();
    const cx = 400;
    const cy = 260;
    roots.forEach((node, i) => {
      placed.push({ node, x: cx - NODE_W / 2, y: cy - NODE_H / 2 + i * (NODE_H + GAP_Y), depth: 0 });
    });
    const r1 = 250;
    branches.forEach((node, i) => {
      const a = branches.length <= 1 ? -Math.PI / 2 : (2 * Math.PI * i) / branches.length - Math.PI / 2;
      placed.push({ node, x: cx + r1 * Math.cos(a) - NODE_W / 2, y: cy + (r1 * 0.62) * Math.sin(a) - NODE_H / 2, depth: 1 });
    });
    const r2 = 430;
    leaves.forEach((node, i) => {
      const a = leaves.length <= 1 ? -Math.PI / 2 : (2 * Math.PI * i) / leaves.length - Math.PI / 2;
      placed.push({ node, x: cx + r2 * Math.cos(a) - NODE_W / 2, y: cy + (r2 * 0.62) * Math.sin(a) - NODE_H / 2, depth: 2 });
    });
    return { placed, width: 1000, height: 620 };
  }
  // Tree (default): Ebenen untereinander, Knoten pro Ebene nebeneinander.
  levels.forEach((nodes, depth) => {
    const rowWidth = nodes.length * (NODE_W + GAP_X) - GAP_X;
    const width = Math.max(rowWidth, 320);
    nodes.forEach((node, i) => {
      placed.push({
        node,
        x: (width - rowWidth) / 2 + 20 + i * (NODE_W + GAP_X),
        y: 20 + depth * (NODE_H + GAP_Y + 14),
        depth,
      });
    });
  });
  const maxRow = Math.max(320, ...levels.map((n) => n.length * (NODE_W + GAP_X)));
  return { placed, width: maxRow + 40, height: Math.max(140, 40 + levels.length * (NODE_H + GAP_Y + 14)) };
}

export interface SvgExportOptions {
  layout?: MindmapLayout;
  color?: string;
}

/** Exportiert die Mindmap als eigenständiges SVG (Bloomberg-Stil: schwarz/amber). */
export function exportToSVG(mindmap: Mindmap, opts?: SvgExportOptions): string {
  const layout = opts?.layout ?? "tree";
  const accent = opts?.color || ACCENT;
  const { placed, width, height } = layoutNodes(mindmap, layout);
  const byId = new Map(placed.map((p) => [p.node.id, p]));
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" data-layout="${layout}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>`);
  for (const edge of mindmap.edges) {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) continue;
    const x1 = Math.round(a.x + NODE_W / 2);
    const y1 = Math.round(a.y + NODE_H / 2);
    const x2 = Math.round(b.x + NODE_W / 2);
    const y2 = Math.round(b.y + NODE_H / 2);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333333" stroke-width="1.5"/>`);
    if (edge.label) {
      parts.push(
        `<text x="${Math.round((x1 + x2) / 2)}" y="${Math.round((y1 + y2) / 2) - 4}" fill="#888888" font-size="9" font-family="monospace" text-anchor="middle">${escapeXml(edge.label)}</text>`,
      );
    }
  }
  for (const p of placed) {
    const fill = p.depth === 0 ? accent : "#111111";
    const stroke = p.depth === 0 ? accent : "#333333";
    const textFill = p.depth === 0 ? "#000000" : (p.node.color || accent);
    const label = escapeXml(p.node.label.length > 24 ? p.node.label.slice(0, 24) + "…" : p.node.label);
    parts.push(
      `<g data-node-id="${escapeXml(p.node.id)}">` +
      `<rect x="${Math.round(p.x)}" y="${Math.round(p.y)}" width="${NODE_W}" height="${NODE_H}" rx="3" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}"/>` +
      `<text x="${Math.round(p.x + NODE_W / 2)}" y="${Math.round(p.y + NODE_H / 2 + 4)}" fill="${escapeXml(textFill)}" font-size="11" font-family="monospace" text-anchor="middle">${label}</text>` +
      `</g>`,
    );
  }
  if (placed.length === 0) {
    parts.push(`<text x="20" y="40" fill="#888888" font-size="12" font-family="monospace">Leere Mindmap — kein Inhalt.</text>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

/** Exportiert die Mindmap als JSON (lesbar eingerückt). */
export function exportToJSON(mindmap: Mindmap): string {
  return JSON.stringify(mindmap, null, 2);
}

function isValidNode(v: unknown): v is MindmapNode {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === "string" && n.id.length > 0 &&
    typeof n.label === "string" &&
    Array.isArray(n.children) &&
    n.children.every(isValidNode) &&
    (n.color === undefined || typeof n.color === "string")
  );
}

/**
 * Importiert eine Mindmap aus JSON. Wirft einen Error bei ungültigem JSON
 * oder ungültiger Struktur.
 */
export function importFromJSON(json: string): Mindmap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Ungültiges JSON: Parsen fehlgeschlagen.");
  }
  if (typeof parsed !== "object" || parsed === null) throw new Error("Ungültige Mindmap: Kein Objekt.");
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) {
    throw new Error("Ungültige Mindmap: nodes/edges fehlen oder sind keine Arrays.");
  }
  if (!p.nodes.every(isValidNode)) throw new Error("Ungültige Mindmap: Knotenstruktur fehlerhaft.");
  const known = new Set<string>();
  const collect = (nodes: MindmapNode[]): void => {
    for (const n of nodes) {
      if (known.has(n.id)) throw new Error(`Ungültige Mindmap: doppelte Knoten-ID "${n.id}".`);
      known.add(n.id);
      collect(n.children);
    }
  };
  collect(p.nodes as MindmapNode[]);
  for (const e of p.edges as unknown[]) {
    if (typeof e !== "object" || e === null) throw new Error("Ungültige Mindmap: Kante ist kein Objekt.");
    const edge = e as Record<string, unknown>;
    if (typeof edge.from !== "string" || typeof edge.to !== "string") {
      throw new Error("Ungültige Mindmap: Kante braucht from/to als Strings.");
    }
    if (!known.has(edge.from) || !known.has(edge.to)) {
      throw new Error("Ungültige Mindmap: Kante verweist auf unbekannten Knoten.");
    }
    if (edge.label !== undefined && typeof edge.label !== "string") {
      throw new Error("Ungültige Mindmap: Kantenlabel muss ein String sein.");
    }
  }
  return parsed as Mindmap;
}

// ---------------------------------------------------------------------------
// Interaktive Operationen (CRUD auf Knoten)
// ---------------------------------------------------------------------------

/** Fügt einen neuen Knoten als Kind des Elternknotens hinzu. */
export function addNode(map: Mindmap, parentId: string, label: string): MindmapNode {
  const parent = findNode(map, parentId);
  if (!parent) throw new Error(`Elternknoten ${parentId} nicht gefunden`);
  const node: MindmapNode = { id: genId("mm"), label, children: [] };
  parent.children.push(node);
  map.edges.push({ from: parentId, to: node.id });
  return node;
}

/** Entfernt einen Knoten (rekursive Unterknoten und Kanten). */
export function removeNode(map: Mindmap, nodeId: string): void {
  const parent = findParent(map, nodeId);
  if (parent) {
    parent.children = parent.children.filter((c) => c.id !== nodeId);
  } else {
    map.nodes = map.nodes.filter((n) => n.id !== nodeId);
  }
  map.edges = map.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  // Rekursive Unterknoten entfernen
  const collectIds = (id: string): string[] => {
    const node = findNode(map, id);
    if (!node) return [id];
    return [id, ...node.children.flatMap((c) => collectIds(c.id))];
  };
  const toRemove = collectIds(nodeId);
  map.edges = map.edges.filter((e) => !toRemove.includes(e.from) && !toRemove.includes(e.to));
}

/** Ändert das Label eines Knotens. */
export function updateNode(map: Mindmap, nodeId: string, label: string): void {
  const node = findNode(map, nodeId);
  if (!node) throw new Error(`Knoten ${nodeId} nicht gefunden`);
  node.label = label;
}

function findNode(map: Mindmap, id: string): MindmapNode | null {
  const search = (nodes: MindmapNode[]): MindmapNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = search(n.children);
      if (found) return found;
    }
    return null;
  };
  return search(map.nodes);
}

function findParent(map: Mindmap, id: string): MindmapNode | null {
  const search = (nodes: MindmapNode[]): MindmapNode | null => {
    for (const n of nodes) {
      if (n.children.some((c) => c.id === id)) return n;
      const found = search(n.children);
      if (found) return found;
    }
    return null;
  };
  return search(map.nodes);
}

/** Exportiert die Mindmap als Mermaid-Code. */
export function exportToMermaid(map: Mindmap): string {
  const lines: string[] = ["mindmap"];
  const visit = (node: MindmapNode, depth: number): void => {
    const indent = "  ".repeat(depth + 1);
    lines.push(`${indent}${node.label}`);
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  };
  for (const root of map.nodes) {
    visit(root, 0);
  }
  return lines.join("\n");
}
