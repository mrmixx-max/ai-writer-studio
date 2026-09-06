# Sprint 12, Agent 7 — Release-Readiness v1.1.0 (Abschlussbericht)

Stand: 2026-09-06. Auftrag: Doku-Releasefähigkeit + Dry-Runs. **Kein Produktcode
angerührt, keine Version erhöht, nichts committet, nichts publiziert.**

## 1) Gelesen

- `docs/CHANGELOG.md` (generiert, Stand v1.0.0), `CHANGELOG.md` (Root,
  Keep-a-Changelog, [Unreleased]-Sektion vorhanden), `docs/README.md` (Index),
  `docs/release.md`, `scripts/release.mjs --help` (+ `--check`, `--bump`,
  `release-notes.mjs --help`).

## 2) Audit: toter-Link-Check als Skript (neu)

- **Neu `scripts/check-docs.mjs`** (lesend, Exit 1 bei Fund): prüft
  Index-Backtick-Refs auf Existenz, alle `[x](ziel)`-Dateilinks in `docs/*.md`
  (md/Bilder/pdf) sowie dateilokale `#anker` gegen Überschriften (GitHub-Slug).
  Externe URLs und reine CLI-Beispiele (z. B. `NOTES.md` in `updater.md:71`,
  kein Link) werden ignoriert.
- **Befund:** keine toten Dateilinks, keine toten Anker, **keine
  Screenshots/Diagramme referenziert** (keine `![]()`-Bildlinks in `docs/`;
  keine fehlenden Assets). Lücke war der **Index**: 18 Dateien nicht verlinkt
  (`handbuch.md`, `plugins.md`, `updater.md`, Sprint-9-Agenten 2+5, alle
  Sprint-10/11-Berichte).
- **Behoben:** `docs/README.md` ergänzt (Guides, fehlende Sprint-9-Berichte,
  Sprint 10/11 komplett, Sprint-12-Berichte inkl. fremder Agenten 2+4,
  `CHANGELOG-unreleased.md`).

## 3) Entwurf `docs/CHANGELOG-unreleased.md` (neu)

- Kuratiert aus `git log` (Sprints 8–11; Sprint 12 läuft noch), Anwendersprache,
  Deutsch, Zielversion v1.1.0. Weder `CHANGELOG.md` noch `docs/CHANGELOG.md`
  angefasst. Beim Release per `node scripts/release.mjs --changelog`
  überführbar.

## 4) Pipeline-Dry-Runs (nur lesend)

| Befehl | Ergebnis |
|---|---|
| `node scripts/release.mjs --check` | ✓ synchron auf 1.0.0 (package.json/tauri.conf.json/Cargo.toml) |
| `node scripts/release.mjs --bump minor --dry-run` | ✓ `(dry-run) 1.0.0 → 1.1.0`, nichts geschrieben (per `git status` belegt) |
| `node scripts/release-notes.mjs` (stdout) | ✓ Notes seit v0.1.0 korrekt gerendert |
| `node scripts/check-docs.mjs` | ✓ grün (53 Dateien, 0 Probleme) |

`--changelog` wurde bewusst **nicht** ausgeführt (schreibt `docs/CHANGELOG.md`).

## 5) Tests & Status-Selbstcheck

- **Neu `tests/check-docs.test.ts`** (7 Tests: Slugger, Link-/Index-Parser,
  Repo-Audit grün, CLI Exit 0). Zusammen mit `tests/release.test.ts`:
  **24/24 grün**.
- `git status`: eigene Änderungen nur **Docs + Skript + Test**
  (`docs/README.md`, `docs/CHANGELOG-unreleased.md`, dieser Bericht,
  `scripts/check-docs.mjs`, `tests/check-docs.test.ts`); daneben nur fremde
  Sprint-12-Arbeit (TTS/Whisper/Backup) — nichts davon angefasst.
- Kein Commit, kein Bump, kein Publish. Release-Readiness Doku: **bereit**.
