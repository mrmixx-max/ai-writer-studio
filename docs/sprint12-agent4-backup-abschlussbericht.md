# Sprint 12 — Agent 4: Daten-Sicherheit (Backup/Restore) — Abschlussbericht

Stand: 2026-09-06. Branch: main (shared tree, keine Checkouts).

## 1. Befund: Storage-Layer

- Engine: **sql.js** (SQLite-WASM), Pfad `{APPDATA}\com.aiwriterstudio.app\user_data\app.db`,
  Fallback In-Memory ohne Tauri-Kontext (`src/services/db/index.ts`).
- Schema: 21 idempotente Migrationen (`src/services/db/migrations/`, Registry `index.ts`,
  `schema_migrations`-Tabelle, `runMigrations()` + `currentSchemaVersion()`).
- Domain: Projekte + Kapitel in `src/services/project/index.ts` (CRUD, AES-Verschluesselung optional).
- Bestand: Snapshots (Versionierung in-DB), Crash-Recovery (`.bak` + `integrity_check`),
  aber **kein portabler One-Click-Backup-Export/Import als Datei** — genau diese Luecke schliesst der Auftrag.

## 2. Implementierung (2 neue Dateien, 0 geaenderte Storage-Dateien)

- `src/services/db/backup.ts` (neu, einzige Produktionsdatei):
  - `exportBackup(db?)` / `exportBackupJson()` — One-Click-Export aller Projekte + Kapitel
    als JSON mit `format`, `backupVersion: 1`, `schemaVersion`, `exportedAt` (ISO), `counts`.
  - `validateBackup(json)` — wirft nie; prueft JSON-Parse, Formatkennung, Backup-Version,
    Schema-Neuheit (neuer als bekannt → Ablehnung mit Update-Hinweis), Pflichtfelder,
    Zeilen-Gueltigkeit, Kapitel→Projekt-Referenzen.
  - `restoreBackup(json, db?)` — wirft nie, gibt immer `{ ok, restoredProjects,
    restoredChapters, error }` zurueck; ersetzt Projekte + Kapitel (FK OFF/ON-geschuetzt);
    bei Ablehnung bleibt die DB unveraendert.
  - `checkIntegrity(db?, log?)` — Startup-Selbstcheck (Kerntabellen, `foreign_key_check`,
    `integrity_check`); loggt statt zu werfen, Rueckgabe `{ ok, checks }`.
  - Keine neuen Abhaengigkeiten (nur vorhandenes sql.js + Migrations-Registry).
- `src/services/db/backup.test.ts` (neu): **17 Tests**, alle gruen.

## 3. Verifikation

- `npx vitest run src/services/db/backup.test.ts` → 17/17 bestanden (Roundtrip, Byte-Identitaet,
  leere DB, Korrupt-/Leer-/Fremdformat-/Versions-/Schema-/Inkonsistenz-Ablehnung, DB-unveraendert,
  Integritaet ok/fehlende Tabelle/Logging/fehlende DB).
- Regression: `migrate.test.ts` + `snapshot.test.ts` + `project/index.test.ts` → 38/38 bestanden.
- `npx tsc --noEmit` → fehlerfrei (Exit 0).

## 4. Status-Selbstcheck

- `git status --short --branch`: siehe Parent-Protokoll; eigene Aenderungen beschraenkt auf
  `src/services/db/backup.ts`, `src/services/db/backup.test.ts`, `docs/sprint12-agent4-backup-abschlussbericht.md`.
- Kein Eingriff in `db/index.ts`, `project/index.ts`, Migrationen oder Snapshots.
- Offene Punkte: kein UI-Button (One-Click ist API-seitig fertig, UI-Anbindung Folgeticket);
  kein Dateidialog (Tauri plugin-fs/dialog beim Verdrahten nutzen); Backup-Version 1 fix.
