// DB-State-Management (Singleton-State)

import type { Database, SqlJsStatic, DatabasePath, PersistentFlag, FsModule, PathModule } from "./types";

interface DbState {
  db: Database | null;
  SQL: SqlJsStatic | null;
  dbPath: DatabasePath;
  persistent: PersistentFlag;
  fsMod: FsModule | null;
  pathMod: PathModule | null;
}

let state: DbState = {
  db: null,
  SQL: null,
  dbPath: null,
  persistent: false,
  fsMod: null,
  pathMod: null,
};

/** Setzt State-Werte (partial update). */
export function setDbState(partial: Partial<DbState>): void {
  state = { ...state, ...partial };
}

/** Gibt den aktuellen State zurück. */
export function getDbState(): DbState {
  return state;
}

/** true, wenn die DB bereit ist (ohne zu werfen). */
export function isDbReady(): boolean {
  return !!((globalThis as any).__aws_db ?? state.db);
}

/**
 * true, wenn Änderungen dauerhaft gespeichert werden.
 * Die UI zeigt bei false einen deutlichen Hinweis, statt Datenverlust zu riskieren.
 */
export function isPersistent(): boolean {
  return state.persistent;
}

/** Absoluter Pfad der DB-Datei, oder null im In-Memory-Betrieb. */
export function databasePath(): DatabasePath {
  return state.dbPath;
}

/** Gibt die DB-Instanz zurück (wirft, wenn nicht initialisiert). */
export function getDb(): Database {
  const injected = (globalThis as any).__aws_db as Database | undefined;
  if (injected) return injected;
  if (!state.db) throw new Error("DB nicht initialisiert – initDb() zuerst aufrufen.");
  return state.db;
}

/** Führt alle Migrationen aus. Bleibt als benannter Export erhalten, damit bestehende Tests unverändert funktionieren. */
export async function migrate(d: Database): Promise<void> {
  const { runMigrations } = await import("./migrations");
  runMigrations(d);
}