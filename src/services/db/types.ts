// Type-Definitionen für den DB-Layer

import type { Database, SqlJsStatic } from "sql.js";

/** true, wenn die DB tatsächlich auf Platte persistiert wird. */
export type PersistentFlag = boolean;

/** Pfad zur DB-Datei, oder null im In-Memory-Betrieb. */
export type DatabasePath = string | null;

/** Recovery-Info von loadWithRecovery. */
export interface RecoveryResult {
  bytes: Uint8Array | null;
  source: string;
  trail: string[];
}

/** Minimaler KV-Vertrag für Tauri fs/path Module. */
export type FsModule = typeof import("@tauri-apps/plugin-fs");
export type PathModule = typeof import("@tauri-apps/api/path");

/** State-Objekt für interne Verwaltung. */
export interface DbState {
  db: Database | null;
  SQL: SqlJsStatic | null;
  dbPath: DatabasePath;
  persistent: PersistentFlag;
  fsMod: FsModule | null;
  pathMod: PathModule | null;
}

// Re-export sql.js types for consumers
export type { Database, SqlJsStatic } from "sql.js";
export type { Statement } from "sql.js";