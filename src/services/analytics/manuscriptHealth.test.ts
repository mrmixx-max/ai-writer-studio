// Tests: Master-Health-Cockpit (WP 24.1).
// Rein deterministisch, kein LLM, keine Netzwerkzugriffe.
import { describe, it, expect } from "vitest";
import {
  runMasterHealthScan,
  calculateReadinessScore,
  generateTodoList,
} from "./manuscriptHealth";
import type {
  ChapterInput,
  Character,
  HealthScanResult,
  ManuscriptProject,
  TrackChange,
} from "./manuscriptHealth";

// ---------------------------------------------------------------------------
// Fixtures / Helfer
// ---------------------------------------------------------------------------

const ch = (
  id: string,
  content: string,
  characters: string[] = [],
  title = `Kapitel ${id}`,
): ChapterInput => ({ id, title, content, characters });

const figure = (
  name: string,
  firstAppearance = 1,
  lastAppearance = 3,
  role = "Nebenfigur",
): Character => ({ name, role, firstAppearance, lastAppearance });

const change = (id: string, resolved: boolean, type: "insert" | "delete" = "insert"): TrackChange => ({
  id,
  type,
  resolved,
});

const project = (
  chapters: ChapterInput[],
  characters: Character[] = [],
  trackChanges: TrackChange[] = [],
): ManuscriptProject => ({ chapters, characters, trackChanges });

/** Kategorie-Präsenz prüfen. */
const hasCategory = (result: HealthScanResult, category: string): boolean =>
  result.issues.some((i) => i.category === category);

const issuesOf = (result: HealthScanResult, category: string) =>
  result.issues.filter((i) => i.category === category);

/** Erzeugt einen Satz mit exakt `n` eindeutigen Wörtern. */
const sentenceWithWords = (n: number): string =>
  Array.from({ length: n }, (_, i) => `wort${i}`).join(" ");

/** Erzeugt einen Text mit ~`words` Wörtern (wiederholt, ohne Satzzeichen). */
const bigText = (words: number): string => {
  const chunk = "satzwort textwort wortteil";
  const perChunk = 3;
  const repeats = Math.ceil(words / perChunk);
  return Array.from({ length: repeats }, () => chunk).join(" ");
};

// ---------------------------------------------------------------------------
// runMasterHealthScan — P0 (Showstopper)
// ---------------------------------------------------------------------------

