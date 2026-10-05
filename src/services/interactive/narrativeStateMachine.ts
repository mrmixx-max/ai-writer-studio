// Interaktiver Zustandsautomat & Inventar-Graph (WP 68.2)
//
// Verzweigte Geschichten scheitern meist an logischen Sackgassen: der Spieler
// steht vor der offenen Tür, hat den Schlüssel aber nie gefunden. Dieser
// Service verwaltet Flags und Variablen, weist Entscheidungen Modifikatoren zu
// und verifiziert mathematisch, dass jedes Ende erreichbar ist.
//
// Design-Regeln (analog visualNovelTransmuter):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Vergleichsoperator einer Bedingung. */
export type ConditionOperator = 'has' | 'not-has' | 'gte' | 'lte' | 'eq';

/** Eine Bedingung über Flags/Variablen. */
export interface StoryCondition {
  /** Name des Flags oder der Variable. */
  key: string;
  /** Vergleichsoperator. */
  operator: ConditionOperator;
  /** Vergleichswert (bei `has`/`not-has` ignoriert). */
  value?: number;
}

/** Ein Zustandsübergang (Entscheidung). */
export interface StoryTransition {
  /** Beschriftung der Option. */
  label: string;
  /** Ziel-Knoten. */
  target: string;
  /** Bedingungen, die alle erfüllt sein müssen. */
  conditions: StoryCondition[];
  /** Flag, das beim Durchlaufen gesetzt wird. */
  setsFlag?: string;
  /** Variablen-Modifikatoren, z. B. { mut: +5, skrupel: -10 }. */
  modifiers: Record<string, number>;
}

/** Ein Knoten im Zustandsgraphen. */
export interface StoryNode {
  /** Eindeutige ID. */
  id: string;
  /** Anzeigetitel. */
  title: string;
  /** true, wenn dieser Knoten ein Ende ist. */
  isEnding: boolean;
  /** Art des Endes (z. B. „gutes-ende"). */
  endingKind?: string;
  /** Bedingungen, die für dieses Ende erfüllt sein müssen. */
  endingConditions: StoryCondition[];
  /** Ausgehende Übergänge. */
  transitions: StoryTransition[];
}

/** Der Zustandsgraph. */
export interface StoryGraph {
  /** Startknoten-ID. */
  start: string;
  /** Alle Knoten. */
  nodes: StoryNode[];
  /** Initiale Flag-Werte. */
  initialFlags: Record<string, number>;
}

/** Ein Eintrag der Enden-Matrix. */
export interface EndingEntry {
  /** Knoten-ID. */
  nodeId: string;
  /** Titel. */
  title: string;
  /** Art des Endes. */
  endingKind: string;
  /** Erreichbar vom Start aus? */
  reachable: boolean;
  /** Menschenlesbare Bedingungen. */
  requirements: string[];
}

/** Ergebnis der Sackgassen-Prüfung. */
export interface DeadEndReport {
  /** true, wenn keine Probleme gefunden wurden. */
  valid: boolean;
  /** Enden, die vom Start aus unerreichbar sind. */
  unreachableEndings: string[];
  /** Knoten ohne Ausgang, die keine Enden sind (echte Sackgassen). */
  deadEnds: string[];
  /** Ziele, die auf unbekannte Knoten zeigen. */
  brokenTargets: string[];
  /** Knoten, die vom Start aus gar nicht erreichbar sind. */
  orphanNodes: string[];
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Prüft, ob eine Bedingung mit den aktuellen Werten erfüllt ist. */
export function checkCondition(
  condition: StoryCondition,
  values: Record<string, number>,
): boolean {
  if (!condition || typeof condition.key !== 'string') return false;
  const actual = values[condition.key];

  switch (condition.operator) {
    case 'has':
      return actual !== undefined && actual > 0;
    case 'not-has':
      return actual === undefined || actual <= 0;
    case 'gte':
      return typeof actual === 'number' && actual >= (condition.value ?? 0);
    case 'lte':
      return typeof actual === 'number' && actual <= (condition.value ?? 0);
    case 'eq':
      return actual === (condition.value ?? 0);
    default:
      return false;
  }
}

/** Prüft, ob alle Bedingungen erfüllt sind. */
export function checkAllConditions(
  conditions: readonly StoryCondition[] | undefined,
  values: Record<string, number>,
): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => checkCondition(c, values));
}

