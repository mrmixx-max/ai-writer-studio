# Sprint 19e, Agent 1 — BookWriter JSON-Robustheit (LFM2-24B): Abschlussbericht

**Datum:** 2026-09-08 · **Scope:** `src/services/bookwriter/workflow.ts` + `workflow.json.test.ts`
**Nicht angefasst:** `chapter-gen.ts` (Timeouts, fremdes Eigentum). Kein Commit, kein Build.

## Problem
LFM2-24B (24B, CPU) liefert für die Outline Wort-Salat statt JSON:
`„Gliederung konnte nicht als JSON gelesen werden. Anfang: horizon horizon margin Marg …"`
Das alte `parseJson` konnte nur direkt + 1 Markdown-Block, ohne Reparatur, ohne Retry.

## Änderungen (`workflow.ts`)
1. **`parseJson` robust + exportiert** — 4-stufige Strategie:
   - direkt parsen → alle Markdown-Code-Blöcke (```json/```) → erste `[...]`/`{...}`-Sequenz
     aus Fließtext isolieren (string-sensitives Bracket-Stack-Matching) → Reparaturlauf.
   - `repairJson`: Single→Double-Quotes, unquotete Keys, unquotete String-Werte
     (Zahlen/`true`/`false`/`null` bleiben), Trailing-Commas, Steuerzeichen, BOM/Trim.
   - Wort-Salat ohne JSON-Struktur → `null` (führt in den Retry-Pfad).
2. **Outline-Prompt gehärtet** (`appendJsonOnlyInstruction`, in `generateGliederung`
   an den Library-Prompt angehängt — `prompts.json` unangetastet):
   „Gib NUR valides JSON zurück … genau N Einträge … Beginne direkt mit `[` …".
3. **Fallback mit Retry** (`resolveOutlineJson`, injizierbares `fetchRaw`):
   Erstversuch mit Basis-Temperatur, danach bis zu 2 Retries mit **0.1**
   (`OUTLINE_RETRY_TEMPERATURE`, `OUTLINE_MAX_ATTEMPTS = 3`, via `{...settings, temperature}`).
   Total-Fehlschlag wirft: `„… Anfang: <120 Zeichen>… Modell liefert kein valides JSON.
   Bitte in den Einstellungen ein kleineres/anderes Modell wählen (z. B. llama3.2)."`
4. **Shape-Toleranz:** `{chapters: [...]}`-Objekt wird entpackt; kein Array → gleicher
   hilfreicher Error statt spätem `reduce`-Crash.

## Verifikation
- **Neu:** `workflow.json.test.ts` — **9 Tests, alle grün** (`vitest run`, 2.3 s):
  direkt, ```json-/```-Block, Fließtext-Isolation, Reparatur (Keys/Single-Quotes/
  Trailing-Comma), Wort-Salat→`null`, Prompt-Härtung, Retry mit Temperaturfolge
  `[0.7, 0.1]`, Error mit Modell-Hinweis nach 3 Versuchen, Error enthält Antwort-Anfang.
- **Regression:** `workflow.hitl.test.ts` + `prompts/library.test.ts` — **35 Tests grün**.
- Bestehende Mocks (`completeOnce`-Signatur unverändert) funktionieren weiter.

## Offene Punkte / Hinweise
- `chapter-gen.ts`-Timeouts bewusst nicht angefasst (anderer Agent).
- Falls LFM2-24B weiter Salat liefert, greift jetzt der Error-Hinweis (Modellwechsel);
  als nächste Eskalation böte sich `maxTokens`-Anhebung oder Kapitel-Splitting an.
