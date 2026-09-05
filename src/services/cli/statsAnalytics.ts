// Erweiterte Analytics: Zeitstrail-Trends, ASCII-Charts, CSV-Export (Sprint 7, Agent 4).
//
// - dailyCostTrend: Cloud-Kosten/Tokens/Buecher pro Tag (letzte N Tage, UTC),
//   fehlende Tage werden mit 0 aufgefuellt → lueckenlose Charts.
// - weeklyBookTrend: abgeschlossene Buecher pro ISO-Woche.
// - localCloudCostTrend: reale Cloud-Kosten vs. potenzielle Lokal-Kosten
//   (Counterfactual) je Tag → Lokal-vs-Cloud-Vergleich ueber die Zeit.
// - sparkline: Unicode-Blockchart ("▁▂▃▄▅▆▇█") fuer den CLI-Output.
// - renderTrendSection / renderAnalyticsCsv: reine Renderer (Dashboard-Block,
//   CSV fuer Spreadsheet-Import).
// Keine DB-/Netzwerk-Abhaengigkeit — volle Testbarkeit (TDD).
import type { JobStats } from "./stats";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Tag im Kosten-Zeitstrail. */
export interface DailyCostPoint {
  /** UTC-Datum als YYYY-MM-DD. */
  day: string;
  /** Alle Jobs (auch laufende), deren updatedAt auf diesen Tag faellt. */
  jobs: number;
  /** Davon abgeschlossene Buecher. */
  books: number;
  chapters: number;
  tokens: number;
  /** Reale Cloud-Kosten an diesem Tag (USD). */
  cloudCostUsd: number;
  /** Potenzielle Cloud-Kosten aller Tokens des Tags (USD). */
  potentialCloudCostUsd: number;
  /** potenziell − real (USD). */
  savingsUsd: number;
}

/** Eine ISO-Woche im Buecher-Zeitstrail. */
export interface WeeklyBookPoint {
  /** ISO-Jahr und -Woche als YYYY-Www. */
  week: string;
  /** Abgeschlossene Buecher in dieser Woche. */
  books: number;
}

/** Ein Tag im Lokal-vs-Cloud-Vergleich. */
export interface LocalCloudPoint {
  day: string;
  /** Reale Cloud-Kosten (USD). */
  cloudCostUsd: number;
  /** Potenzielle Cloud-Kosten der lokal gerouteten Jobs (USD). */
  localPotentialCostUsd: number;
}

// ---------------------------------------------------------------------------
// Datum-Helfer (UTC-basiert, deterministisch testbar)
// ---------------------------------------------------------------------------

