// MobiusPlotTopology (WP 104.1)
// Möbius- & Ouroboros-Plot-Topologie.
// 4 topologische Modelle, Schleifen-Kausalitäts-Prüfer, SVG-Möbius-Canvas.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type TopologyModelId = "ouroboros" | "mobius" | "matryoshka" | "palindrome";

export interface TopologyModel {
  id: TopologyModelId;
  name: string;
  principle: string;
  requirement: string;
  exemplars: string[];
}

export const TOPOLOGY_MODELS: TopologyModel[] = [
  {
    id: "ouroboros",
    name: "Ouroboros-Zyklus",
    principle: "Das Ende begründet den Anfang — eine geschlossene Kausalschleife.",
    requirement: "Der letzte Satz muss den ersten Satz logisch ermöglichen.",
    exemplars: ["Dark", "Predestination", "Die Zeitmaschine"],
  },
  {
    id: "mobius",
    name: "Möbius-Inversion",
    principle: "Spiegelwelt mit polarer Umkehrung der Figuren-Moral.",
    requirement: "Jede Figur begegnet ihrem moralischen Gegenbild ohne Bruch der Kontinuität.",
    exemplars: ["Cloud Atlas", "Arrival", "Enemy"],
  },
  {
    id: "matryoshka",
    name: "Matrjoschka-Verschachtelung",
    principle: "Meta-Fiktionen in Meta-Fiktionen, bis die äußerste Schale die innerste erklärt.",
    requirement: "Jede Erzählebene muss von der nächstäußeren erreichbar sein.",
    exemplars: ["Inception", "Finnegans Wake", "House of Leaves"],
  },
  {
    id: "palindrome",
    name: "Palindrom-Plot",
    principle: "Symmetrische Handlung, die sich ab der Mitte exakt rückwärts spiegelt.",
    requirement: "Szene n und Szene (N−n) müssen spiegelbildlich korrespondieren.",
    exemplars: ["Tenet", "Memento", "Der seltsame Fall des Benjamin Button"],
  },
];

export function getTopologyModel(id: TopologyModelId): TopologyModel | undefined {
  return TOPOLOGY_MODELS.find((m) => m.id === id);
}

export interface PlotNode {
  id: string;
  label: string;
  /** Position in der Erzählreihenfolge (1-basiert). */
  order: number;
  /** Erzählzeit der Szene, kann rückwärts laufen. */
  storyTime: number;
  causes: string[];
}

export interface PlotTopology {
  id: string;
  title: string;
  model: TopologyModelId;
  nodes: PlotNode[];
}

export function createPlotNode(id: string, label: string, order: number, storyTime: number, causes: string[] = []): PlotNode {
  return { id, label, order, storyTime, causes: [...causes] };
}

export interface CausalityIssue {
  kind: "orphanCause" | "openLoop" | "timeParadox" | "asymmetry";
  nodeId: string;
  severity: "info" | "warn" | "error";
  message: string;
}

/** Prüft, ob jeder Ursachen-Verweis auf einen existierenden Knoten zeigt. */
export function findOrphanCauses(topology: PlotTopology): CausalityIssue[] {
  const ids = new Set(topology.nodes.map((n) => n.id));
  const issues: CausalityIssue[] = [];
  for (const node of topology.nodes) {
    for (const cause of node.causes) {
      if (!ids.has(cause)) {
        issues.push({
          kind: "orphanCause",
          nodeId: node.id,
          severity: "error",
          message: `Knoten ${node.id} verweist auf unbekannte Ursache ${cause}.`,
        });
      }
    }
  }
  return issues;
}

