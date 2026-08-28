// SQLite-Persistenz via sql.js + Tauri fs/path Plugin.
// Datei: {APPDATA}\com.aiwriterstudio.app\user_data\app.db
// Fallback: In-Memory, wenn kein Tauri-Kontext (z.B. vitest / Browser-Dev).
//
// WICHTIG — warum statische Imports NICHT funktionieren:
// Die Tauri-Plugin-Pakete (@tauri-apps/plugin-fs) rufen beim Laden `invoke()`
// auf und werfen im reinen Browser/Node-Kontext. Da vitest und der Vite-Dev-
// Server ohne Tauri laufen, werden sie hier per dynamischem Import geladen und
// nur dann, wenn ein Tauri-Kontext erkannt wurde.
//
// Ebenfalls wichtig: `withGlobalTauri` exponiert ausschließlich den Core
// (invoke, path) unter window.__TAURI__ — NICHT die Plugins. Ein Zugriff auf
// window.__TAURI__.fs ist deshalb immer undefined, und die App würde still auf
// In-Memory zurückfallen und bei jedem Beenden alle Projekte verlieren.

import initSqlJs, { Database, SqlJsStatic, Statement } from "sql.js";
// Vite löst dieses Import auf eine gehashte Asset-URL auf und kopiert die Datei
// ins dist-Verzeichnis. Das ist zuverlässiger als ein handgeschriebener Pfad:
// im Tauri-Release liegt das Frontend hinter dem tauri://-Protokoll, wo ein
// absoluter Pfad wie "/sql-wasm.wasm" ins Leere greift und der 404-Fallback
// die index.html liefert (Fehler: "expected magic word ... found 3c 21 44 4f").
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { runMigrations, currentSchemaVersion } from "./migrations";
import { loadWithRecovery, backupBeforeCritical } from "@/services/resilience/crashRecovery";

export { backupBeforeCritical };

declare const window: any;

