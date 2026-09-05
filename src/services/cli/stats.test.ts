// Tests: Token-Analytics & Kosten-Transparenz (Sprint 6, Agent 1).
//
// - costCalculator: OpenRouter-Kosten aus Token-Zahlen, Ersparnis durch
//   lokales Routing (Counterfactual-Cloud-Kosten).
// - stats: historische Auswertung über alle bookwriter_jobs (+ telemetry_json),
//   Zeit-Pro-Buch-Metrik separiert nach lokal/Cloud.
// - renderStats: textuelle Dashboard-Ausgabe.
// - CLI: --stats-Flag druckt Historie statt Dashboard-Loop.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  callCostUsd, counterfactualCloudCostUsd, computeCostReport,
  isCloudProvider, DEFAULT_CLOUD_PRICE_PER_M,
} from "./costCalculator";
import {
  computeJobStats, collectStats, renderStats,
  type StatsReport,
} from "./stats";
import type { RouterCallMeta } from "@/services/llm/router";
import { createBookJob, setBookJobStatus } from "@/services/bookwriter/jobs";
import { saveJobTelemetry, emptyTelemetry, appendCall } from "@/services/bookwriter/telemetry";
import type { BookWriterConfig } from "@/services/writing/bookwriter";

function meta(overrides: Partial<RouterCallMeta> = {}): RouterCallMeta {
  return {
    provider: "ollama",
    model: "llama3.1:8b",
    latency_ms: 100,
    tokens_est: 1000,
    fallback_reason: null,
    task: "chapter",
    ok: true,
    ...overrides,
  };
}

const config: BookWriterConfig = {
  topic: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapterCount: 8, model: "mock", baseUrl: "http://127.0.0.1:11434", language: "Deutsch",
};

let projectId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Stats-Projekt");
  projectId = p.id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

/** Legt einen abgeschlossenen Job mit Telemetrie an (Zeiten relativ zu now). */
async function seedJob(opts: {
  startedAgoMs: number; durationMs: number; chapters?: number;
  calls?: RouterCallMeta[];
}): Promise<string> {
  const job = createBookJob(projectId, config);
  await setBookJobStatus(job.id, "completed");
  let t = emptyTelemetry();
  for (const c of opts.calls ?? []) t = appendCall(t, c).telemetry;
  await saveJobTelemetry(job.id, t);
  // Historische Zeitstempel — NACH saveJobTelemetry, das updated_at auf
  // "jetzt" setzt (in Produktion korrekt: letzter Telemetrie-Schreib ≈ Lauf-Ende).
  const now = Date.now();
  (globalThis as any).__aws_db.run(
    `UPDATE bookwriter_jobs SET created_at = ?, updated_at = ?, current_chapter = ? WHERE id = ?`,
    [now - opts.startedAgoMs, now - opts.startedAgoMs + opts.durationMs, opts.chapters ?? 8, job.id],
  );
  return job.id;
}

describe("costCalculator", () => {
  it("Cloud-Call (openrouter) kostet Geld laut Preisliste", () => {
    const m = meta({ provider: "openrouter", model: "deepseek/deepseek-chat", tokens_est: 1_000_000 });
    expect(isCloudProvider(m.provider)).toBe(true);
    expect(callCostUsd(m)).toBeGreaterThan(0);
  });

  it("Lokaler Call kostet 0 USD", () => {
    const m = meta({ provider: "ollama", tokens_est: 999_999 });
    expect(isCloudProvider(m.provider)).toBe(false);
    expect(callCostUsd(m)).toBe(0);
  });

  it("Counterfactual: lokale Tokens hätten auf dem Cloud-Default-Modell gekostet", () => {
    const m = meta({ provider: "ollama", tokens_est: 2_000_000 });
    expect(counterfactualCloudCostUsd(m)).toBeCloseTo(2 * DEFAULT_CLOUD_PRICE_PER_M, 6);
  });

  it("computeCostReport: Cloud-Kosten, Ersparnis und Token-Summen", () => {
    const calls = [
      meta({ provider: "ollama", tokens_est: 100_000, latency_ms: 500 }),            // lokal, gratis
      meta({ provider: "openrouter", model: "deepseek/deepseek-chat", tokens_est: 50_000, latency_ms: 1200 }),
      meta({ provider: "lmstudio", tokens_est: 30_000, latency_ms: 300 }),
    ];
    const report = computeCostReport(calls);
    expect(report.localTokens).toBe(130_000);
    expect(report.cloudTokens).toBe(50_000);
    expect(report.cloudCostUsd).toBeCloseTo(callCostUsd(calls[1]), 6);
    // Ersparnis = potenzielle Cloud-Kosten − reale Cloud-Kosten. Potenziell:
    // lokale Tokens zum Default-Preis, Cloud-Tokens zum Modellpreis.
    expect(report.savingsUsd).toBeGreaterThan(0);
    expect(report.potentialCloudCostUsd).toBeCloseTo(
      counterfactualCloudCostUsd(meta({ tokens_est: 130_000 })) + callCostUsd(calls[1]), 6,
    );
    expect(report.savingsUsd).toBeCloseTo(report.potentialCloudCostUsd - report.cloudCostUsd, 6);
    expect(report.calls).toBe(3);
  });

  it("computeCostReport: leerer Call-Set → alles 0", () => {
    const report = computeCostReport([]);
    expect(report.cloudCostUsd).toBe(0);
    expect(report.savingsUsd).toBe(0);
    expect(report.tokensTotal).toBe(0);
  });
});

