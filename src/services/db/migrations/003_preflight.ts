// Migration 003 — Preflight vervollständigen.
//
// Migration 002 hat preflight_reports und preflight_findings angelegt, aber
// ohne die Felder, die Nutzerentscheidungen und den Sprung zur Textstelle
// tragen. Diese Migration ergänzt sie und fügt zwei Tabellen hinzu:
// preflight_rules (abschaltbare Regeln je Projekt) und preflight_decisions
// (Entscheidungen, die einen erneuten Lauf überleben).
//
// ALTER TABLE ADD COLUMN ist in SQLite nicht idempotent — ein zweiter Lauf
// wirft "duplicate column name". Deshalb wird jede Spalte vorher geprüft.

import type { Database } from "sql.js";

/** true, wenn die Tabelle diese Spalte hat. */
function hasColumn(d: Database, table: string, column: string): boolean {
  try {
    const res = d.exec(`PRAGMA table_info(${table})`);
    if (res.length === 0) return false;
    // PRAGMA table_info liefert: cid, name, type, notnull, dflt_value, pk
    return res[0].values.some((row) => String(row[1]) === column);
  } catch {
    return false;
  }
}

/** Fügt eine Spalte hinzu, wenn sie fehlt. */
function addColumn(d: Database, table: string, column: string, definition: string): void {
  if (hasColumn(d, table, column)) return;
  d.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function migration003(d: Database): void {
  // -------------------------------------------------------------------------
  //  preflight_findings ergänzen
  // -------------------------------------------------------------------------

  // Einordnung wie bei der Manuskriptprüfung: harter Fehler, deutbar oder
  // vom Autor als bewusst markiert. Orthogonal zum Schweregrad.
  addColumn(d, "preflight_findings", "kind", "TEXT NOT NULL DEFAULT 'possible'");

  // Nutzerentscheidung.
  addColumn(d, "preflight_findings", "status", "TEXT NOT NULL DEFAULT 'open'");

  // Fingerabdruck zur Wiedererkennung nach erneutem Lauf. Bewusst ohne
  // Position gebildet, damit ein eingefügter Absatz die Entscheidung nicht
  // verwirft.
  addColumn(d, "preflight_findings", "fingerprint", "TEXT");

  // Position im Kapiteltext, für den Sprung zur Stelle. NULL bei
  // strukturellen Befunden, die keine Textstelle haben.
  addColumn(d, "preflight_findings", "char_start", "INTEGER");
  addColumn(d, "preflight_findings", "char_end", "INTEGER");

  // Strukturhinweis, wenn kein Textausschnitt möglich ist —
  // etwa "Kapitel 3 von 12, 0 Wörter".
  addColumn(d, "preflight_findings", "structure_hint", "TEXT");

  addColumn(d, "preflight_findings", "updated_at", "INTEGER");

  // -------------------------------------------------------------------------
  //  preflight_reports ergänzen
  // -------------------------------------------------------------------------
  addColumn(d, "preflight_reports", "scope", "TEXT NOT NULL DEFAULT 'project'");
  addColumn(d, "preflight_reports", "chapter_id", "TEXT");
  addColumn(d, "preflight_reports", "notice", "TEXT");
  // Welche Formate geprüft wurden, komma-separiert.
  addColumn(d, "preflight_reports", "formats", "TEXT");

  // -------------------------------------------------------------------------
  //  preflight_rules — Regeln je Projekt abschaltbar
  //
  //  Zweck: Ein Autor, der bewusst ohne Impressum arbeitet, soll die Regel
  //  dauerhaft stumm schalten können, statt den Befund nach jedem Lauf
  //  erneut wegzuklicken.
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS preflight_rules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      /* Abweichender Schwellwert, sofern die Regel einen kennt. */
      threshold REAL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, rule_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  preflight_decisions — Entscheidungen überleben Berichte
  //
  //  Warum eine eigene Tabelle statt nur des Status im Befund: Berichte
  //  werden bei jedem Lauf ersetzt. Läge die Entscheidung nur am Befund,
  //  wäre sie mit dem alten Bericht weg. Hier ist sie an den Fingerabdruck
  //  gebunden und damit dauerhaft.
  // -------------------------------------------------------------------------
  d.run(`
    CREATE TABLE IF NOT EXISTS preflight_decisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      /* 'ignored' = ausblenden, 'accepted' = bewusst so gelassen */
      decision TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, fingerprint),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // -------------------------------------------------------------------------
  //  Indizes
  // -------------------------------------------------------------------------
  d.run(`CREATE INDEX IF NOT EXISTS idx_pf_project ON preflight_findings(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pf_chapter ON preflight_findings(chapter_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pf_status ON preflight_findings(status);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pf_fingerprint ON preflight_findings(fingerprint);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pfr_project ON preflight_reports(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pfd_project ON preflight_decisions(project_id);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_pfrule_project ON preflight_rules(project_id);`);
}
