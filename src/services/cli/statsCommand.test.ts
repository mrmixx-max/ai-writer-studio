// Tests: CLI `stats`-Befehl (Sprint 6, Agent 1).
//
// - parseStatsArg erkennt --stats / --stats=… und ignoriert andere Flags.
// - defaultAppDbPath baut den %APPDATA%-Pfad der App-DB.
// - ensureStatsDb(): injected DB → No-op; ohne DB-Datei → leere, migrierte
//   In-Memory-DB; mit App-DB-Datei → Historie wird gelesen (nur-lesend).
// - runStatsCommand druckt die Historie und schreibt einen Log-Eintrag.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject } from "@/services/project";
import { getDb, isDbReady } from "@/services/db";
import { getLogEntries } from "@/services/logger";
import { parseStatsArg, runStatsCommand, ensureStatsDb, defaultAppDbPath } from "./statsCommand";
import { createBookJob } from "@/services/bookwriter/jobs";
import { saveJobTelemetry, emptyTelemetry, appendCall } from "@/services/bookwriter/telemetry";
import type { RouterCallMeta } from "@/services/llm/router";
import type { BookWriterConfig } from "@/services/writing/bookwriter";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const config: BookWriterConfig = {
  topic: "T", genre: "Sachbuch", targetAudience: "Erwachsene",
  chapterCount: 4, model: "mock", baseUrl: "http://127.0.0.1:11434", language: "Deutsch",
};

function meta(overrides: Partial<RouterCallMeta> = {}): RouterCallMeta {
  return {
    provider: "openrouter", model: "deepseek/deepseek-chat", latency_ms: 700,
    tokens_est: 12_000, fallback_reason: null, task: "chapter", ok: true, ...overrides,
  };
}

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

describe("parseStatsArg", () => {
  it("--stats erkannt", () => {
    expect(parseStatsArg(["node", "cli.js", "--stats"])).toBe(true);
  });
  it("--stats=true erkannt", () => {
    expect(parseStatsArg(["node", "cli.js", "--stats=true"])).toBe(true);
  });
  it("ohne --stats → false", () => {
    expect(parseStatsArg(["node", "cli.js", "--hitl"])).toBe(false);
  });
});

describe("defaultAppDbPath", () => {
  it("baut Pfad unter %APPDATA%", () => {
    expect(defaultAppDbPath("C:\\Users\\x\\AppData\\Roaming")).toBe(
      "C:\\Users\\x\\AppData\\Roaming\\com.aiwriterstudio.app\\user_data\\app.db",
    );
  });
  it("ohne APPDATA → null", () => {
    expect(defaultAppDbPath("")).toBeNull();
  });
});

describe("ensureStatsDb", () => {
  it("bereits initialisierte DB → No-op (injizierte Instanz bleibt)", async () => {
    const before = getDb();
    await ensureStatsDb();
    expect(getDb()).toBe(before);
  });

  it("ohne DB-Datei → leere, migrierte DB bereitgestellt", async () => {
    delete (globalThis as any).__aws_db;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-db-"));
    try {
      await ensureStatsDb({ dbPath: path.join(dir, "fehlt.db") });
      expect(isDbReady()).toBe(true);
      // Migration 020 (bookwriter_jobs + telemetry_json) ist angewendet:
      expect(() =>
        getDb().exec("SELECT id, telemetry_json FROM bookwriter_jobs"),
      ).not.toThrow();
      expect(getLogEntries().some((e) => e.context === "cli/stats")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      // beforeEach-Injektion für nachfolgende Tests wiederherstellen.
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      runMigrations(db);
      (globalThis as any).__aws_db = db;
    }
  });

  it("liest App-DB-Datei (nur-lesend) und findet historische Jobs", async () => {
    // Historie in die injizierte DB schreiben und als Datei exportieren —
    // simuliert die echte App-DB.
    const p = await createProject("Stats-DB-Datei");
    const job = createBookJob(p.id, config);
    let t = emptyTelemetry();
    t = appendCall(t, meta()).telemetry;
    await saveJobTelemetry(job.id, t);
    const bytes = getDb().export();

    delete (globalThis as any).__aws_db;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-db-"));
    const dbFile = path.join(dir, "app.db");
    fs.writeFileSync(dbFile, Buffer.from(bytes));
    try {
      await ensureStatsDb({ dbPath: dbFile });
      const res = getDb().exec("SELECT COUNT(*) FROM bookwriter_jobs");
      expect(Number(res[0].values[0][0])).toBe(1);
      // Nur-lesend: keine Seitendateien/Backups neben der gelesenen DB.
      expect(fs.readdirSync(dir)).toEqual(["app.db"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      runMigrations(db);
      (globalThis as any).__aws_db = db;
    }
  });
});

describe("runStatsCommand", () => {
  it("druckt Historie und schreibt Log-Eintrag", async () => {
    const p = await createProject("Stats-CLI-Projekt");
    const job = createBookJob(p.id, config);
    const now = Date.now();
    (globalThis as any).__aws_db.run(
      `UPDATE bookwriter_jobs SET created_at = ?, updated_at = ?, current_chapter = 4 WHERE id = ?`,
      [now - 300_000, now, job.id],
    );
    let t = emptyTelemetry();
    t = appendCall(t, meta()).telemetry;
    await saveJobTelemetry(job.id, t);

    const text = await runStatsCommand();
    expect(text).toContain("Token-Analytics");
    expect(text).toContain(job.id.slice(0, 8));
    expect(text).toContain("Ersparnis");
    const entries = getLogEntries();
    expect(entries.some((e) => e.context === "cli/stats" && e.level === "info")).toBe(true);
  });
});
