# Sprint 15 — Agent 5: Bilingual-Prompt-Templates — Abschlussbericht

**Agent:** Agent 5 (Bilingual-Prompt-Templates) · **Sprint:** 15 (Bilingual)
**Datum:** 2026-09-07 · **Dateien (neu, keine Aenderung an Bestand):**
- `src/services/prompts/bilingualTemplates.ts`
- `src/services/prompts/bilingualTemplates.test.ts`

## 1. Vorarbeit (read-only)

`src/services/prompts/templates.ts` (Sprint 12/14) gelesen und Struktur uebernommen:
`PromptTemplate`-Shape (`id`, `description`, Template-String, `requiredVars`/`optionalVars`),
Engine `renderTemplate` aus `src/services/bookwriter/prompts/template`,
Validierung (`missing`/`unknown`/`valid`), Registry + `get`/`list`-Helfer.
**`templates.ts` wurde nicht veraendert** (git-status verifiziert).

## 2. Neue Templates (`bilingualTemplates.ts`)

Jedes Template: `{ id, description, build(vars): string }` mit `{{variable}}`-Platzhaltern
(Handlebars via `renderTemplate`); `build()` validiert `requiredVars` strict (throw bei Luecken).

| ID | Beschreibung | required | optional |
|----|--------------|----------|----------|
| `bilingual:translate-de-en` | System-Prompt DE→EN: Ton konsistent, Markup (Markdown/HTML) exakt erhalten, nichts hinzufuegen | `sourceText`, `tone` | `glossary`, `styleHint` |
| `bilingual:chapter-summary` | Bilinguale Kapitelzusammenfassung (erst `DE:`, dann `EN:`, gleiche Inhalte) | `chapterTitle`, `chapterText` | `maxSentences`, `focusPoints` |
| `bilingual:consistency-check` | Konsistenzpruefung DE vs. EN (Vollstaendigkeit, Terminologie, Markup, Ton) | `germanText`, `englishText` | `glossary` |

Zusaetzlich: `BILINGUAL_REGISTRY`, `listBilingualTemplateIds()`,
`getBilingualTemplate(id)` (unbekannte ID → throw), `validateBilingualVars()`.
Keine LLM-Calls — alles pure Functions.

## 3. Tests (TDD)

`bilingualTemplates.test.ts`: **15 Tests, alle gruen**
(`npx vitest run src/services/prompts/bilingualTemplates.test.ts` → 1 File, 15 passed).
Abgedeckt: Struktur (id+description nicht-leer, build-Funktion vorhanden, IDs eindeutig,
`{{}}`-Platzhalter, unbekannte ID wirft), Rendering aller 3 Templates (keine `{{`-Reste,
optionale Vars, DE/EN-Marker), Strict-Fehler (fehlender `sourceText`/`englishText`),
`validateBilingualVars` (missing / unknown / valide Vollbelegung).

## 4. Status-Selbstcheck

- [x] `templates.ts` (Sprint 14) nur gelesen, nicht geaendert
- [x] `bilingualTemplates.ts` neu mit 3 Templates je `{id, description, build}`
- [x] 8+ Tests (15) geschrieben und gruen
- [x] Eigene Dateien: nur `bilingualTemplates.ts` + Test angefasst (kein `checkout`/`branch`)
- [x] Keine Konflikte mit Agent 1–4/6-Dateien (`BilingualPanel`, `bilingualExport` unberuehrt)

## 5. Offen / Hinweise an Integration

- Anbindung an Sprint-15-Bilingual-UI (`BilingualPanel`) und Export (`bilingualExport`)
  erfolgt durch die jeweils zustaendigen Agenten; Templates sind aufrufbereit via `build()`.
- Optional: EN→DE war nicht spezifiziert — bei Bedarf als `bilingual:translate-en-de`
  nach gleichem Muster ergaenzbar.
