# Sprint 8 · Agent 3 — Performance, Load & Chaos: Abschlussbericht

Branch: `sprint8/agent3-performance` · Scope: Performance only, keine Breaking Changes.

## Ergebnis

- 19 neue Tests, alle grün (5 Test-Files in `tests/performance/` + `lazyInit.test.ts`: 24 passed, 1 skipped).
- `tsc --noEmit`: keine neuen Fehler in den Agent-3-Dateien.
- Memory Leaks gefunden: **0** (Loop- und Listener-Cleanup verifiziert; Negativ-Nachweis als Test dokumentiert).

## Neue Dateien

| Datei | Inhalt |
|---|---|
| `tests/performance/load.test.ts` | 6 parallele Book-Jobs über echten Job-Store + `OllamaConnectionPool` (alle complete, maxConcurrency nie überschritten, Durchsatz-Report), Backpressure (`queued > 0` bei Burst), Queue-Timeout-Reject |
| `tests/performance/memoryLeak.test.ts` | Heap-Wachstum pro Kapitel-Iteration begrenzt, onToken-Listener-Cleanup, Polling-Intervall-Cleanup (`stop()`), Negativ-Test: fehlender Cleanup wird sichtbar |
| `tests/performance/chaos.test.ts` | Netzwerk down (ECONNREFUSED + Retry-Budget), Ollama-Crash mid-stream (Partial Output erhalten), Disk full (ENOSPC → Job failed, kein stiller Verlust), Slow Provider (Timeout, Slot freigegeben, Stats konsistent) |
| `src/services/lazyInit.ts` | Lazy-Modul-Registry: `lazyModule` (cached, paralleler Zugriff = 1 Loader-Call, Error-Retry), `prefetch/isLoaded/resetLazyModules`, `preloadCritical/deferHeavy`, `HEAVY_MODULES`-Liste (chapter-gen, bulkRunner, Export/KDP) |
| `src/services/lazyInit.test.ts` | 8 Tests für das obige |
| `docs/sprint8-performance-benchmarks.md` | Baseline-Tabelle (alle Werte [measured] aus Code), Pool-Tuning-Empfehlung, Last-Szenarien 1/5/10 Bücher, Startup-Notes, Chaos-Matrix; Schätzungen als [estimated] markiert |

`tests/performance/performance.test.ts` (Bestand) unverändert, weiterhin grün.

## Pool-Tuning (Kurzfassung, Details im Benchmark-Doc)

- `maxConcurrent=4` beibehalten (aligned mit `OLLAMA_NUM_PARALLEL`-Default; Slot gilt für gesamte Stream-Dauer).
- 5+ parallele Bücher: Queue-Tiefe wächst linear, `queueTimeoutMs=60s` als Backpressure-Ventil; pro-Buch-Slot-Budgetierung empfohlen.
- Bulk bleibt bewusst seriell (`bulkOrchestrator`), Parallelität nur auf Job-/Chunk-Ebene via Pool.

## Bekannte Einschränkungen

- Kein echter Wandzeit-Lasttest gegen laufendes Ollama (Mocks mit realem Job-Store + realem Pool); Benchmark-Doc kennzeichnet das transparent.
- Arbeitsverzeichnis wird mit anderen Sprint-8-Agenten geteilt — committen/integrieren übernimmt der Orchestrator; dieser Bericht listet nur Agent-3-Dateien.

## Verifikation

`npx vitest run tests/performance src/services/lazyInit.test.ts` → 5 Files passed, 24 passed + 1 skipped. `npx tsc --noEmit` → keine Fehler in Agent-3-Dateien.
