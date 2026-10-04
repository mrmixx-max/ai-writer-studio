// Tests: Manuskript-Batch-Runner (WP 41.1)
import { describe, it, expect, vi } from "vitest";
import {
  runBatchAnalysis,
  createJumpTarget,
  summarizeReport,
  yieldToEventLoop,
  type BatchChapter,
  type BatchTool,
  type BatchFinding,
  type BatchReport,
} from "./manuscriptBatchRunner";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function chapter(id: string, content = "Zeile eins.\nZeile zwei."): BatchChapter {
  return { id, title: `Kapitel ${id}`, content };
}

function tool(id: string, output: string): BatchTool {
  return {
    id,
    label: `Tool ${id}`,
    category: "test",
    run: () => output,
  };
}

/** No-op Yield, damit Tests keine echten Timer benötigen. */
const noYield = () => Promise.resolve();

// ---------------------------------------------------------------------------
// runBatchAnalysis — Grundverhalten
// ---------------------------------------------------------------------------

describe("runBatchAnalysis", () => {
  it("sammelt Befunde aus allen Kapiteln und Tools", async () => {
    const chapters = [chapter("c1"), chapter("c2")];
    const tools = [tool("t1", "error:1:Problem A"), tool("t2", "warning:2:Problem B")];

    const report = await runBatchAnalysis(chapters, tools, { yieldFn: noYield });

    expect(report.findings).toHaveLength(4);
    expect(report.chaptersScanned).toBe(2);
    expect(report.toolsRun).toBe(2);
  });

  it("parst Schweregrad und Zeilennummer aus der Tool-Ausgabe", async () => {
    const report = await runBatchAnalysis(
      [chapter("c1")],
      [tool("t1", "error:12:Zu langer Satz\nwarning:5:Wiederholung\ninfo:3:Stilhinweis")],
      { yieldFn: noYield },
    );

    expect(report.findings[0]).toMatchObject({ severity: "error", line: 12, message: "Zu langer Satz" });
    expect(report.findings[1]).toMatchObject({ severity: "warning", line: 5 });
    expect(report.findings[2]).toMatchObject({ severity: "info", line: 3 });
  });

  it("unterstützt alternative Formate ([info], Fehler, Bullet-Präfix)", async () => {
    const report = await runBatchAnalysis(
      [chapter("c1")],
      [tool("t1", "[info] 7:Hinweis\nFehler:2:Echt schlimm\n- Warnung:4:Prüfen")],
      { yieldFn: noYield },
    );

    expect(report.findings[0]).toMatchObject({ severity: "info", line: 7, message: "Hinweis" });
    expect(report.findings[1]).toMatchObject({ severity: "error", line: 2, message: "Echt schlimm" });
    expect(report.findings[2]).toMatchObject({ severity: "warning", line: 4, message: "Prüfen" });
  });

  it("setzt Defaults: severity=info, line=1 ohne Präfix", async () => {
    const report = await runBatchAnalysis([chapter("c1")], [tool("t1", "Nur eine Meldung")], {
      yieldFn: noYield,
    });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ severity: "info", line: 1, message: "Nur eine Meldung" });
  });

  it("ignoriert Leerzeilen und Nicht-String-Ausgaben", async () => {
    const chapters = [chapter("c1")];
    const tools: BatchTool[] = [
      tool("t1", "\n\n  \nerror:1:Treffer\n"),
      { id: "t2", label: "T2", category: "test", run: () => 42 as unknown as string },
    ];

    const report = await runBatchAnalysis(chapters, tools, { yieldFn: noYield });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].message).toBe("Treffer");
  });

  it("unterstützt asynchrone Tools", async () => {
    const asyncTool: BatchTool = {
      id: "ta",
      label: "Async",
      category: "test",
      run: async () => {
        await Promise.resolve();
        return "error:9:Asynchroner Befund";
      },
    };

    const report = await runBatchAnalysis([chapter("c1")], [asyncTool], { yieldFn: noYield });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({ severity: "error", line: 9 });
  });

  it("überlebt ein werfendes Tool und protokolliert es als error-Befund", async () => {
    const throwing: BatchTool = {
      id: "boom",
      label: "Kaputt",
      category: "test",
      run: () => {
        throw new Error("kaputt");
      },
    };
    const good = tool("good", "info:1:ok");

    const report = await runBatchAnalysis([chapter("c1")], [throwing, good], { yieldFn: noYield });

    expect(report.findings).toHaveLength(2);
    const errFinding = report.findings.find((f) => f.toolId === "boom");
    expect(errFinding).toMatchObject({ severity: "error" });
    expect(errFinding?.message).toContain("kaputt");
    // Der Batch läuft nach dem Fehler weiter.
    expect(report.findings.some((f) => f.toolId === "good")).toBe(true);
  });

  it("verarbeitet leere Kapitel-Liste ohne Fehler", async () => {
    const report = await runBatchAnalysis([], [tool("t1", "error:1:x")], { yieldFn: noYield });
    expect(report.findings).toEqual([]);
    expect(report.chaptersScanned).toBe(0);
    expect(report.toolsRun).toBe(0);
  });

  it("verarbeitet leere Tool-Liste ohne Fehler", async () => {
    const report = await runBatchAnalysis([chapter("c1")], [], { yieldFn: noYield });
    expect(report.findings).toEqual([]);
    expect(report.chaptersScanned).toBe(1);
    expect(report.toolsRun).toBe(0);
  });

  it("ist defensiv gegen null/undefined-Eingaben", async () => {
    const report = await runBatchAnalysis(
      undefined as unknown as BatchChapter[],
      null as unknown as BatchTool[],
      { yieldFn: noYield },
    );
    expect(report.findings).toEqual([]);
    expect(report.chaptersScanned).toBe(0);
  });

  it("überspringt ungültige Kapitel und Tools", async () => {
    const chapters = [chapter("c1"), { id: "" } as BatchChapter, null as unknown as BatchChapter];
    const tools = [
      tool("t1", "info:1:x"),
      { id: "broken", label: "ohne run", category: "test" } as unknown as BatchTool,
    ];

    const report = await runBatchAnalysis(chapters, tools, { yieldFn: noYield });

    expect(report.chaptersScanned).toBe(1);
    expect(report.toolsRun).toBe(1);
    expect(report.findings).toHaveLength(1);
  });

  it("gibt zwischen Kapiteln die Kontrolle an die Event-Loop ab (Chunking)", async () => {
    const chapters = [chapter("c1"), chapter("c2"), chapter("c3"), chapter("c4")];
    const yieldSpy = vi.fn(() => Promise.resolve());

    await runBatchAnalysis(chapters, [tool("t1", "info:1:x")], {
      chunkSize: 1,
      yieldFn: yieldSpy,
    });

    // 4 Kapitel → yield nach c1, c2, c3 (nicht nach dem letzten).
    expect(yieldSpy).toHaveBeenCalledTimes(3);
  });

  it("respektiert chunkSize > 1", async () => {
    const chapters = Array.from({ length: 6 }, (_, i) => chapter(`c${i}`));
    const yieldSpy = vi.fn(() => Promise.resolve());

    await runBatchAnalysis(chapters, [tool("t1", "info:1:x")], {
      chunkSize: 3,
      yieldFn: yieldSpy,
    });

    // 6 Kapitel, chunkSize 3 → yield nach Kapitel 3 (nicht nach dem letzten).
    expect(yieldSpy).toHaveBeenCalledTimes(1);
  });

  it("begrenzt Befunde pro Kapitel (Endlos-Schutz)", async () => {
    const many = Array.from({ length: 50 }, (_, i) => `info:${i + 1}:Befund ${i}`).join("\n");
    const report = await runBatchAnalysis([chapter("c1")], [tool("t1", many)], {
      yieldFn: noYield,
      maxFindingsPerChapter: 10,
    });

    expect(report.findings).toHaveLength(10);
  });

  it("begrenzt Befunde gesamt über alle Kapitel (Endlos-Schutz)", async () => {
    const many = Array.from({ length: 20 }, (_, i) => `info:${i + 1}:Befund ${i}`).join("\n");
    const chapters = [chapter("c1"), chapter("c2"), chapter("c3")];

    const report = await runBatchAnalysis(chapters, [tool("t1", many)], {
      yieldFn: noYield,
      maxFindingsPerChapter: 100,
      maxTotalFindings: 25,
    });

    expect(report.findings).toHaveLength(25);
  });

  it("liefert durationMs aus der injizierten Zeitquelle", async () => {
    let t = 1000;
    const nowFn = () => {
      t += 50;
      return t;
    };

    const report = await runBatchAnalysis([chapter("c1")], [tool("t1", "info:1:x")], {
      yieldFn: noYield,
      nowFn,
    });

    expect(report.durationMs).toBeGreaterThan(0);
    expect(typeof report.durationMs).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// yieldToEventLoop
// ---------------------------------------------------------------------------

describe("yieldToEventLoop", () => {
  it("liefert ein auflösbares Promise", async () => {
    await expect(yieldToEventLoop()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createJumpTarget
// ---------------------------------------------------------------------------

describe("createJumpTarget", () => {
  const chapters = [chapter("c1"), chapter("c2"), chapter("c3")];

  const finding: BatchFinding = {
    chapterId: "c2",
    chapterTitle: "Kapitel c2",
    line: 17,
    toolId: "t1",
    toolLabel: "Tool t1",
    severity: "warning",
    message: "x",
  };

  it("löst den Kapitel-Index auf", () => {
    const target = createJumpTarget(finding, chapters);
    expect(target).toEqual({ chapterId: "c2", chapterIndex: 1, line: 17 });
  });

  it("gibt chapterIndex -1 für unbekanntes Kapitel zurück", () => {
    const target = createJumpTarget({ ...finding, chapterId: "unknown" }, chapters);
    expect(target.chapterIndex).toBe(-1);
    expect(target.chapterId).toBe("unknown");
  });

  it("arbeitet ohne Kapitel-Liste (Index -1)", () => {
    const target = createJumpTarget(finding);
    expect(target.chapterIndex).toBe(-1);
    expect(target.line).toBe(17);
  });

  it("klemmt ungültige Zeilennummern defensiv auf 1", () => {
    expect(createJumpTarget({ ...finding, line: 0 }, chapters).line).toBe(1);
    expect(createJumpTarget({ ...finding, line: -5 }, chapters).line).toBe(1);
    expect(createJumpTarget({ ...finding, line: NaN }, chapters).line).toBe(1);
  });

  it("ist defensiv gegen ein ungültiges Finding", () => {
    const target = createJumpTarget(null as unknown as BatchFinding);
    expect(target).toEqual({ chapterId: "", chapterIndex: -1, line: 1 });
  });
});

// ---------------------------------------------------------------------------
// summarizeReport
// ---------------------------------------------------------------------------

describe("summarizeReport", () => {
  function makeReport(findings: BatchFinding[]): BatchReport {
    return { findings, chaptersScanned: 1, toolsRun: 2, durationMs: 5 };
  }

  function f(severity: BatchFinding["severity"], toolId: string): BatchFinding {
    return {
      chapterId: "c1",
      chapterTitle: "Kapitel c1",
      line: 1,
      toolId,
      toolLabel: toolId,
      severity,
      message: "m",
    };
  }

  it("aggregiert Befunde nach Schweregrad", () => {
    const report = makeReport([
      f("error", "t1"),
      f("error", "t1"),
      f("warning", "t2"),
      f("info", "t1"),
    ]);

    const summary = summarizeReport(report);

    expect(summary.total).toBe(4);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.infos).toBe(1);
  });

  it("zählt Befunde pro Tool", () => {
    const report = makeReport([
      f("error", "t1"),
      f("warning", "t1"),
      f("info", "t2"),
    ]);

    const summary = summarizeReport(report);

    expect(summary.byTool).toEqual({ t1: 2, t2: 1 });
  });

  it("behandelt unbekannten Schweregrad als info", () => {
    const report = makeReport([{ ...f("info", "t1"), severity: "bogus" as BatchFinding["severity"] }]);
    const summary = summarizeReport(report);
    expect(summary.infos).toBe(1);
    expect(summary.errors).toBe(0);
  });

  it("liefert Nullsumme für leeren Report", () => {
    const summary = summarizeReport(makeReport([]));
    expect(summary).toEqual({ total: 0, errors: 0, warnings: 0, infos: 0, byTool: {} });
  });

  it("ist defensiv gegen ungültige Reports/Findings", () => {
    const summary = summarizeReport(undefined as unknown as BatchReport);
    expect(summary).toEqual({ total: 0, errors: 0, warnings: 0, infos: 0, byTool: {} });

    const withBad = summarizeReport(
      makeReport([null as unknown as BatchFinding, f("error", "t1")]),
    );
    expect(withBad.total).toBe(1);
    expect(withBad.errors).toBe(1);
  });

  it("fasst einen kompletten Batch-Lauf korrekt zusammen (Integration)", async () => {
    const report = await runBatchAnalysis(
      [chapter("c1"), chapter("c2")],
      [tool("t1", "error:1:hart\nwarning:2:weich"), tool("t2", "info:1:notiz")],
      { yieldFn: noYield },
    );

    const summary = summarizeReport(report);

    expect(summary.total).toBe(6);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(2);
    expect(summary.infos).toBe(2);
    expect(summary.byTool).toEqual({ t1: 4, t2: 2 });
  });
});
