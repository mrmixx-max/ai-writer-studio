// Prepared-Statement-Cache
//
// sql.js kompiliert jedes db.run()/exec() mit SQL-String neu. Häufig wiederholte
// Abfragen (Kapitel lesen, Fragmente speichern …) profitieren erheblich, wenn
// das Statement nur einmal vorbereitet und mit neuen Parametern wiederverwendet
// wird. Der Cache lebt pro Datenbank-Instanz und wird bei initDb() geleert.

import type { Database, Statement } from "sql.js";

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