describe("stats: Zeit-Pro-Buch-Metrik (lokal vs. Cloud)", () => {
  it("rein lokaler Job → Bucket 'local'", async () => {
    await seedJob({
      startedAgoMs: 10 * 60_000, durationMs: 5 * 60_000,
      calls: [meta({ provider: "ollama", latency_ms: 4000 })],
    });
    const report = collectStats();
    expect(report.timePerBook.local).not.toBeNull();
    expect(report.timePerBook.local!.count).toBe(1);
    expect(report.timePerBook.local!.avgDurationMs).toBe(5 * 60_000);
    expect(report.timePerBook.cloud).toBeNull();
  });

  it("Job mit OpenRouter-Call → Bucket 'cloud'", async () => {
    await seedJob({
      startedAgoMs: 20 * 60_000, durationMs: 9 * 60_000,
      calls: [
        meta({ provider: "ollama", latency_ms: 2000 }),
        meta({ provider: "openrouter", latency_ms: 1500 }),
      ],
    });
    const report = collectStats();
    expect(report.timePerBook.cloud).not.toBeNull();
    expect(report.timePerBook.cloud!.count).toBe(1);
    expect(report.timePerBook.cloud!.avgDurationMs).toBe(9 * 60_000);
    // ø Call-Latenz über beide Calls (ollama 2000 + openrouter 1500) / 2.
    expect(report.timePerBook.cloud!.avgLatencyMs).toBe(1750);
    expect(report.timePerBook.local).toBeNull();
  });

  it("Mittelwert über mehrere Jobs je Bucket", async () => {
    await seedJob({ startedAgoMs: 60_000, durationMs: 100_000, calls: [meta({ provider: "ollama" })] });
    await seedJob({ startedAgoMs: 60_000, durationMs: 200_000, calls: [meta({ provider: "lmstudio" })] });
    await seedJob({ startedAgoMs: 60_000, durationMs: 300_000, calls: [meta({ provider: "openrouter" })] });
    const report = collectStats();
    expect(report.timePerBook.local!.count).toBe(2);
    expect(report.timePerBook.local!.avgDurationMs).toBe(150_000);
    expect(report.timePerBook.cloud!.count).toBe(1);
  });

  it("computeJobStats: laufender Job ohne Telemetrie zählt als lokal, 0 Kosten", () => {
    const s = computeJobStats({
      id: "j1", projectId: "p1", status: "running", chapterCount: 3,
      createdAt: 1000, updatedAt: 61_000, calls: [],
    });
    expect(s.bucket).toBe("local");
    expect(s.durationMs).toBe(60_000);
    expect(s.costUsd).toBe(0);
  });
});

describe("stats: historische Auswertung aus der DB", () => {
  it("collectStats aggregiert Jobs, Tokens und Kosten über alle Jobs", async () => {
    await seedJob({
      startedAgoMs: 30 * 60_000, durationMs: 120_000,
      calls: [
        meta({ provider: "ollama", tokens_est: 10_000, latency_ms: 800 }),
        meta({ provider: "openrouter", tokens_est: 5_000, latency_ms: 400 }),
      ],
    });
    await seedJob({
      startedAgoMs: 10 * 60_000, durationMs: 60_000,
      calls: [meta({ provider: "lmstudio", tokens_est: 7_000, latency_ms: 300 })],
    });
    const report = collectStats();
    expect(report.jobs.length).toBe(2);
    expect(report.totals.jobs).toBe(2);
    expect(report.totals.tokens).toBe(22_000);
    expect(report.totals.cloudCostUsd).toBeCloseTo(callCostUsd(meta({ provider: "openrouter", tokens_est: 5_000 })), 6);
    expect(report.byProvider["ollama"].calls).toBe(1);
    expect(report.byProvider["openrouter"].tokens).toBe(5_000);
    expect(report.totals.completedJobs).toBe(2);
  });

  it("Jobs ohne Telemetrie brechen die Auswertung nicht", async () => {
    const job = createBookJob(projectId, config);
    const report = collectStats();
    const js = report.jobs.find((j) => j.jobId === job.id);
    expect(js).toBeDefined();
    expect(js!.calls).toBe(0);
  });
});

describe("renderStats: Dashboard-Text", () => {
  it("enthält Überschriften, Zeit-Pro-Buch-Buckets und Kosten", async () => {
    await seedJob({
      startedAgoMs: 60_000, durationMs: 240_000,
      calls: [meta({ provider: "openrouter", tokens_est: 80_000, latency_ms: 900 })],
    });
    const report = collectStats();
    const text = renderStats(report);
    expect(text).toContain("Token-Analytics");
    expect(text).toContain("Zeit pro Buch");
    expect(text).toContain("Cloud");
    expect(text).toContain("Kosten");
    expect(text).toContain("Ersparnis");
    // Historische Jobs gelistet
    expect(text).toContain("abgeschlossen");
  });

  it("leerer Bestand → verständlicher Hinweis, kein Crash", () => {
    const text = renderStats({ jobs: [], totals: {
      jobs: 0, completedJobs: 0, chapters: 0, tokens: 0, calls: 0, cloudCostUsd: 0, savingsUsd: 0,
    }, byProvider: {}, timePerBook: { local: null, cloud: null } } as unknown as StatsReport);
    expect(text).toContain("Keine historischen Daten");
  });
});