// Migrations-Registry. Alle Migrationen laufen bei jedem Start (idempotent).
import type { Database } from "sql.js";
import { migration001 } from "./001_base";
import { migration002 } from "./002_knowledge_diagnostics";
import { migration003 } from "./003_preflight";
import { migration004 } from "./004_bookwriter";

export interface Migration {
  version: number;
  name: string;
  up: (d: Database) => void;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, name: "base", up: migration001 },
  { version: 2, name: "knowledge_diagnostics", up: migration002 },
  { version: 3, name: "preflight", up: migration003 },
  { version: 4, name: "bookwriter", up: migration004 },
];

/**
 * Führt alle registrierten Migrationen aus und protokolliert sie in schema_migrations.
 * Alle Migrationen sind idempotent (IF NOT EXISTS), daher ist ein Re-Run gefahrlos.
 */
export function runMigrations(d: Database): void {
  d.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  for (const m of MIGRATIONS) {
    m.up(d);
    d.run(
      "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?,?,?)",
      [m.version, m.name, Date.now()],
    );
  }
}

/** Liefert die höchste angewendete Schema-Version (0 wenn keine). */
export function currentSchemaVersion(d: Database): number {
  try {
    const res = d.exec("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations");
    if (!res.length) return 0;
    return Number(res[0].values[0][0] ?? 0);
  } catch {
    return 0;
  }
}
