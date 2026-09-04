// Tests: Bookwriter-Telemetrie & Budget (Sprint 2, B4).
//
// - Migration 020: telemetry_json-Spalte auf bookwriter_jobs (idempotent)
// - recordRouterCall appendet Calls, persistiert, summiert Budget
// - Budget überschritten → Event `bookwriter:budget-warning` (einmalig)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import {
  appendCall, emptyTelemetry, estimateCallCost, DEFAULT_BUDGET_LIMIT,
  recordRouterCall, loadJobTelemetry, BOOKWRITER_BUDGET_WARNING_EVENT,
  type BookwriterTelemetry,
} from "./telemetry";
import type { RouterCallMeta } from "@/services/llm/router";
import { createBookJob } from "./jobs";
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

let jobId: string;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  const p = await createProject("Telemetrie-Projekt");
  const config: BookWriterConfig = {
    topic: "KI im Alltag", genre: "Sachbuch", targetAudience: "Erwachsene",
    chapterCount: 8, model: "mock", baseUrl: "http://127.0.0.1:11434", language: "Deutsch",
  };
  jobId = createBookJob(p.id, config).id;
});

afterEach(() => {
  delete (globalThis as any).__aws_db;
});

describe("Migration 020: telemetry_json", () => {
  it("Spalte telemetry_json existiert auf bookwriter_jobs", () => {
    const db = (globalThis as any).__aws_db;
    const res = db.exec("PRAGMA table_info(bookwriter_jobs)");
    const cols = res[0].values.map((v: unknown[]) => String(v[1]));
    expect(cols).toContain("telemetry_json");
  });

  it("Migration ist idempotent (Re-Run wirft nicht)", () => {
    const db = (globalThis as any).__aws_db;
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("B4: Telemetrie & Budget", () => {
  it("estimateCallCost: openrouter real, ollama mit Faktor 0.1", () => {
    expect(estimateCallCost(meta({ provider: "openrouter", tokens_est: 100 }))).toBe(100);
    expect(estimateCallCost(meta({ provider: "ollama", tokens_est: 100 }))).toBe(10);
  });

  it("appendCall summiert tokens/latency/fallbacks und Budget", () => {
    let t = emptyTelemetry();
    const r1 = appendCall(t, meta({ tokens_est: 500, latency_ms: 2000 }));
    t = r1.telemetry;
    const r2 = appendCall(t, meta({ tokens_est: 300, latency_ms: 1000, fallback_reason: "health_check_failed" }));
    t = r2.telemetry;

    expect(t.calls.length).toBe(2);
    expect(t.tokensTotal).toBe(800);
    expect(t.latencyTotalMs).toBe(3000);
    expect(t.fallbackCount).toBe(1);
    expect(t.budget.spent).toBe(500 * 0.1 + 300 * 0.1); // 80
    expect(r2.budgetExceeded).toBe(false);
  });

  it("Budget überschritten → budgetExceeded einmalig (warned-Flag)", () => {
    let t = emptyTelemetry(100);
    // openrouter, 120 Tokens pro Call → Kosten 120 > 100 sofort.
    const r1 = appendCall(t, meta({ provider: "openrouter", tokens_est: 120 }));
    t = r1.telemetry;
    expect(r1.budgetExceeded).toBe(true);
    const r2 = appendCall(t, meta({ provider: "openrouter", tokens_est: 120 }));
    expect(r2.budgetExceeded).toBe(false); // warned-Flag verhindert Doppel-Alarm
    expect(r2.telemetry.budget.warned).toBe(true);
  });

  it("recordRouterCall persistiert Telemetrie in telemetry_json (DB)", async () => {
    await recordRouterCall(jobId, meta({ tokens_est: 1000 }));
    const t = loadJobTelemetry(jobId);
    expect(t).not.toBeNull();
    expect(t!.calls.length).toBe(1);
    expect(t!.calls[0].model).toBe("llama3.1:8b");
    expect(t!.tokensTotal).toBe(1000);
  });

  it("Budget-Überschreitung feuert Event bookwriter:budget-warning (einmalig)", async () => {
    const listener = vi.fn();
    if (typeof window !== "undefined") {
      window.addEventListener(BOOKWRITER_BUDGET_WARNING_EVENT, listener);
    }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // openrouter 500.001 Tokens → Kosten > Default-Limit 500.000 → Alarm.
      await recordRouterCall(jobId, meta({ provider: "openrouter", tokens_est: DEFAULT_BUDGET_LIMIT + 1 }));
      expect(loadJobTelemetry(jobId)!.budget.warned).toBe(true);
      const fired = listener.mock.calls.length + warnSpy.mock.calls.filter((a) =>
        String(a[0]).includes("Budget-Warnung")).length;
      expect(fired).toBeGreaterThanOrEqual(1);

      // Zweite Überschreitung → KEIN zweiter Alarm (warned-Flag).
      const warnCountBefore = warnSpy.mock.calls.filter((a) => String(a[0]).includes("Budget-Warnung")).length;
      await recordRouterCall(jobId, meta({ provider: "openrouter", tokens_est: 60 }));
      const warnCountAfter = warnSpy.mock.calls.filter((a) => String(a[0]).includes("Budget-Warnung")).length;
      expect(warnCountAfter).toBe(warnCountBefore);
    } finally {
      warnSpy.mockRestore();
      if (typeof window !== "undefined") {
        window.removeEventListener(BOOKWRITER_BUDGET_WARNING_EVENT, listener);
      }
    }
  });

  it("loadJobTelemetry ohne Einträge → null; Default-Limit korrekt", () => {
    expect(loadJobTelemetry("bwj-nichtexistent")).toBeNull();
    expect(DEFAULT_BUDGET_LIMIT).toBeGreaterThan(0);
    const t: BookwriterTelemetry = emptyTelemetry();
    expect(t.budget.limit).toBe(DEFAULT_BUDGET_LIMIT);
  });
});