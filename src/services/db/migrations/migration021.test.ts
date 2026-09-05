// Tests: Migration 021 — bookwriter_facts + bookwriter_consistency_findings.
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import initSqlJs from "sql.js";
import { runMigrations } from "@/services/db/migrations";

let db: any;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
});

describe("Migration 021", () => {
  it("erstellt bookwriter_facts und bookwriter_consistency_findings", () => {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = res[0].values.map((v: unknown[]) => String(v[0])).join(",");
    expect(tables).toContain("bookwriter_facts");
    expect(tables).toContain("bookwriter_consistency_findings");
  });

  it("bookwriter_facts: Spalten vorhanden", () => {
    const cols = db.exec("PRAGMA table_info(bookwriter_facts)")[0].values.map((v: unknown[]) => String(v[1]));
    for (const c of ["id", "project_id", "kind", "key", "value", "source_chapter", "confidence", "created_at", "updated_at"]) {
      expect(cols).toContain(c);
    }
  });

  it("bookwriter_facts: UNIQUE(project_id, kind, key) erzwingt Upsert-Semantik", () => {
    db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','P',1,1)");
    db.run("INSERT INTO bookwriter_facts (id, project_id, kind, key, value, created_at, updated_at) VALUES ('f1','p1','character','Anna','Detektivin',1,1)");
    expect(() =>
      db.run("INSERT INTO bookwriter_facts (id, project_id, kind, key, value, created_at, updated_at) VALUES ('f2','p1','character','Anna','Detektivin, 34',1,1)"),
    ).toThrow();
    // Andere kind/key erlaubt.
    expect(() =>
      db.run("INSERT INTO bookwriter_facts (id, project_id, kind, key, value, created_at, updated_at) VALUES ('f3','p1','place','Anna-Saal','Kneipe',1,1)"),
    ).not.toThrow();
  });

  it("bookwriter_consistency_findings: Spalten vorhanden", () => {
    const cols = db.exec("PRAGMA table_info(bookwriter_consistency_findings)")[0].values.map((v: unknown[]) => String(v[1]));
    for (const c of ["id", "run_id", "project_id", "chapter_index", "chapter_title", "type", "severity", "fact_key", "expected", "found", "details", "status", "created_at"]) {
      expect(cols).toContain(c);
    }
  });

  it("idempotent: zweite Migration wirft nicht", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("FK-Kaskade: Projekt löschen entfernt Fakten", () => {
    db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p2','P2',1,1)");
    db.run("INSERT INTO bookwriter_facts (id, project_id, kind, key, value, created_at, updated_at) VALUES ('f9','p2','entity','Begriff','Definition',1,1)");
    db.run("DELETE FROM projects WHERE id='p2'");
    const res = db.exec("SELECT COUNT(*) FROM bookwriter_facts WHERE project_id='p2'");
    expect(Number(res[0].values[0][0])).toBe(0);
  });
});
