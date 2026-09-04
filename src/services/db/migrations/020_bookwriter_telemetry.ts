// Migration 020 — bookwriter_jobs.telemetry_json (Sprint 2, B4).
//
// INTERFACE-CHANGE (DB-Schema):
// Neue Spalte bookwriter_jobs.telemetry_json: pro Job persistierte
// Router-Telemetrie (provider, model, latency_ms, tokens_est,
// fallback_reason) plus Budget-Stand. DB-CHANGE: Schema-Version steigt
// auf 20; bestehende Rows erhalten NULL (= keine Telemetrie).

import type { Database } from "sql.js";

export const VERSION = 20;
export const NAME = "bookwriter_jobs_telemetry";

export function migration020(d: Database): void {
  const res = d.exec("PRAGMA table_info(bookwriter_jobs)");
  if (!res.length) return; // Tabelle existiert noch nicht (alte DBs) — Migration 018 legt sie an.
  const names = res[0].values.map((v) => String(v[1]));
  if (!names.includes("telemetry_json")) {
    d.run(`ALTER TABLE bookwriter_jobs ADD COLUMN telemetry_json TEXT`);
  }
}