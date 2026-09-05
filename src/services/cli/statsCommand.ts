// CLI-Befehl `stats` (Sprint 6, Agent 1).
//
// `npm run cli -- --stats` (bzw. node dist/cli.js --stats) druckt statt des
// Live-Dashboards die historische Token-Analytics aus der Datenbank:
// Job-Historie, Token-/Kosten-Totals, Ersparnis durch lokales Routing und
// Zeit-Pro-Buch-Metrik (lokal vs. Cloud).
//
// Die Auswertelogik liegt in ./stats (DB-Aggregation) und ./costCalculator
// (Preisliste/Counterfactual); diese Datei ist nur der dünne Adapter.
//
// DB-Zugriff (Fix im Sprint-6-Review): außerhalb von Vitest ist keine DB
// initialisiert (die App-DB wird im Tauri-Webview via initDb() geladen). Der
// stats-Befehl lädt daher die bestehende App-DB (%APPDATA%\com.aiwriter-
// studio.app\user_data\app.db) selbst — bewusst NUR LESEND: kein persist(),
// keine Schreiboperation, die Datei bleibt unangetastet. Ohne Datei (frische
// Installation) fällt er auf eine leere In-Memory-DB zurück und rendert
// „Keine historischen Daten".
import { createRequire } from "node:module";
import type { Database } from "sql.js";
import { collectStats, renderStats } from "./stats";
import { renderAnalyticsCsv } from "./statsAnalytics";
import { isDbReady } from "@/services/db";
import { runMigrations } from "@/services/db/migrations";
import { info } from "@/services/logger";

/** true, wenn --stats (ggf. mit Wert) in argv steht. */
export function parseStatsArg(argv: string[]): boolean {
  return argv.some((a) => a === "--stats" || a.startsWith("--stats="));
}

/** Standarddateiname des Analytics-CSV-Exports (Sprint 7, Agent 4). */
export const DEFAULT_EXPORT_FILENAME = "analytics.csv";

/**
 * Liest --export[=pfad] aus argv (Sprint 7, Agent 4). Rückgabe: Zieldatei —
 * expliziter Pfad nach `=`, sonst der Standarddateiname. Ohne --export: null.
 */
export function parseExportArg(argv: string[]): string | null {
  const hit = argv.find((a) => a === "--export" || a.startsWith("--export="));
  if (!hit) return null;
  const value = hit.slice("--export".length).replace(/^=/, "").trim();
  return value.length > 0 ? value : DEFAULT_EXPORT_FILENAME;
}

/** Standardpfad der App-DB (Windows: %APPDATA%), oder null wenn unbekannt. */
export function defaultAppDbPath(appData: string = process.env.APPDATA ?? ""): string | null {
  if (!appData) return null;
  return `${appData}\\com.aiwriterstudio.app\\user_data\\app.db`;
}

/**
 * Stellt sicher, dass eine DB für den stats-Befehl bereitsteht:
 * - Bereits initialisiert (Tests injizieren __aws_db) → No-op.
 * - Sonst: App-DB-Datei lesen (falls vorhanden), Migrationen anwenden und
 *   als __aws_db bereitstellen. Nur-Lese-Nutzung — es wird nie persistiert.
 */
export async function ensureStatsDb(opts: { dbPath?: string } = {}): Promise<void> {
  if (isDbReady()) return;
  // node:require statt dynamischer ESM-Imports: im esbuild-Bundle (ESM)
  // scheitert `await import("node:fs")` als "Dynamic require" im sql.js-
  // WASM-Init; createRequire ist bundler-sicher und im reinen Node-CLI-
  // Kontext (die einzige Laufzeit dieses Pfads) immer verfügbar.
  const nodeRequire = createRequire(import.meta.url);
  const initSqlJs = nodeRequire("sql.js") as (typeof import("sql.js"))["default"];
  const fs = nodeRequire("node:fs") as typeof import("node:fs");
  const SQL = await initSqlJs();
  const path = opts.dbPath ?? defaultAppDbPath();
  let db: Database;
  let loadedFromFile = false;
  if (path && fs.existsSync(path)) {
    try {
      db = new SQL.Database(fs.readFileSync(path));
      loadedFromFile = true;
    } catch {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
  info(
    loadedFromFile
      ? `stats: App-DB gelesen (${path})`
      : "stats: keine App-DB gefunden — leere Historie",
    "cli/stats",
  );
}

/**
 * Führt den stats-Befehl aus: DB sicherstellen, Historie sammeln, rendern,
 * ausgeben. Mit `exportPath` (bzw. --export in argv) wird zusätzlich der
 * Tages-Zeitstrail als CSV geschrieben (Sprint 7, Agent 4). Return-Wert für
 * Tests: der gerenderte Text.
 */
export async function runStatsCommand(opts: { exportPath?: string | null } = {}): Promise<string> {
  await ensureStatsDb();
  const report = collectStats();
  const text = renderStats(report);
  console.log(text);
  const exportPath = opts.exportPath !== undefined ? opts.exportPath : parseExportArg(process.argv);
  if (exportPath) {
    const csv = renderAnalyticsCsv(report.jobs, 30, Date.now());
    nodeFs().writeFileSync(exportPath, csv, "utf8");
    console.log(`\nAnalytics-Export: ${exportPath} (letzte 30 Tage)`);
    info(
      `stats: Analytics-Export nach ${exportPath} (${report.jobs.length} Job(s))`,
      "cli/stats",
    );
  }
  info(`CLI stats: ${report.totals.jobs} Job(s), ${report.totals.tokens} Tokens, Cloud-Kosten $${report.totals.cloudCostUsd.toFixed(4)}, Ersparnis $${report.totals.savingsUsd.toFixed(4)}`, "cli/stats");
  return text;
}

/** node:fs via createRequire — bundler-sicher (siehe ensureStatsDb). */
function nodeFs(): typeof import("node:fs") {
  return createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
}
