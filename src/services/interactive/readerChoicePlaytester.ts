/**
 * Reader-Choice Playtester — WP 46.2 (Gamebook Monte-Carlo)
 *
 * Lokaler, deterministischer Service zur Analyse von Spielbuch-/Gamebook-
 * Strukturen. Führt Monte-Carlo-Playthroughs mit einem geseedeten Zufalls-
 * generator (mulberry32) aus und erkennt Sackgassen, unfaire Würfelproben,
 * Endlosschleifen sowie heiße/kalte Pfade.
 *
 * Keine LLM-Aufrufe, keine Netzwerkzugriffe, keine Seiteneffekte.
 * Alle Funktionen sind defensiv: fehlende/ungültige Daten führen zu leeren
 * bzw. stabilen Ergebnissen statt zu Exceptions.
 */

// ─── Typen ───────────────────────────────────────────────────────────────────

export interface GamebookChoice {
  text: string;
  targetNodeId: string;
  condition?: string;
  diceThreshold?: number;
}

export interface GamebookNode {
  id: string;
  text: string;
  choices: GamebookChoice[];
  isEnding?: boolean;
  endingType?: 'good' | 'bad' | 'neutral';
}

export interface Gamebook {
  id: string;
  title: string;
  nodes: GamebookNode[];
}

export interface SimulatedPath {
  nodeIds: string[];
  choices: string[];
  endingType?: string;
}

export interface SimulationResult {
  iterations: number;
  paths: SimulatedPath[];
  endingCounts: Record<string, number>;
  averagePathLength: number;
}

export interface DeadEnd {
  nodeId: string;
  reason: string;
}

export interface UnfairThreshold {
  nodeId: string;
  choiceText: string;
  threshold: number;
  reason: string;
}

export interface InfiniteLoop {
  nodeIds: string[];
  reason: string;
}

