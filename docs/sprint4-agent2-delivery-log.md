# Sprint 4 — Agent 2: VBA-Automatisierung & Word-Integration (Log)

## Aufgabe

Post-Production in Microsoft Word nahtlos machen:

1. **VBA-Macro-Generator**: Service, der passend zum generierten Buch ein
   dediziertes VBA-Skript (.bas) erzeugt — "AI Text Refinement":
   - Harte Zeilenumbrüche bereinigen
   - Typografische Anführungszeichen korrigieren
   - Doppelte Leerzeichen und unsichtbare Artefakte (Zero-Width) entfernen
2. **Style-Mapping**: DOCX-Tags aus Sprint 3 werden im VBA-Makro ausgelesen
   und automatisch in native Word-Formatvorlagen umgewandelt.

## Umsetzung

- TDD: Tests zuerst (`vbaMacro.test.ts`, 12 Tests) → Implementierung
  (`vbaMacro.ts`) → GREEN 12/12.
- `buildAiwsVbaBas(meta, chapters)` erzeugt ein vollständiges VBA-Modul
  (`Attribute VB_Name = "AIWSTextRefinement"`), deterministisch (keine
  Zeitstempel), mit eingebetteten Buch-Konstanten (Titel/Autor/Sprache/
  Kapitelanzahl) und 5 Subs + Orchestrator:
  1. `AIWS_ApplyNativeStyles` — Style-Mapping der Sprint-3-DOCX-Tags:
     Heading1/Heading2 → `wdStyleHeading1/2`, Standard → `wdStyleNormal`,
     StandardEingerückt → `wdStyleBodyText`, Einzug → `wdStyleQuote`
  2. `AIWS_CleanHardLineBreaks` — `^l` → Leerzeichen (Fließtext-Reflow)
  3. `AIWS_FixTypographicQuotes` — alternierende Ersetzung `"` → „…“ (de)
     bzw. „ → “…” (en, sprachabhängig via `AIWS_LANGUAGE`)
  4. `AIWS_RemoveHiddenChapterTags` — entfernt die Sprint-3-U+200B-Kapitel-
     Anker (vba.ts) NACH dem Cleanup ihrer Aufgabe, VOR dem Zero-Width-Clean
  5. `AIWS_CleanSpacesAndZeroWidth` — doppelte Leerzeichen (iterativ),
     Leerzeichen vor Absatzmarke, Zero-Width-Artefakte (U+200B/200C/200D,
     U+2060, BOM U+FEFF, Soft-Hyphen U+00AD)
  - `AIWS_RefineAll` orchestriert 1–5 in dieser Reihenfolge (ScreenUpdating
    aus, Fehlerbehandlung mit MsgBox).
- Keine Breaking Changes: `exportBook` gibt zusätzlich das optionale Feld
  `vbaMacro: { filename, content }` zurück (neues Interface
  `ExportVbaMacroResult` in types.ts); bestehende Felder und Signatur
  unangetastet. Re-Export über `export/index.ts`
  (`buildAiwsVbaBas`, `buildAiwsBasFilename`, `AIWS_VBA_MODULE`).
- Reine Textgenerierung: keine LLM-Calls, 0 von 150 API-Calls verbraucht.
- Integrationstests in `export.test.ts` (2 weitere Tests): Result-Feld,
  Dateinamen-Ableitung, Modulheader, Konstanten, alle 5 Subs.

## Verifikation

- `vbaMacro.test.ts`: **12/12 grün** (Modulstruktur, Metadaten-Konstanten,
  VBA-String-Escaping bei Anführungszeichen im Titel, Determinismus,
  alle 4 Cleanup-Regeln, Style-Mapping, Orchestrator-Reihenfolge:
  Styles → Umbrüche → Anführungszeichen → Tags → Leerzeichen/Zero-Width,
  Dateinamen-Sanitizing).
- `export/`-Suite: **46/46 grün** (6 Dateien inkl. neuer Tests).
- `tsc --noEmit`: 0 Fehler in den neuen/geänderten Dateien.
- Volle Suite `vitest run`: 1365/1370; die 5 Fehler in
  `src/services/cli/*` sind **vorbestehend** (uncommitted WIP anderer
  Agents) — per `git stash`-A/B-Lauf identisch fehlgeschlagen ohne meine
  Änderungen; ohne die cli-WIP-Dateien: 1325/1325 grün.
- Log-Eintrag: `logger.info("Book-Export …, VBA-Makro <filename>",
  "exportBook")` erweitert; dieser Report-File ist der persistente
  Log-Eintrag des Sprints.

## Dateien

- NEU: `src/services/bookwriter/export/vbaMacro.ts` (VBA-Macro-Generator)
- NEU: `src/services/bookwriter/export/vbaMacro.test.ts` (12 Tests, TDD)
- GEÄNDERT: `src/services/bookwriter/export/types.ts`
  (`vbaMacro?` in `ExportBookResult`, neues `ExportVbaMacroResult`)
- GEÄNDERT: `src/services/bookwriter/export/index.ts`
  (VBA-Makro je Export erzeugen + re-exportieren)
- GEÄNDERT: `src/services/bookwriter/export/export.test.ts`
  (2 Integrationstests)

## Bekannte Grenzen

- Das Makro läuft in Word (Windows/Mac, VBA); LibreOffice/Scrivener
  benötigen es nicht — dort sind die Sprint-3-Styles bereits nativ.
- Zero-Width-Cleanup entfernt die versteckten Kapitel-Tags absichtlich —
  sie sind nach dem Refinement verzehrbar; für einen zweiten Durchlauf
  einfach neu exportieren.
- Alternierende Anführungszeichen-Ersetzung setzt wohlgeformte Paare
  voraus (ungerade Zahlen bleiben geradet und werden im ersten
  Durchlauf geöffnet — dokumentiertes Randverhalten).

— Agent 2, Sprint 4, 2026-09-05
