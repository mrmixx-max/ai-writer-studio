# Sprint 17 – Agent 4: LLM-Rewrite-Engine — Abschlussbericht

## Auftrag
1. `src/services/llm/` (Router-Pattern — read-only) + `src/services/bookwriter/quality.ts` (Agent 1 — Typen wiederverwenden) lesen.
2. NEU `src/services/bookwriter/rewrite.ts`: `rewritePassage(passage, findings, options): Promise<string>` (injizierbare complete-Fn), `RewriteOptions: { tone: 'preserve'|'formal'|'casual', length: 'same'|'shorter'|'longer' }`. Gezielten Prompt aus Befunden bauen → an LLM delegieren → verbesserten Text zurückgeben.
3. TDD: 10+ Tests (gemocktes complete: Erfolg, leere Befunde, Ton-/Längen-Optionen, malformed Response).
4. Dieser Bericht + Status-Selbstcheck.

## Ergebnis
- ✅ `src/services/bookwriter/rewrite.ts` (NEU, ~230 Zeilen)
- ✅ `src/services/bookwriter/rewrite.test.ts` (NEU, 25 Tests, alle grün)
- ✅ `src/services/llm/` unverändert (nur gelesen); `quality.ts` unverändert (nur gelesen, Typ `ChapterQualityResult` wiederverwendet)
- ✅ Keine fremden Dateien angefasst (eigene Domäne: nur `rewrite.ts` + Tests)

## Design (Muster aus `./lektorat`, Sprint 11)
- Reine Funktionen, keine Seiteneffekte; einzige LLM-Schnittstelle ist die injizierbare `CompleteFn = (prompt: string) => Promise<string>` — Tests mocken `complete`.
- Produktions-Verdrahtung `createOllamaComplete()` nutzt `completeOnce` aus `@/services/llm` via Lazy-Import — kein neuer Netzwerk-Code, Router unangetastet.
- Typ-Wiederverwendung Agent 1: `RewriteFindingsInput` akzeptiert `Pick<ChapterQualityResult, "issues" | "suggestions">` direkt (issues[i] ↔ suggestions[i]); daneben Objekte `{ issue, suggestion? }` und reine Strings.

## API
| Export | Zweck |
|---|---|
| `rewritePassage(passage, findings, options?, complete?)` | Kern: Prompt aus Befunden bauen → LLM → getrimmter Text (äußere Quotes gestrippt) |
| `buildRewritePrompt(passage, findings, options?)` | Prompt-Bau isoliert testbar (Ton-/Längen-Anweisung, nummerierte Befunde, „NUR die überarbeitete Textstelle") |
| `normalizeFindings(input)` | Strings / Objekte / QualityResult → `RewriteFinding[]`; Leer-Einträge verworfen |
| `resolveRewriteOptions(options?)` | Defaults `{ tone: 'preserve', length: 'same' }` + Validierung (wirft bei unbekanntem Ton/Länge) |
| `stripOuterQuotes(text)` | Entfernt eine äußere Quote-Schicht (`„…"`, `"…"`, `«…»`) |
| `createOllamaComplete()` | Produktions-`CompleteFn` (lazy, seitenffektfrei) |

## Semantik (Edge Cases)
- Leere Passage → wirft (`nichts zu überarbeiten`).
- Keine Befunde → Passage **unverändert zurück, ohne LLM-Aufruf** (kein verschwendeter Call).
- Leere/Whitespace-LLM-Antwort → wirft (`keine brauchbare Umformulierung`, kein stilles Fallback).
- `complete` wirft → Fehler mit Kontext (`LLM-Aufruf fehlgeschlagen: …`) weitergegeben.

## Verifikation
- `npx vitest run src/services/bookwriter/rewrite.test.ts` → **25/25 bestanden** (Erfolg ×5, leere Befunde ×2, Ton ×3, Länge ×3, Fehler ×7, Helfer ×5).
- `npx tsc --noEmit -p tsconfig.json` → **keine Fehler** in `rewrite.ts` / `rewrite.test.ts`. Einziger Projekt-Fehler liegt in Agent 5s `RewritePanel.test.tsx` (fremde Domäne, nicht angefasst).

## Status-Selbstcheck
- [x] Nur eigene Dateien erstellt (`rewrite.ts`, `rewrite.test.ts`, dieser Bericht)
- [x] Kein `git checkout` / `git branch` ausgeführt (Shared-Tree-Regel)
- [x] Kein bestehender Code geändert (llm-Router + quality.ts read-only)
- [x] 10+-Tests-Vorgabe übererfüllt (25 Tests, gemocktes LLM, kein Netzwerk)
- [x] Abschlussbericht abgelegt
