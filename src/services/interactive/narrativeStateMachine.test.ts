/**
 * Tests: narrativeStateMachine (WP 68.2)
 */

import { describe, it, expect } from "vitest";
import {
  checkCondition,
  checkAllConditions,
  collectReachable,
  auditStoryGraph,
  buildEndingMatrix,
  simulatePath,
  type StoryGraph,
} from "./narrativeStateMachine";

/** Guter Graph: zwei Enden, beide erreichbar. */
const GOOD_GRAPH: StoryGraph = {
  start: "start",
  initialFlags: { mut: 50, skrupel: 50 },
  nodes: [
    {
      id: "start",
      title: "Der Anfang",
      isEnding: false,
      endingConditions: [],
      transitions: [
        { label: "Kämpfen", target: "kampf", conditions: [], modifiers: { mut: +10 } },
        { label: "Fliehen", target: "flucht", conditions: [], modifiers: { skrupel: +10 } },
      ],
    },
    {
      id: "kampf",
      title: "Der Kampf",
      isEnding: false,
      endingConditions: [],
      transitions: [
        {
          label: "Sieg",
          target: "helden-ende",
          conditions: [{ key: "mut", operator: "gte", value: 60 }],
          modifiers: {},
          setsFlag: "hat_gesiegt",
        },
        { label: "Rückzug", target: "flucht", conditions: [], modifiers: {} },
      ],
    },
    {
      id: "flucht",
      title: "Die Flucht",
      isEnding: false,
      endingConditions: [],
      transitions: [
        { label: "Weiter", target: "trauriges-ende", conditions: [], modifiers: {} },
      ],
    },
    {
      id: "helden-ende",
      title: "Das Heldenende",
      isEnding: true,
      endingKind: "gutes-ende",
      endingConditions: [{ key: "hat_gesiegt", operator: "has" }],
      transitions: [],
    },
    {
      id: "trauriges-ende",
      title: "Das traurige Ende",
      isEnding: true,
      endingKind: "tragisches-ende",
      endingConditions: [],
      transitions: [],
    },
  ],
};

