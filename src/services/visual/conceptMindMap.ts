// Concept-Mind-Map-Service (WP 50.1).
// Lokal, kein LLM, keine Netzwerkzugriffe, vollständig deterministisch.
//
// Eine Concept-Mind-Map besteht aus Knoten (Ideen, Figuren, Motive, Konflikte)
// und gerichteten Verbindungen zwischen ihnen. Der Service bietet:
//   1. createMindMap  -> leere Map mit Titel
//   2. addNode        -> Knoten hinzufügen/ersetzen
//   3. connectNodes   -> Knoten verbinden
//   4. autoLayout     -> deterministisches Force-Directed-Layout (50 Iterationen)
//   5. exportToSvg    -> eigenständiges SVG
//
// Alle Eingaben werden defensiv normalisiert: ungültige Werte fallen auf
// neutrale Standardwerte zurück, statt Ausnahmen zu werfen. Es wird niemals
// Math.random() oder eine sonstige nicht-deterministische Quelle verwendet –
// identische Eingaben liefern immer identische Ergebnisse.

export type MindNodeKind = "idea" | "character" | "motive" | "conflict";

export interface MindNode {
  id: string;
  label: string;
  kind: MindNodeKind;
  x: number;
  y: number;
  color: string;
}

export interface NodeConnection {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  color: string;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindNode[];
  connections: NodeConnection[];
}

/** Farb-Token je Knotenart (Vorgabe aus WP 50.1). */
export const KIND_COLORS: Record<MindNodeKind, string> = {
  idea: "accent",
  character: "success",
  motive: "warn",
  conflict: "error",
};

/** Feste Reihenfolge der Knotenarten (deterministisch). */
export const MIND_NODE_KINDS: MindNodeKind[] = [
  "idea",
  "character",
  "motive",
  "conflict",
];

/** Layout-Parameter (feste Werte für deterministische Ergebnisse). */
export const LAYOUT_ITERATIONS = 50;
export const LAYOUT_WIDTH = 1000;
export const LAYOUT_HEIGHT = 700;
export const LAYOUT_PADDING = 60;
export const NODE_RADIUS = 30;

/** Auflösung der Farb-Token zu konkreten Hex-Werten für den SVG-Export. */
const COLOR_HEX: Record<string, string> = {
  accent: "#6366f1",
  success: "#22c55e",
  warn: "#f59e0b",
  error: "#ef4444",
};

const DEFAULT_COLOR = "accent";
const DEFAULT_TITLE = "Unbenannte Mind-Map";
const DEFAULT_RELATION = "verbunden";

// --- kleine, defensive Helfer -------------------------------------------------

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Deterministischer FNV-1a-Hash (hex, 8 Zeichen) – ersetzt Zufalls-IDs. */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeKind(value: unknown): MindNodeKind {
  return MIND_NODE_KINDS.includes(value as MindNodeKind)
    ? (value as MindNodeKind)
    : "idea";
}

function colorForKind(kind: MindNodeKind): string {
  return KIND_COLORS[kind] ?? DEFAULT_COLOR;
}

function resolveColor(color: string): string {
  const token = safeString(color);
  if (!token) return COLOR_HEX[DEFAULT_COLOR];
  return COLOR_HEX[token] ?? token;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- Normalisierung -----------------------------------------------------------

function normalizeNode(raw: unknown): MindNode | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Partial<MindNode>;

  const label = safeString(node.label);
  const id = safeString(node.id) || `node-${hashString(label || "node")}`;
  const kind = normalizeKind(node.kind);
  const color = safeString(node.color) || colorForKind(kind);

  return {
    id,
    label: label || id,
    kind,
    x: safeNumber(node.x, 0),
    y: safeNumber(node.y, 0),
    color,
  };
}

