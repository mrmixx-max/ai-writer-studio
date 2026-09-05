// Token-Analytics: Zeit-Pro-Buch & historische Auswertung (Sprint 6, Agent 1).
//
// - Liest ALLE bookwriter_jobs (+ telemetry_json) aus der DB und aggregiert
//   sie zu einer Historie: Job-Liste, Token-/Kosten-Totals, Provider-Verteilung
//   und Zeit-Pro-Buch-Metrik separiert nach lokal/Cloud.
// - Kosten-Berechnung liegt in ./costCalculator (Preisliste + Counterfactual).
// - renderStats erzeugt den textuellen Dashboard-Block für den CLI-`stats`-
//   Befehl. Pure Funktionen, DB-Zugriff nur in collectStats.
import { getDb } from "@/services/db";
import type { RouterCallMeta } from "@/services/llm/router";
import {
  computeCostReport,
} from "./costCalculator";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein historischer Job mit geparster Telemetrie. */
export interface JobStats {
  jobId: string;
  projectId: string;
  status: string;
  chapterCount: number;
  createdAt: number;
  updatedAt: number;
  /** updated_at − created_at (Wandlungszeit des Generierungslaufs). */
  durationMs: number;
  /** Ausführungsklasse: lokal (nur ollama/lmstudio) oder cloud (mind. 1 Cloud-Call). */
  bucket: "local" | "cloud";
  calls: number;
  tokens: number;
  /** Gesamtlanzensumme aller Calls in ms. */
  latencyMs: number;
  costUsd: number;
}

export interface ProviderStats {
  provider: string;
  calls: number;
  tokens: number;
  latencyMs: number;
  fallbacks: number;
  errors: number;
}

export interface TimeBucketStats {
  /** Anzahl abgeschlossener Jobs im Bucket. */
  count: number;
  avgDurationMs: number;
  avgLatencyMs: number;
  tokens: number;
}

export interface StatsReport {
  jobs: JobStats[];
  totals: {
    jobs: number;
    completedJobs: number;
    chapters: number;
    tokens: number;
    calls: number;
    cloudCostUsd: number;
    /** Ersparnis durch lokales Routing (Counterfactual-Cloud-Kosten − real). */
    savingsUsd: number;
  };
  byProvider: Record<string, ProviderStats>;
  timePerBook: { local: TimeBucketStats | null; cloud: TimeBucketStats | null };
}

/** Provider, deren Calls als kostenlos (lokal) gelten. */
const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio", "local", "mock"]);

export function isCloudProvider(provider: string): boolean {
  return !LOCAL_PROVIDERS.has(provider);
}

function parseTelemetry(raw: unknown): { calls: RouterCallMeta[] } {
  if (raw === null || raw === undefined) return { calls: [] };
  try {
    const parsed = JSON.parse(String(raw)) as { calls?: RouterCallMeta[] };
    return { calls: Array.isArray(parsed.calls) ? parsed.calls : [] };
  } catch {
    return { calls: [] };
  }
}

