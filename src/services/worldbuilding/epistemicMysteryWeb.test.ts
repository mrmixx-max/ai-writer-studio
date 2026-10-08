// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  MYSTERY_LAYERS,
  getMysteryLayer,
  analyzeLayerCoverage,
  FAIR_PLAY_RULES,
  checkFairPlay,
  analyzeMystery,
  createSampleMysteryCase,
  createSampleMysteryAnalysis,
  pickRandomSuspect,
  type MysteryCase,
} from "./epistemicMysteryWeb";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("test")).toBe(hashString("test"));
  });
  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });
  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(9);
    for (let i = 0; i < 50; i++) {
      expect(r()).toBeGreaterThanOrEqual(0);
      expect(r()).toBeLessThan(1);
    }
  });
});

describe("MYSTERY_LAYERS", () => {
  it("enthält vier epistemische Schichten", () => {
    expect(MYSTERY_LAYERS).toHaveLength(4);
  });
  it("jede Schicht hat eine Leitfrage", () => {
    for (const l of MYSTERY_LAYERS) {
      expect(l.question.length).toBeGreaterThan(0);
    }
  });
  it("getMysteryLayer findet die objektive Wahrheit", () => {
    expect(getMysteryLayer("objectiveTruth")?.name).toBe("Objektive Wahrheit");
  });
  it("getMysteryLayer liefert undefined für unbekannt", () => {
    expect(getMysteryLayer("xyz" as never)).toBeUndefined();
  });
});

describe("analyzeLayerCoverage", () => {
  it("leerer Fall liefert Deckung 0", () => {
    const empty: MysteryCase = { id: "e", title: "E", culpritId: "x", suspects: [], clues: [] };
    for (const c of analyzeLayerCoverage(empty)) {
      expect(c.coverage).toBe(0);
    }
  });
  it("Deckung bleibt im Bereich 0..1", () => {
    for (const c of analyzeLayerCoverage(createSampleMysteryCase())) {
      expect(c.coverage).toBeGreaterThanOrEqual(0);
      expect(c.coverage).toBeLessThanOrEqual(1);
    }
  });
  it("zählt Hinweise je Schicht", () => {
    const cov = analyzeLayerCoverage(createSampleMysteryCase());
    const reader = cov.find((c) => c.layer === "readerView");
    expect(reader!.clueCount).toBeGreaterThan(0);
  });
});

describe("FAIR_PLAY_RULES", () => {
  it("enthält sechs Knox'sche Gebote", () => {
    expect(FAIR_PLAY_RULES).toHaveLength(6);
  });
  it("jede Regel hat eine Anforderung", () => {
    for (const r of FAIR_PLAY_RULES) {
      expect(r.requirement.length).toBeGreaterThan(0);
    }
  });
});

describe("checkFairPlay", () => {
  it("Beispielfall ist fair und lösbar", () => {
    const verdict = checkFairPlay(createSampleMysteryCase(), ["c1", "c2", "c4", "c6"]);
    expect(verdict.solvable).toBe(true);
    expect(verdict.score).toBe(100);
  });
  it("ungenannter Finalbeweis verletzt die Regel", () => {
    const caseData = createSampleMysteryCase();
    // c3 ist nur in objectiveTruth/readerView? -> c3 liegt in objectiveTruth+readerView; nehme einen Hinweis ohne readerView
    const modified: MysteryCase = {
      ...caseData,
      clues: [...caseData.clues, { id: "cX", label: "Geheimer Brief", kind: "documentary", layers: ["objectiveTruth"], pointsToCulprit: true, redHerring: false }],
    };
    const verdict = checkFairPlay(modified, ["cX"]);
    const rule = verdict.findings.find((f) => f.ruleId === "noUnseenEvidence");
    expect(rule?.passed).toBe(false);
  });
  it("Übernatürliches verletzt Regel 2", () => {
    const caseData = createSampleMysteryCase();
    const modified: MysteryCase = {
      ...caseData,
      clues: [...caseData.clues, { id: "cG", label: "Der Fluch des Geistes", kind: "circumstantial", layers: ["readerView"], pointsToCulprit: false, redHerring: false }],
    };
    const verdict = checkFairPlay(modified, []);
    expect(verdict.findings.find((f) => f.ruleId === "noDivineIntervention")?.passed).toBe(false);
  });
  it("später Täter verletzt Regel 1", () => {
    const caseData = createSampleMysteryCase();
    const modified: MysteryCase = {
      ...caseData,
      suspects: [
        { id: "s1", name: "A", isCulprit: false, alibi: "x", alibiLayers: [] },
        { id: "s2", name: "B", isCulprit: false, alibi: "x", alibiLayers: [] },
        { id: "s3", name: "C", isCulprit: false, alibi: "x", alibiLayers: [] },
        { id: "s4", name: "D", isCulprit: true, alibi: "x", alibiLayers: [] },
      ],
    };
    expect(checkFairPlay(modified, []).findings.find((f) => f.ruleId === "culpritEarly")?.passed).toBe(false);
  });
  it("zu wenige Leser-Hinweise verhindern Lösbarkeit", () => {
    const caseData = createSampleMysteryCase();
    const modified: MysteryCase = {
      ...caseData,
      clues: caseData.clues.map((c) => (c.pointsToCulprit ? { ...c, layers: ["detectiveKnowledge" as const] } : c)),
    };
    const verdict = checkFairPlay(modified, []);
    expect(verdict.solvable).toBe(false);
  });
  it("Score bleibt im Bereich 0..100", () => {
    const verdict = checkFairPlay(createSampleMysteryCase(), []);
    expect(verdict.score).toBeGreaterThanOrEqual(0);
    expect(verdict.score).toBeLessThanOrEqual(100);
  });
  it("zählt Täter-Hinweise in der Leser-Sicht", () => {
    const verdict = checkFairPlay(createSampleMysteryCase(), []);
    expect(verdict.culpritCluesInReaderView).toBeGreaterThan(0);
    expect(verdict.totalCulpritClues).toBeGreaterThanOrEqual(verdict.culpritCluesInReaderView);
  });
});

describe("analyzeMystery", () => {
  it("ist deterministisch", () => {
    expect(analyzeMystery(createSampleMysteryCase(), ["c1"]).id).toBe(analyzeMystery(createSampleMysteryCase(), ["c1"]).id);
  });
  it("liefert Zählungen und Schichtdeckung", () => {
    const a = analyzeMystery(createSampleMysteryCase(), ["c1"]);
    expect(a.suspectCount).toBe(4);
    expect(a.clueCount).toBe(6);
    expect(a.layerCoverage).toHaveLength(4);
  });
  it("zählt falsche Fährten", () => {
    expect(analyzeMystery(createSampleMysteryCase(), []).redHerringCount).toBeGreaterThan(0);
  });
});

describe("createSampleMysteryAnalysis", () => {
  it("erzeugt eine lösbare Beispielanalyse", () => {
    const a = createSampleMysteryAnalysis();
    expect(a.verdict.solvable).toBe(true);
    expect(a.title).toContain("Archivflügel");
  });
});

describe("pickRandomSuspect", () => {
  it("ist deterministisch", () => {
    const a = pickRandomSuspect(createSampleMysteryCase(), 42);
    const b = pickRandomSuspect(createSampleMysteryCase(), 42);
    expect(a?.id).toBe(b?.id);
  });
  it("liefert null bei leerer Liste", () => {
    const empty: MysteryCase = { id: "e", title: "E", culpritId: "x", suspects: [], clues: [] };
    expect(pickRandomSuspect(empty, 1)).toBeNull();
  });
});
