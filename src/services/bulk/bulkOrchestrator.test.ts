// Unit-Tests: BulkOrchestrator (Sprint 5, Agent 2).
//
// Akzeptanz:
// - Cooldown zwischen Büchern wird eingehalten (Default 60s, konfigurierbar).
// - Fataler Fehler → failed_jobs.json wird geschrieben, Queue läuft weiter.
// - Context-Cache wird zwischen Büchern geleert.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BulkOrchestrator,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILED_JOBS_FILENAME,
} from "./bulkOrchestrator";
import type { BulkJobRunner, BulkJobResult, BulkRunResult, FailedJobsFile } from "./bulkOrchestrator";
import type { BulkJob } from "./csvQueue";

function job(title: string, overrides: Partial<BulkJob> = {}): BulkJob {
  return {
    id: `job_${title}`,
    title,
    genre: "sachbuch",
    targetWords: 10000,
    specialPrompt: "",
    language: "de",
    sourceRow: 2,
    ...overrides,
  };
}

interface FakeSetup {
  runner: BulkJobRunner;
  calls: string[];
  clears: () => number;
}

/** Fake-Runner: führt Jobs mit konfigurierbarem Ergebnis aus. */
function makeRunner(
  outcomes: Array<{ ok: boolean; error?: string }>,
  opts: { supportsClear?: boolean } = {},
): FakeSetup {
  const calls: string[] = [];
  let clearCount = 0;
  const supportsClear = opts.supportsClear ?? true;
  const runner: BulkJobRunner = {
    runJob: async (j: BulkJob): Promise<BulkJobResult> => {
      calls.push(j.title);
      const o = outcomes[calls.length - 1] ?? { ok: true };
      if (!o.ok) throw new Error(o.error ?? "fataler Fehler");
      return { projectId: `proj_${j.title}`, chaptersWritten: 3, wordsWritten: 3000 };
    },
    clearContextCache: supportsClear
      ? async () => { clearCount += 1; }
      : undefined,
  };
  return { runner, calls, clears: () => clearCount };
}

describe("BulkOrchestrator — Queue & Cooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("DEFAULT_COOLDOWN_MS ist 60s", () => {
    expect(DEFAULT_COOLDOWN_MS).toBe(60_000);
  });

  it("führt alle Jobs in CSV-Reihenfolge aus und hält Cooldown ein", async () => {
    const { runner, calls } = makeRunner([{ ok: true }, { ok: true }, { ok: true }]);
    const orch = new BulkOrchestrator(runner, { cooldownMs: 1000, sleepFn: async (ms) => { await vi.advanceTimersByTimeAsync(ms); } });
    const result = await orch.runAll([job("A"), job("B"), job("C")]);

    expect(calls).toEqual(["A", "B", "C"]);
    expect(result.completed.map((j) => j.title)).toEqual(["A", "B", "C"]);
    expect(result.failed).toEqual([]);
    // Cooldown nur ZWISCHEN Büchern (n-1), nicht nach dem letzten.
    expect(result.cooldownsTaken).toBe(2);
  });

  it("Default-Cooldown ist 60s, wenn nicht konfiguriert", async () => {
    const { runner } = makeRunner([{ ok: true }, { ok: true }]);
    const sleeps: number[] = [];
    const orch = new BulkOrchestrator(runner, { sleepFn: async (ms) => { sleeps.push(ms); } });
    await orch.runAll([job("A"), job("B")]);
    expect(sleeps).toEqual([60_000]);
  });

  it("überspringt den Cooldown nach dem letzten Job", async () => {
    const { runner } = makeRunner([{ ok: true }]);
    const sleeps: number[] = [];
    const orch = new BulkOrchestrator(runner, { sleepFn: async (ms) => { sleeps.push(ms); } });
    await orch.runAll([job("Solo")]);
    expect(sleeps).toEqual([]);
    expect(orch.getQueueLength()).toBe(0);
  });

  it("cooldownMs=0 → kein Warten (remote Provider)", async () => {
    const { runner } = makeRunner([{ ok: true }, { ok: true }]);
    const sleeps: number[] = [];
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0, sleepFn: async (ms) => { sleeps.push(ms); } });
    const res = await orch.runAll([job("A"), job("B")]);
    expect(sleeps).toEqual([]);
    expect(res.cooldownsTaken).toBe(0);
  });

  it("leert den Context-Cache nach jedem Buch", async () => {
    const { runner, clears } = makeRunner([{ ok: true }, { ok: true }]);
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0 });
    await orch.runAll([job("A"), job("B")]);
    expect(clears()).toBe(2);
  });

  it("leert den Context-Cache auch nach einem fehlgeschlagenen Buch", async () => {
    const { runner, clears } = makeRunner([{ ok: false }, { ok: true }]);
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0 });
    await orch.runAll([job("A"), job("B")]);
    expect(clears()).toBe(2);
  });
});