function rowToString(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function rowToNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

/** Statistik für einen einzelnen Job (pure — testbar ohne DB). */
export function computeJobStats(input: {
  id: string; projectId: string; status: string; chapterCount: number;
  createdAt: number; updatedAt: number; calls: RouterCallMeta[];
}): JobStats {
  const report = computeCostReport(input.calls);
  const cloudCall = input.calls.find((c) => isCloudProvider(c.provider));
  return {
    jobId: input.id,
    projectId: input.projectId,
    status: input.status,
    chapterCount: input.chapterCount,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    durationMs: Math.max(0, input.updatedAt - input.createdAt),
    bucket: cloudCall ? "cloud" : "local",
    calls: input.calls.length,
    tokens: report.tokensTotal,
    latencyMs: report.latencyTotalMs,
    costUsd: report.cloudCostUsd,
  };
}

function bucketFrom(jobs: JobStats[], bucket: "local" | "cloud"): TimeBucketStats | null {
  const sel = jobs.filter((j) => j.bucket === bucket);
  if (sel.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const latencyTotal = sel.reduce((a, j) => a + j.latencyMs, 0);
  const callCount = sel.reduce((a, j) => a + j.calls, 0);
  return {
    count: sel.length,
    avgDurationMs: Math.round(avg(sel.map((j) => j.durationMs))),
    // Mittlere Latenz PRO CALL über alle Jobs im Bucket.
    avgLatencyMs: callCount > 0 ? Math.round(latencyTotal / callCount) : 0,
    tokens: sel.reduce((a, j) => a + j.tokens, 0),
  };
}

/** Liest alle Jobs + Telemetrie und aggregiert die Historie. */
export function collectStats(): StatsReport {
  const res = getDb().exec(`
    SELECT id, project_id, status, current_chapter, created_at, updated_at, telemetry_json
    FROM bookwriter_jobs
    ORDER BY created_at ASC
  `);
  const jobs: JobStats[] = [];
  const byProvider: Record<string, ProviderStats> = {};
  const allCalls: RouterCallMeta[] = [];
  let completedJobs = 0;
  let chapters = 0;

  for (const row of res[0]?.values ?? []) {
    const { calls } = parseTelemetry(row[6]);
    allCalls.push(...calls);
    const js = computeJobStats({
      id: rowToString(row[0]),
      projectId: rowToString(row[1]),
      status: rowToString(row[2]) || "running",
      chapterCount: rowToNumber(row[3]),
      createdAt: rowToNumber(row[4]),
      updatedAt: rowToNumber(row[5]),
      calls,
    });
    jobs.push(js);
    if (js.status === "completed") completedJobs += 1;
    chapters += js.chapterCount;
    for (const c of calls) {
      const p = (byProvider[c.provider] ??= {
        provider: c.provider, calls: 0, tokens: 0, latencyMs: 0, fallbacks: 0, errors: 0,
      });
      p.calls += 1;
      p.tokens += Math.max(0, Number(c.tokens_est) || 0);
      p.latencyMs += Math.max(0, Number(c.latency_ms) || 0);
      if (c.fallback_reason !== null && c.fallback_reason !== undefined) p.fallbacks += 1;
      if (c.ok === false) p.errors += 1;
    }
  }

  const cost = computeCostReport(allCalls);
  return {
    jobs,
    totals: {
      jobs: jobs.length,
      completedJobs,
      chapters,
      tokens: cost.tokensTotal,
      calls: cost.calls,
      cloudCostUsd: cost.cloudCostUsd,
      savingsUsd: cost.savingsUsd,
    },
    byProvider,
    timePerBook: { local: bucketFrom(jobs, "local"), cloud: bucketFrom(jobs, "cloud") },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 90) return `${s.toFixed(1)} s`;
  return `${(s / 60).toFixed(1)} min`;
}

function fmtUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function bucketLine(label: string, b: TimeBucketStats | null): string {
  if (!b) return `  ${label}: — (keine Jobs)`;
  return `  ${label}: ${b.count} Job(s), ø ${fmtMs(b.avgDurationMs)} pro Buch, ø Call-Latenz ${fmtMs(b.avgLatencyMs)}, ${b.tokens.toLocaleString("de-DE")} Tokens`;
}

/**
 * Rendert den Stats-Report als textuelles Dashboard (CLI-Ausgabe).
 * Zeigt historische Daten: Jobs, Tokens, Kosten/Ersparnis, Provider-Verteilung
 * und die Zeit-Pro-Buch-Metrik separiert nach lokal/Cloud.
 */
export function renderStats(report: StatsReport): string {
  const lines: string[] = [];
  lines.push("═══ Token-Analytics — historische Daten ═══");
  if (report.jobs.length === 0) {
    lines.push("Keine historischen Daten vorhanden (noch keine Buch-Jobs).");
    return lines.join("\n");
  }
  lines.push(`Jobs: ${report.totals.jobs} (${report.totals.completedJobs} abgeschlossen), Kapitel gesamt: ${report.totals.chapters}`);
  lines.push(`Tokens gesamt: ${report.totals.tokens.toLocaleString("de-DE")} über ${report.totals.calls} Router-Call(s)`);
  lines.push("");
  lines.push("── Zeit pro Buch (lokal vs. Cloud) ──");
  lines.push(bucketLine("Lokal", report.timePerBook.local));
  lines.push(bucketLine("Cloud", report.timePerBook.cloud));
  lines.push("");
  lines.push("── Kosten (OpenRouter / Cloud) ──");
  lines.push(`  Tatsächliche Cloud-Kosten: ${fmtUsd(report.totals.cloudCostUsd)}`);
  lines.push(`  Ersparnis durch lokales Routing: ${fmtUsd(report.totals.savingsUsd)}`);
  lines.push("");
  const providers = Object.values(report.byProvider);
  if (providers.length > 0) {
    lines.push("── Provider-Verteilung ──");
    for (const p of providers) {
      lines.push(
        `  ${p.provider}: ${p.calls} Calls, ${p.tokens.toLocaleString("de-DE")} Tokens, ` +
        `ø ${fmtMs(p.calls > 0 ? p.latencyMs / p.calls : 0)}${p.fallbacks > 0 ? `, ${p.fallbacks} Fallback(s)` : ""}` +
        `${p.errors > 0 ? `, ${p.errors} Fehler` : ""}`,
      );
    }
  }
  lines.push("");
  lines.push("── Job-Historie ──");
  for (const j of report.jobs) {
    lines.push(
      `  ${j.jobId.slice(0, 8)}…  ${j.status}  ${j.chapterCount} Kap.  ` +
      `${fmtMs(j.durationMs)}  ${j.bucket}  ${fmtUsd(j.costUsd)}`,
    );
  }
  return lines.join("\n");
}