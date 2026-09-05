# Sprint 6 — Agent 1: Telemetrie & Token-Analytics (Delivery-Log)

## Aufgabe

Transparenz über Kosten und Laufzeiten der Bookwriter-Generierung (AI Writer
Studio v1.4.0-Sprint 6, TDD-Pflicht, keine Breaking Changes):

1. **Analytics-Dashboard**: CLI `stats`-Befehl — historische Daten aus der
   Datenbank auswerten.
2. **Kosten-Rechner**: API-Kosten für OpenRouter-Calls anhand Token-Zahlen vs.
   Ersparnis durch lokales Routing.
3. **Zeit-Pro-Buch-Metrik**: durchschnittliche Generierungszeit pro Buch,
   separiert nach lokal/Cloud.

## Umsetzung

### 1. Kosten-Rechner — `src/services/cli/costCalculator.ts` (neu)

- `callCostUsd(meta)`: reale Kosten eines Router-Calls in USD =
  `tokens_est / 1e6 × priceFor(model)`. Lokale Provider (ollama, lmstudio,
  local, mock) kosten 0.
- Preisliste `MODEL_PRICES` (USD/1M Tokens, konservativ geschätzt):
  deepseek-chat 0.5, deepseek-r1 1.0, gpt-4o-mini 1.0, claude-3.5-haiku 1.5,
  llama-3.1-8b 0.1; unbekannte Modelle → `DEFAULT_CLOUD_PRICE_PER_M` (1.5).
- `counterfactualCloudCostUsd(meta)`: potenzielle Cloud-Kosten eines
  Token-Umfangs zum Default-Preis — Basis der Ersparnis-Rechnung.
- `computeCostReport(calls)`: Totals (Tokens gesamt/lokal/cloud, reale
  Cloud-Kosten, potenzielle Cloud-Kosten, **Ersparnis = potenziell − real**,
  Latenzsumme). Pure Funktion, keine DB-/Netz-Abhängigkeit.

### 2. Analytics-Aggregation — `src/services/cli/stats.ts` (neu)

- `collectStats()`: liest alle `bookwriter_jobs` (+ `telemetry_json`, Migration
  020) aus der DB und aggregiert: Job-Historie, Token-/Kosten-Totals,
  Provider-Verteilung (Calls, Tokens, ø Latenz, Fallbacks, Fehler) und die
  Zeit-Pro-Buch-Metrik.
- `computeJobStats(input)`: pro-Job-Statistik (pure): Dauer =
  `updated_at − created_at`, Bucket `local`/`cloud` (cloud, sobald mind. ein
  Cloud-Call in der Telemetrie liegt), Tokens, reale Cloud-Kosten.
- Zeit-Pro-Buch: `timePerBook.local` / `timePerBook.cloud` mit
  Job-Anzahl, ø Wandlungszeit pro Buch (`avgDurationMs`), ø Call-Latenz und
  Token-Summe.
- `renderStats(report)`: textuelles Dashboard (Übersicht, Zeit-pro-Buch-Buckets,
  Kosten + Ersparnis, Provider-Verteilung, Job-Historie); graceful
  „Keine historischen Daten" bei leerem Bestand.

### 3. CLI-Befehl — `src/services/cli/statsCommand.ts` (neu) + `cli.ts` (Patch)

- `npm run cli -- --stats` (bzw. `node dist/cli.js --stats`): druckt die
  historische Token-Analytics statt des Live-Dashboard-Loops. `main()` kehrt
  danach zurück (kein readline-Loop).
- `parseStatsArg(argv)` + `runStatsCommand()`: dünner Adapter; Log-Eintrag
  (`logger.info`, context `cli/stats`) mit Job-/Token-/Kosten-/Ersparnis-Zahlen.

## Tests (TDD, erst zuerst geschrieben)

- `src/services/cli/stats.test.ts` (12 Tests): Kosten pro Call (Cloud real,
  lokal 0), Counterfactual, `computeCostReport` inkl. leeren Call-Sets,
  Bucket-Zuordnung lokal/cloud, Mittelwerte über mehrere Jobs, DB-Aggregation
  über mehrere Jobs, robust gegen Jobs ohne Telemetrie, Rendering
  (inkl. leerer Bestand).