/** true, wenn die App im Tauri-Desktop-Kontext läuft. */
function hasTauri(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

/**
 * Schreibt eine Diagnosezeile nach %APPDATA%\...\logs\app.log.
 *
 * Grund: In der Release-EXE gibt es keine DevTools-Konsole. Ohne diesen Weg
 * sind Fehler beim DB-Start unsichtbar — genau der Fall, in dem die App still
 * auf In-Memory zurückfällt und Projekte verliert. Fehler hier werden bewusst
 * geschluckt, damit Logging nie selbst zum Problem wird.
 */
async function logToFile(level: string, message: string): Promise<void> {
  if (!hasTauri()) {
    console.log(`[db/${level}] ${message}`);
    return;
  }
  try {
    const core = await import("@tauri-apps/api/core");
    await core.invoke("log_message", { level: `db/${level}`, message });
  } catch {
    /* Logging darf nie den Start verhindern. */
  }
}

/** Lazy geladene Plugin-Module. */
type FsModule = typeof import("@tauri-apps/plugin-fs");
type PathModule = typeof import("@tauri-apps/api/path");

let fsMod: FsModule | null = null;
let pathMod: PathModule | null = null;

async function loadTauriModules(): Promise<boolean> {
  if (fsMod && pathMod) return true;
  try {
    fsMod = await import("@tauri-apps/plugin-fs");
    pathMod = await import("@tauri-apps/api/path");
    return true;
  } catch (e) {
    await logToFile(
      "ERROR",
      `Tauri-Module nicht ladbar: ${(e as Error).message ?? String(e)}`,
    );
    return false;
  }
}

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let dbPath: string | null = null;
/** true, wenn die DB tatsächlich auf Platte persistiert wird. */
let persistent = false;

/** Entprellter Persist-Timer, damit häufige Mutationen nicht jedes Mal schreiben. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending = false;

/**
 * Ermittelt den DB-Pfad: {APPDATA}\com.aiwriterstudio.app\user_data\app.db
 *
 * appDataDir() liefert bereits das identifier-basierte App-Verzeichnis.
 * user_data/ ist dasselbe Verzeichnis, das main.rs beim Start anlegt — damit
 * enthält eine Sicherung von user_data/ tatsächlich alle Projekte.
 */
async function resolveDbPath(): Promise<string> {
  const base = await pathMod!.appDataDir();
  const dir = await pathMod!.join(base, "user_data");
  await fsMod!.mkdir(dir, { recursive: true });
  return pathMod!.join(dir, "app.db");
}

/**
 * Initialisiert die DB: lädt aus Datei (Tauri) oder erstellt neu (In-Memory).
 *
 * `locateFile` ist zwingend: sql.js lädt sql-wasm.wasm zur Laufzeit per URL
 * nach. Ohne expliziten Pfad sucht es relativ zum Bundle-Chunk, findet nichts,
 * bekommt die index.html als 404-Fallback und scheitert mit
 * "expected magic word 00 61 73 6d, found 3c 21 64 6f" (= "<!do").
 * Die Datei wird von scripts/copy_wasm.py nach public/ gelegt.
 */
export async function initDb(): Promise<Database> {
  if (db && SQL) return db;
  await logToFile("INFO", "initDb() gestartet");
  SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  const tauriDetected = hasTauri();
  const modulesLoaded = tauriDetected ? await loadTauriModules() : false;
  await logToFile(
    "INFO",
    `Tauri erkannt=${tauriDetected}, Module geladen=${modulesLoaded}`,
  );
  const inTauri = tauriDetected && modulesLoaded;

  if (inTauri) {
    try {
      dbPath = await resolveDbPath();
      await logToFile("INFO", `DB-Pfad: ${dbPath}`);
      // Crash-Recovery: primäre Datei, bei Corruption .bak, dann jüngster
      // Snapshot. loadWithRecovery validiert jede Kandidatin per
      // PRAGMA integrity_check, bevor sie akzeptiert wird.
      const recovery = await loadWithRecovery(SQL);
      if (recovery.bytes) {
        db = new SQL.Database(recovery.bytes);
        for (const line of recovery.trail) await logToFile("INFO", `DB-Recovery: ${line}`);
        await logToFile("INFO", `Bestehende DB geladen, Quelle=${recovery.source}`);
      } else if (await fsMod!.exists(dbPath)) {
        // Alle Kandidaten corrupt/lesbar-fehlerhaft: neu anlegen, aber die
        // defekte Datei für die Diagnose umbenennen statt überschreiben.
        try {
          await fsMod!.copyFile(dbPath, `${dbPath}.corrupt-${Date.now()}`);
          await logToFile(
            "ERROR",
            "DB corrupt — defekte Datei gesichert, leere DB wird angelegt",
          );
        } catch {
          await logToFile("ERROR", "DB corrupt — Sicherung der defekten Datei fehlgeschlagen");
        }
        db = new SQL.Database();
      } else {
        db = new SQL.Database();
        await logToFile("INFO", "Neue DB angelegt");
      }
      persistent = true;
    } catch (e) {
      await logToFile(
        "ERROR",
        `Datei nicht nutzbar, In-Memory-Betrieb: ${(e as Error).message ?? String(e)}`,
      );
      db = new SQL.Database();
      persistent = false;
    }
  } else {
    db = new SQL.Database();
    persistent = false;
    await logToFile("WARN", "Kein Tauri-Kontext: In-Memory-Betrieb ohne Persistenz");
  }

  (globalThis as any).__aws_db = db;
  db.run("PRAGMA foreign_keys = ON;");
  // Auto-Backup vor Migrationen (kritische Operation): wenn eine Migration
  // schiefläuft, bleibt der Stand davor als app.db.snapshot-* erhalten.
  if (persistent) await backupBeforeCritical("migration");
  runMigrations(db);
  if (persistent) await persistNow();
  await logToFile("INFO", `initDb() fertig, persistent=${persistent}`);
  return db;
}

/**
 * Schreibt die DB als Datei. Entprellt (400 ms): mehrere Aufrufe werden zu
 * einem Schreibvorgang zusammengefasst. Der letzte Aufruf gewinnt und schreibt
 * den aktuellen Zustand — kein Datenverlust.
 */
export async function persist(): Promise<void> {
  if (!persistent || !db) return;
  persistPending = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistPending) {
      persistPending = false;
      void persistNow();
    }
  }, 400);
}

/** Schreibt sofort, ohne Entprellung — für Snapshot, Restore, App-Ende. */
export async function persistNow(): Promise<void> {
  if (!persistent || !db || !dbPath || !fsMod) return;
  try {
    const data = db.export();
    const tmpPath = `${dbPath}.tmp`;
    // 1. Schreibe temporär
    await fsMod.writeFile(tmpPath, data);
    // 2. Backup der vorherigen Version anlegen (falls vorhanden)
    try {
      if (await fsMod.exists(dbPath)) {
        await fsMod.copyFile(dbPath, `${dbPath}.bak`);
      }
    } catch {
      // Backup darf Schreibvorgang nicht blockieren
    }
    // 3. Temp nach Ziel kopieren (plugin-fs hat kein renameFile)
    await fsMod.copyFile(tmpPath, dbPath);
    // 4. Temp löschen
    try {
      await fsMod.remove(tmpPath);
    } catch {
      // Temp-Löschung kann später nachgeholt werden
    }
  } catch (e) {
    await logToFile(
      "ERROR",
      `Schreiben fehlgeschlagen: ${(e as Error).message ?? String(e)}`,
    );
  }
}

