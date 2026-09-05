# Sprint 5 — Agent 1: HITL (Human-in-the-Loop) & Editor-Modus (Log)

## Aufgabe

Manuelle Kontrolle für den Publisher — Haltepunkte und CLI-Editor:

1. **Approval-Gates**: Optionale Haltepunkte im CLI (`--hitl=true`) — pausiert
   nach Outline, Memory-Base, finalem Revisions-Loop.
2. **CLI-Editor**: Bei Haltepunkt Änderungen einspeisen (z. B. „Kapitel 3
   Fokus ändern: Mehr Spannung") als Inject in den Prompt.

## Akzeptanzkriterien → Erfüllt

| Kriterium | Umsetzung |
|---|---|
| `--hitl=true` aktiviert Haltepunkte | `parseHitlArg()` liest `--hitl[=true|false]` aus argv; ohne Flag ist alles neutral (keine Breaking Changes). Gates: `outline` (nach Phase `gliederung`), `memory` (vor dem Schreiben, Phase `manuskript`), `revision` (nach Phase `ueberarbeitung`). |
| Änderungen werden als Model-Inject übergeben | `buildInjectBlock()`/`withInjects()` formen Freitext zu einem verbindlichen Redaktionsblock; der Workflow injiziert ihn via `hitl.applyInjects(prompt)` in Outline- und Kapitel-Prompts. |
| Publisher kann Outline, Memory, Revision approfen/rejecten | `resolveGate()` persistiert `approved`/`rejected` je Gate über `saveApproval()` in `bookwriter_approvals` (bestehendes Approval-Log, FK auf `bookwriter_runs`). Reject pausiert den Lauf (`pauseRun`), Fortsetzung über Job-Recovery. |

## Umsetzung

- TDD: Tests zuerst (`hitl.test.ts`, 28 Tests) → Implementierung (`hitl.ts`)
  → GREEN 28/28. Danach Integrationstest (`workflow.hitl.test.ts`, 5 Tests)
  mit Mock-Provider + echter In-Memory-DB → GREEN 5/5.
- **Neu: `src/services/cli/hitl.ts`** — reine Logik, kein Terminal-Zwang:
  - `parseHitlArg(argv)` — Flag-Parsing (`--hitl`, `--hitl=true/false`).
  - `HITL_GATES` / `GATE_PHASE` / `GATE_LABELS` — Haltepunkte und Zuordnung
    zu Workflow-Phasen.
  - `createHitl` / `shouldPauseAt` / `resolveGate` — State-Machine +
    Persistenz über `saveApproval` (Tabelle `bookwriter_approvals`).
  - `addInject` / `buildInjectBlock` / `withInjects` — Inject-Kanal:
    Freitext → „Redaktionelle Anweisungen des Verlags (verbindlich
    umzusetzen)"; ohne Injektionen leerer String (Prompts byte-identisch).
  - `formatOutlineSummary` / `formatMemorySummary` / `formatRevisionSummary`
    — Gate-Zusammenfassungen (Gliederung inkl. Wortbudget, Memory-Block aus
    `buildContextBlock`, Revisions-Hinweis).
  - `parseEditorLine` — Editor-Grammatik: `a`/`ok`/`j` = Approve,
    `x`/`n` = Reject, `l` = Liste, `c` = Liste leeren, alles andere =
    Inject-Anweisung (Freitext).
  - `createHitlSession(enabled, io)` — interaktive Session mit
    austauschbarer `HitlIo` (readline im Terminal, Scripted-IO in Tests);
    `runGate()` blockiert bis approve/reject; `workflowHooks()` liefert
    `shouldPause` / `onGate` / `applyInjects` für die Workflow-Verdrahtung.
- **Workflow (`src/services/bookwriter/workflow.ts`)** — optionaler
  `hitl?: HitlHooks`-Parameter an `runBookwriter` (neues exportiertes
  Interface `HitlHooks`); bestehende Signaturen unverändert:
  - Checkpoint nach `gliederung` (Outline-Zusammenfassung mit Kapiteln +
    Wortbudget), vor `manuskript` (Memory-Block via `buildContextBlock`),
    nach `ueberarbeitung` (Revisions-Freigabe vor Export).
  - Bei Reject: `pauseRun(runId)` + Progress-Hinweis; Fortsetzung über die
    bestehende Job-Recovery (`resumeRun`).
  - Injects: `hitl.applyInjects(...)` umschließt `promptOutline` und
    `promptWriteChapter` — der Publisher-Eingriff landet als verbindlicher
    Block im Model-Prompt.
- **CLI-Adapter (`src/services/cli/cli.ts`)** — `buildHitlHooks()` baut die
  Hooks aus `process.argv`; `main()` zeigt den HITL-Modus beim Start an.
  Terminal-IO über readline (gleiches Muster wie Recovery-Prompt).
- Keine Breaking Changes: ohne `--hitl` verhält sich CLI und Workflow
  exakt wie in Sprint 4 (durch Tests abgesichert: „ohne hitl: Lauf läuft
  komplett durch").

## Tests

- `src/services/cli/hitl.test.ts` — 28 Unit-Tests (Flag, Gates,
  Approve/Reject + DB-Persistenz, Injects, Gate-Zusammenfassungen,
  Editor-Session mit Scripted-IO).
- `src/services/bookwriter/workflow.hitl.test.ts` — 5 Integrationstests
  (Lauf ohne HITL unverändert, drei Gates in Reihenfolge, Approve-Callback,
  Reject pausiert den Run, Injects landen in allen 3 Kapitel-Prompts).
- CLI/Bookwriter-Suite nach Änderung: 67/67 grün (6 Dateien).

## Abgrenzung

- Der revision-Gate prüft aktuell Stil/Konsistenz/Lesbarkeit als Hinweistext;
  die echte Revisions-Logik bleibt an die Phase `ueberarbeitung` gebunden
  (Sprint-2-Umfang).
- `chapter-gen.ts` (`generateManuskriptStreaming`) bekommt die Injects in
  einem Folgeschritt ebenfalls verdrahtet, sobald der UI-Flow den
  Streaming-Pfad nutzt — der Workflow-Pfad ist abgedeckt.
