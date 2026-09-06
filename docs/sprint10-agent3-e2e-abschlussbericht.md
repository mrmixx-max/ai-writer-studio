# Sprint 10 · Agent 3 — E2E-Abschlussbericht: Critical Flows

**Scope:** nur `e2e/` (3 neue Spec-Dateien, 8 Specs). Kein App-Code geändert.
**Harness:** Playwright gegen Vite-Dev-Server (Web-only, In-Memory-SQLite),
headless Chromium, gemocktes Netzwerk, 0 echte Ollama-Calls.
**Ergebnis: 8/8 grün** (`npx playwright test e2e/offline-boot.spec.ts
e2e/book-flow-critical.spec.ts e2e/settings-roundtrip.spec.ts` → `8 passed`).

## Neue Specs

### `e2e/offline-boot.spec.ts` (2 Specs)
1. **Bootet mit unerreichbarem Ollama: Haupt-UI steht, kein ErrorBoundary** —
   alle Provider-Calls abgebrochen, Header/Sidebar/KI-Panel sichtbar,
   keine unbehandelten `pageerror`s.
2. **Buchgenerierung ohne Ollama zeigt Fehler-UI, App bleibt bedienbar** —
   nur `/api/chat` abgebrochen → `.bw-error` mit `Fehler:`, kein
   ErrorBoundary, Sidebar + KI-Panel intakt.

### `e2e/book-flow-critical.spec.ts` (3 Specs, Mock aus `e2e/mock-ollama.ts`)
3. **Outline-Stufe: Gliederung mit 3 Kapiteln und Mock-Titeln** —
   `Gliederung erstellt: 3 Kapitel`, 3× `.bw-chapter`, alle drei Mock-Titel.
4. **Kapitel-Stufe: Texte im B3-Fenster, Wortzähler je Kapitel** —
   Volltext pro Kapitel ≥ 700 Wörter, `bw-words-N`-Badge `… / 2.000 Wörter`.
5. **Export-Stub: DOCX-Download nach Kapitel-anlegen** — `Kapitel anlegen (3)`
   → Planer-Tab → Format `docx` → Download `*.docx` + `Export fertig`
   (ergänzt den bestehenden Markdown-Flow in `book-complete-flow.spec.ts`).

### `e2e/settings-roundtrip.spec.ts` (3 Specs)
6. **Modellwechsel: speichern, DB-Roundtrip, Modal-Reopen** — Modell-Input
   füllen → Speichern (dirty-Flag gelöscht) → Wert per `window.__aws_db`
   in der App-DB verifiziert → Modal schließen/öffnen → Wert persistent.
7. **Temperatur + MaxTokens: speichern, DB-Roundtrip, Modal-Reopen** —
   `0.3` / `4096`, gleiche Nachweiskette.
8. **Theme-Roundtrip: Wechsel übersteht Reload (localStorage)** — `light`
   wählen → speichern → `data-theme="light"` → echter `page.reload()` →
   weiterhin `light`.

## Befunde (relevant für andere Agenten / CI)

1. **Pfad-Glob `**/api/**` zerstört den App-Boot.** Der Vite-Dev-Server
   serviert eigene Module unter `/src/plugins/api/*.ts`; ein Abort auf
   `**/api/**` bricht diese mit `ERR_CONNECTION_REFUSED` ab → leere Seite
   (nachgewiesen per Probe: `BODY_LEN=15`, 3 failed Modul-Requests).
   Alle neuen Specs matchen deshalb **host-basiert per URL-Prädikat**
   (localhost/127.0.0.1 außer Dev-Port 1420), niemals per Pfad-Glob.
   Hinweis: `e2e/error-recovery.spec.ts` nutzt noch `page.route("**/api/**",
   abort)` — dort dasselbe Risiko.
2. **E2E-Suite ist sprachen-fragil.** `detectLanguage()` (src/i18n) fällt ohne
   `localStorage("app-lang")` auf die Browsersprache zurück (Chromium-Default
   en-US → englische UI), alle bestehenden Helper/Specs erwarten aber Deutsch
   (`+ Projekt`, `Buch generieren`, …). Nachweis: `e2e/project.spec.ts`
   scheitert auf diesem Rechner aus genau diesem Grund (pre-existing, nicht
   von Agent 3 verursacht). Alle neuen Specs pinnen daher `app-lang=de` per
   `addInitScript` — sie sind **locale-unabhängig und damit CI-sicher**.
3. **SQLite-Settings überleben keinen Reload im Web-Harness**
   (In-Memory ohne Tauri, siehe `src/services/db/index.ts`). Deshalb:
   Modell/Temperatur/MaxTokens → DB-Assert + Modal-Reopen;
   Theme (zusätzlich in localStorage) → echter Reload.

## Verifikation
- `npx playwright test e2e/offline-boot.spec.ts e2e/book-flow-critical.spec.ts
  e2e/settings-roundtrip.spec.ts` → **8 passed** (31,6 s, 8 Worker).
- `npx tsc --noEmit` → ohne neue Fehler (siehe CI-Log).
- Geändert/hinzugefügt: nur `e2e/offline-boot.spec.ts`,
  `e2e/book-flow-critical.spec.ts`, `e2e/settings-roundtrip.spec.ts`
  (+ dieser Bericht). Temporäre Debug-Probe (`e2e/zz-probe.spec.ts`) wieder
  entfernt.

## Offen / Empfehlung
- `e2e/error-recovery.spec.ts`: `**/api/**`-Abort durch Host-Prädikat
  ersetzen (Befund 1) — ein Eingriff in eine fremde Spec-Datei, daher
  bewusst nicht von Agent 3 gemacht.
- Suite-weit `app-lang=de` in `e2e/helpers.ts#gotoApp` pinnen (Befund 2) —
  betrifft geteilte Datei im Parallel-Sprint, ebenfalls offengelassen.