/** Wendet Modifikatoren auf eine Kopie der Werte an. */
function applyModifiers(
  values: Record<string, number>,
  modifiers: Record<string, number> | undefined,
): Record<string, number> {
  const next = { ...values };
  if (!modifiers) return next;
  for (const [key, delta] of Object.entries(modifiers)) {
    if (typeof delta === 'number' && Number.isFinite(delta)) {
      next[key] = (next[key] ?? 0) + delta;
    }
  }
  return next;
}

/** Menschenlesbare Beschreibung einer Bedingung. */
function describeCondition(condition: StoryCondition): string {
  switch (condition.operator) {
    case 'has':
      return `${condition.key} vorhanden`;
    case 'not-has':
      return `${condition.key} nicht vorhanden`;
    case 'gte':
      return `${condition.key} ≥ ${condition.value ?? 0}`;
    case 'lte':
      return `${condition.key} ≤ ${condition.value ?? 0}`;
    case 'eq':
      return `${condition.key} = ${condition.value ?? 0}`;
    default:
      return `${condition.key} (?)`;
  }
}

// ---------------------------------------------------------------------------
// 1) Graph-Durchlauf (Breitensuche mit Zustands-Merge)
// ---------------------------------------------------------------------------

/**
 * Sammelt alle vom Start aus erreichbaren Knoten samt der Werte, mit denen sie
 * erreicht werden können.
 *
 * Bedingungen werden monoton behandelt: ein Knoten gilt als erreichbar, sobald
 * *irgendein* Pfad ihn erreicht. Für die Sackgassen-Prüfung ist das die richtige
 * Frage — „kann der Spieler hierher kommen?" — und sie terminiert garantiert,
 * weil jeder Knoten höchstens einmal in die Warteschlange geht.
 */
export function collectReachable(
  graph: StoryGraph | null | undefined,
): Map<string, Record<string, number>> {
  const reachable = new Map<string, Record<string, number>>();
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return reachable;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const startNode = byId.get(graph.start);
  if (!startNode) return reachable;

  const initial = { ...(graph.initialFlags ?? {}) };
  reachable.set(startNode.id, initial);

  const queue: string[] = [startNode.id];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    const current = byId.get(currentId);
    const values = reachable.get(currentId) ?? initial;
    if (!current) continue;

    for (const transition of current.transitions) {
      const target = byId.get(transition.target);
      if (!target) continue;
      if (!checkAllConditions(transition.conditions, values)) continue;

      const nextValues = applyModifiers(values, transition.modifiers);
      if (transition.setsFlag) {
        nextValues[transition.setsFlag] = (nextValues[transition.setsFlag] ?? 0) + 1;
      }

      // Erster Pfad gewinnt; danach nicht erneut einreihen (Terminierung).
      if (!reachable.has(target.id)) {
        reachable.set(target.id, nextValues);
        queue.push(target.id);
      }
    }
  }

  return reachable;
}

// ---------------------------------------------------------------------------
// 2) Sackgassen- & Logik-Prüfer
// ---------------------------------------------------------------------------

/**
 * Prüft den Graphen auf Sackgassen, unerreichbare Enden und kaputte Ziele.
 *
 * Defensiv: ein leerer Graph meldet `valid: false` mit einem klaren Grund.
 */
export function auditStoryGraph(graph: StoryGraph | null | undefined): DeadEndReport {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return {
      valid: false,
      unreachableEndings: [],
      deadEnds: [],
      brokenTargets: [],
      orphanNodes: [],
    };
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const reachable = collectReachable(graph);

  const unreachableEndings: string[] = [];
  const deadEnds: string[] = [];
  const brokenTargets: string[] = [];
  const orphanNodes: string[] = [];

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      orphanNodes.push(node.id);
    }

    if (node.isEnding) {
      // Ein Ende muss erreichbar sein UND seine Bedingungen müssen unter den
      // Werten erfüllbar sein, mit denen es erreicht wird.
      if (!reachable.has(node.id)) {
        unreachableEndings.push(node.id);
      } else {
        const values = reachable.get(node.id) ?? {};
        if (!checkAllConditions(node.endingConditions, values)) {
          unreachableEndings.push(node.id);
        }
      }
    } else if (node.transitions.length === 0) {
      // Kein Ende, aber kein Ausgang → Sackgasse.
      deadEnds.push(node.id);
    }

    for (const transition of node.transitions) {
      if (!byId.has(transition.target)) {
        brokenTargets.push(`${node.id} → ${transition.target}`);
      }
    }
  }

  return {
    valid:
      unreachableEndings.length === 0 &&
      deadEnds.length === 0 &&
      brokenTargets.length === 0 &&
      orphanNodes.length === 0,
    unreachableEndings,
    deadEnds,
    brokenTargets,
    orphanNodes,
  };
}