export interface PathHeatmap {
  nodeVisits: Record<string, number>;
  hotPaths: string[];
  coldPaths: string[];
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

/** Maximale Schrittzahl eines einzelnen Playthroughs (Loop-Schutz). */
export const MAX_PLAYTHROUGH_STEPS = 100;

/** Obergrenze für die Anzahl der Simulationen (Missbrauchsschutz). */
export const MAX_ITERATIONS = 100_000;

/** Anteil der Playthroughs, ab dem ein Knoten als "heiß" gilt. */
const HOT_RATIO = 0.5;

/** Anteil der Playthroughs, unter dem ein Knoten als "kalt" gilt. */
const COLD_RATIO = 0.1;

/** Erkannte Startknoten-IDs (in Prioritätsreihenfolge, case-insensitiv). */
const START_IDS = ['start', 'start_node', 'startnode', 'begin', 'intro', 'anfang'];

/** Literale, die eine Bedingung als nie erfüllbar markieren. */
const FALSE_LITERALS = new Set([
  'false',
  'no',
  'nein',
  'never',
  'nie',
  '0',
  'off',
  'unmoeglich',
  'unmöglich',
]);

// ─── Deterministischer Zufall ────────────────────────────────────────────────

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Leitet den Seed defensiv aus Buch-ID (Fallback: Titel, dann Konstante) ab. */
function seedFor(book: Gamebook | null | undefined): number {
  const id = book && typeof book.id === 'string' && book.id.length > 0 ? book.id : '';
  const title = book && typeof book.title === 'string' ? book.title : '';
  return hashString(id || title || 'gamebook');
}

// ─── Struktur-Helfer ─────────────────────────────────────────────────────────

/** Filtert gültige Knoten (mit nicht-leerer id) defensiv heraus. */
function asNodes(book: Gamebook | null | undefined): GamebookNode[] {
  if (!book || !Array.isArray(book.nodes)) return [];
  return book.nodes.filter(
    (n): n is GamebookNode => !!n && typeof n.id === 'string' && n.id.length > 0,
  );
}

function buildNodeMap(nodes: GamebookNode[]): Map<string, GamebookNode> {
  const map = new Map<string, GamebookNode>();
  for (const n of nodes) {
    if (!map.has(n.id)) map.set(n.id, n);
  }
  return map;
}

/**
 * Ermittelt den Startknoten deterministisch:
 * 1. bekannte Start-IDs, 2. erster Knoten ohne eingehende Kante (In-Grad 0),
 * 3. erster Knoten der Liste.
 */
function findStartNode(nodes: GamebookNode[]): GamebookNode | null {
  if (nodes.length === 0) return null;

  for (const id of START_IDS) {
    const match = nodes.find((n) => n.id.toLowerCase() === id);
    if (match) return match;
  }

  const targeted = new Set<string>();
  for (const n of nodes) {
    const choices = Array.isArray(n.choices) ? n.choices : [];
    for (const c of choices) {
      if (c && typeof c.targetNodeId === 'string' && c.targetNodeId.length > 0) {
        targeted.add(c.targetNodeId);
      }
    }
  }

  const root = nodes.find((n) => !targeted.has(n.id));
  return root ?? nodes[0] ?? null;
}

/** Choices, deren Zielknoten tatsächlich existiert. */
function usableChoices(
  node: GamebookNode,
  map: Map<string, GamebookNode>,
): GamebookChoice[] {
  const choices = Array.isArray(node.choices) ? node.choices : [];
  return choices.filter(
    (c): c is GamebookChoice =>
      !!c &&
      typeof c.targetNodeId === 'string' &&
      c.targetNodeId.length > 0 &&
      map.has(c.targetNodeId),
  );
}

// ─── Bedingungs-Analyse ──────────────────────────────────────────────────────

/**
 * Erkennt Bedingungen, die unter keinen Umständen erfüllbar sind:
 * bekannte Falsch-Literale sowie konstante Zahlenvergleiche (z. B. "1 > 2").
 */
function isImpossibleCondition(condition?: string): boolean {
  if (typeof condition !== 'string') return false;
  const trimmed = condition.trim();
  if (trimmed.length === 0) return false;

  if (FALSE_LITERALS.has(trimmed.toLowerCase())) return true;

  const m = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (m) {
    const a = Number(m[1]);
    const op = m[2];
    const b = Number(m[3]);
    switch (op) {
      case '==':
        return a !== b;
      case '!=':
        return a === b;
      case '>':
        return !(a > b);
      case '<':
        return !(a < b);
      case '>=':
        return !(a >= b);
      case '<=':
        return !(a <= b);
      default:
        return false;
    }
  }

  return false;
}

function clampIterations(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const floored = Math.floor(n);
  if (floored <= 0) return 0;
  return Math.min(floored, MAX_ITERATIONS);
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/** Simuliert einen einzelnen Durchlauf bis Ending, Sackgasse oder Schrittlimit. */
function simulateSingle(
  start: GamebookNode,
  map: Map<string, GamebookNode>,
  rng: () => number,
): SimulatedPath {
  const nodeIds: string[] = [];
  const choices: string[] = [];
  let endingType: string | undefined;

  let current: GamebookNode | undefined = start;
  for (let step = 0; step < MAX_PLAYTHROUGH_STEPS && current; step++) {
    nodeIds.push(current.id);

    if (current.isEnding) {
      endingType = current.endingType ?? 'neutral';
      break;
    }

    const usable = usableChoices(current, map);
    if (usable.length === 0) break; // Sackgasse

    const idx = Math.floor(rng() * usable.length);
    const chosen = usable[idx] ?? usable[usable.length - 1];
    choices.push(typeof chosen.text === 'string' ? chosen.text : '');
    current = map.get(chosen.targetNodeId);
  }

  return { nodeIds, choices, endingType };
}

/**
 * Führt `iterations` Monte-Carlo-Playthroughs aus.
 * Deterministisch: gleicher Input → identisches Ergebnis (Seed aus Buch-ID).
 */
export function simulatePlaythroughs(
  book: Gamebook,
  iterations: number,
): SimulationResult {
  const nodes = asNodes(book);
  const map = buildNodeMap(nodes);
  const effective = clampIterations(iterations);

  const paths: SimulatedPath[] = [];
  const endingCounts: Record<string, number> = {};
  let totalLength = 0;

  const start = findStartNode(nodes);
  if (start && effective > 0) {
    const rng = createSeededRandom(seedFor(book));
    for (let i = 0; i < effective; i++) {
      const path = simulateSingle(start, map, rng);
      paths.push(path);
      totalLength += path.nodeIds.length;
      const key = path.endingType ?? 'none';
      endingCounts[key] = (endingCounts[key] ?? 0) + 1;
    }
  }

  const averagePathLength = paths.length > 0 ? totalLength / paths.length : 0;

  return { iterations: effective, paths, endingCounts, averagePathLength };
}

// ─── Sackgassen ──────────────────────────────────────────────────────────────

/** Findet Knoten ohne nutzbare Choices, die kein Ending sind. */
export function detectDeadEnds(book: Gamebook): DeadEnd[] {
  const nodes = asNodes(book);
  const map = buildNodeMap(nodes);
  const deadEnds: DeadEnd[] = [];

  for (const node of nodes) {
    if (node.isEnding) continue;

    const choices = Array.isArray(node.choices) ? node.choices : [];
    if (choices.length === 0) {
      deadEnds.push({
        nodeId: node.id,
        reason: 'Node ohne Choices und kein Ending',
      });
      continue;
    }

    if (usableChoices(node, map).length === 0) {
      deadEnds.push({
        nodeId: node.id,
        reason: 'Alle Choices verweisen auf unbekannte Zielknoten',
      });
    }
  }

  return deadEnds;
}

// ─── Unfaire Würfelproben ────────────────────────────────────────────────────

/** Findet unmögliche Würfelproben (Schwelle außerhalb 1–6) und nie erfüllbare Bedingungen. */
export function detectUnfairThresholds(book: Gamebook): UnfairThreshold[] {
  const nodes = asNodes(book);
  const unfair: UnfairThreshold[] = [];

  for (const node of nodes) {
    const choices = Array.isArray(node.choices) ? node.choices : [];
    for (const choice of choices) {
      if (!choice) continue;
      const text = typeof choice.text === 'string' ? choice.text : '';
      const t = choice.diceThreshold;

      if (typeof t === 'number' && Number.isFinite(t)) {
        if (t > 6) {
          unfair.push({
            nodeId: node.id,
            choiceText: text,
            threshold: t,
            reason: `Schwelle ${t} > 6: mit einem W6 (1–6) unerreichbar`,
          });
          continue;
        }
        if (t < 1) {
          unfair.push({
            nodeId: node.id,
            choiceText: text,
            threshold: t,
            reason: `Schwelle ${t} < 1: ungültige Würfelprobe`,
          });
          continue;
        }
      }

      if (isImpossibleCondition(choice.condition)) {
        unfair.push({
          nodeId: node.id,
          choiceText: text,
          threshold: typeof t === 'number' && Number.isFinite(t) ? t : 0,
          reason: `Bedingung "${choice.condition}" ist nie erfüllbar`,
        });
      }
    }
  }

  return unfair;
}

// ─── Endlosschleifen ─────────────────────────────────────────────────────────

/**
 * Erkennt Zyklen, in denen ein Knoten ≥ 3× im selben Pfad auftritt.
 * DFS ab Startknoten, budgetiert (Loop-Schutz), deterministisch.
 */
export function detectInfiniteLoops(book: Gamebook): InfiniteLoop[] {
  const nodes = asNodes(book);
  const map = buildNodeMap(nodes);
  const start = findStartNode(nodes);
  if (!start) return [];

  const loops: InfiniteLoop[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const path: string[] = [];
  let budget = 50_000;

  const visit = (nodeId: string): void => {
    if (budget <= 0 || path.length >= MAX_PLAYTHROUGH_STEPS) return;
    budget -= 1;

    const node = map.get(nodeId);
    if (!node || node.isEnding) return;

    const c = (counts.get(nodeId) ?? 0) + 1;
    counts.set(nodeId, c);
    path.push(nodeId);

    if (c >= 3) {
      const occurrences: number[] = [];
      for (let i = 0; i < path.length; i++) {
        if (path[i] === nodeId) occurrences.push(i);
      }
      const segment = path.slice(occurrences[0], occurrences[occurrences.length - 1] + 1);
      const unique = Array.from(new Set(segment));
      const key = [...unique].sort().join('|');

      if (!seen.has(key)) {
        seen.add(key);
        const closed = unique.every((id) => {
          const n = map.get(id);
          if (!n) return false;
          const u = usableChoices(n, map);
          return u.length > 0 && u.every((ch) => unique.includes(ch.targetNodeId));
        });
        loops.push({
          nodeIds: unique,
          reason:
            `Knoten "${nodeId}" wiederholt sich 3× im Pfad (${segment.join(' → ')})` +
            (closed ? ' — geschlossener Zyklus ohne Ausweg' : ' — Zyklus mit möglichem Ausweg'),
        });
      }
    } else {
      for (const ch of usableChoices(node, map)) {
        visit(ch.targetNodeId);
      }
    }

    path.pop();
    counts.set(nodeId, c - 1);
  };

  visit(start.id);
  return loops;
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

/**
 * Aggregiert Knoten-Besuche über alle simulierten Pfade.
 * nodeVisits zählt, in wie vielen Playthroughs ein Knoten vorkam.
 * hotPaths = ≥ 50 % der Pfade, coldPaths = < 10 % (inkl. nie besucht).
 */
export function generateHeatmap(book: Gamebook, result: SimulationResult): PathHeatmap {
  const nodes = asNodes(book);
  const nodeVisits: Record<string, number> = {};
  for (const n of nodes) nodeVisits[n.id] = 0;

  const paths = result && Array.isArray(result.paths) ? result.paths : [];

  for (const p of paths) {
    if (!p || !Array.isArray(p.nodeIds)) continue;
    const seenInPath = new Set<string>();
    for (const id of p.nodeIds) {
      if (typeof id !== 'string' || seenInPath.has(id)) continue;
      seenInPath.add(id);
      nodeVisits[id] = (nodeVisits[id] ?? 0) + 1;
    }
  }

  const total = paths.length;
  const ids = Object.keys(nodeVisits);

  const hotThreshold = total > 0 ? total * HOT_RATIO : Infinity;
  const coldThreshold = total > 0 ? total * COLD_RATIO : Infinity;

  const hotPaths = ids
    .filter((id) => total > 0 && nodeVisits[id] >= hotThreshold)
    .sort((a, b) => nodeVisits[b] - nodeVisits[a] || a.localeCompare(b));

  const coldPaths = ids
    .filter((id) => (total === 0 ? true : nodeVisits[id] < coldThreshold))
    .sort((a, b) => nodeVisits[a] - nodeVisits[b] || a.localeCompare(b));

  return { nodeVisits, hotPaths, coldPaths };
}
