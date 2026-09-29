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

// Core exports
export { initDb } from "./init";
export { persist, persistNow, cancelPendingPersist } from "./persist";
export { getDb, isDbReady, isPersistent, databasePath, migrate } from "./state";
export { currentSchemaVersion } from "./migrations";
export { backupBeforeCritical } from "@/services/resilience/crashRecovery";

// Prepared Statement Cache
export { getPrepared, runPrepared, queryAll, queryOne } from "./prepared";

// Serialized Write Queue
export { enqueueWrite, getWriteChain, resetWriteChain } from "./writeQueue";

// Types
export type {
  PersistentFlag,
  DatabasePath,
  RecoveryResult,
  FsModule,
  PathModule,
  DbState,
} from "./types";
