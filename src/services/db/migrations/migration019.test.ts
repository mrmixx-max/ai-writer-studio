// Tests: Migration 019 — style_profiles + chapter_revisions (Struktur + CRUD).
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

describe("Migration 019", () => {
  it("erstellt style_profiles und chapter_revisions", () => {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = res[0].values.map((v: unknown[]) => String(v[0])).join(",");
    expect(tables).toContain("style_profiles");
    expect(tables).toContain("chapter_revisions");
  });

  it("style_profiles: Spalten vorhanden (id, project_id, name, system_hint, rules_json, is_preset)", () => {
    const cols = db.exec("PRAGMA table_info(style_profiles)")[0].values.map((v: unknown[]) => String(v[1]));
    for (const c of ["id", "project_id", "name", "system_hint", "rules_json", "is_preset", "created_at", "updated_at"]) {
      expect(cols).toContain(c);
    }
  });

  it("chapter_revisions: Metrik-Spalten vorhanden", () => {
    const cols = db.exec("PRAGMA table_info(chapter_revisions)")[0].values.map((v: unknown[]) => String(v[1]));
    for (const c of ["id", "chapter_id", "mode", "model", "before_words", "after_words", "before_filler", "after_filler", "note", "created_at"]) {
      expect(cols).toContain(c);
    }
  });

  it("idempotent: zweite Migration wirft nicht", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("FK-Kaskade: Kapitel löschen entfernt Revisionshistorie", () => {
    db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','P',1,1)");
    db.run("INSERT INTO chapters (id, project_id, title, content, order_index, created_at, updated_at) VALUES ('c1','p1','T','x',0,1,1)");
    db.run("INSERT INTO chapter_revisions (id, chapter_id, mode, before_words, after_words, before_filler, after_filler, created_at) VALUES ('r1','c1','straffen',100,90,0.3,0.1,1)");
    db.run("DELETE FROM chapters WHERE id='c1'");
    const res = db.exec("SELECT COUNT(*) FROM chapter_revisions");
    expect(Number(res[0].values[0][0])).toBe(0);
  });
});