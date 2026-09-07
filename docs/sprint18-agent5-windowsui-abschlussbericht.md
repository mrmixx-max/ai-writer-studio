# Sprint 18 — Agent 5: Windows-Native UI — Abschlussbericht

**Agent:** 5 (Windows-Native UI) · **Datum:** 2026-09-07 · **Status:** ✅ abgeschlossen
**Scope:** `src-tauri/src/main.rs` (Windows-Anteil), `src-tauri/src/windows.rs` (neu),
`src-tauri/tauri.conf.json` (Fenster/Assoziationen), `src-tauri/Cargo.toml` (1 Dep).

## Was geändert wurde (minimaler Diff, kein Verhaltenswandel)

| Datei | Änderung |
|---|---|
| `src-tauri/Cargo.toml` | + `window-vibrancy = "0.6"` (Mica/Acrylic, offizielles Tauri-Ökosystem) |
| `src-tauri/src/windows.rs` (neu) | Mica-Backdrop, DWM-Titelleiste/Ecken, Taskleisten-Commands, Sprunglisten-Command, 7 Unit-Tests |
| `src-tauri/src/main.rs` | `mod windows;`, `apply_chrome()` im Setup, 2 neue Commands registriert, `startup_file()` akzeptiert `.awproject` |
| `src-tauri/tauri.conf.json` | Fenster-`theme`: `null` → `"Dark"`; Dateiassoziation `awproject` zum Projekt-Typ hinzugefügt (Legacy `aiwsproj`/`aiwschapter` bleiben) |

## Windows-11-Look
- **Mica-Backdrop (dunkel)** via `window_vibrancy::apply_mica(window, Some(true))` — nativer Windows-11-Effekt.
- **Dunkle Titelleiste** via `DwmSetWindowAttribute(DWMWA_USE_IMMERSIVE_DARK_MODE = 20)` — direktes dwmapi-FFI aus std, ohne Extra-Dependency.
- **Runde Ecken** via `DWMWA_WINDOW_CORNER_PREFERENCE = 33 / DWMWCP_ROUND = 2` (Windows-11-Stil).
- **Fenster-Schatten** bleibt nativ (DWM, `decorations: true`); `transparent: false` ist Mica-Voraussetzung.
- Alles **additiv mit Fehler-Fallback**: schlägt ein Effekt fehl, wird geloggt und die App läuft mit Standard-Chrome weiter.

## Windows-Spezifika
- **Taskleisten-Fortschritt:** neues Command `set_taskbar_progress(status, progress)` → `window.set_progress_bar` (Tauri-Core). Status: `normal|indeterminate|paused|error|none` (unbekannt → `none`), Progress auf 0–100 geklemmt.
- **Sprungliste:** neues Command `add_recent_document(path)` → `SHAddToRecentDocsW` (shell32-FFI); nur Projektdateien werden eingetragen.
- **Dateiassoziationen:** `.awproject` als kanonischer Alias registriert (Installer/NSIS + `startup_file()`-Erkennung beim Doppelklick/Öffnen-mit).

## Tests (TDD, 7 Tests — Anforderung: 2+)
In `src/windows.rs`, `cargo test`: **7 passed, 0 failed** (3m22s Build, Tests 0.00s).
1. `config_window_dark_theme` — Config valide: Dark-Theme, native Deko, opak.
2. `config_file_association_awproject` — `.awproject` + Legacy-Assoziationen vorhanden.
3. `window_creation_defaults` — Fenstererzeugung: Geometrie, zentriert, sichtbar, kein Fullscreen/AlwaysOnTop.
4. `project_file_detection` — Dateiendungs-Erkennung (inkl. Case-Insensitivität, Negativfälle).
5. `progress_status_mapping` — Taskleisten-Status-Mapping inkl. Fallback.
6. `progress_clamping` — 0–100-Klemmung.
7. `dwm_constants_match_win32_sdk` — DWM-Konstanten gegen Windows-SDK-Werte.

## Verifikation
- `cargo test` (src-tauri): Kompilierung inkl. aller Plugins erfolgreich, 7/7 Tests grün.
- `git status`: eigene Änderungen nur in `src-tauri/{Cargo.toml,src/main.rs,src/windows.rs,tauri.conf.json}`; parallele Frontend-Edits anderer Agenten (`src/App.tsx`, BookWriter/Sidebar-CSS) wurden nicht angerührt.
- Keine Capability-Änderung nötig (Commands laufen Rust-seitig, kein Frontend-Fenster-API-Zugriff).

## Status-Selbstcheck
- [x] main.rs + tauri.conf.json gelesen und verstanden
- [x] Mica/Acrylic, dunkle Titelleiste, runde Ecken, nativer Schatten
- [x] Taskleisten-Fortschritt, Sprungliste, `.awproject`-Assoziation
- [x] Minimaler Diff, keine Verhaltensänderung (nur additive Pfade + Fallbacks)
- [x] 7 Tests (≥ 2), alle grün
- [x] Keine fremden Dateien modifiziert

## Offene Punkte / Hinweise für Folge-Sprints
- Visueller Feinschliff (Mica-Tönung vs. App-Hintergrund) am besten per Screenshot-Review auf echtem Windows 11 prüfen.
- `add_recent_document` kann vom Frontend z. B. bei Projekt-Speichern aufgerufen werden (einzeiliger `invoke`, kein Rust-Umbau nötig).
- `set_taskbar_progress` eignet sich für Export-/KI-Generierungs-Fortschritt (Status `indeterminate` während Streaming).
