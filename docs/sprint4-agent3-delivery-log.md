# Sprint 4 — Agent 3: Asset-Bündelung & Delivery (Log)

## Aufgabe

Release-Paket-Verpackung für AI Writer Studio (BookWriter-Pipeline):

1. **ExportPackager** (`buildReleasePackage`): bündelt alle Assets in ein ZIP-Archiv
   - `/manuscript`: DOCX (Word/Scrivener), EPUB (Jutoh) via bestehendem `exportBook`
   - `/metadata`: `book.json`, `kdp-keywords.json` (genau 7 Keywords, KDP-Limit 50 Zeichen), `blurbs.json` (Kurz/Standard/Amazon-Klappentext) via `generateMarketingAssets`
   - `/marketing`: `midjourney-prompts.json` (3-5 Varianten), `social-teasers.md` (X/Instagram/Facebook)
   - `manifest.json`: maschinenlesbares Archiv-Inventar (formatVersion 1, alle Pfade + Bytegrößen, inkl. selbstreferenzieller Größe — konvergiert deterministisch)
2. **Statistik-Report** `project-report.md` im ZIP: Wörterzahl, Flesch-Reading-Ease
   (deutsch, Amstad-Anpassung via bestehendem `computeReadability`), verwendete
   Modelle, Produktionszeit (Start/Ende/Dauer) — plus maschinenlesbarer JSON-Block.

## Umsetzung

- TDD: Tests zuerst (`releasePackage.test.ts`, 12 Tests) → RED bestätigt
  (Modul fehlte) → Implementierung (`releasePackage.ts`) → GREEN 12/12.
- Reine Komposition bestehender Sprint-3-Services: `exportBook`,
  `generateMarketingAssets`, `generateCoverPrompts`, `computeReadability`,
  `tiptapToText`. Keine LLM-Calls, kein API-Budget verbraucht (0 von 150).
- Keine Breaking Changes: alle bestehenden Interfaces unangetastet, neues Modul
  nur zusätzlich. Einfuhr in `bookwriter/index.ts` bewusst NICHT vorgenommen,
  um Import-Zyklen zu vermeiden — Konsum via direktem Import
  `@/services/bookwriter/releasePackage`.

## Verifikation

- `releasePackage.test.ts`: **12/12 grün** (ZIP-Struktur, manifest-Konsistenz,
  KDP-Keyword-Limits, Klappentexte, MJ-Prompts, Report-Felder, Log-Eintrag).
- `tsc --noEmit`: 0 Fehler in den neuen Dateien; Gesamtdiff der Fehlerzahl
  unverändert gegenüber HEAD (5-8 vorbestehende Fehler in `src/services/cli/*`
  und `export/index.ts` — andere Agents, uncommitted, nicht Sprint-4-Agent-3).
- Volle Suite `vitest run`: 1365/1370 grün; die 5 Fehler in
  `src/services/cli/dashboard|jobRecovery` sind **vorbestehend** — per
  `git stash`-A/B-Lauf identisch fehlgeschlagen OHNE meine Änderungen.
- Log-Eintrag: `logger.info("Release-Paket erstellt: …", "buildReleasePackage")`
  getestet (genau 1 eigener Eintrag pro Paket); dieser Report-File ist der
  persistente Log-Eintrag des Sprints.

## Dateien

- NEU: `src/services/bookwriter/releasePackage.ts` (ExportPackager + Report)
- NEU: `src/services/bookwriter/releasePackage.test.ts` (12 Tests, TDD)

## Bekannte Grenzen

- JSZip bekommt Binary-Assets als `Uint8Array` (Node-Blob-Erkennung von JSZip
  ist unter Vitest unzuverlässig); Browser-Verhalten identisch.
- `manifest.json` führt seine eigene Bytegröße mit (Fixpunkt-Iteration, max. 5
  Schritte, konvergiert in 2-3).
- PDF-Report entfällt bewusst: Task erlaubt „.pdf oder .md" — Markdown wurde
  gewählt (deterministisch, ohne neue Abhängigkeit, im ZIP enthalten).

— Agent 3, Sprint 4, 2026-09-05