describe("runMasterHealthScan — P0", () => {
  it("meldet offene Track-Changes als P0 und zählt sie in den Stats", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Anna ging nach Hause.")], [], [
        change("t1", false),
        change("t2", false, "delete"),
        change("t3", true),
      ]),
    );
    const open = issuesOf(result, "open-track-changes");
    expect(open).toHaveLength(1);
    expect(open[0].severity).toBe("P0");
    expect(result.stats.openTrackChanges).toBe(2);
  });

  it("meldet keine P0-Track-Changes, wenn alle aufgelöst sind", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Anna ging nach Hause.")], [], [change("t1", true)]),
    );
    expect(hasCategory(result, "open-track-changes")).toBe(false);
    expect(result.stats.openTrackChanges).toBe(0);
  });

  it("erkennt widersprüchliche Täteralibis als P0", () => {
    const result = runMasterHealthScan(
      project(
        [ch("1", "Anna war zur Tatzeit im Kino. Anna war zur Tatzeit bei Ben.")],
        [figure("Anna"), figure("Ben")],
      ),
    );
    const alibi = issuesOf(result, "alibi-conflict");
    expect(alibi).toHaveLength(1);
    expect(alibi[0].severity).toBe("P0");
    expect(alibi[0].message).toContain("Anna");
  });

  it("meldet kein Alibi, wenn nur eine Aussage existiert", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Anna war zur Tatzeit im Kino.")], [figure("Anna")]),
    );
    expect(hasCategory(result, "alibi-conflict")).toBe(false);
  });

  it("erkennt eine ungelöste Zeitstempel-Kollision als P0", () => {
    const result = runMasterHealthScan(
      project([
        ch("1", "Um 22:00 Uhr war Anna im Kino."),
        ch("2", "Um 22:00 Uhr war Ben am Bahnhof."),
      ]),
    );
    const collisions = issuesOf(result, "timestamp-collision");
    expect(collisions).toHaveLength(1);
    expect(collisions[0].severity).toBe("P0");
    expect(collisions[0].message).toContain("22:00");
  });

  it("wertet eine Zeitstempel-Kollision mit Auflösungsmarker nicht als P0", () => {
    const result = runMasterHealthScan(
      project([
        ch("1", "Um 22:00 Uhr war Anna im Kino."),
        ch("2", "Um 22:00 Uhr war Ben am Bahnhof, doch das war ein Irrtum."),
      ]),
    );
    expect(hasCategory(result, "timestamp-collision")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runMasterHealthScan — P1 (Handwerk)
// ---------------------------------------------------------------------------

describe("runMasterHealthScan — P1", () => {
  it("erkennt einen Schusterjungen (letzte Zeile mit einem Wort)", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Der Anfang eines Absatzes mit vielen Wörtern.\nEnde")]),
    );
    const wo = issuesOf(result, "widow-orphan");
    expect(wo).toHaveLength(1);
    expect(wo[0].severity).toBe("P1");
    expect(wo[0].message).toContain("Schusterjunge");
  });

  it("erkennt einen Bandwurmsatz über 40 Wörtern", () => {
    const result = runMasterHealthScan(
      project([ch("1", `${sentenceWithWords(45)}.`)]),
    );
    const long = issuesOf(result, "long-sentence");
    expect(long).toHaveLength(1);
    expect(long[0].severity).toBe("P1");
    expect(long[0].message).toContain("45");
  });

  it("meldet keinen Bandwurmsatz bei genau 40 Wörtern", () => {
    const result = runMasterHealthScan(
      project([ch("1", `${sentenceWithWords(40)}.`)]),
    );
    expect(hasCategory(result, "long-sentence")).toBe(false);
  });

  it("erkennt eine verwaiste Figur (nie im Manuskript verwendet)", () => {
    const result = runMasterHealthScan(
      project(
        [ch("1", "Anna ging nach Hause.", ["Anna"])],
        [figure("Anna"), figure("Geist")],
      ),
    );
    const orphaned = issuesOf(result, "orphaned-character");
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].severity).toBe("P1");
    expect(orphaned[0].message).toContain("Geist");
  });

  it("erkennt eine hängende Figuren-Referenz (im Register nicht vorhanden)", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Anna traf Ben.", ["Anna", "Ben"])], [figure("Anna")]),
    );
    const dangling = issuesOf(result, "dangling-character");
    expect(dangling).toHaveLength(1);
    expect(dangling[0].severity).toBe("P1");
    expect(dangling[0].message).toContain("Ben");
  });
});

// ---------------------------------------------------------------------------
// runMasterHealthScan — P2 (Stil-Feinschliff)
// ---------------------------------------------------------------------------

describe("runMasterHealthScan — P2", () => {
  it("erkennt eine überstrapazierte Lieblingsfloskel als P2", () => {
    const result = runMasterHealthScan(
      project([
        ch(
          "1",
          "Die dunkle Gasse war leer. Die dunkle Gasse blieb still. Die dunkle Gasse rief.",
        ),
      ]),
    );
    const phrases = issuesOf(result, "overused-phrase");
    expect(phrases.length).toBeGreaterThanOrEqual(1);
    expect(phrases[0].severity).toBe("P2");
    expect(phrases[0].message.toLowerCase()).toContain("dunkle gasse");
  });

  it("erkennt ein Dialog-Übergewicht als P2", () => {
    const result = runMasterHealthScan(
      project([ch("1", "„Ein gesprochener Satz der fast den ganzen Text ausmacht.“")]),
      { dialogueMinWords: 1 },
    );
    const balance = issuesOf(result, "dialogue-balance");
    expect(balance).toHaveLength(1);
    expect(balance[0].severity).toBe("P2");
    expect(balance[0].message).toContain("Dialoglastig");
  });

  it("erkennt ein Narrativ-Übergewicht als P2", () => {
    const result = runMasterHealthScan(
      project([ch("1", "Der Erzähler beschreibt eine weite, stille Landschaft ohne jede wörtliche Rede.")]),
      { dialogueMinWords: 1 },
    );
    const balance = issuesOf(result, "dialogue-balance");
    expect(balance).toHaveLength(1);
    expect(balance[0].message).toContain("Narrativlastig");
  });
});

