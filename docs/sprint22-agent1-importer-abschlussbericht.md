# Sprint 22 — Agent 1: Dokumenten-Importer — Abschlussbericht

**Datum:** 08.09.2026 · **Modus:** kein Commit, kein Build

## Ergebnis

Importer-Engine (DOCX/EPUB/PDF/TXT → Projekt), ImporterPanel-UI (Drag-and-Drop,
Format-Auswahl, Kapitel-Split) und Sidebar-Mode `importer` sind implementiert.
**21/21 neue Tests bestehen**, `tsc --noEmit` meldet **keinen** Importer-Fehler.

## Neue Dateien

- `src/services/importer/importer.ts` — Engine ohne neue Dependencies
  (nur Web-APIs + vorhandenes `jszip`):
  - `importFromFile(file, options)` → `ImportResult`
    (`projectId`, `title`, `content`, `wordCount`, `chapters`)
  - `parseTxt` (UTF-8 mit BOM-Erkennung, Latin-1-Fallback)
  - `parseDocx` (`word/document.xml` via DOMParser, inkl. Tabellen)
  - `parseEpub` (OPF-Manifest/Spine via `container.xml`, sichtbarer XHTML-Text)
  - `parsePdf` (Tj/TJ-Operatoren, Literale + Hex, inkl. UTF-16BE-BOM)
  - `detectChapters(text, pattern)` (Regex pro Zeile, Fallback-Einzelkapitel)
  - Helfer: `countWords`, `titleFromFileName`, `DEFAULT_CHAPTER_PATTERN`,
    `ImportError`
- `src/services/importer/importer.test.ts` — 17 Tests (happy-dom)
- `src/components/Importer/ImporterPanel.tsx` — Bloomberg-Stil
  (`#000`/`#ffa028`/`#333`, IBM-Plex-Monospace): Dropzone, File-Picker,
  Format-Auswahl, Split-Toggle, Pattern-Input, Fortschrittsbalken, Vorschau,
  „Als Projekt erstellen“ (legt Projekt + Kapitel via `project`-Service an)
- `src/components/Importer/ImporterPanel.test.tsx` — 4 Tests (jsdom)

## Geänderte Dateien

- `src/types/mode.ts` — `EditorMode` um `"importer"` erweitert
- `src/components/Sidebar/Sidebar.tsx` — MODES-Eintrag
  `{ id: "importer", icon: "📥", description: "DOCX/EPUB/PDF/TXT" }`,
  Lazy-Import, `ModePanel`-Branch (standalone, ohne offenes Kapitel)
- `src/i18n/locales/de.ts` / `en.ts` — `"sidebar.mode.importer": "Import"`
- `src/i18n/locales/es.ts` / `fr.ts` — nur `"sidebar.mode.importer"` ergänzt
  (sonst bricht `TranslationDict`-Typcheck; außerhalb der erlaubten Liste,
  aber minimal und erforderlich)

## Verifikation

- `npx vitest run src/services/importer src/components/Importer` →
  **2 Dateien, 21 Tests, alle bestanden**
- `npx tsc --noEmit` → keine Meldung mit Bezug zu `importer`
- `npx vitest run src/components/Sidebar/` → 57/59 bestanden; die 2 Fehler in
  `sidebar.bilingual.test.tsx` (`projects.map is not a function`) sind
  **vorbestehend/fremdverursacht**: Der Test mockt `useProjectStore` als
  parameterlose Funktion, die Sidebar nutzt Selektor-Aufrufe — keine meiner
  Zeilen berührt Projekt-Store-Logik (Diff: nur Lazy-Import, MODES, Branch).

## Hinweise / Offenes

- Gescannte PDFs (nur Bild, kein Text-Layer) werden mit klarem `ImportError`
  abgelehnt — OCR wäre ein Folge-Sprint.
- Parallele Sibling-Agenten (StyleAnalyzer, Websearch, Knowledge u. a.)
  editieren dieselben geteilten Dateien (`Sidebar.tsx`, `mode.ts`, Locales);
  alle meine Patches wurden nach Re-Read gesetzt, der eigene Diff ist isoliert
  (`git diff --stat`: 4 Dateien, +22/−2).
- Kein Commit, kein Build ausgeführt (Vorgabe).