function normalizeConnection(raw: unknown): NodeConnection | null {
  if (!raw || typeof raw !== "object") return null;
  const connection = raw as Partial<NodeConnection>;

  const fromId = safeString(connection.fromId);
  const toId = safeString(connection.toId);
  // Selbstverbindungen und unvollständige Verbindungen verwerfen.
  if (!fromId || !toId || fromId === toId) return null;

  const relation = safeString(connection.relation) || DEFAULT_RELATION;
  const id =
    safeString(connection.id) ||
    `conn-${hashString(`${fromId}->${toId}:${relation}`)}`;
  const color = safeString(connection.color) || DEFAULT_COLOR;

  return { id, fromId, toId, relation, color };
}

/** Bringt beliebige Eingaben in eine gültige MindMap-Form (defensiver Fallback). */
function normalizeMap(input: unknown): MindMap {
  if (!input || typeof input !== "object") return createMindMap(DEFAULT_TITLE);
  const map = input as Partial<MindMap>;

  const title = safeString(map.title) || DEFAULT_TITLE;
  const id = safeString(map.id) || `mindmap-${hashString(title)}`;

  const nodes = Array.isArray(map.nodes)
    ? map.nodes
        .map((node) => normalizeNode(node))
        .filter((node): node is MindNode => node !== null)
    : [];

  const connections = Array.isArray(map.connections)
    ? map.connections
        .map((connection) => normalizeConnection(connection))
        .filter((connection): connection is NodeConnection => connection !== null)
    : [];

  return { id, title, nodes, connections };
}

// --- öffentliche API ----------------------------------------------------------

/**
 * Erstellt eine leere Mind-Map mit Titel.
 * Die id wird deterministisch aus dem Titel abgeleitet.
 */
export function createMindMap(title: string): MindMap {
  const safeTitle = safeString(title) || DEFAULT_TITLE;
  return {
    id: `mindmap-${hashString(safeTitle)}`,
    title: safeTitle,
    nodes: [],
    connections: [],
  };
}

/**
 * Fügt einen Knoten hinzu. Existiert bereits ein Knoten mit gleicher id,
 * wird er ersetzt (defensiv). Ungültige Knoten werden ignoriert.
 * Gibt immer eine neue Map zurück (unveränderlich).
 */
export function addNode(map: MindMap, node: MindNode): MindMap {
  const base = normalizeMap(map);
  const normalized = normalizeNode(node);
  if (!normalized) return base;

  const nodes = base.nodes.slice();
  const index = nodes.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) {
    nodes[index] = normalized;
  } else {
    nodes.push(normalized);
  }
  return { ...base, nodes };
}

/**
 * Verbindet zwei vorhandene Knoten. Unbekannte Knoten-ids oder
 * Selbstverbindungen werden ignoriert (Map bleibt unverändert).
 * Eine bereits bestehende Verbindung zwischen demselben Paar wird ersetzt.
 * Die Verbindungsfarbe leitet sich aus der Farbe des Zielknotens ab.
 */
export function connectNodes(
  map: MindMap,
  fromId: string,
  toId: string,
  relation: string,
): MindMap {
  const base = normalizeMap(map);
  const from = safeString(fromId);
  const to = safeString(toId);

  if (!from || !to || from === to) return base;

  const target = base.nodes.find((node) => node.id === to);
  const source = base.nodes.find((node) => node.id === from);
  if (!source || !target) return base;

  const safeRelation = safeString(relation) || DEFAULT_RELATION;
  const connection: NodeConnection = {
    id: `conn-${hashString(`${from}->${to}:${safeRelation}`)}`,
    fromId: from,
    toId: to,
    relation: safeRelation,
    color: target.color || DEFAULT_COLOR,
  };

  const connections = base.connections.slice();
  const index = connections.findIndex(
    (entry) => entry.fromId === from && entry.toId === to,
  );
  if (index >= 0) {
    connections[index] = connection;
  } else {
    connections.push(connection);
  }

  return { ...base, connections };
}

/**
 * Deterministisches Force-Directed-Layout (Fruchterman-Reingold-Variante).
 * Repulsion zwischen allen Knoten, Attraktion entlang der Kanten, leichte
 * Zentrumsgravitation; die Verschiebung wird über eine abkühlende Temperatur
 * begrenzt. Feste Iterationszahl, keine Zufallsquelle – identische Eingaben
 * ergeben identische Koordinaten.
 */
