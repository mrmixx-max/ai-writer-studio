# Sprint 13, Agent 2: LLM-Router-Qualität — Abschlussbericht

## Auftrag
1) `src/services/llm/` + Partial-Files + `src/services/prompts/templates.ts`
   (read-only) lesen. 2) Implementieren: task-aware Modellauswahl,
   automatischer Downgrade bei Timeout, per-Request-Ringpuffer
   (Modell, Task, Dauer, Fallback). 3) TDD: 10+ Tests (alle gemockt).
4) Dieser Bericht + Status-Selbstcheck.

## Bestand (gelesen, wiederverwendet — nicht neu erfunden)
- `src/services/llm/router.ts` (Sprint 2/3): `BookwriterRouter`
  (Ollama→OpenRouter-Kette, Fallback nur bei health/timeout-Quote/retry;
  nie bei Abort/4xx), `MODEL_MATRIX` + `pickModelForTask`,
  `TASK_CLASS_MATRIX` + `pickModelWithTaskClass`, `RouterCallMeta`.
- Partials (untracked, übernommen wie vorgefunden):
  `timeoutDowngrade.ts` (`isTimeoutError`, `resolveDowngradeModel`,
  `executeWithTimeoutDowngrade`) und `requestLog.ts` (`RouterRequestLog`,
  Kapazität 100, `seq`/`last`/`clear`) — beide rein, ohne Netz/Disk.
- `src/services/prompts/templates.ts` (Sprint 12): `PromptTaskKind`
  (`system|chapter|outline|revise`) — nur als Typ importiert, Datei
  unangetastet.
- Fehler-Taxonomie: `classifyError` aus `src/services/writing/retry.ts`.

## Geändert (nur additiv, kein Bestandsverhalten gebrochen)
- `src/services/llm/router.ts`:
  - Config: `requestLogCapacity?` (Default 100), `downgradeModels?`
    (Default []), `enableTimeoutDowngrade?` (Default true).
  - `BookwriterRouter.requestLog: RouterRequestLog` + `recentRequests(n)`.
  - Timeout-Downgrade: NUR bei Timeout-Signatur, einmal pro
    Provider-Besuch, Kandidat aus `downgradeModels` + `models.fast`
    (via `resolveDowngradeModel`, nie erfunden); `chatOpts.model` wird
    umgeschaltet, Warn-Log `Downgrade A → B`. Netzwerk/Abort/4xx:
    unverändert (kein Modellwechsel).
  - Meta: optionale `downgraded?`/`downgradedFrom?`; `fallback_reason`
    bleibt Provider-Fallback vorbehalten (Downgrade im selben Provider
    setzt es NICHT — bestehende `toBeNull`-Tests bleiben grün).
  - Ringpuffer-Eintrag pro Request: `{model, task, durationMs,
    fallbackUsed (= Provider-Fallback ODER Downgrade), ok, provider}` —
    auch bei Abort/4xx/Kettenfehler (`ok:false`).
  - `BookwriterRouter.bookwriterTaskForPromptTask`: Brücke
    Template-Task→Router-Task (`revise→repair`, `system→metadata`,
    `chapter`/`outline` direkt) für qualitätsäquivalentes Routing.
- `src/services/llm/router.quality.test.ts` (NEU): 13 Tests, alle
  gemockt (Provider-Instanzen direkt gepatcht, kein Netz/Disk).

## Verifikation
- `npx vitest run router.quality + router + fallback-log + taskclass`:
  4 Dateien, 35/35 bestanden (13 neu, 22 Bestand unverändert grün).
- `npx eslint` auf router*.ts/requestLog/timeoutDowngrade: sauber.
- `npx tsc --noEmit`: KEIN Fehler in eigenen Dateien. Einziger Fehler
  repo-weit in `src/services/bookwriter/kdpCover.ts` (TS2367) —
  fremde untracked Datei eines Parallel-Agenten, nicht angefasst.

## Status-Selbstcheck
- [x] Task-aware Auswahl: Matrix + Task-Klasse + Template-Brücke (3 Tests)
- [x] Downgrade nur bei Timeout, log+switch ohne Crash (Units + 2 Router-Tests)
- [x] Ringpuffer Modell/Task/Dauer/Fallback, Kapazität/Überlauf/seq (5 Tests)
- [x] 10+-Test-Vorgabe: 13/13 gemockt, bestanden
- [x] Bestand: 22/22 Router-Tests weiter grün, Lint sauber, kein Breaking Change
- [ ] Offen (bewusst außerhalb): Default-`downgradeModels` aus
  `listModels()` befüllen + Caller auf `recentRequests()` umstellen —
  Vorschlag für Folge-Sprint, kein hängiger Defekt.

## Eigene Änderungen (`git status`)
- M `src/services/llm/router.ts` | NEU `router.quality.test.ts` |
  NEU dieser Bericht. Partials `requestLog.ts`/`timeoutDowngrade.ts`
  waren vorgefunden-untracked und sind jetzt verdrahtet (gehört zum
  Auftrag: „read first, reuse or replace“ — reused).
