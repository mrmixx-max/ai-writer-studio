// Relationship Graph Service (WP 6.1): Beziehungs-Graph mit Force-Directed-Layout.
// Lokal, kein LLM nötig, deterministisch.

export interface CharacterNode {
  id: string;
  name: string;
  type: "character" | "faction" | "location";
  x?: number;
  y?: number;
}

export interface RelationshipEdge {
  id: string;
  from: string;
  to: string;
  type: "friendship" | "rivalry" | "family" | "secret";
  startChapter: number;
  endChapter?: number;
}

export interface GraphData {
  nodes: CharacterNode[];
  edges: RelationshipEdge[];
}

// ---------------------------------------------------------------------------
// buildGraph
// ---------------------------------------------------------------------------

/**
 * Baut die Graph-Datenstruktur aus Knoten und Kanten.
 * - Validiert Referenitzintegrität (Kanten auf nicht-existente Knoten werden verworfen)
 * - Entfernt doppelte Kanten (gleiche from/to/type)
 * - Initialisiert fehlende Koordinaten deterministisch (Kreis-Anordnung)
 */
export function buildGraph(
  characters: CharacterNode[],
  relationships: RelationshipEdge[],
): GraphData {
  const nodeIds = new Set(characters.map((c) => c.id));

  // Kanten filtern: beide Enden müssen existieren
  const validEdges = relationships.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to),
  );

  // Duplikate entfernen (gleiche from/to/type)
  const seen = new Set<string>();
  const uniqueEdges: RelationshipEdge[] = [];
  for (const e of validEdges) {
    const key = `${e.from}→${e.to}:${e.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEdges.push(e);
    }
  }

  // Koordinaten initialisieren (deterministisch, Kreis-Anordnung)
  const nodes = characters.map((c, i) => {
    if (c.x !== undefined && c.y !== undefined) return { ...c };
    const angle = (2 * Math.PI * i) / Math.max(1, characters.length);
    const radius = 100;
    return {
      ...c,
      x: 200 + radius * Math.cos(angle),
      y: 200 + radius * Math.sin(angle),
    };
  });

  return { nodes, edges: uniqueEdges };
}

// ---------------------------------------------------------------------------
// applyForceLayout
// ---------------------------------------------------------------------------

/**
 * Wendet einen einfachen Force-Directed-Layout-Algorithmus an.
 *
 * Kräfte:
 * - Abstoßung zwischen allen Knotenpaaren (Coulomb-ähnlich: F ∝ 1/d²)
 * - Anziehung entlang Kanten (Hooke-ähnlich: F ∝ d)
 * - Dämpfung für Stabilität
 *
 * Deterministisch: keine Zufallskomponenten.
 */
export function applyForceLayout(
  graph: GraphData,
  iterations = 100,
): GraphData {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return { nodes: [], edges: [...edges] };

  // Kopie der Knoten mit mutable Positionen
  const positions = nodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));

  const posMap = new Map(positions.map((p) => [p.id, p]));

  // Kanten-Indizes für schnellen Zugriff
  const edgePairs = edges
    .map((e) => ({ from: posMap.get(e.from), to: posMap.get(e.to) }))
    .filter(
      (p): p is { from: (typeof positions)[0]; to: (typeof positions)[0] } =>
        p.from !== undefined && p.to !== undefined,
    );

  const REPULSION = 5000; // Abstoßungs-Konstante
  const ATTRACTION = 0.01; // Anziehungs-Konstante
  const DAMPING = 0.85; // Dämpfungsfaktor
  const MAX_DISPLACEMENT = 50; // Maximaler Schritt pro Iteration

  for (let iter = 0; iter < iterations; iter++) {
    // Kraft-Akkumulatoren
    const fx = new Map<string, number>();
    const fy = new Map<string, number>();
    for (const p of positions) {
      fx.set(p.id, 0);
      fy.set(p.id, 0);
    }

    // Abstoßung zwischen allen Knotenpaaren
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 0.01; // Division durch null vermeiden

        // Coulomb-ähnlich: F = k / d²
        const force = REPULSION / distSq;
        const fxVal = (force * dx) / dist;
        const fyVal = (force * dy) / dist;

        fx.set(a.id, (fx.get(a.id) ?? 0) + fxVal);
        fy.set(a.id, (fy.get(a.id) ?? 0) + fyVal);
        fx.set(b.id, (fx.get(b.id) ?? 0) - fxVal);
        fy.set(b.id, (fy.get(b.id) ?? 0) - fyVal);
      }
    }

    // Anziehung entlang Kanten
    for (const { from, to } of edgePairs) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

      // Hooke-ähnlich: F = k * d
      const force = ATTRACTION * dist;
      const fxVal = (force * dx) / dist;
      const fyVal = (force * dy) / dist;

      fx.set(from.id, (fx.get(from.id) ?? 0) + fxVal);
      fy.set(from.id, (fy.get(from.id) ?? 0) + fyVal);
      fx.set(to.id, (fx.get(to.id) ?? 0) - fxVal);
      fy.set(to.id, (fy.get(to.id) ?? 0) - fyVal);
    }

    // Kräfte anwenden mit Dämpfung und Maximal-Schritt
    for (const p of positions) {
      const deltaX = (fx.get(p.id) ?? 0) * DAMPING;
      const deltaY = (fy.get(p.id) ?? 0) * DAMPING;

      // Maximalen Schritt begrenzen
      const deltaMag = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const scale = deltaMag > MAX_DISPLACEMENT ? MAX_DISPLACEMENT / deltaMag : 1;

      p.x += deltaX * scale;
      p.y += deltaY * scale;
    }
  }

  // Knoten mit aktualisierten Positionen zurückgeben
  const updatedNodes = nodes.map((n) => {
    const pos = posMap.get(n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : { ...n };
  });

  return { nodes: updatedNodes, edges: [...edges] };
}

// ---------------------------------------------------------------------------
// getRelationshipsAtChapter
// ---------------------------------------------------------------------------

/**
 * Filtert Beziehungen nach Kapitel (für Timeline-Slider).
 * Eine Beziehung ist aktiv, wenn:
 * - startChapter <= chapter UND
 * - endChapter ist undefined ODER endChapter >= chapter
 */
export function getRelationshipsAtChapter(
  relationships: RelationshipEdge[],
  chapter: number,
): RelationshipEdge[] {
  return relationships.filter(
    (r) =>
      r.startChapter <= chapter &&
      (r.endChapter === undefined || r.endChapter >= chapter),
  );
}
