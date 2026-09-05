// Migrations-Registry. Alle Migrationen laufen bei jedem Start (idempotent).
import type { Database } from "sql.js";
import { migration001 } from "./001_base";
import { migration002 } from "./002_knowledge_diagnostics";
import { migration003 } from "./003_preflight";
import { migration004 } from "./004_bookwriter";
import { migration005 } from "./005_bookwriter_created_at";
import { migration006 } from "./006_bookwriter_documents";
import { migration007 } from "./007_characters";
import { migration008 } from "./008_timeline";
import { migration009 } from "./009_performance_indexes";
import { migration010 } from "./010_voice_lab";
import { migration011 } from "./011_relationships";
import { migration012 } from "./012_ki_features";
import { migration013 } from "./013_worldbuilding";
import { migration014 } from "./014_collaboration";
import { migration015 } from "./015_research";
import { migration016 } from "./016_performance_indexes";
import { migration017 } from "./017_ki_memory";
import { migration018 } from "./018_bookwriter_jobs";
import { migration019 } from "./019_revision";
import { migration020 } from "./020_bookwriter_telemetry";
import { migration021 } from "./021_memory";

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
  { version: 5, name: "bookwriter_created_at", up: migration005 },
  { version: 6, name: "bookwriter_documents", up: migration006 },
  { version: 7, name: "characters", up: migration007 },
  { version: 8, name: "timeline_events", up: migration008 },
  { version: 9, name: "performance_indexes", up: migration009 },
  { version: 10, name: "voice_lab", up: migration010 },
  { version: 11, name: "character_relationships", up: migration011 },
  { version: 12, name: "ki_features", up: migration012 },
  { version: 13, name: "worldbuilding", up: migration013 },
  { version: 14, name: "collaboration", up: migration014 },
  { version: 15, name: "research", up: migration015 },
  { version: 16, name: "performance_indexes_2", up: migration016 },
  { version: 17, name: "ki_memory", up: migration017 },
  { version: 18, name: "bookwriter_jobs", up: migration018 },
  { version: 19, name: "revision_loop", up: migration019 },
  { version: 20, name: "bookwriter_jobs_telemetry", up: migration020 },
  { version: 21, name: "bookwriter_memory", up: migration021 },
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
