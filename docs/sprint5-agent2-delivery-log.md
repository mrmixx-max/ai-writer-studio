# Sprint 5 — Agent 2: Bulk Processing & Queue Management (Delivery-Log)

## Aufgabe

Automatisierte Abarbeitung mehrerer Projekte (Bücher) über eine CSV-Job-Queue:

1. **CSV-Job-Queue**: BulkOrchestrator liest `.csv` (Titel, Genre,
   Target-Wörterzahl, Spezial-Prompt, Sprache) und reiht in Queue ein.
2. **Ressourcen-Schonung**: Cooldown-Phase (Default 60s) zwischen Büchern
   bei lokalen Modellen, Context-Cache leeren.
3. **Resume-on-Crash**: Fataler Fehler → `failed_jobs.json`, Queue läuft weiter.

## Umsetzung

TDD: Tests zuerst → Implementierung → GREEN.

### Neue Dateien (`src/services/bulk/`)

| Datei | Zweck |
|---|---|
| `csvQueue.ts` | CSV-Parser (RFC 4180: Quoting, `""`-Escapes, eingebettete Zeilenumbrüche, BOM, CRLF). Header-Aliasse (de/en), Genre-/Sprach-Normalisierung (`"Sachbuch"` → `sachbuch`, `"Deutsch"` → `de`). Invalide Zeilen werden gesammelt (`invalid[]` mit 1-basierter Zeilennummer), nicht geworfen. |
| `csvQueue.test.ts` | 12 Unit-Tests: reguläres Einlesen, Normalisierung, Quoting, BOM/CRLF, Defaults (Sprache=de, Target=0=auto), Fehlerzeilen-Sammelung, leere Zeilen, strukturelle Fehler (fehlende Kopfzeile), englische Header. |
| `bulkOrchestrator.ts` | Queue-Abarbeitung. `DEFAULT_COOLDOWN_MS = 60_000` zwischen Büchern (nicht nach dem letzten), `cooldownMs: 0` für entfernte Provider. Context-Cache-Clear nach JEDEM Buch (auch nach Fehlern) über optionales `runner.clearContextCache()`. Fatale Fehler → Eintrag in `failed_jobs.json` (`BulkFailedJob`: jobId, jobTitle, error, failedAt, sourceRow, fatal) + Queue läuft weiter; fehlgeschlagene Jobs werden NICHT erneut eingereiht. Default-Persistenz: Tauri-FS → `appDataDir` (still passend im Browser/Test-Kontext); in Tests via `writeFileFn` injiziert. |
| `bulkOrchestrator.test.ts` | 14 Unit-Tests: Default 60s, Reihenfolge, Cooldown nur zwischen Büchern, cooldownMs=0, Context-Clear nach jedem Buch (auch nach Fehler), failed_jobs.json bei Crash (kumulativ bei mehreren), kein Re-Enqueue (kein Endlosloop), keine Writes bei Erfolg, `BulkRunResult`-Zeitstempel. |
| `bulkRunner.ts` | Adapter zur App: `bulkJobToBriefing()` mappt CSV-Spalten → `BookBriefing` (Target-Wörterzahl → Kapitelanzahl via `chapterCountForTargetWords()`, Spezial-Prompt → idea/uniqueAngle); `createBookJobRunner()` führt pro Job einen vollständigen Bookwriter-Lauf aus (eigenes `createProject` → `startBookwriter` → `runBookwriter`, Modus „auto") und leert den Context-Cache; `runBulkFromCsv()` als Convenience-Einstieg. |
| `bulkRunner.integration.test.ts` | 3 Integrationstests über den ECHTEN Bookwriter-Workflow (Mock-LLM, In-Memory-SQLite, happy-dom): komplette Kette CSV → Parser → Orchestrator → Workflow; Resume-on-Crash: Lauf 2 crasht → `failed_jobs.json` geschrieben, Läufe 1+3 abgeschlossen. |
| `bulk-jobs.example.csv` | Beispiel-Queue mit 4 Büchern (de/en) als Vorlage. |
| `index.ts` | Öffentliche Re-Exports des Bulk-Moduls. |

### Akzeptanzkriterien → Nachweis

1. **CSV mit Spalten wird korrekt eingelesen** — `csvQueue.test.ts` (12 Tests):
   kanonische Header + Aliasse, Quoting, BOM/CRLF, Genre-/Sprach-Normalisierung,
   Defaults; Integrationstest startet echte Läufe aus CSV-Zeilen.
2. **Cooldown zwischen Büchern wird eingehalten** — `DEFAULT_COOLDOWN_MS = 60_000`,
   Warten genau n−1× (nicht nach dem letzten Buch), konfigurierbar (`cooldownMs: 0`
   für Cloud/Remote); Context-Cache wird nach jedem Buch geleert.
3. **failed_jobs.json bei Fehler, Queue läuft weiter** — Unit- + Integrationstests:
   Crash in Lauf 2 stoppt die Queue nicht, Eintrag (Titel, Fehler, Zeitstempel,
   CSV-Zeile) wird sofort kumulativ persistiert, nachfolgende Bücher laufen.

### Verifikation

- `npx vitest run src/services/bulk/` → **29/29 grün** (3 Dateien).
- `npm run typecheck` → 0 Fehler.
- `npx eslint src/services/bulk` → sauber.
- Keine Breaking Changes: neues Modul, keine bestehenden Signaturen geändert.