// ---------------------------------------------------------------------------
// runMasterHealthScan — Stats, Sortierung, Determinismus, Defensive
// ---------------------------------------------------------------------------

describe("runMasterHealthScan — Stats & Sortierung", () => {
  it("zählt Wörter und Kapitel korrekt", () => {
    const result = runMasterHealthScan(
      project([ch("1", "eins zwei drei"), ch("2", "vier fünf")]),
    );
    expect(result.stats.totalChapters).toBe(2);
    expect(result.stats.totalWords).toBe(5);
  });

  it("zählt offene Handlungsfäden in den Stats", () => {
    const result = runMasterHealthScan(
      project(
        [ch("1", "Anna ging nach Hause.", ["Anna"])],
        [figure("Anna"), figure("Geist")],
      ),
    );
    // eine verwaiste Figur → ein offener Handlungsfaden
    expect(result.stats.unresolvedPlots).toBeGreaterThanOrEqual(1);
  });

  it("sortiert Befunde P0 → P1 → P2", () => {
    const result = runMasterHealthScan(
      project(
        [
          ch("1", "Anna war zur Tatzeit im Kino. Anna war zur Tatzeit bei Ben.", ["Anna", "Ben"]),
          ch("2", `${sentenceWithWords(45)}.`),
        ],
        [figure("Anna"), figure("Ben"), figure("Geist")],
        [change("t1", false)],
      ),
    );
    const severities = result.issues.map((i) => i.severity);
    const firstP1 = severities.indexOf("P1");
    const firstP2 = severities.indexOf("P2");
    const lastP0 = severities.lastIndexOf("P0");
    if (firstP1 !== -1) expect(lastP0).toBeLessThan(firstP1);
    if (firstP2 !== -1) expect(firstP1).toBeLessThan(firstP2);
    expect(severities[0]).toBe("P0");
  });

  it("ist deterministisch (gleiche Eingabe → gleiches Ergebnis)", () => {
    const input = project(
      [ch("1", "Um 22:00 Uhr war Anna im Kino.", ["Anna"]), ch("2", "Um 22:00 Uhr war Ben da.")],
      [figure("Anna"), figure("Ben")],
      [change("t1", false)],
    );
    expect(JSON.stringify(runMasterHealthScan(input))).toBe(
      JSON.stringify(runMasterHealthScan(input)),
    );
  });
});

