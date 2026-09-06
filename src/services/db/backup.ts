// One-click Backup (Export) + Restore mit Validierung + Startup-Integritaetscheck.
//
// Speicherformat (JSON, UTF-8):
// {
//   "format": "ai-writer-studio-backup",
//   "backupVersion": 1,
//   "schemaVersion": <maximale Migration, z.B. 21>,
//   "exportedAt": "<ISO-8601>",
//   "counts": { "projects": n, "chapters": m },
//   "data": { "projects": [...], "chapters": [...] }
// }
//
// Design-Regeln (Sprint 12, Agent 4):
// - Keine neuen nativen Abhaengigkeiten (nur sql.js, bereits vorhanden).
// - Kein Eingriff in bestehendes Storage-Verhalten: dieses Modul liest ueber
//   getDb()/exec und schreibt nur in restoreBackup().
// - restoreBackup() wirft NIE — jede fehlerhafte Datei ergibt ein klares
//   { ok: false, error } statt eines Absturzes.
// - checkIntegrity() loggt statt zu werfen (Startup-Selbstcheck).

import type { Database } from "sql.js";
import { getDb } from "@/services/db";
import { MIGRATIONS } from "@/services/db/migrations";

/** Formatkennung — jede Backup-Datei muss genau diesen Wert tragen. */
export const BACKUP_FORMAT = "ai-writer-studio-backup";

/** Aktuelle Version des Backup-Formats (nicht der DB-Schema-Version). */
export const BACKUP_VERSION = 1;

/** Hoechste bekannte DB-Schema-Version (letzte Migration). */
export const LATEST_SCHEMA_VERSION: number =
  MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;

export interface BackupProjectRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface BackupChapterRow {
  id: string;
  project_id: string;
  title: string;
  content: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  status: string | null;
  target_word_count: number | null;
  minimum_word_count: number | null;
  maximum_word_count: number | null;
  current_word_count: number | null;
  purpose: string | null;
  synopsis: string | null;
  last_error: string | null;
}

export interface BackupFile {
  format: string;
  backupVersion: number;
  schemaVersion: number;
  exportedAt: string;
  counts: { projects: number; chapters: number };
  data: { projects: BackupProjectRow[]; chapters: BackupChapterRow[] };
}

export interface RestoreResult {
  ok: boolean;
  restoredProjects: number;
  restoredChapters: number;
  /** Bei ok=false die menschenlesbare Fehlerursache (niemals ein Stacktrace). */
  error: string | null;
}

export interface IntegrityCheck {
  ok: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
}

function resolveDb(d?: Database): Database | null {
  if (d) return d;
  try {
    return getDb();
  } catch {
    return null;
  }
}

function readTable<T>(db: Database, sql: string): T[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      obj[c] = row[i];
    });
    return obj as T;
  });
}

/**
 * Exportiert alle Projekte + Kapitel als Backup-Objekt (One-Click-Backup).
 * Wirft nur, wenn gar keine DB verfuegbar ist; leere DB ergibt ein gueltiges
 * Backup mit counts 0/0.
 */
export function exportBackup(d?: Database): BackupFile {
  const db = resolveDb(d);
  if (!db) throw new Error("Backup-Export: keine Datenbank initialisiert.");
  const projects = readTable<BackupProjectRow>(
    db,
    "SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC",
  );
  const chapters = readTable<BackupChapterRow>(
    db,
    "SELECT id, project_id, title, content, order_index, created_at, updated_at, " +
      "status, target_word_count, minimum_word_count, maximum_word_count, " +
      "current_word_count, purpose, synopsis, last_error FROM chapters ORDER BY project_id, order_index",
  );
  let schemaVersion = 0;
  try {
    const res = db.exec("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations");
    if (res.length) schemaVersion = Number(res[0].values[0][0] ?? 0);
  } catch {
    schemaVersion = 0;
  }
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion,
    exportedAt: new Date().toISOString(),
    counts: { projects: projects.length, chapters: chapters.length },
    data: { projects, chapters },
  };
}

/** Serialisiert ein Backup-Objekt nach JSON (Dateiinhalt). */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}