export function autoLayout(map: MindMap): MindMap {
  const base = normalizeMap(map);
  const nodes = base.nodes.map((node) => ({ ...node }));
  const count = nodes.length;

  if (count === 0) return { ...base, nodes: [] };

  if (count === 1) {
    nodes[0].x = round2(LAYOUT_WIDTH / 2);
    nodes[0].y = round2(LAYOUT_HEIGHT / 2);
    return { ...base, nodes };
  }

  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => indexById.set(node.id, index));

  // Deterministische Startverteilung, wenn alle Knoten auf demselben Punkt
  // liegen (z. B. frisch hinzugefügt, x = y = 0): goldener Winkel, kein Zufall.
  const allSame = nodes.every(
    (node) => node.x === nodes[0].x && node.y === nodes[0].y,
  );
  if (allSame) {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radius = Math.min(LAYOUT_WIDTH, LAYOUT_HEIGHT) * 0.35;
    nodes.forEach((node, index) => {
      const r = radius * Math.sqrt((index + 1) / count);
      const angle = index * goldenAngle;
      node.x = LAYOUT_WIDTH / 2 + r * Math.cos(angle);
      node.y = LAYOUT_HEIGHT / 2 + r * Math.sin(angle);
    });
  }

  const k = Math.sqrt((LAYOUT_WIDTH * LAYOUT_HEIGHT) / count);

  const edges: Array<[number, number]> = [];
  for (const connection of base.connections) {
    const a = indexById.get(connection.fromId);
    const b = indexById.get(connection.toId);
    if (a === undefined || b === undefined || a === b) continue;
    edges.push([a, b]);
  }

  let temperature = LAYOUT_WIDTH / 10;

  for (let iteration = 0; iteration < LAYOUT_ITERATIONS; iteration += 1) {
    const dispX = new Array<number>(count).fill(0);
    const dispY = new Array<number>(count).fill(0);

    // Repulsion zwischen allen Knotenpaaren.
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dist = Math.hypot(dx, dy);

        if (dist < 0.01) {
          // Deterministischer Mini-Versatz gegen Division durch Null.
          dx = i % 2 === 0 ? 0.01 : -0.01;
          dy = j % 2 === 0 ? 0.01 : -0.01;
          dist = Math.hypot(dx, dy);
        }

        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[i] += fx;
        dispY[i] += fy;
        dispX[j] -= fx;
        dispY[j] -= fy;
      }
    }

    // Attraktion entlang der Kanten.
    for (const [a, b] of edges) {
      let dx = nodes[a].x - nodes[b].x;
      let dy = nodes[a].y - nodes[b].y;
      let dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        dx = 0.01;
        dy = 0;
        dist = 0.01;
      }

      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      dispX[a] -= fx;
      dispY[a] -= fy;
      dispX[b] += fx;
      dispY[b] += fy;
    }

    // Leichte Gravitation zur Mitte hält lose Knoten im Bild.
    for (let i = 0; i < count; i += 1) {
      dispX[i] += (LAYOUT_WIDTH / 2 - nodes[i].x) * 0.01;
      dispY[i] += (LAYOUT_HEIGHT / 2 - nodes[i].y) * 0.01;
    }

    // Verschiebung anwenden, begrenzt durch die aktuelle Temperatur.
    for (let i = 0; i < count; i += 1) {
      const length = Math.hypot(dispX[i], dispY[i]);
      if (length < 0.0001) continue;
      const limit = Math.min(length, temperature);
      nodes[i].x += (dispX[i] / length) * limit;
      nodes[i].y += (dispY[i] / length) * limit;
    }

    temperature = Math.max(0.5, temperature * (1 - (iteration + 1) / LAYOUT_ITERATIONS));
  }

  // Gesamtes Layout in den positiven Bereich mit Rand verschieben.
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const shiftX = LAYOUT_PADDING - Math.min(...xs);
  const shiftY = LAYOUT_PADDING - Math.min(...ys);

  for (const node of nodes) {
    node.x = round2(node.x + shiftX);
    node.y = round2(node.y + shiftY);
  }

  return { ...base, nodes };
}

