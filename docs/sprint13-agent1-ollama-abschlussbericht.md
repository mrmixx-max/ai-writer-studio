# Sprint 13 Agent 1 — Ollama-Resilienz: Abschlussbericht

## Auftrag
Timeout-Guard mit Abort, Single-Flight-Queue fuer konkurrierende identische
Requests, Modell-Fallback-Kette (preferred → Fallbacks → Offline-Fehler),
Stale-Health-Cache. TDD mit 10+ Tests (gemockter fetch), Abschlussbericht,
Status-Self-Check.

## Befund
`src/services/ollama/resilience.ts` (320 Zeilen) existierte bereits aus einem
abgebrochenen Vorversuch und deckte alle vier Bausteine ab. Nach Review
uebernommen wie vorgefunden — kein Rewrite noetig, keine Breaking Changes.
Neu geschrieben: `src/services/ollama/resilience.test.ts` (22 Tests).

## Was implementiert ist (`resilience.ts`, unveraendert uebernommen)
- **Timeout-Guard** `requestWithTimeout()`: AbortController, Default 30 s
  (Router-Konvention), externes Signal wird durchgereicht (aborted),
  Netzwerkfehler → klarer Offline-Hinweis (`ollama serve`, Port 11434).
- **SingleFlight**: N parallele `run()` mit gleichem Key teilen ein Promise
  (Ollama auf CPU bedient seriell — kein Hammering). Nach Settle wird der Key
  entfernt (kein ewiges Caching).
- **SerialQueue**: FIFO, Concurrency 1; ein abgelehnter Task bricht die Kette
  nicht.
- **Fallback-Kette** `runWithFallbackChain()`: preferred → Fallbacks bei
  Modell-fehlt (404 / „no such model" / …); Offline bricht sofort mit klarer
  Meldung ab; Kette erschoepft → `model-missing` mit tried-Liste und
  `ollama pull`-Hinweis. `resolveModelChain()` trimmt/dedupt.
- **Stale-Health-Cache** `OllamaHealthCache`: `GET /api/tags` max. 1× pro TTL
  (Default 15 s), Treffer im TTL kommen aus dem Cache (`fromCache: true`),
  Probe-Fehler → `healthy:false` (wirft nie). `force`/`invalidate()`/`peek()`.
- Alles ASCII-only (shell-safe), deutsche Meldungen, fetch injizierbar.

## Tests (neu, 22 Tests, alle gruen, 0 Unhandled Errors)
`npx vitest run src/services/ollama/resilience.test.ts` →
**Test Files 1 passed, Tests 22 passed**, keine Unhandled Errors.
Abdeckung: Timeout (Erfolg / Timeout-kind / externes Abort-Signal /
Netzwerk→offline), SingleFlight (Dedupe / unabhaengige Keys / Re-Execute nach
Settle), SerialQueue (FIFO / Fehler bricht Kette nicht), Fallback
(trim/dedupe / Direkt-Treffer / Fallback bei 404 / Offline-Abbruch /
erschoepfte Kette), HealthCache (Cache-Treffer / force / Fehler→false /
invalidate+peek), Helfer (isOfflineError / isModelMissingError /
toOfflineError / Defaults).
Hinweis: Ein Stolperstein wurde im Test gefixt — der Rejection-Handler muss
VOR `vi.advanceTimersByTimeAsync()` angehaengt werden, sonst meldet Vitest
eine Unhandled Rejection.

## Self-Check
- [x] Timeout-Guard mit Abort (inkl. externem Signal)
- [x] Single-Flight-Queue + SerialQueue
- [x] Modell-Fallback-Kette mit Offline-Abbruch
- [x] Stale-Health-Cache (TTL, force, invalidate, peek)
- [x] 22 Tests (≥10 gefordert), gemockter fetch, kein echtes Ollama noetig
- [x] ASCII-only Source, `tsc --noEmit`: kein Fehler in eigenen Dateien
      (einziger Fehler liegt in `src/services/bookwriter/kdpCover.ts` —
      Datei eines anderen Agenten, ungetrackt, nicht angefasst)
- [x] Kein `git checkout` / `git branch` verwendet (Shared-Tree-Regel)

## Offene Punkte / Uebergabe
- `resilience.ts` ist standalone; Einbindung in bestehende Caller
  (modelManager / connectionPool) ist bewusst nicht erfolgt (additiv, keine
  Breaking Changes) — ggf. Folgeticket.
- Neue Dateien (ungetrackt): `src/services/ollama/resilience.ts` (Vorversuch),
  `src/services/ollama/resilience.test.ts` (neu), `docs/...abschlussbericht.md`
  (diese Datei).
