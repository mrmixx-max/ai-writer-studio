# Sprint 10 — Agent 2 Export-Härtung (Abschlussbericht)

## Ergebnis
Export-Suite: **53/53 Tests grün** (`npx vitest run src/services/export`).

## Geliefert
- **NEU `src/services/export/exportValidate.ts`**: Validatoren für generierte
  Artefakte (DOCX-Zip-Integrität + document.xml, EPUB-Container + OPF-Manifest,
  PDF-Header + Seitenzahl). Keine neuen Dependencies.
- **NEU `src/services/export/exportValidate.test.ts`**: 23 Tests (Roundtrip
  generate → validate, Umlaute/ß-Metadaten, TOC, Cover, Char-Code-Assertions).
- **Fix `src/services/export/index.ts`**:
  - `toWinAnsiSafe()`: ersetzt Zeichen außerhalb WinAnsi deterministisch
    (Fallback-Map, Umlaute/ß/dt. Typografie bleiben erhalten) — verhindert
    pdf-lib Encoding-Abbrüche bei Emoji/Kyrillisch/CJK/Pfeilen.
  - PDF-Metadaten: `setTitle`/`setAuthor`/`setLanguage` (Default „de“).

## Verlauf (relevant für Folge-Sprints)
- Versuch 1: `sed` auf Unicode-Escapes hat zwei Map-Keys verstümmelt
  (`"\u200B"` → `"200B"`). Operator-Reparatur mit Byte-Verifikation (python,
  Hex-Dump der Keys). Lehre: **nie `sed`/Shell auf Unicode-Quelltext** —
  nur Editor-Patches + Hex-Verifikation.
- Retry #2: Arbeit komplett (53/53 grün), Final-Antwort des Agents danach
  entgleist (Schema-Fail). Report vom Operator aus Transcript rekonstruiert.

## Tests
- `exportValidate.test.ts`: 23 neu (alle grün)
- Gesamt `src/services/export`: 53/53 grün (inkl. bestehender index-,
  export-project-, publishing-Tests)