/**
 * Exportiert die Mind-Map als eigenständiges, valides SVG.
 * Koordinaten werden aus den aktuellen Knotenpositionen abgeleitet; fehlende
 * Verbindungsendpunkte werden übersprungen. Immer deterministisch.
 */
export function exportToSvg(map: MindMap): string {
  const base = normalizeMap(map);
  const title = escapeXml(base.title);

  if (base.nodes.length === 0) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 220" width="480" height="220" role="img" aria-label="' +
        title +
        '">',
      '  <rect x="0" y="0" width="480" height="220" fill="#0b1020"/>',
      '  <text x="24" y="40" font-family="sans-serif" font-size="20" fill="#e2e8f0">' +
        title +
        "</text>",
      '  <text x="24" y="120" font-family="sans-serif" font-size="14" fill="#94a3b8">Keine Knoten vorhanden.</text>',
      "</svg>",
    ].join("\n");
  }

  const xs = base.nodes.map((node) => node.x);
  const ys = base.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const pad = 100;
  const originX = round2(minX - pad);
  const originY = round2(minY - pad);
  const width = Math.max(320, Math.ceil(maxX - minX + pad * 2));
  const height = Math.max(240, Math.ceil(maxY - minY + pad * 2));

  const nodeById = new Map<string, MindNode>();
  for (const node of base.nodes) nodeById.set(node.id, node);

  const connectionParts: string[] = [];
  for (const connection of base.connections) {
    const from = nodeById.get(connection.fromId);
    const to = nodeById.get(connection.toId);
    if (!from || !to) continue; // defensiv: Endpunkt fehlt -> überspringen

    const stroke = resolveColor(connection.color);
    const midX = round2((from.x + to.x) / 2);
    const midY = round2((from.y + to.y) / 2);
    connectionParts.push(
      `    <line x1="${round2(from.x)}" y1="${round2(from.y)}" x2="${round2(
        to.x,
      )}" y2="${round2(to.y)}" stroke="${stroke}" stroke-width="2" stroke-opacity="0.7"/>`,
    );
    connectionParts.push(
      `    <text x="${midX}" y="${midY}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#cbd5e1">${escapeXml(
        connection.relation,
      )}</text>`,
    );
  }

  const nodeParts: string[] = [];
  for (const node of base.nodes) {
    const fill = resolveColor(node.color);
    nodeParts.push(
      `    <g class="node" data-id="${escapeXml(node.id)}" data-kind="${node.kind}">`,
    );
    nodeParts.push(
      `      <circle cx="${round2(node.x)}" cy="${round2(
        node.y,
      )}" r="${NODE_RADIUS}" fill="${fill}" fill-opacity="0.9" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2"/>`,
    );
    nodeParts.push(
      `      <text x="${round2(node.x)}" y="${round2(
        node.y,
      )}" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#ffffff">${escapeXml(
        node.label,
      )}</text>`,
    );
    nodeParts.push(
      `      <text x="${round2(node.x)}" y="${round2(
        node.y,
      )}" dy="2.2em" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#cbd5e1">${node.kind}</text>`,
    );
    nodeParts.push("    </g>");
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${originX} ${originY} ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${title}">`,
    `  <rect x="${originX}" y="${originY}" width="${width}" height="${height}" fill="#0b1020"/>`,
    `  <text x="${round2(originX + 24)}" y="${round2(
      originY + 34,
    )}" font-family="sans-serif" font-size="20" fill="#e2e8f0">${title}</text>`,
    '  <g class="connections">',
    ...connectionParts,
    "  </g>",
    '  <g class="nodes">',
    ...nodeParts,
    "  </g>",
    "</svg>",
  ].join("\n");
}
