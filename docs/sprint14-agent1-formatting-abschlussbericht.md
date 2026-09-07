# Sprint 14 – Agent 1: Textformatierungs-Engine — Abschlussbericht

**Agent:** Agent 1 (Textformatierungs-Engine) · **Datum:** 2026-09-07
**Scope:** nur NEUE Dateien unter `src/services/formatting/` (+ Bericht) — keine fremden Dateien modifiziert.

## 1. Editor-Recherche (read-only)

- `src/components/Editor/Editor.tsx`: TipTap 2 (`@tiptap/react`, StarterKit, Heading Level 1–3).
- Speichermodell: TipTap-JSON-Dokument — `onChange(JSON.stringify(editor.getJSON()))`,
  Laden via `setContent(parsed)` (JSON-String eines Kapitels).
- Verwandte Helfer: `src/services/editor/count.ts` (Unicode-Wortzählung),
  `src/services/import/tiptap.ts` (Blöcke → TipTap-JSON), `src/services/editor/markdown.ts`.
- Konsequenz: Engine arbeitet auf zwei reinen Ebenen — Plaintext-Pipelines und
  TipTap-JSON-Transformationen (`formatTiptapDoc`, `applyChapterHeadingStyle`).

## 2. Neue Dateien

| Datei | Inhalt |
|---|---|
| `src/services/formatting/textFormat.ts` (~330 Zeilen) | Reine Funktionen, keine Seiteneffekte |
| `src/services/formatting/textFormat.test.ts` | 24 Tests (Anforderung: 12+) |
| `docs/sprint14-agent1-formatting-abschlussbericht.md` | dieser Bericht |

### API (`textFormat.ts`)

- `splitParagraphs` / `normalizeDoubleEnter` — Auto-Paragraph bei Doppel-Enter (idempotent).
- `applySmartQuotes(text, locale)` — de: „…“/‚…', en: "…"/'…'; Apostroph in Wortmitte → '; idempotent.
- `convertDashes` — `---`/`--` → `—` (Em-dash per Task-Vorgabe).
- `convertEllipsis` (`...` → `…`), `applyGermanSpacing` (nbsp vor `! ? : ;`, nach `«`; Mehrfachspaces → 1).
- `detectChapterHeading` — Regex `^(Kapitel|Chapter) N [:.\-–— Titel]?$` (case-insensitiv,
  arabisch + römisch, Titel optional) → `{ number, rawNumber, title, keyword, level: 1 }`.
- `findChapterHeadings`, `formatParagraph`, `formatDocument` (Kapitelzeilen bleiben Rohtext).
- `countWords` (Unicode-aware, konsistent mit `count.ts`), `countWordsPerChapter`
  (Section 0 = Prolog vor erstem Heading; jede Section: `{ chapter, heading, words, chars }`).
- `summarizeChapterLengths(chapters, complete: CompleteFn)` — LLM-Funktion injizierbar, in Tests gemockt.
- `formatTiptapDoc(doc, options)` — pure Transformation aller Textknoten (keine Mutation).
- `applyChapterHeadingStyle(doc)` — Kapitel-Paragrafen → `heading/level 1` (keine Mutation).

## 3. Verifikation

- `npx vitest run src/services/formatting/textFormat.test.ts` → **24/24 grün**.
- `npx tsc --noEmit` → **keine Fehler** in `src/services/formatting/**`;
  2 Fehler in fremden Dateien (`ImageGenPanel.test.tsx`, `promptBuilder.test.ts`) sind
  pre-existing und wurden nicht angefasst.
- TDD-Anlauf: 1 Fail (fehlendes `/i`-Flag bei `KAPITEL …`), gefixt, danach grün.

## 4. Status-Self-Check

- [x] Editor-Speichermodell recherchiert (read-only, keine Edits außerhalb Scope)
- [x] `src/services/formatting/textFormat.ts` erstellt (pure functions)
- [x] Alle geforderten Ops: Doppel-Enter, Smart-Quotes, Dash-Konvertierung,
      Kapitel-Erkennung (Kapitel N / Chapter N → Heading-Level 1),
      Wortzählung pro Kapitel + injizierbare LLM-Funktion (Mock in Tests)
- [x] 24 Tests ≥ 12 (Smart-Quotes, Dashes, Heading-Erkennung, Wortzählung, deutsche Typografie)
- [x] Kein Scope-Bruch: nur NEUE Dateien unter `src/services/formatting/` + dieser Bericht
- [x] Kein `git checkout` / `git branch` ausgeführt

## 5. Offene Punkte / Hinweise für Integration (Folge-Sprint)

- Verdrahtung in `Editor.tsx` (onUpdate-Hook) ist bewusst NICHT Teil dieses Auftrags
  (Agent 1 besitzt nur `src/services/formatting/`).
- Design-Entscheidung: `--` → `—` (Em-dash) exakt per Task-Vorgabe; deutsches
  Korrektorat nutzt teils `–` (En-dash) — bei Bedarf als Option nachrüstbar.
- `summarizeChapterLengths`-Prompt ist deutsch; englische Variante bei Bedarf ergänzen.
