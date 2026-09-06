# Sprint 10 Agent 4 — Abschlussbericht: Benutzerhandbuch + In-App-Hilfe (Retry)

> Retry: Der erste Versuch meldete „completed", legte aber keine Dateien ab.
> Dieser Lauf hat alle vier Deliverables physisch erstellt und verifiziert.

## Deliverables (alle auf Disk, verifiziert per `git status --short`)

| # | Pfad | Inhalt |
|---|---|---|
| 1 | `docs/handbuch.md` | Deutsches Benutzerhandbuch (11 Kapitel: Installation, Ollama + `OLLAMA_ORIGINS`, Schreib-Workflows, BookWriter, KDP-Export, Export ▾, Modell-Manager, Updater, Einstellungen, Troubleshooting, HelpPanel) |
| 2 | `src/components/Help/helpIndex.ts` | 10 DE-Hilfeeinträge + EN-Fallback, `searchHelp()`, `getHelpEntry()`, `helpTitle()`/`helpBody()`, `HELP_IDS` |
| 3 | `src/components/Help/HelpPanel.tsx` | Standalone suchbares Overlay (Suche, Trefferzähler, aufklappbare Einträge, ✕-Close); ändert keine bestehenden Panels |
| 4 | `src/components/Help/helpIndex.test.ts` | 9 Tests (2 describes: Vollständigkeit + Suche/Fallback) |

Zusätzlich dieser Report: `docs/sprint10-agent4-handbuch-abschlussbericht.md`.

## UI-Label-Verifikation (grep, keine erfundenen Namen)

- Einstellungen: `SettingsPanel.tsx` — „Einstellungen", „Anbieter", „Felder", „Verbindung testen"/„Teste…", „aktiv", „Modell", „Temperatur", „Max Tokens", „System-Prompt", „Speichern"/„Speichern •", „Änderungen verwerfen".
- Modell-Manager: `ModelManager.tsx` — „Modelle (lokal)", „Aktualisieren"/„lädt…", „Keine Modelle installiert.", „Modell laden", Placeholder „z. B. llama3.2, qwen2.5:7b", „Laden"/„lädt…", „Abbrechen", „Löschen"/„wird gelöscht…".
- Updater: `UpdateCheck.tsx` — „App-Updates", „Nach Updates suchen", „Update installieren", „Erneut prüfen", „Jetzt neu starten"/„Starte neu …", Status-Texte, „Release-Notes", „Installiert: …".
- Export: `ExportBar.tsx` — „Export ▾", „Format" (DOCX/MD/TXT/PDF/EPUB), „Bereich" („Ganzes Projekt"/„Aktuelles Kapitel"), Preflight nur bei DOCX/PDF/EPUB.
- KDP: `KdpChecklistPanel.tsx` — „KDP-Checkliste", „↻" („Neu laden"), „KDP-Paket exportieren"/„Export läuft…", „Enthält DOCX, PDF, EPUB, Cover und kdp-metadata.json in einem Ordner."; `KdpPreUploadChecklist.tsx` — alle 6 Checklisten-Labels inkl. „Preis gesetzt (0,99–200 USD)" und „ISBN (optional — KDP vergibt eigene)".
- BookWriter: `BookWriterDashboard.tsx` — „📖 BookWriter", „▶ Fortsetzen", „Später"; `BookWriterPanel.tsx` — STATUS_LABELS („Geplant", „Generierung läuft", „Entwurf", „Überarbeitung nötig", „Abgeschlossen").
- Sidebar: `Sidebar.tsx` — `mode-switcher`, Tabs „Projekte"/„Prompts".
- CORS: `ollamaCors.ts` (403-Meldung mit `OLLAMA_ORIGINS="…" ollama serve`), `localModelProfiles.ts` (`OLLAMA_CORS_ORIGINS`: `tauri://localhost`, `http://tauri.localhost`, `http://localhost:5173`), `healthMonitor.ts` (🟡→„OLLAMA_ORIGINS setzen"), `docker-compose.yml`-Beispiel.

## Verifikation

- `npx vitest run src/components/Help/helpIndex.test.ts` → **1 File, 9/9 Tests grün**.
- `npx tsc --noEmit` → **keine Fehler in Help-Dateien**; einziger Repo-Fehler liegt in fremder Datei `src/services/export/exportValidate.test.ts` (TS6133 `tipTap` unused — paralleler Export-Agent, nicht angefasst).
- Bestehende Panels unverändert (nur NEUE Dateien unter `src/components/Help/`).

## Kollisionen / Offenes

- Keine: nur eigene 4 Pfade angelegt, kein `git checkout/branch`, keine fremden Dateien modifiziert.
- Optional/Follow-up: `HelpPanel` in App-Shell einbinden (Overlay-Button) + `helpIndex`-Einträge bei UI-Umbenennungen pflegen; ungenutzter `tipTap`-Import im fremden Export-Test gehört dem Export-Agent.
