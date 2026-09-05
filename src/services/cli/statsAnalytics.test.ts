// Tests: Erweiterte Analytics (Sprint 7, Agent 4).
//
// - dailyCostTrend / weeklyBookTrend: Zeitstrail-Aggregation (Kosten pro Tag,
//   Buecher pro Woche) mit Null-Auffuellung fuer lueckenlose Charts.
// - localCloudCostTrend: Lokal-vs-Cloud-Vergleich ueber die Zeit.
// - sparkline: ASCII/Unicode-Blockcharts ("▇▅▃▁").
// - renderAnalyticsCsv: CSV-Export fuer Spreadsheet-Import.
// - CLI: --export=pfad schreibt die CSV und loggt.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { getLogEntries } from "@/services/logger";
import {
  dailyCostTrend, weeklyBookTrend, localCloudCostTrend,
  sparkline, renderTrendSection, renderAnalyticsCsv,
} from "./statsAnalytics";
import type { JobStats } from "./stats";
import { runStatsCommand, parseExportArg } from "./statsCommand";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Fixer Bezugszeitpunkt: 2026-09-05T12:00:00Z (Samstag). */
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

function job(overrides: Partial<JobStats> = {}): JobStats {
  return {
    jobId: "j", projectId: "p", status: "completed", chapterCount: 8,
    createdAt: NOW - 60_000, updatedAt: NOW, durationMs: 60_000,
    bucket: "local", calls: 1, tokens: 1000, latencyMs: 100,
    costUsd: 0, potentialCostUsd: 0,
    ...overrides,
  };
}

describe("dailyCostTrend", () => {
  it("gruppiert Cloud-Kosten nach Tag (UTC) und fuellt fehlende Tage mit 0", () => {
    const jobs = [
      job({ updatedAt: Date.UTC(2026, 8, 5, 10), costUsd: 0.02, potentialCostUsd: 0.05, bucket: "cloud" }),
      job({ updatedAt: Date.UTC(2026, 8, 5, 22), costUsd: 0.01, potentialCostUsd: 0.01, bucket: "cloud" }),
      job({ updatedAt: Date.UTC(2026, 8, 3, 8), costUsd: 0.30, potentialCostUsd: 0.30, bucket: "cloud" }),
    ];
    const trend = dailyCostTrend(jobs, 4, NOW);
    expect(trend).toHaveLength(4);
    expect(trend.map((d) => d.day)).toEqual([
      "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
    ]);
    expect(trend[0].cloudCostUsd).toBe(0);
    expect(trend[1].cloudCostUsd).toBeCloseTo(0.30, 6);
    expect(trend[3].cloudCostUsd).toBeCloseTo(0.03, 6);
    expect(trend[3].jobs).toBe(2);
  });

  it("sammelt Ersparnis und potenzielle Kosten je Tag", () => {
    const jobs = [
      job({ updatedAt: NOW, costUsd: 0, potentialCostUsd: 0.10, bucket: "local" }),
      job({ updatedAt: NOW, costUsd: 0.05, potentialCostUsd: 0.05, bucket: "cloud" }),
    ];
    const trend = dailyCostTrend(jobs, 1, NOW);
    expect(trend[0].potentialCloudCostUsd).toBeCloseTo(0.15, 6);
    expect(trend[0].savingsUsd).toBeCloseTo(0.10, 6);
    expect(trend[0].cloudCostUsd).toBeCloseTo(0.05, 6);
  });

  it("leere Job-Liste → lauter 0-Tage, kein Crash", () => {
    const trend = dailyCostTrend([], 3, NOW);
    expect(trend).toHaveLength(3);
    expect(trend.every((d) => d.cloudCostUsd === 0 && d.jobs === 0)).toBe(true);
  });
});

describe("weeklyBookTrend", () => {
  it("zaehlt abgeschlossene Buecher pro ISO-Woche, laufende nicht", () => {
    const jobs = [
      // KW 36 (31.08.–06.09.2026): 2 abgeschlossene + 1 laufender Job
      job({ updatedAt: Date.UTC(2026, 8, 1), status: "completed" }),
      job({ updatedAt: Date.UTC(2026, 8, 4), status: "completed" }),
      job({ updatedAt: Date.UTC(2026, 8, 5), status: "running" }),
      // KW 34: 1 Buch
      job({ updatedAt: Date.UTC(2026, 7, 20), status: "completed" }),
    ];
    const trend = weeklyBookTrend(jobs, 3, NOW);
    expect(trend.map((w) => w.week)).toEqual(["2026-W34", "2026-W35", "2026-W36"]);
    expect(trend[0].books).toBe(1);
    expect(trend[1].books).toBe(0);
    expect(trend[2].books).toBe(2);
  });
});

