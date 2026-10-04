/**
 * Reader-Choice Playtester Tests — WP 46.2
 * Vitest-Unit-Tests für den Gamebook Monte-Carlo Playtester.
 * Deterministisch, defensiv, ohne Netzwerk/LLM.
 */

import { describe, it, expect } from 'vitest';
import {
  simulatePlaythroughs,
  detectDeadEnds,
  detectUnfairThresholds,
  detectInfiniteLoops,
  generateHeatmap,
  MAX_ITERATIONS,
  type Gamebook,
  type GamebookNode,
  type GamebookChoice,
  type SimulationResult,
} from './readerChoicePlaytester';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function node(
  id: string,
  choices: GamebookChoice[] = [],
  extra: Partial<GamebookNode> = {},
): GamebookNode {
  return { id, text: `Text ${id}`, choices, ...extra };
}

/** start → middle → end (good): vollständig linear. */
function linearBook(): Gamebook {
  return {
    id: 'linear',
    title: 'Linear',
    nodes: [
      node('start', [{ text: 'Weiter', targetNodeId: 'middle' }]),
      node('middle', [{ text: 'Zum Ende', targetNodeId: 'end' }]),
      node('end', [], { isEnding: true, endingType: 'good' }),
    ],
  };
}

/** start → a → endA(good) | start → b → endB(bad), plus unerreichbares 'orphan'. */
function branchingBook(): Gamebook {
  return {
    id: 'branching',
    title: 'Branching',
    nodes: [
      node('start', [
        { text: 'Weg A', targetNodeId: 'a' },
        { text: 'Weg B', targetNodeId: 'b' },
      ]),
      node('a', [{ text: 'A-Ende', targetNodeId: 'endA' }]),
      node('b', [{ text: 'B-Ende', targetNodeId: 'endB' }]),
      node('endA', [], { isEnding: true, endingType: 'good' }),
      node('endB', [], { isEnding: true, endingType: 'bad' }),
      node('orphan', [{ text: 'x', targetNodeId: 'endA' }]),
    ],
  };
}

// ─── simulatePlaythroughs ────────────────────────────────────────────────────

describe('simulatePlaythroughs', () => {
  it('führt genau die angeforderte Anzahl an Durchläufen aus', () => {
    const result = simulatePlaythroughs(linearBook(), 25);
    expect(result.iterations).toBe(25);
    expect(result.paths).toHaveLength(25);
  });

  it('ist deterministisch: gleicher Input → identisches Ergebnis', () => {
    const book = branchingBook();
    const first = simulatePlaythroughs(book, 50);
    const second = simulatePlaythroughs(book, 50);
    expect(second).toEqual(first);
  });

  it('folgt einem linearen Buch entlang aller Knoten', () => {
    const result = simulatePlaythroughs(linearBook(), 5);
    expect(result.paths[0].nodeIds).toEqual(['start', 'middle', 'end']);
    expect(result.paths[0].choices).toEqual(['Weiter', 'Zum Ende']);
    expect(result.paths[0].endingType).toBe('good');
  });

  it('berechnet averagePathLength korrekt', () => {
    const result = simulatePlaythroughs(linearBook(), 10);
    expect(result.averagePathLength).toBe(3);
  });

  it('zählt Endings und summiert sie über alle Pfade', () => {
    const result = simulatePlaythroughs(branchingBook(), 100);
    const total = Object.values(result.endingCounts).reduce((s, n) => s + n, 0);
    expect(total).toBe(100);
    expect(result.endingCounts.good ?? 0).toBeGreaterThan(0);
    expect(result.endingCounts.bad ?? 0).toBeGreaterThan(0);
  });

  it('erreicht beide Verzweigungen bei genügend Durchläufen', () => {
    const result = simulatePlaythroughs(branchingBook(), 200);
    const nodeIds = result.paths.flatMap((p) => p.nodeIds);
    expect(nodeIds).toContain('a');
    expect(nodeIds).toContain('b');
  });

  it('gibt bei leerem Buch leere Pfade und 0 als Länge zurück', () => {
    const result = simulatePlaythroughs({ id: 'empty', title: 'Leer', nodes: [] }, 10);
    expect(result.paths).toEqual([]);
    expect(result.endingCounts).toEqual({});
    expect(result.averagePathLength).toBe(0);
  });

  it('klemmt negative oder ungültige Iterationen auf 0', () => {
    expect(simulatePlaythroughs(linearBook(), -5).iterations).toBe(0);
    expect(simulatePlaythroughs(linearBook(), Number.NaN).paths).toEqual([]);
  });

  it('klemmt Iterationen auf MAX_ITERATIONS', () => {
    const result = simulatePlaythroughs(linearBook(), MAX_ITERATIONS + 1234);
    expect(result.iterations).toBe(MAX_ITERATIONS);
  });

  it('behandelt null/undefined defensiv', () => {
    const result = simulatePlaythroughs(undefined as unknown as Gamebook, 10);
    expect(result.iterations).toBe(10);
    expect(result.paths).toEqual([]);
    expect(result.averagePathLength).toBe(0);
  });

  it('stoppt bei einer Sackgasse ohne Ending', () => {
    const book: Gamebook = {
      id: 'trap',
      title: 'Trap',
      nodes: [
        node('start', [{ text: 'Falle', targetNodeId: 'trap' }]),
        node('trap', []),
      ],
    };
    const result = simulatePlaythroughs(book, 3);
    expect(result.paths[0].nodeIds).toEqual(['start', 'trap']);
    expect(result.paths[0].endingType).toBeUndefined();
    expect(result.endingCounts.none).toBe(3);
  });

  it('startet am ersten Knoten ohne eingehende Kante, wenn kein Start-Id existiert', () => {
    const book: Gamebook = {
      id: 'implicit',
      title: 'Implicit',
      nodes: [
        node('alpha', [{ text: 'weiter', targetNodeId: 'beta' }]),
        node('beta', [], { isEnding: true, endingType: 'neutral' }),
      ],
    };
    const result = simulatePlaythroughs(book, 1);
    expect(result.paths[0].nodeIds[0]).toBe('alpha');
  });

  it('bevorzugt bekannte Start-Ids gegenüber der Listenreihenfolge', () => {
    const book: Gamebook = {
      id: 'known-start',
      title: 'Known Start',
      nodes: [
        node('prologue', [{ text: 'skip', targetNodeId: 'start' }]),
        node('start', [{ text: 'weiter', targetNodeId: 'end' }]),
        node('end', [], { isEnding: true, endingType: 'good' }),
      ],
    };
    const result = simulatePlaythroughs(book, 1);
    expect(result.paths[0].nodeIds[0]).toBe('start');
  });
});