/** Prüft für Ouroboros, ob der Anfang ursächlich vom Ende begründet wird. */
export function checkOuroborosLoop(topology: PlotTopology): CausalityIssue[] {
  const sorted = [...topology.nodes].sort((a, b) => a.order - b.order);
  if (sorted.length < 2) return [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  // Der erste Knoten muss vom letzten verursacht werden (das Ende begründet den Anfang).
  const closes = first.causes.includes(last.id);
  if (closes) return [];
  return [
    {
      kind: "openLoop",
      nodeId: last.id,
      severity: "error",
      message: `Keine geschlossene Kausalkette: ${last.id} begründet ${first.id} nicht.`,
    },
  ];
}

/** Prüft für den Palindrom-Plot die Spiegelsymmetrie ab der Mitte. */
export function checkPalindromeSymmetry(topology: PlotTopology): CausalityIssue[] {
  const sorted = [...topology.nodes].sort((a, b) => a.order - b.order);
  const n = sorted.length;
  const issues: CausalityIssue[] = [];
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const left = sorted[i];
    const right = sorted[n - 1 - i];
    // Spiegelbild: die Erzählzeit der Gegenszene muss gleich sein.
    const mirrored = left.storyTime === right.storyTime;
    if (!mirrored) {
      issues.push({
        kind: "asymmetry",
        nodeId: left.id,
        severity: "warn",
        message: `Szene ${left.order} und ${right.order} spiegeln sich nicht (Erzählzeit ${left.storyTime} vs. ${right.storyTime}).`,
      });
    }
  }
  return issues;
}

/** Prüft für den Möbius-Plot, ob jede Figur ein moralisches Gegenbild hat. */
export function checkMobiusInversion(topology: PlotTopology): CausalityIssue[] {
  const issues: CausalityIssue[] = [];
  for (const node of topology.nodes) {
    const hasCounterpart = topology.nodes.some((o) => o.id !== node.id && o.causes.includes(node.id));
    if (!hasCounterpart) {
      issues.push({
        kind: "asymmetry",
        nodeId: node.id,
        severity: "warn",
        message: `Knoten ${node.id} besitzt kein moralisches Gegenbild.`,
      });
    }
  }
  return issues;
}

