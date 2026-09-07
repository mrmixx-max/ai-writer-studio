# Sprint 14 – Agent 2: Textformatierungs-UI – Abschlussbericht

**Agent:** Agent 2 (Textformatierungs-UI) · **Datum:** 2026-09-07 · **Branch:** main (shared tree, keine Checkouts/Branches)
**Scope:** nur NEUE Dateien unter `src/components/Formatting/` + dieser Bericht. Bestehende Toolbar NICHT modifiziert.

## 1) Editor-Toolbar gelesen (read-only)

- `src/components/Editor/Editor.tsx` (Zeilen 194 ff.): `.editor-toolbar` mit B / I / H1 / H2 / H3 … (TipTap-`chain()`-Commands).
- Keine Datei außerhalb von `src/components/Formatting/` und `docs/` angefasst (`git diff --stat` leer, `git status` zeigt nur untracked Agent-Dateien).

## 2) Neue Dateien

| Datei | Zweck |
|---|---|
| `src/components/Formatting/FormatToolbar.tsx` | Eigenständige Toolbar (`role="toolbar"`, ARIA-Label „Textformatierung"), 4 Buttons: **Smart Quotes**, **Auto-Paragraph**, **Fix Dashes**, **Detect Chapter Headings**. Props: `getText()`, `onApply(actionId, formatted)`, optionale `actions`-Overrides, `serviceLoader`-Seam, `onError`, `disabled`. |
| `src/components/Formatting/FormatToolbar.css` | Eigene Styles (`.format-toolbar`, bewusst separat von `.editor-toolbar`). |
| `src/components/Formatting/index.ts` | Barrel-Export. |
| `src/components/Formatting/FormatToolbar.test.tsx` | **11 Tests** (vitest + jsdom + user-event). |

## 3) Verdrahtung auf den Agent-1-Service

Statischer Import aus `src/services/formatting/textFormat.ts` (Agent 1, zur Laufzeit gelandet — anfangs noch nicht vorhanden, deshalb zuerst dynamischer Loader mit `serviceLoader`-Seam, danach auf statisch umgestellt):

- Smart Quotes → `applySmartQuotes` (de-Default „…")
- Auto-Paragraph → `formatDocument` (absatzweise Normalisierung + Formatierung)
- Fix Dashes → `convertDashes` (–/—)
- Detect Chapter Headings → `findChapterHeadings`; erkannte Zeilen werden als Markdown-Headings markiert (`# …`), Rest unverändert (Adapter `markChapterHeadings`, da der Service strukturierte `HeadingAnnotation[]` liefert, die Toolbar aber Text→Text arbeitet)

Fehlt eine Aktion (weder `actions`-Override noch Default), meldet die Toolbar via `onError(actionId, error)` statt zu crashen.

## 4) Verifikation (echte Tool-Outputs)

- `npx vitest run src/components/Formatting/FormatToolbar.test.tsx` → **11 passed** (4× Button→Service→onApply, Render-/ARIA-Tests, `disabled`, 2× `onError`-Degradation, 2× Integration gegen den echten Agent-1-Service).
- `npx tsc --noEmit` → **0 Fehler**.
- `npx eslint src/components/Formatting/` → **clean**.
- Bestehende Editor-Toolbar unverändert (kein Diff in tracked Dateien).

## 5) Status-Selbstcheck

- [x] Toolbar read-only analysiert, nichts Bestehendes geändert
- [x] `FormatToolbar.tsx` neu, 4 Buttons, ruft Agent-1-Service auf
- [x] `FormatToolbar.test.tsx` neu, 11 Tests (≥ 6 gefordert), alle grün
- [x] Typecheck + Lint grün
- [x] Bericht + Selbstcheck vorliegend
- **Offen / Hinweis an Integration:** Die Toolbar ist standalone und noch nirgends eingebunden (bewusst — Einbindung in Editor-Host ist Folgearbeit außerhalb dieses Scopes). `disabled`-Prop ist für Hosts vorgesehen, die die Toolbar während KI-Operationen sperren wollen.