describe("runMasterHealthScan — defensive Fallbacks", () => {
  it("behandelt undefined/null/wie leer (keine Ausnahme)", () => {
    for (const input of [undefined, null] as unknown[]) {
      const result = runMasterHealthScan(input as ManuscriptProject);
      expect(result.issues).toEqual([]);
      expect(result.stats).toEqual({
        totalWords: 0,
        totalChapters: 0,
        openTrackChanges: 0,
        unresolvedPlots: 0,
      });
    }
  });

  it("behandelt ein leeres Projekt defensiv", () => {
    const result = runMasterHealthScan({} as ManuscriptProject);
    expect(result.issues).toEqual([]);
    expect(result.stats.totalChapters).toBe(0);
    expect(result.stats.totalWords).toBe(0);
  });

  it("überspringt ungültige Kapitel-Einträge", () => {
    const result = runMasterHealthScan(
      project([null, undefined, ch("1", "Anna ging nach Hause.")] as unknown as ChapterInput[]),
    );
    expect(result.stats.totalChapters).toBe(1);
    expect(result.stats.totalWords).toBe(4);
  });

  it("verarbeitet TipTap-JSON-Inhalt wie Klartext", () => {
    const tiptap = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Anna ging nach Hause" }] }],
    });
    const result = runMasterHealthScan(project([ch("1", tiptap)]));
    expect(result.stats.totalWords).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// calculateReadinessScore
// ---------------------------------------------------------------------------

describe("calculateReadinessScore", () => {
  const makeResult = (
    p0: number,
    p1: number,
    p2: number,
  ): HealthScanResult => ({
    issues: [
      ...Array.from({ length: p0 }, () => ({ severity: "P0" as const, category: "x", message: "m" })),
      ...Array.from({ length: p1 }, () => ({ severity: "P1" as const, category: "y", message: "m" })),
      ...Array.from({ length: p2 }, () => ({ severity: "P2" as const, category: "z", message: "m" })),
    ],
    stats: { totalWords: 0, totalChapters: 0, openTrackChanges: 0, unresolvedPlots: 0 },
  });

  it("liefert 100 % für ein fehlerfreies Manuskript", () => {
    expect(calculateReadinessScore(makeResult(0, 0, 0))).toBe(100);
  });

  it("zieht 25 Punkte je P0 ab", () => {
    expect(calculateReadinessScore(makeResult(1, 0, 0))).toBe(75);
  });

  it("begrenzt den Score bei vier Showstoppern auf 0 %", () => {
    expect(calculateReadinessScore(makeResult(4, 0, 0))).toBe(0);
  });

  it("gewichtet P1 und P2 geringer als P0", () => {
    expect(calculateReadinessScore(makeResult(0, 2, 0))).toBe(90);
    expect(calculateReadinessScore(makeResult(0, 0, 3))).toBe(94);
  });

  it("bleibt im gültigen Bereich 0–100", () => {
    const score = calculateReadinessScore(makeResult(50, 50, 50));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("defensiv: ungültiges Ergebnis gilt als fehlerfrei", () => {
    expect(calculateReadinessScore(undefined as unknown as HealthScanResult)).toBe(100);
    expect(calculateReadinessScore({} as HealthScanResult)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// generateTodoList
// ---------------------------------------------------------------------------

describe("generateTodoList", () => {
  it("liefert eine leere Liste ohne Befunde", () => {
    expect(
      generateTodoList({
        issues: [],
        stats: { totalWords: 0, totalChapters: 0, openTrackChanges: 0, unresolvedPlots: 0 },
      }),
    ).toEqual([]);
  });

  it("erstellt je Befund einen offenen To-Do-Eintrag", () => {
    const result = runMasterHealthScan(
      project(
        [
          ch("1", "Anna war zur Tatzeit im Kino. Anna war zur Tatzeit bei Ben.", ["Anna", "Ben"]),
          ch("2", "Die dunkle Gasse war leer. Die dunkle Gasse blieb still. Die dunkle Gasse rief."),
        ],
        [figure("Anna"), figure("Ben")],
        [change("t1", false)],
      ),
    );
    const todos = generateTodoList(result);
    expect(todos.length).toBe(result.issues.length);
    expect(todos.every((t) => t.done === false)).toBe(true);
    expect(todos.every((t) => typeof t.task === "string" && t.task.length > 0)).toBe(true);
  });

  it("priorisiert P0-Einträge vor P1 und P2", () => {
    const todos = generateTodoList({
      issues: [
        { severity: "P2", category: "overused-phrase", message: "p2" },
        { severity: "P0", category: "open-track-changes", message: "p0" },
        { severity: "P1", category: "long-sentence", message: "p1" },
      ],
      stats: { totalWords: 0, totalChapters: 0, openTrackChanges: 0, unresolvedPlots: 0 },
    });
    expect(todos.map((t) => t.priority)).toEqual(["P0", "P1", "P2"]);
    expect(todos[0].task).toContain("Track-Changes");
  });

  it("defensiv: ungültiges Ergebnis liefert eine leere Liste", () => {
    expect(generateTodoList(undefined as unknown as HealthScanResult)).toEqual([]);
    expect(generateTodoList({} as HealthScanResult)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe("runMasterHealthScan — Performance", () => {
  it("verarbeitet 200.000 Wörter ohne Blockade (< 8 s)", () => {
    const words = 200_000;
    const projectLarge = project([ch("1", bigText(words))]);
    const start = Date.now();
    const result = runMasterHealthScan(projectLarge);
    const elapsed = Date.now() - start;
    expect(result.stats.totalWords).toBeGreaterThanOrEqual(words);
    expect(elapsed).toBeLessThan(8000);
  });
});
