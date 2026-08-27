// Migration 005 — bookwriter_phases.created_at hinzufügen.
//
// Migration 004 hat bookwriter_phases ohne created_at angelegt, aber
// state.ts schreibt created_at beim Anlegen einer Phase. Diese Migration
// ergänzt die Spalte idempotent.

import type { Database } from "sql.js";

export function migration005(d: Database): void {
  try {
    const res = d.exec(`PRAGMA table_info(bookwriter_phases)`);
    if (res.length === 0) return;
    const hasColumn = res[0].values.some((row) => String(row[1]) === "created_at");
    if (!hasColumn) {
      d.run(`ALTER TABLE bookwriter_phases ADD COLUMN created_at INTEGER`);
    }
  } catch {
    // Tabelle existiert nicht — nichts zu tun.
  }
}