/** Komfort: Export direkt als JSON-String. */
export function exportBackupJson(d?: Database): string {
  return serializeBackup(exportBackup(d));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkProjectRow(p: unknown): string | null {
  if (!isRecord(p)) return "Projekt ist kein Objekt.";
  if (typeof p.id !== "string" || !p.id) return "Projekt ohne gueltige id.";
  if (typeof p.name !== "string") return `Projekt ${String(p.id)} ohne gueltigen name.`;
  return null;
}

function checkChapterRow(c: unknown): string | null {
  if (!isRecord(c)) return "Kapitel ist kein Objekt.";
  if (typeof c.id !== "string" || !c.id) return "Kapitel ohne gueltige id.";
  if (typeof c.project_id !== "string" || !c.project_id)
    return `Kapitel ${String(c.id)} ohne gueltige project_id.`;
  if (typeof c.title !== "string") return `Kapitel ${String(c.id)} ohne gueltigen title.`;
  if (typeof c.content !== "string") return `Kapitel ${String(c.id)} ohne gueltigen content.`;
  return null;
}

/**
 * Validiert einen Backup-JSON-String. Gibt bei Erfolg das Backup zurueck,
 * sonst eine klare Fehlermeldung. Wirft nie.
 */
export function validateBackup(
  json: string,
): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  if (typeof json !== "string" || json.trim() === "") {
    return { ok: false, error: "Backup-Datei ist leer." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      error: "Backup-Datei ist kein gueltiges JSON (Datei beschaedigt?).",
    };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "Backup-Datei hat ein unbekanntes Format (kein Objekt)." };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: `Unbekanntes Backup-Format (${String(parsed.format ?? "fehlend")}). Erwartet: ${BACKUP_FORMAT}.`,
    };
  }
  if (parsed.backupVersion !== BACKUP_VERSION) {
    return {
      ok: false,
      error:
        `Nicht unterstuetzte Backup-Version (${String(parsed.backupVersion ?? "fehlend")}). ` +
        `Diese App liest Version ${BACKUP_VERSION}.`,
    };
  }
  if (typeof parsed.schemaVersion !== "number") {
    return { ok: false, error: "Backup-Datei ohne gueltige schemaVersion." };
  }
  if (parsed.schemaVersion > LATEST_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        `Backup stammt aus einem neueren Schema (v${parsed.schemaVersion}, bekannt: v${LATEST_SCHEMA_VERSION}). ` +
        "Bitte die App aktualisieren, statt das Backup einzuspielen.",
    };
  }
  if (typeof parsed.exportedAt !== "string" || !parsed.exportedAt) {
    return { ok: false, error: "Backup-Datei ohne gueltiges exportedAt-Datum." };
  }
  if (!isRecord(parsed.data)) {
    return { ok: false, error: "Backup-Datei ohne Datenbereich (data fehlt)." };
  }
  const { projects, chapters } = parsed.data;
  if (!Array.isArray(projects) || !Array.isArray(chapters)) {
    return { ok: false, error: "Backup-Daten unvollstaendig (projects/chapters fehlen)." };
  }
  for (const p of projects) {
    const err = checkProjectRow(p);
    if (err) return { ok: false, error: `Backup beschaedigt: ${err}` };
  }
  for (const c of chapters) {
    const err = checkChapterRow(c);
    if (err) return { ok: false, error: `Backup beschaedigt: ${err}` };
  }
  const projectIds = new Set(projects.map((p) => (p as Record<string, unknown>).id));
  for (const c of chapters) {
    const pid = (c as Record<string, unknown>).project_id;
    if (!projectIds.has(pid)) {
      return {
        ok: false,
        error: `Backup inkonsistent: Kapitel ${String((c as Record<string, unknown>).id)} verweist auf unbekanntes Projekt ${String(pid)}.`,
      };
    }
  }
  return { ok: true, backup: parsed as unknown as BackupFile };
}

/**
 * Spielt ein Backup in die DB ein (ersetzt Projekte + Kapitel).
 * Gibt IMMER ein RestoreResult zurueck und wirft nie — auch bei
 * beschaedigten Dateien oder DB-Fehlern nicht.
 */
