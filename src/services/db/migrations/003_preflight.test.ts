// Tests: Migration 003 (Preflight).
//
// Wichtigster Prüfpunkt: Idempotenz. ALTER TABLE ADD COLUMN wirft in SQLite
// bei einem zweiten Lauf "duplicate column name" — anders als CREATE TABLE
// IF NOT EXISTS. Da alle Migrationen bei jedem App-Start laufen, würde ein
// Fehler hier die App beim zweiten Start unbrauchbar machen.

import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { runMigrations, currentSchemaVersion } from "@/services/db/migrations";

let db: Database;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
});

/** Spaltennamen einer Tabelle. */
function columns(table: string): string[] {
  const res = db.exec(`PRAGMA table_info(${table})`);
  if (res.length === 0) return [];
  return res[0].values.map((r) => String(r[1]));
}

/** Alle Tabellennamen. */
function tables(): string[] {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  return res.length ? res[0].values.map((r) => String(r[0])) : [];
}

/** Alle Indexnamen. */
function indexes(): string[] {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='index'");
  return res.length ? res[0].values.map((r) => String(r[0])) : [];
}

describe("Migration 003 — Idempotenz", () => {
  it("läuft mehrfach ohne zu werfen", () => {
    // Der entscheidende Test: ALTER TABLE ADD COLUMN ist nicht idempotent.
    // Ohne Spaltenprüfung würde der zweite Lauf werfen und die App beim
    // zweiten Start unbrauchbar machen.
    expect(() => {
      runMigrations(db);
      runMigrations(db);
      runMigrations(db);
    }).not.toThrow();
  });

  it("legt Spalten bei mehrfachem Lauf nicht doppelt an", () => {
    runMigrations(db);
    const first = columns("preflight_findings");
    runMigrations(db);
    const second = columns("preflight_findings");

    expect(second).toEqual(first);
    // Keine Dubletten in der Spaltenliste.
    expect(new Set(second).size).toBe(second.length);
  });

  it("protokolliert Schema-Version 8", () => {
    runMigrations(db);
    expect(currentSchemaVersion(db)).toBe(8);
  });
});

describe("Migration 003 — Schema", () => {
  beforeEach(() => runMigrations(db));

  it("legt preflight_rules und preflight_decisions an", () => {
    const t = tables();
    expect(t).toContain("preflight_rules");
    expect(t).toContain("preflight_decisions");
  });

  it("ergänzt preflight_findings um die Entscheidungsfelder", () => {
    const c = columns("preflight_findings");
    for (const needed of [
      "kind",
      "status",
      "fingerprint",
      "char_start",
      "char_end",
      "structure_hint",
      "updated_at",
    ]) {
      expect(c, `Spalte ${needed} fehlt`).toContain(needed);
    }
  });

  it("behält die Spalten aus Migration 002", () => {
    // Die Ergänzung darf nichts zerstören.
    const c = columns("preflight_findings");
    for (const old of [
      "id",
      "report_id",
      "project_id",
      "chapter_id",
      "category",
      "severity",
      "rule_id",
      "title",
      "explanation",
      "recommendation",
      "excerpt",
      "affected_formats",
      "created_at",
    ]) {
      expect(c, `Bestandsspalte ${old} verloren`).toContain(old);
    }
  });

  it("ergänzt preflight_reports um Umfang und Formate", () => {
    const c = columns("preflight_reports");
    for (const needed of ["scope", "chapter_id", "notice", "formats"]) {
      expect(c, `Spalte ${needed} fehlt`).toContain(needed);
    }
  });

  it("legt die Suchindizes an", () => {
    const idx = indexes();
    for (const needed of [
      "idx_pf_project",
      "idx_pf_chapter",
      "idx_pf_status",
      "idx_pf_fingerprint",
      "idx_pfr_project",
      "idx_pfd_project",
      "idx_pfrule_project",
    ]) {
      expect(idx, `Index ${needed} fehlt`).toContain(needed);
    }
  });
});

describe("Migration 003 — Datenintegrität", () => {
  beforeEach(() => {
    runMigrations(db);
    db.run(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1','Test',0,0)",
    );
  });

  it("erzwingt Eindeutigkeit je Projekt und Regel", () => {
    db.run(
      `INSERT INTO preflight_rules (id, project_id, rule_id, enabled, created_at, updated_at)
       VALUES ('r1','p1','structure.empty-chapter',0,0,0)`,
    );
    expect(() =>
      db.run(
        `INSERT INTO preflight_rules (id, project_id, rule_id, enabled, created_at, updated_at)
         VALUES ('r2','p1','structure.empty-chapter',1,0,0)`,
      ),
    ).toThrow();
  });

  it("erzwingt Eindeutigkeit je Projekt und Fingerabdruck", () => {
    db.run(
      `INSERT INTO preflight_decisions (id, project_id, fingerprint, decision, created_at)
       VALUES ('d1','p1','abc123','ignored',0)`,
    );
    expect(() =>
      db.run(
        `INSERT INTO preflight_decisions (id, project_id, fingerprint, decision, created_at)
         VALUES ('d2','p1','abc123','accepted',0)`,
      ),
    ).toThrow();
  });

  it("löscht Regeln und Entscheidungen mit dem Projekt", () => {
    db.run(
      `INSERT INTO preflight_rules (id, project_id, rule_id, enabled, created_at, updated_at)
       VALUES ('r1','p1','x',0,0,0)`,
    );
    db.run(
      `INSERT INTO preflight_decisions (id, project_id, fingerprint, decision, created_at)
       VALUES ('d1','p1','fp','ignored',0)`,
    );

    db.run("DELETE FROM projects WHERE id = 'p1'");

    const rules = db.exec("SELECT COUNT(*) FROM preflight_rules");
    const decisions = db.exec("SELECT COUNT(*) FROM preflight_decisions");
    expect(Number(rules[0].values[0][0])).toBe(0);
    expect(Number(decisions[0].values[0][0])).toBe(0);
  });

  it("setzt sinnvolle Standardwerte für die neuen Spalten", () => {
    db.run(
      `INSERT INTO preflight_reports (id, project_id, target_format, blocker_count,
        warning_count, hint_count, checked_frontmatter, checked_backmatter,
        created_at, duration_ms)
       VALUES ('rep1','p1','docx',0,0,0,1,1,0,0)`,
    );
    db.run(
      `INSERT INTO preflight_findings (id, report_id, project_id, chapter_id,
        category, severity, rule_id, title, explanation, recommendation,
        excerpt, affected_formats, created_at)
       VALUES ('f1','rep1','p1',NULL,'structure','warning','x','T','E',NULL,NULL,'',0)`,
    );

    const res = db.exec("SELECT kind, status FROM preflight_findings WHERE id='f1'");
    expect(String(res[0].values[0][0])).toBe("possible");
    expect(String(res[0].values[0][1])).toBe("open");
  });
});