// ─── detectDeadEnds ──────────────────────────────────────────────────────────

describe('detectDeadEnds', () => {
  it('findet einen Knoten ohne Choices, der kein Ending ist', () => {
    const book: Gamebook = {
      id: 'de',
      title: 'DeadEnd',
      nodes: [
        node('start', [{ text: 'go', targetNodeId: 'trap' }]),
        node('trap', []),
        node('end', [], { isEnding: true, endingType: 'good' }),
      ],
    };
    const deadEnds = detectDeadEnds(book);
    expect(deadEnds).toHaveLength(1);
    expect(deadEnds[0].nodeId).toBe('trap');
  });

  it('meldet Ending-Knoten nicht als Sackgasse', () => {
    const deadEnds = detectDeadEnds(linearBook());
    expect(deadEnds).toEqual([]);
  });

  it('findet Knoten, deren Choices nur auf unbekannte Ziele verweisen', () => {
    const book: Gamebook = {
      id: 'dangling',
      title: 'Dangling',
      nodes: [node('start', [{ text: 'x', targetNodeId: 'ghost' }])],
    };
    const deadEnds = detectDeadEnds(book);
    expect(deadEnds).toHaveLength(1);
    expect(deadEnds[0].nodeId).toBe('start');
    expect(deadEnds[0].reason).toMatch(/unbekannte/i);
  });

  it('liefert ein leeres Array für ein leeres Buch', () => {
    expect(detectDeadEnds({ id: 'x', title: 'x', nodes: [] })).toEqual([]);
  });
});

// ─── detectUnfairThresholds ──────────────────────────────────────────────────

describe('detectUnfairThresholds', () => {
  function unfairBook(): Gamebook {
    return {
      id: 'unfair',
      title: 'Unfair',
      nodes: [
        node('start', [
          { text: 'Unmöglich hoch', targetNodeId: 'end', diceThreshold: 7 },
          { text: 'Ungültig niedrig', targetNodeId: 'end', diceThreshold: 0 },
          { text: 'Falsche Bedingung', targetNodeId: 'end', condition: 'false' },
          { text: 'Konstant falsch', targetNodeId: 'end', condition: '1 > 2' },
          { text: 'Fair', targetNodeId: 'end', diceThreshold: 4 },
        ]),
        node('end', [], { isEnding: true, endingType: 'good' }),
      ],
    };
  }

  it('markiert diceThreshold > 6 als unerreichbar', () => {
    const result = detectUnfairThresholds(unfairBook());
    const high = result.find((u) => u.choiceText === 'Unmöglich hoch');
    expect(high).toBeDefined();
    expect(high?.threshold).toBe(7);
    expect(high?.reason).toMatch(/>\s*6/);
  });

  it('markiert diceThreshold < 1 als ungültig', () => {
    const result = detectUnfairThresholds(unfairBook());
    expect(result.some((u) => u.choiceText === 'Ungültig niedrig')).toBe(true);
  });

  it('markiert nie erfüllbare Bedingungen', () => {
    const result = detectUnfairThresholds(unfairBook());
    expect(result.some((u) => u.choiceText === 'Falsche Bedingung')).toBe(true);
    expect(result.some((u) => u.choiceText === 'Konstant falsch')).toBe(true);
  });

  it('meldet faire Schwellen (1–6) und erfüllbare Bedingungen nicht', () => {
    const result = detectUnfairThresholds(unfairBook());
    expect(result.some((u) => u.choiceText === 'Fair')).toBe(false);
    expect(result).toHaveLength(4);
  });

  it('akzeptiert erfüllbare Zahlenvergleiche als fair', () => {
    const book: Gamebook = {
      id: 'fair-cond',
      title: 'Fair',
      nodes: [
        node('start', [{ text: 'ok', targetNodeId: 'end', condition: '2 > 1' }]),
        node('end', [], { isEnding: true, endingType: 'good' }),
      ],
    };
    expect(detectUnfairThresholds(book)).toEqual([]);
  });
});