describe("BulkOrchestrator — Resume-on-Crash / failed_jobs.json", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schreibt failed_jobs.json bei fatalem Fehler, Queue läuft weiter", async () => {
    const { runner, calls } = makeRunner([
      { ok: false, error: "OOM: out of memory" },
      { ok: true },
    ]);
    const writes: Array<{ filename: string; data: FailedJobsFile }> = [];
    const orch = new BulkOrchestrator(runner, {
      cooldownMs: 0,
      writeFileFn: async (filename, data) => { writes.push({ filename, data }); },
    });
    const result = await orch.runAll([job("Crash"), job("Danach")]);

    expect(calls).toEqual(["Crash", "Danach"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      jobTitle: "Crash",
      jobId: "job_Crash",
      error: "OOM: out of memory",
      fatal: true,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].filename).toBe(DEFAULT_FAILED_JOBS_FILENAME);
    expect(writes[0].data.failed).toHaveLength(1);
    expect(writes[0].data.failed[0].error).toBe("OOM: out of memory");
    expect(typeof writes[0].data.generatedAt).toBe("number");
    // Queue lief weiter:
    expect(result.completed.map((j) => j.title)).toEqual(["Danach"]);
  });

  it("sammelt mehrere Fehler und schreibt sie kumulativ", async () => {
    const { runner } = makeRunner([{ ok: false, error: "e1" }, { ok: false, error: "e2" }]);
    const writes: Array<{ filename: string; data: FailedJobsFile }> = [];
    const orch = new BulkOrchestrator(runner, {
      cooldownMs: 0,
      writeFileFn: async (f, d) => { writes.push({ filename: f, data: d }); },
    });
    const res = await orch.runAll([job("X"), job("Y")]);
    expect(res.completed).toEqual([]);
    expect(res.failed.map((f) => f.error)).toEqual(["e1", "e2"]);
    expect(writes).toHaveLength(2);
    expect(writes[1].data.failed).toHaveLength(2);
  });

  it("reiht fehlgeschlagene Jobs NICHT erneut ein (kein Endlosloop)", async () => {
    const { runner, calls } = makeRunner([{ ok: false }, { ok: false }]);
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0 });
    await orch.runAll([job("A"), job("B")]);
    expect(calls).toEqual(["A", "B"]);
  });

  it("rührt failed_jobs.json nicht an, wenn alles klappt", async () => {
    const { runner } = makeRunner([{ ok: true }]);
    const writeFileFn = vi.fn();
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0, writeFileFn });
    const res = await orch.runAll([job("OK")]);
    expect(res.failed).toEqual([]);
    expect(writeFileFn).not.toHaveBeenCalled();
  });

  it("buildFailedJobsFile liefert das persistierbare Format", () => {
    const orch = new BulkOrchestrator(makeRunner([]).runner, { cooldownMs: 0 });
    const file = orch.buildFailedJobsFile([
      { jobId: "j1", jobTitle: "T", error: "boom", failedAt: 123, sourceRow: 5, fatal: true },
    ]);
    expect(file).toEqual({
      generatedAt: expect.any(Number),
      failed: [
        { jobId: "j1", jobTitle: "T", error: "boom", failedAt: 123, sourceRow: 5, fatal: true },
      ],
    });
  });

  it("BulkRunResult enthält Start/End-Zeitstempel", async () => {
    const { runner } = makeRunner([{ ok: true }]);
    const orch = new BulkOrchestrator(runner, { cooldownMs: 0 });
    const res: BulkRunResult = await orch.runAll([job("A")]);
    expect(res.startedAt).toBeLessThanOrEqual(res.finishedAt);
  });
});
