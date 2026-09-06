# Release & Windows-Installer — Anleitung

> `scripts/build-windows.ps1` wird hier **nur dokumentiert, nicht umgebaut**
> (Sprint 9, Agent 1). Neue Node-Release-Helfer: `scripts/release.mjs`,
> `scripts/release-notes.mjs`, Logik in `scripts/release-lib.mjs`.

## 1. Voraussetzungen

| Werkzeug | Mindestversion | Prüfung im Skript |
|---|---|---|
| Node.js + npm | Node 20 | `Test-Tool 'node'` / `'npm'` |
| Rust (`cargo`) | 1.77 | `Test-Tool 'cargo'` (+ Versionsvergleich) |
| Python (optional) | — | nur für Icon-Erzeugung |
| Inno Setup (`iscc`) | — | nur mit `-CreateInstaller` nötig |

Versionsquelle: `scripts/release.config.psd1` (`AppVersion`), verteilt per
`scripts/sync-version.ps1` auf `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src/version.ts`. Node-Gegenstück:
`npm run release:check`.

## 2. Standard-Releases (Knopfdruck)

```powershell
# 1) Versionen prüfen + Changelog + Notes
npm run release:check
npm run release:changelog
npm run release:notes -- --out RELEASE_NOTES.md

# 2) Version erhöhen (schreibt package.json, tauri.conf.json, Cargo.toml, src/version.ts)
node scripts/release.mjs --bump patch --dry-run   # erst Probe …
node scripts/release.mjs --bump patch             # … dann echt

# 3) Windows-Build + Installer (DAS ist der "Knopfdruck")
.\scripts\build-windows.ps1 -CreateInstaller

# 4) Alles (signieren + portable ZIP + Updater-Feed)
.\scripts\build-windows.ps1 -CreateInstaller -Sign -Portable -UpdateArtifacts
```

`build-windows.ps1`-Phasen: alte App-Prozesse beenden → Werkzeuge prüfen →
Version abgleichen → Typecheck/Lint/Tests → Icons → Vite-Frontend →
Tauri-Release → (optional) Installer, Signatur, Portable, Updater-Feed.
Jeder Fehler bricht ab — es gibt nie ein halbfertiges Artefakt als „Erfolg".

Weitere Schalter: `-SkipTests` (nur Zwischenbuilds), `-SkipIcons`,
`-Version x.y.z` (überschreibt Config), `-Sign` (Authenticode, Zertifikat
oder Warnung), `-Portable`, `-UpdateArtifacts` (braucht Tauri-Signaturschlüssel
unter `$HOME\.tauri\ai-writer-studio.key`).

Artefakte landen in `release/` (ZIP) bzw. `installer/` (Setup-EXE).
SHA256 für ein Artefakt: `node scripts/release.mjs --sha256 release\<datei>.zip`
→ `<datei>.zip.sha256` im `sha256sum`-kompatiblen Format.

## 3. Troubleshooting

| Symptom | Ursache / Abhilfe |
|---|---|
| `npm wurde nicht gefunden` / `cargo` fehlt | Node 20+ bzw. Rust 1.77+ installieren, neues Terminal öffnen |
| `iscc` nicht gefunden | Inno Setup 6 installieren und `iscc` in PATH legen (nur bei `-CreateInstaller`) |
| Versionen weichen ab (`sync-version -Check` / `release:check` rot) | `.\scripts\sync-version.ps1` bzw. `node scripts/release.mjs --bump <x.y.z>` laufen lassen |
| Typecheck/Lint/Tests rot | Build bricht bewusst ab — erst `npm run verify` grün bekommen; Notlösung nur für Zwischenbuilds: `-SkipTests` |
| Signierung warnt „ohne Signatur" | Kein Zertifikat konfiguriert (`release.config.psd1 → Signing`); Build läuft unsigniert weiter |
| Updater-Feed schlägt fehl | Tauri-Signaturschlüssel fehlt (`$HOME\.tauri\ai-writer-studio.key` erzeugen: `npx tauri signer generate -w …`) |
| Erster Tauri-Build dauert „ewig" | Normal — Rust kompiliert beim ersten Mal mehrere Minuten |
| Alte App blockiert Dateien | Skript beendet laufende Prozesse selbst; bei hartnäckiger Sperre App manuell schließen und erneut starten |
