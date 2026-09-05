// E2E-Check: node scripts/seed-stats-e2e.mjs — baut eine reale App-DB-Datei
// mit 3 abgeschlossenen Jobs (2 lokal, 1 Cloud) samt Telemetrie. Die Datei
// wird von `node dist/cli.mjs --stats` gelesen, um die Historie live zu zeigen.
//
// Auflösung ohne tsx: esbuild kompiliert den Inline-Seed + Migrationen zu
// einem einzelnen ESM-Bundle (sql.js bleibt extern), das rohes Node direkt
// ausführen kann.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";

const SEED_TS = `
import initSqlJs from "sql.js";
import { runMigrations } from "../src/services/db/migrations/index";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const SQL = await initSqlJs();
const db = new SQL.Database();
db.run("PRAGMA foreign_keys = ON;");
runMigrations(db);

const now = Date.now();
for (const [pid, name, ago] of [["p1","Seed-A",86400e3],["p2","Seed-B",43200e3],["p3","Seed-C",3600e3]]) {
  db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?,?,?,?)", [pid, name, now - ago, now - ago]);
}

function job(id, pid, status, createdAgoMs, durMs, chapters, telemetry) {
  db.run(
    "INSERT INTO bookwriter_jobs (id, project_id, config_json, status, current_chapter, created_at, updated_at, telemetry_json) VALUES (?,?,?,?,?,?,?,?)",
    [id, pid, "{}", status, chapters, now - createdAgoMs, now - createdAgoMs + durMs, JSON.stringify(telemetry)],
  );
}

const localCall = (tokens, latency) => ({ provider: "ollama", model: "llama3.1:8b", latency_ms: latency, tokens_est: tokens, fallback_reason: null, task: "chapter", ok: true });
const cloudCall = (tokens, latency) => ({ provider: "openrouter", model: "deepseek/deepseek-chat", latency_ms: latency, tokens_est: tokens, fallback_reason: null, task: "chapter", ok: true });

job("job-local-1", "p1", "completed", 86400e3, 21 * 60e3, 8, { calls: Array.from({ length: 10 }, () => localCall(4000, 2500)), budgetTokens: 1e6, usedTokens: 40000 });
job("job-local-2", "p2", "completed", 43200e3, 24 * 60e3, 8, { calls: Array.from({ length: 10 }, () => localCall(4200, 2800)), budgetTokens: 1e6, usedTokens: 42000 });
job("job-cloud-1", "p3", "completed", 3600e3, 7 * 60e3, 8, { calls: Array.from({ length: 10 }, () => cloudCall(4200, 1800)), budgetTokens: 1e6, usedTokens: 42000 });

const bytes = db.export();
const tmp = path.join(os.tmpdir(), "aws-stats-e2e.db");
fs.writeFileSync(tmp, Buffer.from(bytes));
console.log("SEEDED_DB=" + tmp);
`;
fs.writeFileSync("scripts/.seed-stats-inline.mts", SEED_TS);
try {
  execFileSync(
    "node",
    ["node_modules/esbuild/bin/esbuild", "scripts/.seed-stats-inline.mts",
     "--bundle", "--platform=node", "--format=esm", "--outfile=scripts/.seed-stats-inline.mjs",
     "--external:sql.js", "--log-level=error"],
    { stdio: "inherit" },
  );
  execFileSync("node", ["scripts/.seed-stats-inline.mjs"], { stdio: "inherit" });
} finally {
  fs.rmSync("scripts/.seed-stats-inline.mts", { force: true });
  fs.rmSync("scripts/.seed-stats-inline.mjs", { force: true });
}
