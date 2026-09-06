# Sprint 11 · Agent 1 — Updater-Feed end-to-end (key-agnostisch) · Abschlussbericht

Datum: 2026-09-06 · Main-Branch, keine Checkouts/Branches.

## Ergebnis

- **NEU `scripts/updater-feed.mjs`**: baut `latest.json` aus Release-Infos
  (Version, Notes, Plattform-URLs). Reine, importierbare Funktionen
  (vitest-tauglich) + CLI. Key-agnostisch:
  - Ohne `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_PRIVATE_KEY`: UNSIGNED-Draft
    (`"unsigned": true`, leere Signaturen), gibt exakt
    `Kein Signing-Key gefunden. Key erzeugen mit: tauri signer generate -w`
    aus, Stopp vor Publishing mit **Exit 2**. Erzeugt/loggt niemals Keys.
  - Mit Key: übernimmt nur per `--sig`/`--sigs-json` übergebene Signaturen
    (kein Self-Signing, Key-Wert nie ausgegeben), signierter Feed, Exit 0.
  - Fixture-Modus: `--release-json` (`{tag|tag_name, body|notes, assets[]}`),
    kein Netzwerk, keine Keys nötig.
- **`scripts/release.mjs`**: `--updater-feed` als Opt-in verdrahtet (default AUS;
  Args nach `--` werden an `updater-feed.mjs` durchgereicht) + Hilfeintrag.
- **`docs/updater.md`**: neuer Abschnitt „Feed-Workflow key-agnostisch“ mit
  den drei Befehlen (Draft / Opt-in / mit Key), Stopp-Regel, Fixture-Modus, Testbefehl.
- **Tests `tests/updater-feed.test.ts`**: 18 Tests, alle grün (Fixture-only).
  Zusammen mit `tests/release.test.ts`: 35/35 grün.

## Verifiziert (echte Tool-Outputs)

- `vitest run tests/updater-feed.test.ts` → 18/18 passed.
- CLI ohne Key → Draft + Hint + `exit=2` (unsigned-Flag gesetzt).
- CLI mit Dummy-Key + `--sig` → signierter Feed, `exit=0`, URL-Schema
  `.../releases/download/v1.1.0/AI-Writer-Studio_1.1.0_x64-setup.nsis.zip`.
- `node scripts/release.mjs --help` → `--updater-feed`-Zeile vorhanden;
  `--updater-feed -- --help` reicht an Feed-Skript durch.
- Draft-Artefakte nach Verifikation gelöscht (`release/*.draft|signed.json`).

## Dateien (eigene)

- `scripts/updater-feed.mjs` (neu)
- `tests/updater-feed.test.ts` (neu, 18 Tests)
- `scripts/release.mjs` (M: Help + `--updater-feed`-Branch)
- `docs/updater.md` (M: Feed-Workflow-Abschnitt)
- `docs/sprint11-agent1-updaterfeed-abschlussbericht.md` (diese Datei)

## git-status Self-Check

```
M docs/updater.md
M scripts/release.mjs
?? scripts/updater-feed.mjs
?? tests/updater-feed.test.ts
```
(Hinweis: `git status --short` zeigt zusätzlich Dateien paralleler
Sprint-11-Agenten — HelpPanel, AboutDialog, LektoratPanel, kdpPackage,
lektorat, hooks/, stats.html — die nicht von Agent 1 stammen und
unangetastet blieben. `release.mjs`/`updater.md`-Diffs enthalten nur die
oben beschriebenen Agent-1-Änderungen.)

## Offen / Folgearbeit

- `generate-update-manifest.ps1` bleibt Windows-Pfad; `updater-feed.mjs` ist
  der plattformneutrale Draft-Bauer — Zusammenführung optional.
- Echtes End-to-End-Signieren (`tauri signer sign`) erst auf Release-Rechner/CI
  mit gesetztem Key möglich (bewusst nicht in diesem Task).