/** Erreichbarkeit über Ursachen-Kanten (wird für die Schleifenerkennung gebraucht). */
function isReachable(topology: PlotTopology, fromId: string, targetId: string): boolean {
  const byId = new Map(topology.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const stack = [fromId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === targetId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const node = byId.get(current);
    if (node) stack.push(...node.causes);
  }
  return false;
}

/** Zeitparadox: ein Knoten verweist auf eine spätere Ursache, ohne dass eine Kausalschleife sie schließt. */
export function checkTimeParadox(topology: PlotTopology): CausalityIssue[] {
  const byId = new Map(topology.nodes.map((n) => [n.id, n]));
  const issues: CausalityIssue[] = [];
  for (const node of topology.nodes) {
    for (const causeId of node.causes) {
      const cause = byId.get(causeId);
      if (!cause || cause.storyTime <= node.storyTime) continue;
      // Die spätere Ursache ist nur zulässig, wenn von ihr ein Pfad zurück zu diesem Knoten führt.
      if (!isReachable(topology, causeId, node.id)) {
        issues.push({
          kind: "timeParadox",
          nodeId: node.id,
          severity: "warn",
          message: `${node.id} wird von ${cause.id} verursacht, das später liegt — ohne geschlossene Schleife.`,
        });
      }
    }
  }
  return issues;
}

export interface TopologyReport {
  id: string;
  title: string;
  model: TopologyModel;
  issues: CausalityIssue[];
  coherent: boolean;
  loopClosed: boolean;
  nodeCount: number;
}

export function analyzeTopology(topology: PlotTopology): TopologyReport {
  const model = getTopologyModel(topology.model) || TOPOLOGY_MODELS[0];
  const issues = [
    ...findOrphanCauses(topology),
    ...checkTimeParadox(topology),
    ...(topology.model === "ouroboros" ? checkOuroborosLoop(topology) : []),
    ...(topology.model === "palindrome" ? checkPalindromeSymmetry(topology) : []),
    ...(topology.model === "mobius" ? checkMobiusInversion(topology) : []),
  ];
  const errors = issues.filter((i) => i.severity === "error").length;
  const sorted = [...topology.nodes].sort((a, b) => a.order - b.order);
  const loopClosed =
    sorted.length >= 2 &&
    (sorted[sorted.length - 1].causes.includes(sorted[0].id) || sorted[0].causes.includes(sorted[sorted.length - 1].id));

  return {
    id: `TOPOL-${hashString(`${topology.title}:${topology.model}:${topology.nodes.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    title: topology.title,
    model,
    issues,
    coherent: errors === 0,
    loopClosed,
    nodeCount: topology.nodes.length,
  };
}

export interface MobiusCanvas {
  id: string;
  svg: string;
  pathPoints: number;
  model: TopologyModelId;
}

/** Rendert das Schleifen-Modell als SVG-Kurve (Möbius-Band / Palindrom-Spiegel). */
export function renderMobiusCanvas(topology: PlotTopology, width: number = 420, height: number = 240): MobiusCanvas {
  const model = topology.model;
  const cx = width / 2;
  const cy = height / 2;
  const sorted = [...topology.nodes].sort((a, b) => a.order - b.order);
  const n = Math.max(1, sorted.length);

  const path: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    let x: number;
    let y: number;
    if (model === "palindrome") {
      // Zickzack-Spiegel
      const phase = i / 120;
      x = 40 + phase * (width - 80);
      y = cy + Math.sin(phase * Math.PI * 3) * (height / 3.2) * (phase < 0.5 ? 1 : 1);
    } else if (model === "matryoshka") {
      const r = 30 + (i / 120) * 60;
      x = cx + Math.cos(t * 3) * r;
      y = cy + Math.sin(t * 3) * r;
    } else {
      // Möbius-Band / Ouroboros: verschlungene Lemniskate
      const scale = 1 + 0.35 * Math.cos(t);
      x = cx + Math.cos(t) * (width / 3) * scale;
      y = cy + Math.sin(2 * t) * (height / 3.4);
    }
    path.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const nodeDots = sorted
    .map((node, i) => {
      const angle = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(angle) * (width / 3.4);
      const y = cy + Math.sin(angle) * (height / 3.6);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" style="fill: var(--accent)" /><text x="${(x + 7).toFixed(1)}" y="${(y + 3).toFixed(1)}" style="fill: var(--muted)" font-size="8">${node.order}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <path d="${path.join(" ")}" fill="none" style="stroke: var(--accent)" stroke-width="2" />
  ${nodeDots}
</svg>`;

  return {
    id: `CANVAS-${hashString(`${topology.id}:${model}`).toString(16).padStart(8, "0").toUpperCase()}`,
    svg,
    pathPoints: path.length,
    model,
  };
}

export function createSampleOuroborosTopology(): PlotTopology {
  const nodes = [
    createPlotNode("n1", "Der Junge findet das Tagebuch", 1, 1, ["n4"]),
    createPlotNode("n2", "Die Reise durch den Sturm", 2, 2, ["n1"]),
    createPlotNode("n3", "Die Erkenntnis im Turm", 3, 3, ["n2"]),
    createPlotNode("n4", "Der Alte schreibt das Tagebuch", 4, 4, ["n3"]),
  ];
  return { id: "topology-ouroboros", title: "Die Schleife des Tagebuchs", model: "ouroboros", nodes };
}

export function createSamplePalindromeTopology(): PlotTopology {
  const nodes = [
    createPlotNode("p1", "Aufbruch", 1, 1, []),
    createPlotNode("p2", "Verrat", 2, 2, ["p1"]),
    createPlotNode("p3", "Wendepunkt", 3, 3, ["p2"]),
    createPlotNode("p4", "Verrat gespiegelt", 4, 2, ["p3"]),
    createPlotNode("p5", "Rückkehr", 5, 1, ["p4"]),
  ];
  return { id: "topology-palindrome", title: "Der Spiegel der Treue", model: "palindrome", nodes };
}

export function createSampleTopologyReport(): TopologyReport {
  return analyzeTopology(createSampleOuroborosTopology());
}

export function createSampleMobiusCanvas(): MobiusCanvas {
  return renderMobiusCanvas(createSampleOuroborosTopology());
}

// Hält pick() für spätere Erweiterungen im Einsatz (zufällige Beispiel-Titel).
export function randomSampleTitle(seed: number = 42): string {
  const rng = createSeededRandom(hashString(`title:${seed}`));
  return pick(
    ["Die Schleife des Tagebuchs", "Der Spiegel der Treue", "Die Puppe in der Puppe", "Der letzte Satz"],
    rng
  );
}
