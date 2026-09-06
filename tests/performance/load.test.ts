// Last-/Pool-Tuning-Tests: parallele Book-Generierung durch den echten
// Job-Store + OllamaConnectionPool mit gemockten Provider-Funktionen.
//
// Kein Netzwerk, kein echter Ollama — CI-sicher. In-Memory-sql.js wie in
// bookwriter.e2e.simulation.test.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());

import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  createBookJob,
  setBookJobOutline,
  updateBookJobProgress,
  completeBookJob,
  loadBookJob,
} from "@/services/bookwriter/jobs";
import {
  OllamaConnectionPool,
  resetOllamaPools,
} from "@/services/ollama/connectionPool";
import type { BookOutline } from "@/types/bookwriter";
import type { BookWriterConfig } from "@/services/writing/bookwriter";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function baseConfig(): BookWriterConfig {
  return {
    topic: "KI im Alltag",
    genre: "Sachbuch",
    targetAudience: "Erwachsene",
    chapterCount: 4,
    model: "fake-model",
    baseUrl: "http://127.0.0.1:11434",
    language: "Deutsch",
    wordsPerChapter: 120,
  };
}

function fakeOutline(n = 4): BookOutline {
  return {
    title: "Last-Test-Buch",
    chapters: Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      title: `Kapitel ${i + 1}`,
      goal: "Ziel",
      conflict: "Konflikt",
      outcome: "Ergebnis",
    })),
    chapterSummaries: [],
    entities: [],
  } as unknown as BookOutline;
}

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as unknown as { __aws_db?: unknown }).__aws_db = db;
  const p = await createProject("Last-Test-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as unknown as { __aws_db?: unknown }).__aws_db;
  resetOllamaPools();
});

describe("Load: parallele Book-Jobs durch echten Job-Store + Pool", () => {
  it("6 parallele Jobs: alle complete, maxConcurrency nie überschritten, Durchsatz-Report", async () => {
    const JOB_COUNT = 6;
    const MAX_CONCURRENT = 3;
    const TOKENS_PER_JOB = 500; // simulierte Token pro Job
    const WORK_MS = 40; // simulierte Provider-Latenz pro Job

    const pool = new OllamaConnectionPool({ maxConcurrent: MAX_CONCURRENT });
    let inFlight = 0;
    let maxObserved = 0;

    const runOneJob = async (idx: number) => {
      const job = createBookJob(projectId, baseConfig(), null);
      await setBookJobOutline(job.id, fakeOutline());
      // Mock-Provider-Funktion: hält den Pool-Slot für die volle Dauer
      // (acquire/release-Vertrag wie bei echten Streams).
      const text = await pool.run(async () => {
        inFlight += 1;
        maxObserved = Math.max(maxObserved, inFlight);
        try {
          await sleep(WORK_MS);
          return `kapitel-${idx} ` + "wort ".repeat(TOKENS_PER_JOB);
        } finally {
          inFlight -= 1;
        }
      }, `job-${idx}`);
      const tokens = text.split(/\s+/).length;
      await updateBookJobProgress(job.id, 4);
      await completeBookJob(job.id);
      return { jobId: job.id, tokens };
    };

    const start = performance.now();
    const results = await Promise.all(
      Array.from({ length: JOB_COUNT }, (_, i) => runOneJob(i)),
    );
    const wallMs = performance.now() - start;

    // Alle Jobs vollständig + im Store als completed.
    expect(results).toHaveLength(JOB_COUNT);
    for (const r of results) {
      expect(loadBookJob(r.jobId)?.status).toBe("completed");
    }
    // Pool-Grenze nie überschritten.
    expect(maxObserved).toBeLessThanOrEqual(MAX_CONCURRENT);
    expect(maxObserved).toBeGreaterThan(1); // es lief wirklich parallel
    const stats = pool.getStats();
    expect(stats.completed).toBe(JOB_COUNT);
    expect(stats.rejected).toBe(0);

    // Durchsatz-Report (tokens/s-Stil wie vom Task gefordert).
    const totalTokens = results.reduce((s, r) => s + r.tokens, 0);
    const tokensPerSec = Math.round((totalTokens / wallMs) * 1000);
    const jobsPerSec = (JOB_COUNT / (wallMs / 1000)).toFixed(2);
    console.log(
      `[load] ${JOB_COUNT} jobs in ${wallMs.toFixed(0)} ms ` +
        `| maxObserved=${maxObserved}/${MAX_CONCURRENT} ` +
        `| ${totalTokens} tokens → ${tokensPerSec} tokens/s ` +
        `| ${jobsPerSec} jobs/s | avgWait=${stats.avgWaitMs} ms`,
    );
    expect(tokensPerSec).toBeGreaterThan(0);
  });

  it("Backpressure: Burst stellt sich in die Queue (queued > 0)", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 2 });
    // Beide Slots manuell belegen → alles Weitere muss warten.
    const rel1 = await pool.acquire("holder-1");
    const rel2 = await pool.acquire("holder-2");

    const pending = Array.from({ length: 4 }, (_, i) =>
      pool.run(async () => {
        await sleep(30);
        return i;
      }, `burst-${i}`),
    );
    // Kurz warten, bis sich die Queue gefüllt hat (Slots noch belegt).
    await sleep(10);
    const sawQueued = pool.getStats().queued;
    expect(sawQueued).toBeGreaterThan(0);

    rel1();
    rel2();
    const out = await Promise.all(pending);
    expect(out).toEqual([0, 1, 2, 3]);
    // completed zählt jedes release(): 2 manuelle Holder + 4 Burst-Runs.
    expect(pool.getStats().completed).toBe(6);
    console.log(`[load] backpressure: max queued während Burst = ${sawQueued}`);
  });

  it("Queue-Timeout: wartender Request wird abgewiesen (rejected + 1)", async () => {
    const pool = new OllamaConnectionPool({
      maxConcurrent: 1,
      queueTimeoutMs: 50,
    });
    const release = await pool.acquire("blocker");
    const queued = pool.run(
      async () => {
        await sleep(10);
        return "zu spät";
      },
      "timeout-opfer",
    );
    await expect(queued).rejects.toThrow(/Queue-Timeout/);
    expect(pool.getStats().rejected).toBe(1);
    expect(pool.getStats().completed).toBe(0);
    release();
    // Pool danach wieder benutzbar. completed zählt jedes release():
    // 1 Blocker + 1 Nachfolge-Run.
    await expect(pool.run(async () => "ok", "nachher")).resolves.toBe("ok");
    expect(pool.getStats().completed).toBe(2);
  });
});
