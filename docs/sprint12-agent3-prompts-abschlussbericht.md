# Sprint 12, Agent 3: Prompt-Template-Library — Abschlussbericht

## Auftrag
Typisierte Template-Registry als NEUE Schicht ueber der bestehenden
Prompt-Library (23 Genres + Presets aus `prompts.json`/`library.ts`).
Nur NEUE Dateien unter `src/services/prompts/`, keine LLM-Calls,
kein Wortlaut-Eingriff in bestehende Presets.

## Bestand-Verdrahtung (wiederverwendet, nicht neu erfunden)
- Genres/Presets leben in `src/services/bookwriter/prompts/prompts.json`
  (23 Genre-Keys, `defaultGenre: sachbuch`), Fassade `prompts.ts`,
  Logik `prompts/library.ts` (`listGenres`, `resolveGenre`,
  `systemFromProfile`, Stil-Presets aus Sprint 7).
- Rendering: `renderTemplate` aus `prompts/template.ts` (minimale
  Handlebars-Engine, pure Funktion). Typ `TemplateVars` uebernommen.

## Neu erstellt
- `src/services/prompts/templates.ts` — Registry:
  - `PromptTemplate` (`id`, `task`, `genre`, `template`, `requiredVars`,
    `optionalVars`), `PromptTaskKind` (`system`|`chapter`|`outline`|`revise`).
  - 23 per-Genre System-Templates (`system:<genre>`, Fokus-Zeilen sind
    NEU formuliert, kein Zitat aus `prompts.json`) + explizites
    `system:fallback`; je ein Fallback-Task-Template fuer
    `chapter`/`outline`/`revise` mit `{{variablen}}`.
  - `extractVariables` (ignoriert `#if/#unless/#each/else/this/@...`,
    Pfad-Kopf), `validateVars` (`missing`/`unknown`/`valid`),
    `renderPromptTemplate` (+`strict`-Modus), `resolveTemplate`
    (unbekanntes Genre → Fallback, kein Throw), `renderTask`,
    `runTemplateTask` (nur injizierte `CompleteFn`, kein Provider-Import),
    `genreCoverage` (gegen `listGenres()` geprueft, keine Zweitliste).
- `src/services/prompts/templates.test.ts` — 23 Tests (Rendering,
  Strict-Fehler, missing/unknown-Validierung, 23-Genres-Abdeckung,
  Fallback, ID-Eindeutigkeit, stub-`complete` ohne LLM-Call).

## Verifikation
- `npx vitest run src/services/prompts/templates.test.ts`: 23/23 bestanden.
- `npx tsc --noEmit`: keine Fehler in `src/services/prompts/`.
- `git status --short`: eigene Aenderung = nur `src/services/prompts/`
  (new) + dieser Bericht; bestehende Presets unangetastet
  (kein Diff in `bookwriter/prompts/`).

## Offene Punkte / Hinweise
- Keine: Registry ist rein additiv. Naechster Schritt (fuer andere
  Agenten): Caller auf `renderTask`/`runTemplateTask` umstellen —
  ausserhalb dieses Auftrags.
