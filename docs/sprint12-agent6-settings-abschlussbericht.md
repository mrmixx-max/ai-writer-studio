# Sprint 12 — Agent 6: Settings-Persistenz-Audit — Abschlussbericht

## 1. Gefundene Settings-Stores (Vollinventar)

**Kein zustand-`persist`-Middleware und kein tauri-store-Plugin im Einsatz.**
Persistenz laeuft ueber drei Mechanismen:

| # | Modul | Mechanismus | Key / Tabelle |
|---|-------|-------------|---------------|
| 1 | `services/settings` (AppSettings, Auth-Record) | SQLite `settings`-Tabelle | `app_settings`, `security_auth` |
| 2 | `services/analytics` + `store/analyticsStore` | localStorage, manuelles save/load | `ai-writer-studio.analytics.v1` |
| 3 | `services/printlayout` | localStorage, manuelles save/load | `aiws.printlayout.v1` |
| 4 | `services/sprint` | localStorage, manuelles save/load | **war `sprint_stats` → jetzt `ai-writer-studio.sprint.v1`** |
| 5 | `services/setup/state` | localStorage | `aiws.setup.completed`, `aiws.setup.version` |
| 6 | `i18n` / `highContrast` | localStorage | `app-lang`, `app-contrast` |
| 7 | `plugins/PluginManager` | localStorage | `plugins.enabled` |
| 8 | `plugins/builtin/writing-goal-tracker` | localStorage (injizierbar) | `plugins.writing-goal-tracker` |
| 9 | `services/prompt/store` (Favoriten etc.) | SQLite `writing_prompts` | DB-Tabelle |
| 10 | `store/projectStore` | SQLite via `services/project` | DB-Tabellen |
| 11 | `store/fragmentStore` | SQLite via `services/fragment` (View transient) | DB / RAM |
| 12 | `store/editorStore`, `store/promptStore` | **transient (RAM), per Design** | — |
| 13 | `theme`-Spiegel | localStorage `theme` + SQLite `settings.theme` | bewusst doppelt (Boot-Fast-Path in `App.tsx`) |
| 14 | `MarkdownViewerPanel`, `WordStatsPanel` | localStorage (Draft-Cache, kein Settings-Charakter) | `md-viewer-content`, `editor-text-preview` |

## 2. Echte Luecken + minimale Fixes (jeweils mit Test)

**Fix A — `src/services/sprint/sprint.ts`: generischer Key + fehlende Validierung.**
`sprint_stats` ist unprefixt und kollisionsanfaellig; `loadSprintStats` gab
formfremdes JSON (`"42"`, `{"totalSprints":"x"}`) ungeprueft zurueck; `saveSprintStats`
warf bei vollem/defektem Storage. Fix: namespaced Key `ai-writer-studio.sprint.v1`
mit Legacy-Lesemigration (`sprint_stats` wird gelesen, beim Speichern weggeraeumt),
`isValidStats`-Formpruefung mit Defaults-Fallback, try/catch beim Speichern.

**Fix B — `src/services/prompt/store.ts`: `deletePrompt` ohne `persist()`.**
Alle anderen Mutationen (`savePrompt`, `setFavorite`, `linkToProject`) rufen
`persist()` — nur `deletePrompt` nicht: geloeschte Prompts konnten nach Neustart
wieder auftauchen. Fix: eine Zeile `void persist()` (fire-and-forget, Signatur
bleibt sync — `PromptGenerator.tsx`-onClick unveraendert).

## 3. Neue Tests

`tests/settings-roundtrip.test.ts` — **28 Tests, alle gruen.**
Pro Store: Wert setzen → serialisieren → frische Instanz/neues Lesen →
Ueberleben behaupten. DB-Tests via `__aws_db`-Injektion (frische sql.js-DB pro
Test), localStorage via In-Memory-Stub (node-Env). Fix-Tests (Legacy-Migration,
Formvalidierung, Storage-Throw, deletePersist-Zaehler via `persist`-Mock-Wrapper)
schlagen gegen den Alt-Code fehl, gegen den Neu-Code bestehen sie.
Nachbar-Suites (`analytics`, `sprint`, `export`, `prompt`: 78 Tests) + `tsc --noEmit`
bleiben gruen.

## 4. Bewusst nicht geaendert

- `editorStore`/`promptStore`/Fragment-View: transient per Design (Tabs laufen ueber
  SQLite); Tests sichern Slice-Serialisierbarkeit statt falscher Persistenz.
- `theme`-Doppelablage: kein Defekt — `App.tsx` braucht das Theme vor DB-Start;
  `SettingsPanel` + `WelcomeWizard` schreiben beide Ablagen konsistent.
- Kein zustand-`persist`-Refactoring: haette alle Stores umgebaut (gegen
  Minimal-Diff-Regel); Audit-Test wuerde eine kuenftige Migration absichern.

## 5. Status-Self-Check

- `git status --short`: nur `M src/services/prompt/store.ts`,
  `M src/services/sprint/sprint.ts`, `?? tests/settings-roundtrip.test.ts`,
  `?? docs/sprint12-agent6-settings-abschlussbericht.md`. Kein Branch-Wechsel.
- Cocoa-Rule: keine Shell-Unicode in Befehlen; Diffs minimal (Persist/Load-Pfad only).