// ─── detectInfiniteLoops ─────────────────────────────────────────────────────

describe('detectInfiniteLoops', () => {
  it('findet einen A→B→A-Zyklus', () => {
    const book: Gamebook = {
      id: 'loop',
      title: 'Loop',
      nodes: [
        node('start', [{ text: 'zu A', targetNodeId: 'a' }]),
        node('a', [{ text: 'zu B', targetNodeId: 'b' }]),
        node('b', [{ text: 'zurück', targetNodeId: 'a' }]),
      ],
    };
    const loops = detectInfiniteLoops(book);
    expect(loops).toHaveLength(1);
    expect(loops[0].nodeIds).toContain('a');
    expect(loops[0].nodeIds).toContain('b');
  });

  it('meldet keine Endlosschleife bei einem linearen Buch', () => {
    expect(detectInfiniteLoops(linearBook())).toEqual([]);
  });

  it('erkennt eine Selbstschleife', () => {
    const book: Gamebook = {
      id: 'self',
      title: 'Self',
      nodes: [node('start', [{ text: 'warten', targetNodeId: 'start' }])],
    };
    const loops = detectInfiniteLoops(book);
    expect(loops).toHaveLength(1);
    expect(loops[0].nodeIds).toEqual(['start']);
  });

  it('liefert bei leerem Buch keine Treffer', () => {
    expect(detectInfiniteLoops({ id: 'x', title: 'x', nodes: [] })).toEqual([]);
  });
});

// ─── generateHeatmap ─────────────────────────────────────────────────────────

describe('generateHeatmap', () => {
  it('zählt Knoten-Besuche über alle Pfade', () => {
    const book = branchingBook();
    const result = simulatePlaythroughs(book, 100);
    const heatmap = generateHeatmap(book, result);
    expect(heatmap.nodeVisits.start).toBe(100);
    expect(heatmap.nodeVisits.orphan).toBe(0);
  });

  it('listet stets besuchte Knoten als heiße Pfade', () => {
    const book = branchingBook();
    const result = simulatePlaythroughs(book, 100);
    const heatmap = generateHeatmap(book, result);
    expect(heatmap.hotPaths).toContain('start');
    expect(heatmap.hotPaths).not.toContain('orphan');
  });

  it('listet nie besuchte Knoten als kalte Pfade', () => {
    const book = branchingBook();
    const result = simulatePlaythroughs(book, 100);
    const heatmap = generateHeatmap(book, result);
    expect(heatmap.coldPaths).toContain('orphan');
  });

  it('initialisiert nodeVisits für alle Knoten mit 0 bei leerem Ergebnis', () => {
    const book = branchingBook();
    const empty: SimulationResult = {
      iterations: 0,
      paths: [],
      endingCounts: {},
      averagePathLength: 0,
    };
    const heatmap = generateHeatmap(book, empty);
    expect(heatmap.hotPaths).toEqual([]);
    expect(Object.values(heatmap.nodeVisits).every((v) => v === 0)).toBe(true);
    expect(heatmap.coldPaths).toContain('start');
  });

  it('zählt einen mehrfach besuchten Knoten pro Pfad nur einmal', () => {
    const book = linearBook();
    const result: SimulationResult = {
      iterations: 1,
      paths: [{ nodeIds: ['start', 'start', 'end'], choices: ['a', 'b'], endingType: 'good' }],
      endingCounts: { good: 1 },
      averagePathLength: 3,
    };
    const heatmap = generateHeatmap(book, result);
    expect(heatmap.nodeVisits.start).toBe(1);
  });

  it('behandelt ein fehlerhaftes Ergebnis defensiv', () => {
    const book = linearBook();
    const broken = { iterations: 5 } as unknown as SimulationResult;
    const heatmap = generateHeatmap(book, broken);
    expect(heatmap.nodeVisits.start).toBe(0);
    expect(heatmap.hotPaths).toEqual([]);
  });
});