describe("narrativeStateMachine", () => {
  describe("checkCondition", () => {
    it("prüft 'has'", () => {
      expect(checkCondition({ key: "schluessel", operator: "has" }, { schluessel: 1 })).toBe(true);
      expect(checkCondition({ key: "schluessel", operator: "has" }, {})).toBe(false);
    });

    it("prüft 'not-has'", () => {
      expect(checkCondition({ key: "schluessel", operator: "not-has" }, {})).toBe(true);
      expect(checkCondition({ key: "schluessel", operator: "not-has" }, { schluessel: 1 })).toBe(false);
    });

    it("prüft 'gte'", () => {
      expect(checkCondition({ key: "mut", operator: "gte", value: 60 }, { mut: 60 })).toBe(true);
      expect(checkCondition({ key: "mut", operator: "gte", value: 60 }, { mut: 59 })).toBe(false);
    });

    it("prüft 'lte'", () => {
      expect(checkCondition({ key: "mut", operator: "lte", value: 60 }, { mut: 60 })).toBe(true);
      expect(checkCondition({ key: "mut", operator: "lte", value: 60 }, { mut: 61 })).toBe(false);
    });

    it("prüft 'eq'", () => {
      expect(checkCondition({ key: "mut", operator: "eq", value: 50 }, { mut: 50 })).toBe(true);
      expect(checkCondition({ key: "mut", operator: "eq", value: 50 }, { mut: 51 })).toBe(false);
    });

    it("behandelt fehlende Schlüssel defensiv", () => {
      expect(checkCondition({ key: "fehlt", operator: "gte", value: 0 }, {})).toBe(false);
    });

    it("kommt mit null zurecht", () => {
      expect(checkCondition(null as never, {})).toBe(false);
    });
  });

  describe("checkAllConditions", () => {
    it("erfüllt leere Bedingungen", () => {
      expect(checkAllConditions([], {})).toBe(true);
      expect(checkAllConditions(undefined, {})).toBe(true);
    });

    it("verlangt alle Bedingungen", () => {
      const conds = [
        { key: "mut", operator: "gte" as const, value: 60 },
        { key: "schluessel", operator: "has" as const },
      ];
      expect(checkAllConditions(conds, { mut: 60, schluessel: 1 })).toBe(true);
      expect(checkAllConditions(conds, { mut: 60 })).toBe(false);
    });
  });

  describe("collectReachable", () => {
    it("findet alle erreichbaren Knoten", () => {
      const r = collectReachable(GOOD_GRAPH);
      expect(r.size).toBe(5);
    });

    it("wendet Modifikatoren an", () => {
      const r = collectReachable(GOOD_GRAPH);
      expect(r.get("kampf")?.mut).toBe(60);
      expect(r.get("flucht")?.skrupel).toBe(60);
    });

    it("kommt mit leerem Graphen zurecht", () => {
      expect(collectReachable(null).size).toBe(0);
    });

    it("kommt mit fehlendem Startknoten zurecht", () => {
      const g = { ...GOOD_GRAPH, start: "gibt-es-nicht" };
      expect(collectReachable(g).size).toBe(0);
    });

    it("terminiert bei Zyklen", () => {
      const cyclic: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "zu b", target: "b", conditions: [], modifiers: {} }] },
          { id: "b", title: "B", isEnding: false, endingConditions: [], transitions: [{ label: "zu a", target: "a", conditions: [], modifiers: {} }] },
        ],
      };
      const r = collectReachable(cyclic);
      expect(r.size).toBe(2);
    });
  });

  describe("auditStoryGraph", () => {
    it("erkennt einen gesunden Graphen", () => {
      const r = auditStoryGraph(GOOD_GRAPH);
      expect(r.valid).toBe(true);
      expect(r.deadEnds).toEqual([]);
      expect(r.unreachableEndings).toEqual([]);
      expect(r.brokenTargets).toEqual([]);
    });

    it("erkennt eine Sackgasse (Nicht-Ende ohne Ausgang)", () => {
      const g: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "weiter", target: "sackgasse", conditions: [], modifiers: {} }] },
          { id: "sackgasse", title: "Sackgasse", isEnding: false, endingConditions: [], transitions: [] },
        ],
      };
      const r = auditStoryGraph(g);
      expect(r.valid).toBe(false);
      expect(r.deadEnds).toContain("sackgasse");
    });

    it("erkennt ein unerreichbares Ende", () => {
      const g: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "weiter", target: "ende", conditions: [], modifiers: {} }] },
          { id: "ende", title: "Ende", isEnding: true, endingConditions: [], transitions: [] },
          { id: "einsam", title: "Einsames Ende", isEnding: true, endingConditions: [], transitions: [] },
        ],
      };
      const r = auditStoryGraph(g);
      expect(r.unreachableEndings).toContain("einsam");
      expect(r.orphanNodes).toContain("einsam");
    });

    it("erkennt ein Ende mit unerfüllbaren Bedingungen", () => {
      const g: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "weiter", target: "ende", conditions: [], modifiers: {} }] },
          { id: "ende", title: "Ende", isEnding: true, endingConditions: [{ key: "schluessel", operator: "has" }], transitions: [] },
        ],
      };
      const r = auditStoryGraph(g);
      expect(r.unreachableEndings).toContain("ende");
    });

    it("erkennt kaputte Ziele", () => {
      const g: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "weiter", target: "nirgendwo", conditions: [], modifiers: {} }] },
        ],
      };
      const r = auditStoryGraph(g);
      expect(r.brokenTargets.length).toBe(1);
      expect(r.valid).toBe(false);
    });

    it("kommt mit leerem Graphen zurecht", () => {
      const r = auditStoryGraph(null);
      expect(r.valid).toBe(false);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(auditStoryGraph(GOOD_GRAPH))).toBe(JSON.stringify(auditStoryGraph(GOOD_GRAPH)));
    });
  });

  describe("buildEndingMatrix", () => {
    it("listet alle Enden", () => {
      const m = buildEndingMatrix(GOOD_GRAPH);
      expect(m.length).toBe(2);
    });

    it("markiert erreichbare Enden", () => {
      const m = buildEndingMatrix(GOOD_GRAPH);
      expect(m.every((e) => e.reachable)).toBe(true);
    });

    it("nennt die Enden-Arten", () => {
      const m = buildEndingMatrix(GOOD_GRAPH);
      const kinds = m.map((e) => e.endingKind);
      expect(kinds).toContain("gutes-ende");
      expect(kinds).toContain("tragisches-ende");
    });

    it("beschreibt die Bedingungen", () => {
      const m = buildEndingMatrix(GOOD_GRAPH);
      const held = m.find((e) => e.nodeId === "helden-ende");
      expect(held?.requirements.length).toBeGreaterThan(0);
      expect(held?.requirements[0]).toContain("hat_gesiegt");
    });

    it("markiert unerreichbare Enden", () => {
      const g: StoryGraph = {
        start: "a",
        initialFlags: {},
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [] },
          { id: "fern", title: "Fern", isEnding: true, endingKind: "wahr", endingConditions: [], transitions: [] },
        ],
      };
      const m = buildEndingMatrix(g);
      expect(m[0].reachable).toBe(false);
    });

    it("kommt mit null zurecht", () => {
      expect(buildEndingMatrix(null)).toEqual([]);
    });
  });

  describe("simulatePath", () => {
    it("durchläuft einen vollständigen Pfad", () => {
      const s = simulatePath(GOOD_GRAPH, ["Kämpfen", "Sieg"]);
      expect(s.completed).toBe(true);
      expect(s.visited).toEqual(["start", "kampf", "helden-ende"]);
    });

    it("setzt Flags", () => {
      const s = simulatePath(GOOD_GRAPH, ["Kämpfen", "Sieg"]);
      expect(s.finalValues.hat_gesiegt).toBe(1);
    });

    it("wendet Modifikatoren an", () => {
      const s = simulatePath(GOOD_GRAPH, ["Kämpfen"]);
      expect(s.finalValues.mut).toBe(60);
    });

    it("meldet unbekannte Optionen", () => {
      const s = simulatePath(GOOD_GRAPH, ["Tanzen"]);
      expect(s.completed).toBe(false);
      expect(s.failure).toContain("existiert nicht");
    });

    it("meldet nicht erfüllte Bedingungen", () => {
      // Fliehen senkt mut nicht → Sieg bleibt möglich. Wir senken mut über einen
      // anderen Pfad: Fliehen → Weiter ist ein Ende, also vorher prüfen.
      const g: StoryGraph = {
        start: "a",
        initialFlags: { mut: 10 },
        nodes: [
          { id: "a", title: "A", isEnding: false, endingConditions: [], transitions: [{ label: "sieg", target: "ende", conditions: [{ key: "mut", operator: "gte", value: 60 }], modifiers: {} }] },
          { id: "ende", title: "Ende", isEnding: true, endingConditions: [], transitions: [] },
        ],
      };
      const s = simulatePath(g, ["sieg"]);
      expect(s.completed).toBe(false);
      expect(s.failure).toContain("Bedingungen");
    });

    it("meldet einen Pfad, der vor dem Ende stoppt", () => {
      const s = simulatePath(GOOD_GRAPH, ["Kämpfen"]);
      expect(s.completed).toBe(false);
      expect(s.failure).toContain("Endknoten");
    });

    it("kommt mit leerem Graphen zurecht", () => {
      const s = simulatePath(null, ["a"]);
      expect(s.completed).toBe(false);
      expect(s.failure).toBeDefined();
    });

    it("kommt mit fehlendem Startknoten zurecht", () => {
      const s = simulatePath({ ...GOOD_GRAPH, start: "weg" }, []);
      expect(s.completed).toBe(false);
    });

    it("ist deterministisch", () => {
      const a = simulatePath(GOOD_GRAPH, ["Kämpfen", "Sieg"]);
      const b = simulatePath(GOOD_GRAPH, ["Kämpfen", "Sieg"]);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });
});
