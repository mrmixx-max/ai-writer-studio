/**
 * Tests: whatIfScenarioPlanner (WP 62.2 — Was-wäre-wenn-Szenarienplaner)
 */

import { describe, it, expect } from "vitest";
import {
  planWhatIfScenario,
  compareTimelines,
  analyzeCascade,
  formatCascadeReport,
  EFFECT_LABELS,
} from "./whatIfScenarioPlanner";

const INPUT = {
  divergence: "Der Mentor überlebt Kapitel 4",
  chapter: 4,
  totalChapters: 20,
  characters: ["Halden", "Mira"],
};

describe("whatIfScenarioPlanner — planWhatIfScenario", () => {
  it("plant ein Szenario", () => {
    const s = planWhatIfScenario(INPUT);
    expect(s.cascade.length).toBeGreaterThan(0);
    expect(s.alternativeScene.length).toBeGreaterThan(30);
  });

  it("übernimmt den Divergenz-Punkt", () => {
    const s = planWhatIfScenario(INPUT);
    expect(s.divergence).toBe("Der Mentor überlebt Kapitel 4");
    expect(s.chapter).toBe(4);
  });

  it("verteilt Effekte über die Folgekapitel", () => {
    const s = planWhatIfScenario(INPUT);
    s.cascade.forEach((c, i) => {
      expect(c.chapter).toBe(4 + i + 1);
    });
  });

  it("nutzt alle fünf Effekt-Arten reihum", () => {
    const s = planWhatIfScenario({ ...INPUT, totalChapters: 40, chapter: 4 });
    const kinds = new Set(s.cascade.map((c) => c.effect));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("benennt die Effekte", () => {
    const s = planWhatIfScenario(INPUT);
    s.cascade.forEach((c) => {
      expect(c.effectLabel).toBe(EFFECT_LABELS[c.effect]);
    });
  });

  it("nennt betroffene Figuren", () => {
    const s = planWhatIfScenario(INPUT);
    const all = s.cascade.map((c) => c.description).join(" ");
    expect(all).toMatch(/Halden|Mira/);
  });

  it("Effekte werden mit der Zeit schwerer", () => {
    const s = planWhatIfScenario({ ...INPUT, totalChapters: 40 });
    const first = s.cascade[0].severity;
    const last = s.cascade[s.cascade.length - 1].severity;
    expect(last).toBeGreaterThanOrEqual(first);
  });

  it("ist deterministisch", () => {
    const a = planWhatIfScenario(INPUT);
    const b = planWhatIfScenario(INPUT);
    expect(a.alternativeScene).toBe(b.alternativeScene);
    expect(a.cascade.map((c) => c.description)).toEqual(b.cascade.map((c) => c.description));
  });

  it("unterschiedliche Divergenzen erzeugen unterschiedliche Szenarien", () => {
    const a = planWhatIfScenario(INPUT);
    const b = planWhatIfScenario({ ...INPUT, divergence: "Die Heldin nimmt das Lösegeld an" });
    expect(a.alternativeScene).not.toBe(b.alternativeScene);
  });

  it("berechnet die Gesamtschwere", () => {
    const s = planWhatIfScenario(INPUT);
    expect(s.totalSeverity).toBeGreaterThan(0);
    expect(s.totalSeverity).toBeLessThanOrEqual(1);
  });

  it("zählt betroffene Kapitel", () => {
    const s = planWhatIfScenario(INPUT);
    expect(s.affectedChapters).toBe(s.cascade.length);
  });

  it("bleibt innerhalb des Manuskripts", () => {
    const s = planWhatIfScenario({ ...INPUT, totalChapters: 10, chapter: 9 });
    s.cascade.forEach((c) => {
      expect(c.chapter).toBeLessThanOrEqual(10);
    });
  });

  it("jede Beschreibung endet mit Satzzeichen", () => {
    const s = planWhatIfScenario(INPUT);
    s.cascade.forEach((c) => {
      expect(/[.!?]$/.test(c.description.trim())).toBe(true);
    });
  });

  it("kommt ohne Optionen zurecht", () => {
    const s = planWhatIfScenario();
    expect(s.cascade.length).toBeGreaterThan(0);
    expect(s.chapter).toBe(5);
  });

  it("kommt mit null zurecht", () => {
    expect(planWhatIfScenario(null).cascade.length).toBeGreaterThan(0);
    expect(planWhatIfScenario(undefined).wordCount).toBeGreaterThan(5);
  });

  it("mutiert die Eingabe nicht", () => {
    const copy = JSON.parse(JSON.stringify(INPUT));
    planWhatIfScenario(INPUT);
    expect(INPUT).toEqual(copy);
  });

  it("exportiert die Effekt-Labels", () => {
    expect(EFFECT_LABELS["alliance-broken"]).toBe("Allianz zerbricht");
    expect(EFFECT_LABELS["death-caused"]).toBe("Neuer Tod");
  });
});

describe("whatIfScenarioPlanner — compareTimelines", () => {
  it("vergleicht zwei Zeitlinien", () => {
    const s = planWhatIfScenario(INPUT);
    const c = compareTimelines(s, 20);
    expect(c.diffs.length).toBe(20);
  });

  it("markiert Kapitel nach dem Divergenz-Punkt als verändert", () => {
    const s = planWhatIfScenario(INPUT);
    const c = compareTimelines(s, 20);
    expect(c.diffs[3].changed).toBe(false);
    expect(c.diffs[5].changed).toBe(true);
  });

  it("berechnet die Divergenz-Rate", () => {
    const s = planWhatIfScenario(INPUT);
    const c = compareTimelines(s, 20);
    expect(c.divergenceRate).toBeGreaterThan(0);
    expect(c.divergenceRate).toBeLessThan(1);
  });

  it("nennt den Divergenz-Punkt", () => {
    const s = planWhatIfScenario(INPUT);
    expect(compareTimelines(s, 20).divergencePoint).toBe(4);
  });

  it("zählt veränderte Kapitel", () => {
    const s = planWhatIfScenario(INPUT);
    const c = compareTimelines(s, 20);
    expect(c.changedCount).toBe(20 - 4);
  });

  it("Kaskade deckt alle Folgekapitel ab", () => {
    const s = planWhatIfScenario(INPUT);
    expect(s.cascade.length).toBe(20 - 4);
  });

  it("verteilt lange Kaskaden gleichmäßig (max. 20 Schritte)", () => {
    const s = planWhatIfScenario({ divergence: "X", chapter: 1, totalChapters: 100 });
    expect(s.cascade.length).toBe(20);
    const last = s.cascade[s.cascade.length - 1].chapter;
    expect(last).toBe(100);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    const c = compareTimelines(null);
    expect(c.diffs).toEqual([]);
    expect(compareTimelines(undefined).changedCount).toBe(0);
  });
});

describe("whatIfScenarioPlanner — analyzeCascade", () => {
  it("analysiert eine Kaskade", () => {
    const s = planWhatIfScenario(INPUT);
    const a = analyzeCascade(s, 20);
    expect(a.severity).toBeGreaterThan(0);
  });

  it("berechnet die Reichweite", () => {
    const s = planWhatIfScenario(INPUT);
    const a = analyzeCascade(s, 20);
    expect(a.reach).toBeGreaterThan(0);
    expect(a.reach).toBeLessThanOrEqual(1);
  });

  it("erkennt eine Kaskade bis ins Finale", () => {
    const s = planWhatIfScenario({ ...INPUT, totalChapters: 40, chapter: 2 });
    const a = analyzeCascade(s, 40);
    expect(a.reachesFinale).toBe(true);
  });

  it("erkennt eine lokale Kaskade", () => {
    const s = planWhatIfScenario({ divergence: "Kleinigkeit", chapter: 18, totalChapters: 20 });
    const a = analyzeCascade(s, 20);
    expect(a.reachesFinale).toBe(false);
  });

  it("empfiehlt bei hoher Schwere eine Neuplanung", () => {
    const s = planWhatIfScenario({ ...INPUT, totalChapters: 40, chapter: 2 });
    const a = analyzeCascade(s, 40);
    expect(a.recommendation).toContain("dritten Akt");
  });

  it("liefert eine Empfehlung", () => {
    const a = analyzeCascade(planWhatIfScenario(INPUT), 20);
    expect(a.recommendation.length).toBeGreaterThan(20);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    const a = analyzeCascade(null);
    expect(a.severity).toBe(0);
    expect(a.recommendation).toContain("Kein Szenario");
    expect(analyzeCascade(undefined).reachesFinale).toBe(false);
  });
});

describe("whatIfScenarioPlanner — formatCascadeReport", () => {
  it("formatiert einen Bericht", () => {
    const s = planWhatIfScenario(INPUT);
    const text = formatCascadeReport(s);
    expect(text).toContain("Divergenz-Punkt: Kapitel 4");
    expect(text).toContain("Allianz zerbricht");
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(formatCascadeReport(null)).toBe("");
    expect(formatCascadeReport(undefined)).toBe("");
  });
});
