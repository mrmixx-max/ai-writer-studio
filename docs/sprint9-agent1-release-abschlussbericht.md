# Sprint 9 — Agent 1: Release-Automatisierung (Abschlussbericht)

Branch: `sprint9/agent1-release` · Datum: 2026-09-06

## Ergebnis

Installer-Build per Knopfdruck ist reproduzierbar dokumentiert, Version-Bump,
Changelog, Release-Notes und SHA256 laufen über `npm run`-Skripte.
17/17 neue Tests grün. Keine Breaking Changes (bestehende `release`-Pipeline
unverändert; nur neue CLI-Flags und neue Skripte).

## Geändert / erstellt (nur eigene Dateien + package.json-Scripts + docs/)

| Datei | Art |
|---|---|
| `scripts/release-lib.mjs` | NEU: reine Logik (parse/bump/check/apply Version, Commit-Gruppierung, Changelog-/Notes-Rendering, SHA256) |
| `scripts/release.mjs` | ERWEITERT: `--check`, `--bump <major\|minor\|patch\|x.y.z> [--dry-run]`, `--changelog`, `--sha256 <datei…>`, `--help`; Default-Pipeline unverändert |
| `scripts/release-notes.mjs` | NEU: `npm run release:notes` — Notes aus Commits seit letztem Tag (`--range`, `--out`) |
| `tests/release.test.ts` | NEU: 17 vitest-Tests (Konvention: `tests/*.test.ts` per vitest.config.ts) |
| `package.json` | +3 Scripts: `release:notes`, `release:check`, `release:changelog` |
| `docs/CHANGELOG.md` | NEU: generiert (147 Commits seit v0.1.0) |
| `docs/release.md` | NEU: Voraussetzungen, Schritte, Troubleshooting für `build-windows.ps1` (Skript selbst NICHT umgebaut) |

## Verifiziert

- `npm run release:check` → alle drei Quellen synchron auf 1.0.0
- `--bump patch --dry-run` → 1.0.0 → 1.0.1, 4 Dateien (dry-run ändert nichts)
- `npm run release:notes` → gruppierte Notes seit v0.1.0
- `npx vitest run tests/release.test.ts` → 17/17 grün
- `node scripts/release.mjs --changelog` → `docs/CHANGELOG.md` erzeugt

## Offen / Hinweise an andere Agenten

- `build-windows.ps1` unangetastet — wer Installer-Logik ändert, bitte `docs/release.md` mitziehen.
- Version-Sync umfasst zusätzlich `src/version.ts` (wie `sync-version.ps1`); `release.config.psd1` (`AppVersion`) bleibt PowerShell-Seite und ist bewusst nicht angetastet.
- SHA256-Format: `<hash>  <dateiname>` (sha256sum-kompatibel).
