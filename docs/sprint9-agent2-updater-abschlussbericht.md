# Sprint 9 – Agent 2: Auto-Updater UI + Doku + Tests — Abschlussbericht

Datum: 2026-09-06 · Agent 2 (Retry) · Branch: Arbeitsbaum (kein Checkout, shared tree)

## Backend-Verifikation (nur gelesen, NICHT angefasst)

`src-tauri/` wurde nicht modifiziert. Verifiziert vorhanden und korrekt verdrahtet:

- `src-tauri/src/updater.rs`: Commands `check_for_updates` (→ `UpdateInfo`
  `{ available, current_version, version, notes, date }`), `download_and_install_update`
  (emittiert `update://progress { downloaded, total }` und `update://installed { version }`,
  danach `app.restart()`), `relaunch_app`.
- `src-tauri/src/main.rs`: `.plugin(tauri_plugin_updater::Builder::new().build())` plus
  alle drei Commands im `invoke_handler` registriert.
- `src-tauri/tauri.conf.json` → `plugins.updater`: `active: true`, öffentlicher
  Minisign-`pubkey`, Endpoint
  `https://github.com/mrmixx-max/ai-writer-studio/releases/latest/download/latest.json`;
  `bundle.createUpdaterArtifacts: true`.
- Feststellung: `@tauri-apps/plugin-updater` ist **nicht** als npm-Paket installiert —
  die UI nutzt daher `invoke()` aus `@tauri-apps/api/core` + `listen()` aus
  `@tauri-apps/api/event`, konsistent mit `GitPanel.tsx` / `executor.ts` /
  `secureBackup.ts`. Kein Private Key im Repo (nur der öffentliche `pubkey`).

## Deliverables

1. **`src/components/Settings/UpdateCheck.tsx` (NEU)** — State-Machine
   `idle → checking → available | up-to-date | error`, `available → downloading → ready | error`;
   Button „Nach Updates suchen“, Statusanzeige (`role="status"`), installierte/neue Version,
   aufklappbare Release-Notes, Fortschrittsbalken (Prozent bei bekanntem Total, KB-Stand sonst),
   Restart-Prompt („Jetzt neu starten“ → `relaunch_app`). Kein Auto-Check beim Mount
   (bestehende Tests bleiben unberührt). Fallback: Bleibt `update://installed` aus, wird nach
   erfolgreichem `invoke` trotzdem `ready` gesetzt.
2. **`src/components/Settings/SettingsPanel.tsx` (minimal additiv)** — nur Import +
   `<section className="update-section" aria-label="App-Updates"><UpdateCheck /></section>`
   nach den Settings-Actions; kein Umbau. Styles additiv in `settings.css`.
3. **`docs/updater.md` (NEU)** — Funktionsweise (Feed, Minisign-Signaturprüfung, Events),
   Key-Rotation mit Übergangs-Release-Warnung, Release-Flow-Checkliste (Version bump →
   Build → Manifest → GitHub-Release mit 3 Assets → Verifikation → Changelog) inkl.
   Fehlerquellen (Tag ohne `v`, fehlende `latest.json`, Versions-Mismatch).
4. **`src/components/Settings/UpdateCheck.test.tsx` (NEU)** — **14 Tests**, alle grün:
   Idle-Render, Checking-Status, Version+Notes+Install-Button, `check_for_updates`-Aufruf,
   Check-Fehler, Download-Start, Fortschritts-Update (50 %), KB-Fallback, `installed`→Ready,
   Ready-Fallback ohne Event, Download-Fehler (Signatur), `relaunch_app`-Aufruf, Retry nach
   Fehler, Ignorieren von Events außerhalb des Downloads.

## Verifikation

- `vitest run src/components/Settings/`: **24/24 grün** (14 neu + 10 SettingsPanel, bestehend).
- `tsc --noEmit`: keine Fehler in eigenen Dateien (verbliebene Fehler z. B. in
  `kdpUploadRetry.test.ts` stammen von parallelen Agenten im Shared Tree).
- `eslint` auf allen drei angefassten TSX-Dateien: sauber.
- Keine Breaking Changes, keine Secrets hinzugefügt.

## Nebenbefund (fremde Datei, minimal repariert)

`src/i18n/locales/de.ts` Zeilen 67–69 waren von einem parallelen Agenten syntaktisch
kaputt hinterlassen worden (ASCII-`"` statt deutschem Schlusszeichen `“` in drei
`keyHint`-Strings) — blockierte `tsc` und alle Settings-Tests. Ausschließlich diese drei
Zeichen repariert, sonst nichts an der Datei geändert.