// ---------------------------------------------------------------------------
// 3) Enden-Matrix
// ---------------------------------------------------------------------------

/**
 * Listet alle Enden mit ihren Bedingungen und ihrer Erreichbarkeit.
 *
 * Defensiv: ohne Graph wird eine leere Matrix zurückgegeben.
 */
export function buildEndingMatrix(graph: StoryGraph | null | undefined): EndingEntry[] {
  if (!graph || !Array.isArray(graph.nodes)) return [];
  const reachable = collectReachable(graph);

  return graph.nodes
    .filter((n) => n.isEnding)
    .map((n) => {
      const values = reachable.get(n.id) ?? {};
      return {
        nodeId: n.id,
        title: n.title,
        endingKind: n.endingKind ?? 'ende',
        reachable: reachable.has(n.id) && checkAllConditions(n.endingConditions, values),
        requirements: (n.endingConditions ?? []).map(describeCondition),
      };
    });
}

// ---------------------------------------------------------------------------
// 4) Simulation eines Pfades
// ---------------------------------------------------------------------------

/** Ergebnis einer Pfad-Simulation. */
export interface PathSimulation {
  /** true, wenn der Pfad vollständig durchlaufen wurde. */
  completed: boolean;
  /** Durchlaufene Knoten-IDs. */
  visited: string[];
  /** Endzustand der Werte. */
  finalValues: Record<string, number>;
  /** Grund für einen Abbruch. */
  failure?: string;
}

/**
 * Simuliert einen Pfad entlang von Übergangs-Labels.
 *
 * Defensiv: unbekannte Labels oder nicht erfüllte Bedingungen brechen die
 * Simulation mit einem erklärenden `failure` ab, statt zu werfen.
 */
export function simulatePath(
  graph: StoryGraph | null | undefined,
  labels: readonly string[],
): PathSimulation {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return { completed: false, visited: [], finalValues: {}, failure: 'Kein Graph vorhanden.' };
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let current = byId.get(graph.start);
  if (!current) {
    return { completed: false, visited: [], finalValues: {}, failure: `Startknoten „${graph.start}" fehlt.` };
  }

  let values = { ...(graph.initialFlags ?? {}) };
  const visited: string[] = [current.id];

  for (const label of Array.isArray(labels) ? labels : []) {
    if (current.isEnding) {
      return { completed: true, visited, finalValues: values, failure: undefined };
    }

    const transition = current.transitions.find((t) => t.label === label);
    if (!transition) {
      return {
        completed: false,
        visited,
        finalValues: values,
        failure: `Option „${label}" existiert nicht in „${current.id}".`,
      };
    }

    if (!checkAllConditions(transition.conditions, values)) {
      return {
        completed: false,
        visited,
        finalValues: values,
        failure: `Bedingungen für „${label}" nicht erfüllt.`,
      };
    }

    const target = byId.get(transition.target);
    if (!target) {
      return {
        completed: false,
        visited,
        finalValues: values,
        failure: `Ziel „${transition.target}" existiert nicht.`,
      };
    }

    values = applyModifiers(values, transition.modifiers);
    if (transition.setsFlag) {
      values[transition.setsFlag] = (values[transition.setsFlag] ?? 0) + 1;
    }

    current = target;
    visited.push(current.id);
  }

  return {
    completed: current.isEnding,
    visited,
    finalValues: values,
    failure: current.isEnding ? undefined : 'Pfad endet vor einem Endknoten.',
  };
}