- `src/services/cli/statsCommand.test.ts` (5 Tests): Flag-Parsing, Statistik-
  Druck aus befüllter DB, Log-Eintrag (`cli/stats`).

## Verifikation

- `npx vitest run src/services/cli/stats.test.ts src/services/cli/statsCommand.test.ts`
  → 17/17 grün.
- Regression: `npx vitest run src/services/cli src/services/bookwriter/telemetry.test.ts src/services/bookwriter/jobs.test.ts`
  → 8 Dateien, 85/85 grün (keine Breaking Changes an cli/dashboard/hitl/jobs/
  telemetry).
- `npm run typecheck` → meine Dateien fehlerfrei; verbleibende Fehler stammen
  aus fremdem, ungetracktem WIP (`src/services/logging/` anderer Agent) und
  `src/services/bookwriter/progress.test.ts` — vorab vorhanden.
- `npx eslint` auf allen neuen/veränderten Dateien → 0 Befunde.
- Full-Suite-Lauf gestartet (Ergebnis im Session-Log).

## Schnittstellen (additiv, keine Breaking Changes)

- Neu: `src/services/cli/costCalculator.ts`, `src/services/cli/stats.ts`,
  `src/services/cli/statsCommand.ts` (+ Tests).
- Geändert: `src/services/cli/cli.ts` — `main()` respektiert neu `--stats`
  (Frühausstieg vor Health-Check/Recovery/Dashboard-Loop); Standardpfad
  unverändert.
- Keine DB-Migration nötig: Auswertung liest bestehende Tabellen
  (`bookwriter_jobs`, `telemetry_json` aus Migration 020).
- Keine API-Calls (lokale Preisliste statt Live-OpenRouter-Abfrage) —
  Budget von max 150 API-Calls unberührt.

## Review-Nachtrag (Fix nach Real-Run)

Der Abnahmelauf außerhalb von Vitest deckte einen Bug in der ursprünglichen
Lieferung auf: `--stats` warf „DB nicht initialisiert – initDb() zuerst
aufrufen.", weil `main()` den Befehl ausführte, bevor überhaupt eine DB
existierte (die App-DB wird nur im Tauri-Webview via `initDb()` geladen).

- **Fix (`statsCommand.ts`)**: `ensureStatsDb()` lädt die bestehende App-DB
  (`%APPDATA%\com.aiwriterstudio.app\user_data\app.db`) selbst, wendet die
  Migrationen an und stellt sie als `__aws_db` bereit — bewusst **nur
  lesend** (kein `persist()`, die Datei bleibt unangetastet). Ohne Datei
  (frische Installation) → leere, migrierte In-Memory-DB → graceful
  „Keine historischen Daten". `runStatsCommand()` ist jetzt async,
  `cli.ts` awaited.
- **Bundler-Fallstrick**: `await import("node:fs")` scheitert im
  esbuild-ESM-Bundle („Dynamic require" im sql.js-WASM-Init); gelöst via
  `createRequire(import.meta.url)`.
- **Tests**: 5 neue (Pfad-Bau `defaultAppDbPath`, No-op bei injizierter DB,
  Fallback ohne Datei mit Migrations-Check, nur-lesendes Lesen einer
  realen DB-Datei, async Druck) → 22/22 in stats.test.ts +
  statsCommand.test.ts; src/services/cli gesamt 91/91 grün; eslint clean.
- **E2E-Nachweis** (`scripts/seed-stats-e2e.mjs`, esbuild-Inline-Bundle):
  App-DB mit 3 abgeschlossenen Jobs (2 lokal ollama, 1 Cloud openrouter)
  → Dashboard zeigt Historie, Zeit pro Buch (Lokal ø 22.5 min, Cloud
  ø 7.0 min), Cloud-Kosten $0.0210, Ersparnis $0.1230, Provider-Verteilung.
- **Hinweis**: die Produktions-DB (Stand Sep 3) stammt aus der Zeit vor
  Sprint 4 (enthält `bookwriter_runs`, aber noch keine `bookwriter_jobs`)
  → dort rendert `--stats` korrekt „Keine historischen Daten".