/** YYYY-MM-DD eines UTC-Timestamps. */
export function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** ISO-8601-Wochenlabel (YYYY-Www) eines UTC-Timestamps. */
export function isoWeekKey(ts: number): string {
  const d = new Date(ts);
  // UTC-Donnerstag der Woche bestimmt das ISO-Jahr (DIN 1355 / ISO 8601).
  const day = d.getUTCDay() || 7; // So=0 → 7
  d.setUTCDate(d.getUTCDate() - day + 4); // auf Donnerstag schieben
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Montag 00:00 UTC der Woche, die ts enthaelt. */
function weekStartUtc(ts: number): number {
  const d = new Date(ts);
  const day = d.getUTCDay() || 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Zeitstrail-Aggregation (pure)
// ---------------------------------------------------------------------------

/** Kosten-Zeitstrail: die letzten `days` Tage (UTC) inkl. heute/neuester Jobs. */
export function dailyCostTrend(jobs: JobStats[], days: number, now: number): DailyCostPoint[] {
  const n = Math.max(1, Math.floor(days));
  const endDay = utcDayKey(now);
  const byDay = new Map<string, DailyCostPoint>();
  for (let i = n - 1; i >= 0; i -= 1) {
    const key = utcDayKey(new Date(endDay + "T00:00:00Z").getTime() - i * 86_400_000);
    byDay.set(key, {
      day: key, jobs: 0, books: 0, chapters: 0, tokens: 0,
      cloudCostUsd: 0, potentialCloudCostUsd: 0, savingsUsd: 0,
    });
  }
  for (const j of jobs) {
    const p = byDay.get(utcDayKey(j.updatedAt));
    if (!p) continue;
    p.jobs += 1;
    if (j.status === "completed") p.books += 1;
    p.chapters += j.chapterCount;
    p.tokens += j.tokens;
    p.cloudCostUsd += j.costUsd;
    p.potentialCloudCostUsd += j.potentialCostUsd;
  }
  const points = [...byDay.values()];
  for (const p of points) p.savingsUsd = p.potentialCloudCostUsd - p.cloudCostUsd;
  return points;
}

/** Buecher-Zeitstrail: abgeschlossene Buecher pro ISO-Woche (letzte `weeks`). */
export function weeklyBookTrend(jobs: JobStats[], weeks: number, now: number): WeeklyBookPoint[] {
  const n = Math.max(1, Math.floor(weeks));
  const start = weekStartUtc(now) - (n - 1) * 7 * 86_400_000;
  const counts = new Map<number, number>();
  for (const j of jobs) {
    if (j.status !== "completed") continue;
    const ws = weekStartUtc(j.updatedAt);
    if (ws < start) continue;
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  const points: WeeklyBookPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const ws = start + i * 7 * 86_400_000;
    points.push({ week: isoWeekKey(ws), books: counts.get(ws) ?? 0 });
  }
  return points;
}

/** Lokal-vs-Cloud: reale Cloud-Kosten vs. potenzielle Lokal-Kosten je Tag. */
export function localCloudCostTrend(jobs: JobStats[], days: number, now: number): LocalCloudPoint[] {
  const daily = dailyCostTrend(jobs, days, now);
  const localPotential = new Map<string, number>();
  for (const j of jobs) {
    if (j.bucket !== "local") continue;
    const key = utcDayKey(j.updatedAt);
    localPotential.set(key, (localPotential.get(key) ?? 0) + j.potentialCostUsd);
  }
  return daily.map((d) => ({
    day: d.day,
    cloudCostUsd: d.cloudCostUsd,
    localPotentialCostUsd: localPotential.get(d.day) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// ASCII/Unicode-Charts
// ---------------------------------------------------------------------------

const BLOCKS = "▁▂▃▄▅▆▇█";

/**
 * Rendert Werte als Unicode-Blockchart. Skalierung am Maximum; 0 bleibt auf
 * der Grundlinie ("▁"). Leere Liste → leerer String.
 */
export function sparkline(values: number[]): string {
  const max = Math.max(0, ...values);
  if (values.length === 0 || max <= 0) return values.map(() => "▁").join("");
  return values
    .map((v) => {
      if (v <= 0) return "▁";
      const idx = Math.min(BLOCKS.length - 1, Math.max(1, Math.floor((v / max) * (BLOCKS.length - 1))));
      return BLOCKS[idx];
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/**
 * Rendert den Trend-/Chart-Block fuer das CLI-Dashboard: Kosten pro Tag
 * (Sparkline), Lokal-vs-Cloud-Vergleich und Buecher pro Woche.
 */
export function renderTrendSection(jobs: JobStats[], now: number = Date.now()): string {
  const lines: string[] = [];
  const daily = dailyCostTrend(jobs, 14, now);
  const totalCost = daily.reduce((a, d) => a + d.cloudCostUsd, 0);
  const activeDays = daily.filter((d) => d.cloudCostUsd > 0);
  const avgCost = activeDays.length > 0 ? totalCost / activeDays.length : 0;

  lines.push("── Trend: Kosten pro Tag (letzte 14 Tage) ──");
  lines.push(`  ${sparkline(daily.map((d) => d.cloudCostUsd))}`);
  lines.push(`  gesamt ${fmtUsd(totalCost)}${activeDays.length > 0 ? `, ø ${fmtUsd(avgCost)} pro aktivem Tag` : ""}`);
  const lastActive = [...daily].reverse().find((d) => d.cloudCostUsd > 0);
  if (lastActive) lines.push(`  letzter kostenpflichtiger Tag: ${lastActive.day} (${fmtUsd(lastActive.cloudCostUsd)})`);
  lines.push("");

  const lc = localCloudCostTrend(jobs, 14, now);
  const cloudSum = lc.reduce((a, d) => a + d.cloudCostUsd, 0);
  const localSum = lc.reduce((a, d) => a + d.localPotentialCostUsd, 0);
  lines.push("── Trend: Lokal vs. Cloud (letzte 14 Tage) ──");
  lines.push(`  Cloud (real):        ${sparkline(lc.map((d) => d.cloudCostUsd))}  ${fmtUsd(cloudSum)}`);
  lines.push(`  Lokal (haette ${fmtUsd(localSum)} gekostet): ${sparkline(lc.map((d) => d.localPotentialCostUsd))}`);
  lines.push(`  Ersparnis durch lokales Routing: ${fmtUsd(Math.max(0, localSum))}`);
  lines.push("");

  const weekly = weeklyBookTrend(jobs, 8, now);
  const booksTotal = weekly.reduce((a, w) => a + w.books, 0);
  lines.push("── Trend: Bücher pro Woche (letzte 8 Wochen) ──");
  lines.push(`  ${sparkline(weekly.map((w) => w.books))}  ${booksTotal} Buch/Bücher gesamt`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CSV-Export
// ---------------------------------------------------------------------------

const CSV_HEADER = "day,jobs,books,chapters,cloud_cost_usd,potential_cloud_cost_usd,savings_usd,tokens";

/**
 * Rendert den Tages-Zeitstrail als CSV (Spreadsheet-Import). Dezimaltrenner
 * ist der Punkt, Kosten mit 6 Nachkommastellen. Letzte Zeile = heutiger Tag.
 */
export function renderAnalyticsCsv(jobs: JobStats[], days: number, now: number): string {
  const rows = dailyCostTrend(jobs, days, now).map((d) => [
    d.day,
    String(d.jobs),
    String(d.books),
    String(d.chapters),
    d.cloudCostUsd.toFixed(6),
    d.potentialCloudCostUsd.toFixed(6),
    d.savingsUsd.toFixed(6),
    String(d.tokens),
  ]);
  return [CSV_HEADER, ...rows].join("\n") + "\n";
}
