// Tests: One-click Backup/Restore + Startup-Integritaetscheck (Sprint 12, Agent 4).
import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { runMigrations } from "@/services/db/migrations";
import { createProject, createChapter, listProjects, listChapters } from "@/services/project";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  LATEST_SCHEMA_VERSION,
  exportBackup,
  exportBackupJson,
  serializeBackup,
  validateBackup,
  restoreBackup,
  checkIntegrity,
} from "@/services/db/backup";

function doc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

let db: Database;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  (globalThis as any).__aws_db = db;
});

describe("Backup-Export", () => {
  it("exportiert Projekte + Kapitel mit Format, Version und Zeitstempel", async () => {
    const p = await createProject("Backup-Buch");
    await createChapter(p.id, "Kapitel Eins", doc("Ein einpraegsamer Satz."));
    const b = exportBackup(db);
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.backupVersion).toBe(BACKUP_VERSION);
    expect(b.schemaVersion).toBeGreaterThan(0);
    expect(typeof b.exportedAt).toBe("string");
    expect(new Date(b.exportedAt).getTime()).not.toBeNaN();
    expect(b.counts).toEqual({ projects: 1, chapters: 1 });
    expect(b.data.projects[0].name).toBe("Backup-Buch");
    expect(b.data.chapters[0].content).toContain("einpraegsamer Satz");
  });

  it("exportiert eine leere DB als gueltiges Backup mit 0/0", () => {
    const b = exportBackup(db);
    expect(b.counts).toEqual({ projects: 0, chapters: 0 });
    expect(b.data.projects).toEqual([]);
    expect(b.data.chapters).toEqual([]);
    expect(validateBackup(JSON.stringify(b)).ok).toBe(true);
  });

  it("exportBackupJson liefert parsierbares JSON", async () => {
    const p = await createProject("JSON-Buch");
    await createChapter(p.id, "K1", doc("Text."));
    const json = exportBackupJson(db);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).format).toBe(BACKUP_FORMAT);
  });
});

describe("Backup-Roundtrip", () => {
  it("stellt Projekte + Kapitel vollständig wieder her", async () => {
    const p = await createProject("Roundtrip-Buch");
    await createChapter(p.id, "Anfang", doc("Der Anfang aller Dinge."));
    await createChapter(p.id, "Ende", doc("Das Ende aller Dinge."));
    const json = exportBackupJson(db);

    db.run("DELETE FROM chapters;");
    db.run("DELETE FROM projects;");
    expect(listProjects()).toHaveLength(0);

    const r = restoreBackup(json, db);
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.restoredProjects).toBe(1);
    expect(r.restoredChapters).toBe(2);
    expect(listProjects()[0].name).toBe("Roundtrip-Buch");
    expect(listChapters(listProjects()[0].id)).toHaveLength(2);
  });

  it("stellt Kapitelinhalte byte-identisch wieder her", async () => {
    const p = await createProject("Inhalt-Buch");
    const content = doc("Ein sehr spezifischer Wiedererkennungs-Satz 123.");
    await createChapter(p.id, "K1", content);
    const json = exportBackupJson(db);
    db.run("DELETE FROM chapters;");
    db.run("DELETE FROM projects;");
    const r = restoreBackup(json, db);
    expect(r.ok).toBe(true);
    const chapters = listChapters(listProjects()[0].id);
    expect(chapters[0].content).toBe(content);
  });

  it("leeres Backup stellt leeren Stand wieder her", () => {
    const json = exportBackupJson(db);
    const r = restoreBackup(json, db);
    expect(r.ok).toBe(true);
    expect(r.restoredProjects).toBe(0);
    expect(r.restoredChapters).toBe(0);
  });
});

describe("Restore-Validierung (wirft nie, lehnt klar ab)", () => {
  it("lehnt korrupte Datei (kein JSON) mit klarer Meldung ab", () => {
    const r = restoreBackup("{kein-json,,,", db);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/kein gueltiges JSON/i);
  });

  it("lehnt leere Datei ab", () => {
    const r = restoreBackup("   ", db);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/leer/i);
  });

  it("lehnt falsches Format ab", () => {
    const r = restoreBackup(JSON.stringify({ format: "fremd", backupVersion: 1 }), db);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Unbekanntes Backup-Format/);
  });

  it("lehnt falsche Backup-Version ab", () => {
    const b = exportBackup(db);
    const wrong = serializeBackup({ ...b, backupVersion: 999 });
    const v = validateBackup(wrong);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/Backup-Version/);
    const r = restoreBackup(wrong, db);
    expect(r.ok).toBe(false);
  });

  it("lehnt neueres Schema ab (statt still zu korrumpieren)", () => {
    const b = exportBackup(db);
    const future = serializeBackup({ ...b, schemaVersion: LATEST_SCHEMA_VERSION + 5 });
    const r = restoreBackup(future, db);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/neueren Schema/);
  });

  it("lehnt Kapitel ohne Projekt (inkonsistent) ab", async () => {
    const p = await createProject("Inkonsistenz-Buch");
    await createChapter(p.id, "K1", doc("Text."));
    const b = exportBackup(db);
    b.data.projects = [];
    const r = restoreBackup(serializeBackup(b), db);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unbekanntes Projekt/);
  });

  it("veraendert die DB bei Ablehnung nicht", async () => {
    const p = await createProject("Unveraendert-Buch");
    await createChapter(p.id, "K1", doc("Bleibt erhalten."));
    const before = listChapters(p.id)[0].content;
    const r = restoreBackup("definitiv-kein-backup", db);
    expect(r.ok).toBe(false);
    expect(listChapters(p.id)[0].content).toBe(before);
    expect(listProjects()).toHaveLength(1);
  });
});

describe("Startup-Integritaetscheck", () => {
  it("meldet ok bei frisch migrierter DB", () => {
    const silent = () => {};
    const result = checkIntegrity(db, silent);
    expect(result.ok).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("meldet fehlende Tabelle statt zu werfen", () => {
    const silent = () => {};
    db.run("DROP TABLE chapters;");
    let result: ReturnType<typeof checkIntegrity> | null = null;
    expect(() => {
      result = checkIntegrity(db, silent);
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    expect(result!.checks.find((c) => c.name === "tabelle-chapters")?.passed).toBe(false);
  });

  it("loggt statt zu werfen (Logger erhaelt Eintraege)", () => {
    const lines: string[] = [];
    const result = checkIntegrity(db, (level, msg) => lines.push(`${level}:${msg}`));
    expect(result.ok).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("meldet fehlende DB als nicht-ok, ohne zu werfen", () => {
    (globalThis as any).__aws_db = undefined;
    let result: ReturnType<typeof checkIntegrity> | null = null;
    expect(() => {
      result = checkIntegrity(undefined, () => {});
    }).not.toThrow();
    expect(result!.ok).toBe(false);
    (globalThis as any).__aws_db = db;
  });
});