export function getDb(): Database {
  const injected = (globalThis as any).__aws_db as Database | undefined;
  if (injected) return injected;
  if (!db) throw new Error("DB nicht initialisiert – initDb() zuerst aufrufen.");
  return db;
}

/** true, wenn die DB bereit ist (ohne zu werfen). */
export function isDbReady(): boolean {
  return !!((globalThis as any).__aws_db ?? db);
}

/**
 * true, wenn Änderungen dauerhaft gespeichert werden.
 * Die UI zeigt bei false einen deutlichen Hinweis, statt Datenverlust zu riskieren.
 */
export function isPersistent(): boolean {
  return persistent;
}

/** Absoluter Pfad der DB-Datei, oder null im In-Memory-Betrieb. */
export function databasePath(): string | null {
  return dbPath;
}

/**
 * Führt alle Migrationen aus. Bleibt als benannter Export erhalten,
 * damit bestehende Tests unverändert funktionieren.
 */
export function migrate(d: Database): void {
  runMigrations(d);
}

export { currentSchemaVersion };

// ---------------------------------------------------------------------------
// Prepared-Statement-Cache
//
// sql.js kompiliert jedes db.run()/exec() mit SQL-String neu. Häufig wiederholte
// Abfragen (Kapitel lesen, Fragmente speichern …) profitieren erheblich, wenn
// das Statement nur einmal vorbereitet und mit neuen Parametern wiederverwendet
// wird. Der Cache lebt pro Datenbank-Instanz und wird bei initDb() geleert.
// ---------------------------------------------------------------------------

const stmtCache = new WeakMap<Database, Map<string, Statement>>();

/**
 * Liefert ein gecachtes Prepared Statement für dieselbe Datenbank.
 * Das Statement muss anschließend mit `.run(params)` oder `.getAsObject(params)`
 * benutzt und per `.reset()`/`.free()` zurückgesetzt werden — `runPrepared`
 * kapselt das bereits.
 */
export function getPrepared(d: Database, sql: string): Statement {
  let cache = stmtCache.get(d);
  if (!cache) {
    cache = new Map();
    stmtCache.set(d, cache);
  }
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = d.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}

/**
 * Führt ein SQL-Statement mit Parametern über den Statement-Cache aus.
 * Equivalent zu d.run(sql, params), aber ohne wiederholtes Kompilieren.
 */
export function runPrepared(d: Database, sql: string, params: unknown[] = []): void {
  const stmt = getPrepared(d, sql);
  stmt.run(params as never);
}

/** Liest alle Zeilen eines SELECTs über den Statement-Cache als Objekte. */
export function queryAll<T = Record<string, unknown>>(
  d: Database,
  sql: string,
  params: unknown[] = [],
): T[] {
  const stmt = getPrepared(d, sql);
  try {
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.reset();
  }
}

/** Liest die erste Zeile eines SELECTs (oder null) über den Statement-Cache. */
export function queryOne<T = Record<string, unknown>>(
  d: Database,
  sql: string,
  params: unknown[] = [],
): T | null {
  const rows = queryAll<T>(d, sql, params);
  return rows.length ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// Serialisierte Schreiboperationen ("Connection Pooling" für sql.js)
//
// sql.js hat genau EINE Verbindung (die In-Memory-DB). Ein klassischer Pool
// ist nicht möglich; das Ziel — keine überlappenden Schreibvorgänge, keine
// Race-Conditions zwischen persistNow()-Exporten — wird stattdessen durch
// eine serielle Aufgabenwarteschlange erreicht: Alle Schreiboperationen laufen
// nacheinander, niemals parallel.
// ---------------------------------------------------------------------------

let writeChain: Promise<void> = Promise.resolve();

/**
 * Führt eine Schreiboperation serialisiert aus. Mehrere gleichzeitig
 * aufgerufene Tasks laufen strikt nacheinander; ein Fehler bricht die
 * Kette nicht (der nächste Task läuft weiter).
 */
export function enqueueWrite<T>(task: () => Promise<T> | T): Promise<T> {
  const result = writeChain.then(task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
