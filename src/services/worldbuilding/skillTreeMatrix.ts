// SkillTreeMatrix (WP 134.2)
// Skill-Tree- & Klassen-Evolutions-Architekt für Progression Fantasy & LitRPG.
// Verzweigter Fähigkeitenbaum (DAG), Synergie- & Ausschluss-Wächter, SVG-Rendering.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Skill-Tree-DAG
// ---------------------------------------------------------------------------

export type SkillType = "active" | "passive" | "ultimate";

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  tier: number; // 1-5, höher = stärker
  cost: number; // Skillpunkte
  cooldown: number; // Sekunden, 0 = kein Cooldown
  prerequisites: string[]; // IDs von Skill-Nodes
  synergies: string[]; //IDs von Skills, die verstärkt werden
  exclusions: string[]; // IDs von Skills, die sich gegenseitig ausschließen
  icon: string; // Emoji
}

export interface SkillTree {
  id: string;
  name: string;
  description: string;
  nodes: SkillNode[];
}

export const SKILL_TREES: SkillTree[] = [
  {
    id: "pyromancer",
    name: "Pyromant",
    description: "Feuermagie — von der ersten Flamme bis zum Sonnen-Archon.",
    nodes: [
      { id: "firebolt", name: "Feuerblitz", description: "Ein schneller Feuerball.", type: "active", tier: 1, cost: 1, cooldown: 3, prerequisites: [], synergies: [], exclusions: [], icon: "🔥" },
      { id: "flame_shield", name: "Flammenschild", description: "Schützt vor Feuerschaden.", type: "passive", tier: 1, cost: 1, cooldown: 0, prerequisites: [], synergies: [], exclusions: [], icon: "🛡️" },
      { id: "inferno", name: "Höllenfeuer", description: "Ein Sturm aus Flammen.", type: "active", tier: 2, cost: 2, cooldown: 10, prerequisites: ["firebolt"], synergies: ["firebolt"], exclusions: [], icon: "🌋" },
      { id: "phoenix", name: "Phönix", description: "Wiedergeburt aus der Asche.", type: "passive", tier: 3, cost: 3, cooldown: 0, prerequisites: ["flame_shield"], synergies: ["flame_shield"], exclusions: [], icon: "🦅" },
      { id: "solar_archon", name: "Sonnen-Archon", description: "Die Sonne gehorcht dir.", type: "ultimate", tier: 5, cost: 10, cooldown: 60, prerequisites: ["inferno", "phoenix"], synergies: ["inferno", "phoenix"], exclusions: [], icon: "☀️" },
    ],
  },
  {
    id: "cryomancer",
    name: "Kryomant",
    description: "Eismagie — vom Reif bis zum Ewigen Winter.",
    nodes: [
      { id: "frostbolt", name: "Frostblitz", description: "Ein schneller Eisstrahl.", type: "active", tier: 1, cost: 1, cooldown: 3, prerequisites: [], synergies: [], exclusions: ["ice_armor"], icon: "❄️" },
      { id: "ice_armor", name: "Eistrüstung", description: "Schützt vor Kälte.", type: "passive", tier: 1, cost: 1, cooldown: 0, prerequisites: [], synergies: [], exclusions: ["frostbolt"], icon: "🧊" },
      { id: "blizzard", name: "Schneesturm", description: "Ein Sturm aus Schnee und Eis.", type: "active", tier: 2, cost: 2, cooldown: 12, prerequisites: ["frostbolt"], synergies: ["frostbolt"], exclusions: [], icon: "🌨️" },
      { id: "permafrost", name: "Permafrost", description: "Ewiges Eis.", type: "passive", tier: 3, cost: 3, cooldown: 0, prerequisites: ["ice_armor"], synergies: ["ice_armor"], exclusions: [], icon: "🏔️" },
      { id: "eternal_winter", name: "Ewiger Winter", description: "Die Welt erstarrt.", type: "ultimate", tier: 5, cost: 10, cooldown: 90, prerequisites: ["blizzard", "permafrost"], synergies: ["blizzard", "permafrost"], exclusions: [], icon: "🌌" },
    ],
  },
  {
    id: "paladin",
    name: "Heiliger Paladin",
    description: "Heilige Magie — vom Licht bis zum Göttlichen Segen.",
    nodes: [
      { id: "holy_light", name: "Heiliges Licht", description: "Ein Strahl aus reinem Licht.", type: "active", tier: 1, cost: 1, cooldown: 4, prerequisites: [], synergies: [], exclusions: [], icon: "✨" },
      { id: "divine_shield", name: "Göttlicher Schild", description: "Schutz durch den Glauben.", type: "passive", tier: 1, cost: 1, cooldown: 0, prerequisites: [], synergies: [], exclusions: [], icon: "🛡️" },
      { id: "smite", name: "Heilige Strafe", description: "Das Licht verurteilt.", type: "active", tier: 2, cost: 2, cooldown: 8, prerequisites: ["holy_light"], synergies: ["holy_light"], exclusions: [], icon: "⚡" },
      { id: "aura", name: "Heilige Aura", description: "Segnet die Alliierten.", type: "passive", tier: 3, cost: 3, cooldown: 0, prerequisites: ["divine_shield"], synergies: ["divine_shield"], exclusions: [], icon: "🌟" },
      { id: "divine_judgment", name: "Göttliches Urteil", description: "Das endgültige Urteil.", type: "ultimate", tier: 5, cost: 10, cooldown: 120, prerequisites: ["smite", "aura"], synergies: ["smite", "aura"], exclusions: [], icon: "👑" },
    ],
  },
  {
    id: "shadow",
    name: "Schattenmagier",
    description: "Schattenmagie — von der Dunkelheit bis zur Leere.",
    nodes: [
      { id: "shadow_strike", name: "Schlag aus dem Schatten", description: "Ein Angriff aus der Dunkelheit.", type: "active", tier: 1, cost: 1, cooldown: 4, prerequisites: [], synergies: [], exclusions: [], icon: "🌑" },
      { id: "shadow_cloak", name: "Schattenumhang", description: "Verbirgt dich im Schatten.", type: "passive", tier: 1, cost: 1, cooldown: 0, prerequisites: [], synergies: [], exclusions: [], icon: "🧥" },
      { id: "void_bolt", name: "Leerenschlag", description: "Ein Schlag aus der Leere.", type: "active", tier: 2, cost: 2, cooldown: 10, prerequisites: ["shadow_strike"], synergies: ["shadow_strike"], exclusions: [], icon: "🕳️" },
      { id: "dark_presence", name: "Dunkle Präsenz", description: "Die Dunkelheit folgt dir.", type: "passive", tier: 3, cost: 3, cooldown: 0, prerequisites: ["shadow_cloak"], synergies: ["shadow_cloak"], exclusions: [], icon: "👤" },
      { id: "oblivion", name: "Vergessenheit", description: "Die Welt vergisst dich.", type: "ultimate", tier: 5, cost: 10, cooldown: 90, prerequisites: ["void_bolt", "dark_presence"], synergies: ["void_bolt", "dark_presence"], exclusions: [], icon: "🌌" },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. Klassen-Evolutionen
// ---------------------------------------------------------------------------

export interface ClassEvolution {
  id: string;
  name: string;
  fromClass: string;
  toClass: string;
  levelRequired: number;
  prerequisites: string[]; // Skill-IDs
  description: string;
}

export const CLASS_EVOLUTIONS: ClassEvolution[] = [
  { id: "apprentice_pyromancer", name: "Lehrling des Feuers", fromClass: "Magier-Lehrling", toClass: "Pyromant", levelRequired: 5, prerequisites: ["firebolt"], description: "Der erste Funken Feuer wird zur Flamme." },
  { id: "pyromancer_inferno", name: "Höllenfürst", fromClass: "Pyromant", toClass: "Höllenfürst", levelRequired: 15, prerequisites: ["inferno"], description: "Die Flamme wird zum Sturm." },
  { id: "solar_archon", name: "Sonnen-Archon", fromClass: "Höllenfürst", toClass: "Sonnen-Archon", levelRequired: 30, prerequisites: ["solar_archon"], description: "Die Sonne selbst gehört dir." },
  { id: "apprentice_cryomancer", name: "Lehrling des Eises", fromClass: "Magier-Lehrling", toClass: "Kryomant", levelRequired: 5, prerequisites: ["frostbolt"], description: "Der erste Reif wird zur Eiskristalle." },
  { id: "eternal_winter_lord", name: "Herr des Ewigen Winters", fromClass: "Kryomant", toClass: "Herr des Ewigen Winters", levelRequired: 30, prerequisites: ["eternal_winter"], description: "Die Welt erstarrt unter deinem Atem." },
  { id: "paladin_knight", name: "Heiliger Ritter", fromClass: "Krieger", toClass: "Heiliger Ritter", levelRequired: 10, prerequisites: ["holy_light"], description: "Dein Schwert wird zum Symbol des Lichts." },
  { id: "divine_champion", name: "Göttlicher Champion", fromClass: "Heiliger Ritter", toClass: "Göttlicher Champion", levelRequired: 25, prerequisites: ["divine_judgment"], description: "Die Götter selbst kämpfen an deiner Seite." },
  { id: "shadow_initiate", name: "Schatten-Lehrling", fromClass: "Dieb", toClass: "Schatten-Lehrling", levelRequired: 5, prerequisites: ["shadow_strike"], description: "Die Dunkelheit nimmt dich auf." },
  { id: "void_walker", name: "Leerenwanderer", fromClass: "Schatten-Lehrling", toClass: "Leerenwanderer", levelRequired: 20, prerequisites: ["oblivion"], description: "Du zwischen den Schatten." },
];

// ---------------------------------------------------------------------------
// 3. Synergie- & Ausschluss-Wächter
// ---------------------------------------------------------------------------

export interface SynergyResult {
  valid: boolean;
  violations: string[];
  synergies: SkillNode[];
  exclusions: SkillNode[];
}

export function validateSkillPath(treeId: string, selectedSkillIds: string[]): SynergyResult {
  const tree = SKILL_TREES.find((t) => t.id === treeId);
  if (!tree) throw new Error(`Unknown tree: ${treeId}`);

  const selected = tree.nodes.filter((n) => selectedSkillIds.includes(n.id));
  const violations: string[] = [];
  const synergies: SkillNode[] = [];
  const exclusions: SkillNode[] = [];

  for (const node of selected) {
    // Check prerequisites
    for (const prereqId of node.prerequisites) {
      if (!selectedSkillIds.includes(prereqId)) {
        violations.push(`${node.name} requires ${tree.nodes.find((n) => n.id === prereqId)?.name ?? prereqId}`);
      }
    }

    // Check exclusions
    for (const exclusionId of node.exclusions) {
      if (selectedSkillIds.includes(exclusionId)) {
        const excludedNode = tree.nodes.find((n) => n.id === exclusionId);
        if (excludedNode) {
          violations.push(`${node.name} excludes ${excludedNode.name}`);
          exclusions.push(excludedNode);
        }
      }
    }

    // Collect synergies
    for (const synergyId of node.synergies) {
      if (selectedSkillIds.includes(synergyId)) {
        const synergyNode = tree.nodes.find((n) => n.id === synergyId);
        if (synergyNode && !synergies.includes(synergyNode)) {
          synergies.push(synergyNode);
        }
      }
    }
  }

  return { valid: violations.length === 0, violations, synergies, exclusions };
}

// ---------------------------------------------------------------------------
// 4. Pfad-Berechnung
// ---------------------------------------------------------------------------

export interface SkillPath {
  nodes: SkillNode[];
  totalCost: number;
  totalCooldown: number;
  maxTier: number;
}

export function calculateOptimalPath(treeId: string, targetSkillId: string): SkillPath {
  const tree = SKILL_TREES.find((t) => t.id === treeId);
  if (!tree) throw new Error(`Unknown tree: ${treeId}`);
  const t = tree;

  const target = t.nodes.find((n) => n.id === targetSkillId);
  if (!target) throw new Error(`Unknown skill: ${targetSkillId}`);

  const path: SkillNode[] = [];
  const visited = new Set<string>();

  function traverse(node: SkillNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    path.push(node);
    for (const prereqId of node.prerequisites) {
      const prereq = t.nodes.find((n) => n.id === prereqId);
      if (prereq) traverse(prereq);
    }
  }

  traverse(target);

  return {
    nodes: path,
    totalCost: path.reduce((sum, n) => sum + n.cost, 0),
    totalCooldown: path.reduce((sum, n) => sum + n.cooldown, 0),
    maxTier: Math.max(...path.map((n) => n.tier)),
  };
}

// ---------------------------------------------------------------------------
// 5. SVG-Rendering-Daten
// ---------------------------------------------------------------------------

export interface SVGNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  icon: string;
  tier: number;
}

export interface SVGEdge {
  from: string;
  to: string;
}

export interface SkillTreeSVG {
  nodes: SVGNode[];
  edges: SVGEdge[];
  width: number;
  height: number;
}

export function generateSkillTreeSVG(treeId: string): SkillTreeSVG {
  const tree = SKILL_TREES.find((t) => t.id === treeId);
  if (!tree) throw new Error(`Unknown tree: ${treeId}`);

  const nodes: SVGNode[] = [];
  const edges: SVGEdge[] = [];
  const tierGroups = new Map<number, SkillNode[]>();

  for (const node of tree.nodes) {
    if (!tierGroups.has(node.tier)) tierGroups.set(node.tier, []);
    tierGroups.get(node.tier)!.push(node);
  }

  const tierHeight = 80;
  const nodeWidth = 120;
  const nodeHeight = 50;
  const padding = 20;

  let maxWidth = 0;

  for (const [tier, tierNodes] of tierGroups) {
    const totalWidth = tierNodes.length * (nodeWidth + padding) - padding;
    maxWidth = Math.max(maxWidth, totalWidth);
    const startX = (maxWidth - totalWidth) / 2;

    for (let i = 0; i < tierNodes.length; i++) {
      const node = tierNodes[i];
      nodes.push({
        id: node.id,
        x: startX + i * (nodeWidth + padding),
        y: (tier - 1) * tierHeight,
        width: nodeWidth,
        height: nodeHeight,
        color: getNodeColor(node.type),
        label: node.name,
        icon: node.icon,
        tier: node.tier,
      });
    }
  }

  for (const node of tree.nodes) {
    for (const prereqId of node.prerequisites) {
      edges.push({ from: prereqId, to: node.id });
    }
  }

  const height = (Math.max(...tierGroups.keys()) - 1) * tierHeight + nodeHeight + 20;

  return { nodes, edges, width: maxWidth + 40, height };
}

function getNodeColor(type: SkillType): string {
  switch (type) {
    case "active": return "#4fc3f7";
    case "passive": return "#81c784";
    case "ultimate": return "#ffb74d";
  }
}

// ---------------------------------------------------------------------------
// 6. Hilfsfunktionen
// ---------------------------------------------------------------------------

export function getSkillTreeById(id: string): SkillTree {
  const tree = SKILL_TREES.find((t) => t.id === id);
  if (!tree) throw new Error(`Unknown tree: ${id}`);
  return tree;
}

export function getSkillNodeById(treeId: string, skillId: string): SkillNode {
  const tree = getSkillTreeById(treeId);
  const node = tree.nodes.find((n) => n.id === skillId);
  if (!node) throw new Error(`Unknown skill: ${skillId}`);
  return node;
}

export function getAllSkillTrees(): SkillTree[] {
  return [...SKILL_TREES];
}

export function getClassEvolutionById(id: string): ClassEvolution {
  const evo = CLASS_EVOLUTIONS.find((e) => e.id === id);
  if (!evo) throw new Error(`Unknown evolution: ${id}`);
  return evo;
}

export function getAllClassEvolutions(): ClassEvolution[] {
  return [...CLASS_EVOLUTIONS];
}
