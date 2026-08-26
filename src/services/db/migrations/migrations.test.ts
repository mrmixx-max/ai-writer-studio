// Unit-Tests: Migrationen legen alle Tabellen an, sind idempotent und versioniert.
import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { runMigrations, currentSchemaVersion, MIGRATIONS } from "@/services/db/migrations";
import type { Database } from "sql.js";

const EXPECTED_TABLES = [
  // 001
  "projects", "chapters", "settings", "writing_prompts",
  "fragments", "voices", "semantic_nodes", "semantic_edges",
  "obstruction_presets", "chapter_dialogues", "literary_versions",
  "whisper_transcriptions",
  // 002
  "knowledge_sources", "knowledge_chunks", "knowledge_index_jobs",
  "consistency_reports", "consistency_findings", "style_findings",
  "preflight_reports", "preflight_findings",
  "snapshots", "snapshot_items", "snapshot_diffs",
  "character_profiles", "location_profiles", "project_notes",
  // Registry
  "schema_migrations",
];

function tableNames(db: Database): string[] {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  if (!res.length) return [];
  return res[0].values.map((v) => String(v[0]));
}

describe("db migrations", () => {
  let db: Database;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON;");
  });

  it("legt alle erwarteten Tabellen an", () => {
    runMigrations(db);
    const names = tableNames(db);
    for (const t of EXPECTED_TABLES) {
      expect(names, `Tabelle fehlt: ${t}`).toContain(t);
    }
  });

  it("ist idempotent (mehrfacher Lauf wirft nicht)", () => {
    runMigrations(db);
    runMigrations(db);
    runMigrations(db);
    const names = tableNames(db);
    expect(names).toContain("knowledge_chunks");
  });

  it("protokolliert die Schema-Version", () => {
    runMigrations(db);
    const v = currentSchemaVersion(db);
    expect(v).toBe(MIGRATIONS[MIGRATIONS.length - 1].version);
  });

  it("legt Indizes für Retrieval-Abfragen an", () => {
    runMigrations(db);
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='index'");
    const idx = res.length ? res[0].values.map((v) => String(v[0])) : [];
    expect(idx).toContain("idx_kc_project");
    expect(idx).toContain("idx_cf_status");
    expect(idx).toContain("idx_snap_project");
  });

  it("erzwingt Kaskade beim Löschen eines Projekts", () => {
    runMigrations(db);
    const now = Date.now();
    db.run("INSERT INTO projects (id,name,created_at,updated_at) VALUES ('p1','P',?,?)", [now, now]);
    db.run(
      "INSERT INTO knowledge_sources (id,project_id,source_type,ref_id,title,content,tags,status,content_hash,last_error,created_at,updated_at,indexed_at) VALUES ('s1','p1','note',NULL,'N','x',NULL,'pending','h',NULL,?,?,NULL)",
      [now, now],
    );
    db.run("DELETE FROM projects WHERE id='p1'");
    const res = db.exec("SELECT COUNT(*) FROM knowledge_sources WHERE project_id='p1'");
    expect(Number(res[0].values[0][0])).toBe(0);
  });
});
