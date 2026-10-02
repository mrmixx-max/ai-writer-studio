// Tests: Subplot-Weaver & Dramaturgie-Symphonie (WP 24.2).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect, beforeEach } from "vitest";
import {
  assignSceneToPlot,
  getScenePlot,
  getSceneAssignments,
  clearSceneAssignments,
  detectNeglectedSubplots,
  checkKlimaxSync,
  PLOT_IDS,
  PLOT_LABELS,
  NEGLECT_THRESHOLD,
} from "./subplotWeaver";
import type {
  ChapterInput,
  PlotAssignment,
} from "./subplotWeaver";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

/** Kapitel 1..n mit fortlaufender Nummer erzeugen. */
function makeChapters(count: number): ChapterInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ch${i + 1}`,
    title: `Kapitel ${i + 1}`,
    content: `Inhalt Kapitel ${i + 1}`,
    chapterNumber: i + 1,
  }));
}

/** Eine Szenen-Zuordnung bauen. */
function assignment(
  plotId: string,
  chapterNumber: number,
  sceneId = `${plotId}-${chapterNumber}`,
): PlotAssignment {
  return { sceneId, plotId, chapterNumber };
}

beforeEach(() => {
  clearSceneAssignments();
});

// ---------------------------------------------------------------------------
// 1) assignSceneToPlot
// ---------------------------------------------------------------------------

describe("assignSceneToPlot", () => {
  it("ordnet eine Szene einem Handlungsstrang zu", () => {
    assignSceneToPlot("scene-1", "B");
    expect(getScenePlot("scene-1")).toBe("B");
  });

  it("überschreibt bei erneuter Zuordnung derselben Szene", () => {
    assignSceneToPlot("scene-1", "A");
    assignSceneToPlot("scene-1", "C");
    expect(getScenePlot("scene-1")).toBe("C");
    expect(getSceneAssignments()).toHaveLength(1);
  });

  it("ignoriert unbekannte Plot-IDs defensiv", () => {
    assignSceneToPlot("scene-1", "Z");
    expect(getScenePlot("scene-1")).toBeUndefined();
    expect(getSceneAssignments()).toEqual([]);
  });

  it("ignoriert leere Szenen-IDs defensiv", () => {
    assignSceneToPlot("   ", "A");
    expect(getSceneAssignments()).toEqual([]);
  });

  it("akzeptiert Plot-IDs case-insensitiv (kleinbuchstabig)", () => {
    assignSceneToPlot("scene-1", "b");
    expect(getScenePlot("scene-1")).toBe("B");
  });

  it("liefert alle Zuordnungen deterministisch sortiert", () => {
    assignSceneToPlot("scene-b", "B");
    assignSceneToPlot("scene-a", "A");
    assignSceneToPlot("scene-c", "C");
    expect(getSceneAssignments().map((a) => a.sceneId)).toEqual([
      "scene-a",
      "scene-b",
      "scene-c",
    ]);
  });

  it("liefert undefined für unbekannte Szene", () => {
    expect(getScenePlot("gibt-es-nicht")).toBeUndefined();
  });

  it("wirft nicht bei nicht-string-Eingaben", () => {
    expect(() => assignSceneToPlot(undefined as unknown as string, "A")).not.toThrow();
    expect(() => assignSceneToPlot("scene-1", null as unknown as string)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2) detectNeglectedSubplots
// ---------------------------------------------------------------------------

describe("detectNeglectedSubplots", () => {
  it("meldet einen Nebenplot nach mehr als der Schwelle ohne Erwähnung", () => {
    const chapters = makeChapters(10);
    const assignments = [assignment("C", 1)]; // danach 9 Kapitel ohne Auftritt
    const result = detectNeglectedSubplots(chapters, assignments);

    expect(result).toHaveLength(1);
    expect(result[0].plotId).toBe("C");
    expect(result[0].lastSeenChapter).toBe(1);
    expect(result[0].chaptersSinceLastSeen).toBe(9);
    expect(result[0].message).toContain("C");
    expect(result[0].message).toContain("9");
  });

  it("meldet NICHT bei genau der Schwellenzahl (Grenzfall > 4)", () => {
    const chapters = makeChapters(5);
    const assignments = [assignment("D", 1)]; // 4 Kapitel seither → nicht > 4
    expect(detectNeglectedSubplots(chapters, assignments)).toEqual([]);
  });

  it("meldet erst ab Schwelle + 1 (Grenzfall)", () => {
    const chapters = makeChapters(6);
    const assignments = [assignment("D", 1)]; // 5 Kapitel seither → > 4
    const result = detectNeglectedSubplots(chapters, assignments);
    expect(result).toHaveLength(1);
    expect(result[0].chaptersSinceLastSeen).toBe(5);
  });

  it("meldet einen kontinuierlich gepflegten Strang nicht", () => {
    const chapters = makeChapters(8);
    const assignments = [
      assignment("B", 1),
      assignment("B", 4),
      assignment("B", 8),
    ];
    expect(detectNeglectedSubplots(chapters, assignments)).toEqual([]);
  });

  it("meldet mehrere vernachlässigte Stränge, sortiert nach Dauer", () => {
    const chapters = makeChapters(12);
    const assignments = [
      assignment("C", 1), // 11 Kapitel seither
      assignment("D", 3), // 9 Kapitel seither
    ];
    const result = detectNeglectedSubplots(chapters, assignments);
    expect(result.map((r) => r.plotId)).toEqual(["C", "D"]);
    expect(result[0].chaptersSinceLastSeen).toBe(11);
    expect(result[1].chaptersSinceLastSeen).toBe(9);
  });

  it("liefert ein leeres Array bei fehlenden Zuordnungen", () => {
    expect(detectNeglectedSubplots(makeChapters(10), [])).toEqual([]);
  });

  it("liefert ein leeres Array bei fehlenden Kapiteln", () => {
    expect(detectNeglectedSubplots([], [assignment("A", 1)])).toEqual([]);
  });

  it("wirft nicht bei null/undefined-Eingaben", () => {
    expect(() =>
      detectNeglectedSubplots(
        undefined as unknown as ChapterInput[],
        undefined as unknown as PlotAssignment[],
      ),
    ).not.toThrow();
  });

  it("verwirft ungültige Zuordnungen (unbekannte Plot-ID / fehlendes Kapitel)", () => {
    const chapters = makeChapters(10);
    const assignments = [
      assignment("Z", 1),
      { sceneId: "s", plotId: "C", chapterNumber: Number.NaN } as PlotAssignment,
      assignment("C", 1),
    ];
    const result = detectNeglectedSubplots(chapters, assignments);
    expect(result).toHaveLength(1);
    expect(result[0].plotId).toBe("C");
  });

  it("ignoriert ein leeres Kapitel-Array mit undefined chapterNumber", () => {
    const chapters = [
      { id: "x", title: "x", content: "", chapterNumber: 0 } as ChapterInput,
    ];
    expect(detectNeglectedSubplots(chapters, [assignment("A", 1)])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3) checkKlimaxSync
// ---------------------------------------------------------------------------

describe("checkKlimaxSync", () => {
  it("meldet synced=true, wenn A- und B-Höhepunkt im Showdown zusammenlaufen", () => {
    const chapters = makeChapters(10);
    const assignments = [
      assignment("A", 8),
      assignment("A", 9),
      assignment("A", 10),
      assignment("B", 9),
    ];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.synced).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.aPlotClimaxChapter).toBe(10);
    expect(result.bPlotClimaxChapter).toBe(9);
  });

  it("erkennt fehlenden B-Plot-Höhepunkt", () => {
    const chapters = makeChapters(10);
    const assignments = [assignment("A", 10)];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.synced).toBe(false);
    expect(result.aPlotClimaxChapter).toBe(10);
    expect(result.bPlotClimaxChapter).toBeUndefined();
    expect(result.issues.join(" ")).toContain("B-Plot");
  });

  it("erkennt fehlenden A-Plot-Höhepunkt", () => {
    const chapters = makeChapters(10);
    const assignments = [assignment("B", 10)];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.synced).toBe(false);
    expect(result.issues.join(" ")).toContain("A-Plot");
  });

  it("meldet nicht synchronen Höhepunkt-Abstand", () => {
    const chapters = makeChapters(10);
    const assignments = [
      assignment("A", 3),
      assignment("B", 10),
    ];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.synced).toBe(false);
    expect(result.issues.join(" ")).toContain("zusammen");
    expect(result.aPlotClimaxChapter).toBe(3);
    expect(result.bPlotClimaxChapter).toBe(10);
  });

  it("toleriert einen Abstand von genau einem Kapitel", () => {
    const chapters = makeChapters(9);
    const assignments = [
      assignment("A", 8),
      assignment("B", 9),
    ];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.issues).toEqual([]);
    expect(result.synced).toBe(true);
  });

  it("erkennt einen zu frühen A-Plot-Höhepunkt (Showdown-Bereich)", () => {
    const chapters = makeChapters(12);
    const assignments = [
      assignment("A", 4), // Showdown beginnt in Kap. 9
      assignment("B", 10),
    ];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.synced).toBe(false);
    expect(result.issues.join(" ")).toContain("zu früh");
  });

  it("bestimmt den Höhepunkt als Kapitel mit den meisten Szenen", () => {
    const chapters = makeChapters(10);
    const assignments = [
      assignment("A", 2),
      assignment("A", 9, "a1"),
      assignment("A", 9, "a2"),
      assignment("A", 9, "a3"),
      assignment("B", 9, "b1"),
      assignment("B", 9, "b2"),
    ];
    const result = checkKlimaxSync(chapters, assignments);
    expect(result.aPlotClimaxChapter).toBe(9);
    expect(result.bPlotClimaxChapter).toBe(9);
    expect(result.synced).toBe(true);
  });

  it("liefert definiertes Ergebnis bei fehlenden Kapiteln", () => {
    const result = checkKlimaxSync([], [assignment("A", 1), assignment("B", 1)]);
    expect(result.synced).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.aPlotClimaxChapter).toBeUndefined();
  });

  it("wirft nicht bei null/undefined-Eingaben", () => {
    expect(() =>
      checkKlimaxSync(
        null as unknown as ChapterInput[],
        null as unknown as PlotAssignment[],
      ),
    ).not.toThrow();
  });

  it("liefert keine undefinierten Optionalfelder, wenn kein Höhepunkt existiert", () => {
    const result = checkKlimaxSync(makeChapters(5), []);
    expect(result.synced).toBe(false);
    expect("aPlotClimaxChapter" in result).toBe(false);
    expect("bPlotClimaxChapter" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Konstanten / Vertrag
// ---------------------------------------------------------------------------

describe("Vertrag", () => {
  it("führt genau die vier Handlungsstränge A/B/C/D", () => {
    expect(PLOT_IDS).toEqual(["A", "B", "C", "D"]);
  });

  it("liefert für jeden Strang einen Anzeigenamen", () => {
    for (const id of PLOT_IDS) {
      expect(typeof PLOT_LABELS[id]).toBe("string");
      expect(PLOT_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("setzt die Vernachlässigungs-Schwelle auf 4", () => {
    expect(NEGLECT_THRESHOLD).toBe(4);
  });
});