export function restoreBackup(json: string, d?: Database): RestoreResult {
  const fail = (error: string): RestoreResult => ({
    ok: false,
    restoredProjects: 0,
    restoredChapters: 0,
    error,
  });
  let db: Database | null;
  try {
    db = resolveDb(d);
  } catch {
    db = null;
  }
  if (!db) return fail("Restore: keine Datenbank initialisiert.");
  const validated = validateBackup(json);
  if (!validated.ok) return fail(validated.error);
  const backup = validated.backup;
  try {
    db.run("PRAGMA foreign_keys = OFF;");
    try {
      db.run("DELETE FROM chapters;");
      db.run("DELETE FROM projects;");
      for (const p of backup.data.projects) {
        db.run("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?,?,?,?)", [
          p.id,
          p.name,
          p.created_at,
          p.updated_at,
        ]);
      }
      for (const c of backup.data.chapters) {
        db.run(
          "INSERT INTO chapters (id, project_id, title, content, order_index, created_at, updated_at, " +
            "status, target_word_count, minimum_word_count, maximum_word_count, " +
            "current_word_count, purpose, synopsis, last_error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            c.id,
            c.project_id,
            c.title,
            c.content,
            c.order_index,
            c.created_at,
            c.updated_at,
            c.status,
            c.target_word_count,
            c.minimum_word_count,
            c.maximum_word_count,
            c.current_word_count,
            c.purpose,
            c.synopsis,
            c.last_error,
          ],
        );
      }
    } finally {
      db.run("PRAGMA foreign_keys = ON;");
    }
    return {
      ok: true,
      restoredProjects: backup.data.projects.length,
      restoredChapters: backup.data.chapters.length,
      error: null,
    };
  } catch (e) {
    return fail(`Restore fehlgeschlagen: ${(e as Error).message ?? String(e)}`);
  }
}

type LogFn = (level: string, message: string) => void;

function defaultLog(level: string, message: string): void {
  if (level === "ERROR") console.error(`[backup] ${message}`);
  else console.log(`[backup] ${message}`);
}

function tableExists(db: Database, name: string): boolean {
  try {
    const res = db.exec(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='${name}'`,
    );
    return !!res.length && Number(res[0].values[0][0]) > 0;
  } catch {
    return false;
  }
}

/**
 * Startup-Integritaetscheck: prueft Kerntabellen, Fremdschluessel und
 * Seitenintegritaet. Loggt statt zu werfen — Rueckgabe sagt, ob alles ok ist.
 * Ideal zum Aufruf nach initDb()/runMigrations().
 */
export function checkIntegrity(d?: Database, log: LogFn = defaultLog): IntegrityCheck {
  const checks: IntegrityCheck["checks"] = [];
  const push = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
    log(passed ? "INFO" : "ERROR", `${name}: ${detail}`);
  };
  const db = resolveDb(d);
  if (!db) {
    push("db-verfuegbar", false, "Keine Datenbank initialisiert.");
    return { ok: false, checks };
  }
  for (const t of ["projects", "chapters", "schema_migrations"]) {
    const exists = tableExists(db, t);
    push(`tabelle-${t}`, exists, exists ? "vorhanden." : "FEHLT — Migration unvollstaendig?");
  }
  try {
    const res = db.exec("PRAGMA foreign_key_check;");
    const violations = res.length ? res[0].values.length : 0;
    push(
      "fremdschluessel",
      violations === 0,
      violations === 0 ? "keine Verletzungen." : `${violations} Verletzung(en) gefunden.`,
    );
  } catch (e) {
    push("fremdschluessel", false, `Pruefung nicht moeglich: ${(e as Error).message ?? String(e)}`);
  }
  try {
    const res = db.exec("PRAGMA integrity_check;");
    const first = res.length ? String(res[0].values[0][0] ?? "") : "";
    const passed = first.toLowerCase() === "ok";
    push("integritaet", passed, passed ? "integrity_check ok." : `integrity_check: ${first}`);
  } catch (e) {
    push("integritaet", false, `Pruefung nicht moeglich: ${(e as Error).message ?? String(e)}`);
  }
  return { ok: checks.every((c) => c.passed), checks };
}