describe("localCloudCostTrend", () => {
  it("trennt reale Cloud-Kosten von potenziellen (lokal haette gekostet)", () => {
    const jobs = [
      job({ updatedAt: NOW, bucket: "local", costUsd: 0, potentialCostUsd: 0.20 }),
      job({ updatedAt: NOW, bucket: "cloud", costUsd: 0.08, potentialCostUsd: 0.08 }),
    ];
    const trend = localCloudCostTrend(jobs, 1, NOW);
    expect(trend[0].cloudCostUsd).toBeCloseTo(0.08, 6);
    expect(trend[0].localPotentialCostUsd).toBeCloseTo(0.20, 6);
  });
});

describe("sparkline", () => {
  it("bildet Werte auf Unicode-Blockstufen ab (max → ▇-Top)", () => {
    expect(sparkline([1, 2, 3, 4])).toBe("▂▄▆█");
  });
  it("alle 0 → flache Linie", () => {
    expect(sparkline([0, 0, 0])).toBe("▁▁▁");
  });
  it("leere Liste → leerer String", () => {
    expect(sparkline([])).toBe("");
  });
});

describe("renderTrendSection", () => {
  it("enthaelt Kosten-pro-Tag-Chart, Lokal-vs-Cloud-Vergleich und Buecher-pro-Woche", () => {
    const jobs = [
      job({ updatedAt: NOW, bucket: "cloud", costUsd: 0.4, potentialCostUsd: 0.4 }),
      job({ updatedAt: NOW - 3 * 86_400_000, bucket: "local", costUsd: 0, potentialCostUsd: 0.9 }),
    ];
    const text = renderTrendSection(jobs, NOW);
    expect(text).toContain("Kosten pro Tag");
    expect(text).toContain("Lokal vs. Cloud");
    expect(text).toContain("Bücher pro Woche");
    expect(text).toMatch(/[▁▂▃▄▅▆▇█]/);
  });
});

describe("renderAnalyticsCsv", () => {
  it("schreibt Header + eine Zeile pro Tag mit Zahlen (Punkt-Dezimaltrenner)", () => {
    const jobs = [
      job({ updatedAt: NOW, bucket: "cloud", costUsd: 0.25, potentialCostUsd: 0.25, tokens: 5000, chapterCount: 8 }),
      job({ updatedAt: NOW, bucket: "local", costUsd: 0, potentialCostUsd: 0.10, tokens: 3000, chapterCount: 4 }),
    ];
    const csv = renderAnalyticsCsv(jobs, 2, NOW);
    const lines = csv.split("\n").filter((l) => l.length > 0);
    expect(lines[0]).toBe("day,jobs,books,chapters,cloud_cost_usd,potential_cloud_cost_usd,savings_usd,tokens");
    expect(lines).toHaveLength(3);
    const last = lines[2].split(",");
    expect(last[0]).toBe("2026-09-05");
    expect(Number(last[1])).toBe(2);
    expect(Number(last[2])).toBe(2);
    expect(Number(last[4])).toBeCloseTo(0.25, 6);
    expect(Number(last[6])).toBeCloseTo(0.10, 6);
    expect(Number(last[7])).toBe(8000);
  });
});

describe("parseExportArg", () => {
  it("--export=analytics.csv liefert den Pfad", () => {
    expect(parseExportArg(["node", "cli.js", "--stats", "--export=analytics.csv"])).toBe("analytics.csv");
  });
  it("--export ohne Wert → Standarddateiname", () => {
    expect(parseExportArg(["node", "cli.js", "--export"])).toBe("analytics.csv");
  });
  it("ohne --export → null", () => {
    expect(parseExportArg(["node", "cli.js", "--stats"])).toBeNull();
  });
});

describe("runStatsCommand mit --export", () => {
  beforeEach(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON;");
    runMigrations(db);
    (globalThis as any).__aws_db = db;
  });
  afterEach(() => {
    delete (globalThis as any).__aws_db;
  });

  it("schreibt die CSV-Datei und loggt den Export", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-export-"));
    const out = path.join(dir, "analytics.csv");
    try {
      const text = await runStatsCommand({ exportPath: out });
      expect(text).toContain("Token-Analytics");
      expect(fs.existsSync(out)).toBe(true);
      const csv = fs.readFileSync(out, "utf8");
      expect(csv.startsWith("day,jobs,books,")).toBe(true);
      expect(getLogEntries().some((e) => e.context === "cli/stats" && e.message.includes("Export"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
