# Migrations-Guide — Datenbankschema

AI Writer Studio speichert alle Daten in einer lokalen SQLite-Datei
(`%APPDATA%\com.aiwriterstudio.app\user_data\app.db`), verwaltet durch
[sql.js](https://github.com/sql-js/sql.js) im Renderer-Prozess.

## Aktuelles Schema

**Version 15** (Migrations 001–015, siehe `src/services/db/migrations/`).

| # | Name | Inhalt |
|---|------|--------|
| 1 | base | `projects`, `chapters`, `settings`, `writing_prompts` |
| 2 | knowledge_diagnostics | `knowledge_sources`, `knowledge_chunks`, Diagnostik, Preflight, Snapshots |
| 3 | preflight | Preflight-Befunde, Entscheidungen |
| 4 | bookwriter | Bookwriter-Datenmodell |
| 5 | bookwriter_created_at | `created_at`-Spalten im Bookwriter |
| 6 | bookwriter_documents | Bookwriter-Dokumente (inkl. RAG) |
| 7 | characters | Figurenprofile |
| 8 | timeline_events | Zeitstrahl-Ereignisse |
| 9 | performance_indexes | Performance-Indizes |
| 10 | voice_lab | Stimmen-Labor |
| 11 | character_relationships | Figurenbeziehungen |
| 12 | ki_features | KI-Features (Prompts, Läufe) |
| 13 | worldbuilding | Orte, Welten, Kulturen |
| 14 | collaboration | Kollaboration, Sharing |
| 15 | research | Recherche-Ablage |

## Wie Migrationen laufen

`runMigrations()` in `src/services/db/migrations/index.ts`:

1. Legt `schema_migrations (version, name, applied_at)` an.
2. Führt **jede** registrierte Migration bei jedem Start aus — daher muss
   jede Migration **idempotent** sein.
3. Trägt jede Migration nach dem Lauf in `schema_migrations` ein
   (`INSERT OR REPLACE`).

`currentSchemaVersion(d)` liefert die höchste angewendete Version (0 bei
leerer DB).

## Neue Migration hinzufügen (Schritt für Schritt)

Angenommen, Feature „foo" braucht eine Tabelle:

1. **Datei anlegen:** `src/services/db/migrations/016_foo.ts`

   ```ts
   // Migration 016 — Foo (kurze Beschreibung).
   // Idempotent via IF NOT EXISTS. Wird von migrate() nach den Basistabellen ausgeführt.

   import type { Database } from "sql.js";

   export function migration016(d: Database): void {
     d.run(`
       CREATE TABLE IF NOT EXISTS foo (
         id TEXT PRIMARY KEY,
         project_id TEXT NOT NULL,
         name TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL,
         FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
       );
     `);
     d.run(`CREATE INDEX IF NOT EXISTS idx_foo_project ON foo(project_id);`);
   }
   ```

2. **Registrieren** in `src/services/db/migrations/index.ts`:

   ```ts
   import { migration016 } from "./016_foo";
   // …
   { version: 16, name: "foo", up: migration016 },
   ```

3. **Test schreiben** nach dem Muster von `003_preflight.test.ts` /
   `migrations.test.ts`: Migration zweimal laufen lassen (Idempotenz),
   Tabelle/Spalten prüfen.

4. **Bestehende DBs:** Da alle Migrationen bei jedem Start laufen, bekommen
   Bestandsnutzer die neue Tabelle automatisch — `CREATE TABLE IF NOT EXISTS`
   tut nichts auf frischen DBs, legt sie aber auf alten an. **Kein Nutzer-Eingriff nötig.**

## Regeln

- **Niemals** bestehende Migrationen (001–015) ändern — nur neue Dateien
  anlegen. Alte DBs haben die alte Fassung bereits angewendet.
- **Idempotenz ist Pflicht:** `IF NOT EXISTS`, keine `INSERT`s ohne
  Existenzprüfung, keine destruktiven `DROP`/`DELETE` ohne Guard.
- **Schema-Änderungen an bestehenden Tabellen** (Spalte hinzufügen) über
  eine neue Migration mit `ALTER TABLE … ADD COLUMN` und vorheriger
  Prüfung (`PRAGMA table_info`), weil `ALTER` nicht idempotent ist:

  ```ts
  const cols = d.exec("PRAGMA table_info(chapters)");
  const has = cols[0]?.values.some((r) => r[1] === "new_col");
  if (!has) d.run("ALTER TABLE chapters ADD COLUMN new_col TEXT;");
  ```

- **Datenmigration** (Werte umbauen) ebenfalls in einer neuen Migration,
  bevorzugt in einer Transaktion (`BEGIN`/`COMMIT`).
- **Fremdschlüssel** immer mit `ON DELETE CASCADE` auf `projects(id)`,
  damit Projektlöschen alles miträumt.
- **Zeitstempel** als `INTEGER` (Unix-ms), Felder `created_at`/`updated_at`.
- **Index** auf jede `project_id`-Spalte (Muster aus Migration 009).
- Changelog-Eintrag unter `[Unreleased] → Added/Changed` ergänzen.

## Rollback / Notfall

Ein Rollback ist nicht vorgesehen und nicht nötig: Die App-Daten liegen als
eine Datei vor; Sicherung = Ordner `user_data` kopieren (siehe README,
„Wo deine Daten liegen"). Bei Schema-Korruption App schließen, `app.db`
wiederherstellen, App neu starten.
