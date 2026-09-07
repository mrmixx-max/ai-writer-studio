# Sprint 19d — Agent 1 (Timeout-Architektur): Abschlussbericht

**Datum:** 07.09.2026 · **Owner:** Agent 1 · **Scope:** `src/services/llm/ollama.ts` + `src/services/llm/ollama.timeout.test.ts` (neu)
**Kein Commit, kein Build** (Vorgabe eingehalten).

## Problem (verifiziert)
- 14,4-GB-CPU-Modell (`hf.co/mradermacher/LFM2-24B-A2B-abliterated-GGUF:Q4_K_M`) braucht >60s bis zum ersten Token (Model-Load + Inferenz); `chat()` brach nach 30s (`FETCH_TIMEOUT`) ab → „Fehler bei KI-Aufruf“.
- Payload ohne `keep_alive` → Ollama entlädt das Modell nach 5min Idle → jeder Call lädt 14GB neu.
- Kein `num_ctx` im Payload → Server-Default 131072 sprengt den CPU-RAM.

## Änderungen (`src/services/llm/ollama.ts`, einzige angefasste Prod-Datei)
1. **`keep_alive: "keep"`** im `/api/chat`-Payload — Modell bleibt geladen, keine 14-GB-Reloads. Pro Call überschreibbar via `keepAlive`-Extra (`"15m"`, `0`, …). Export: `OLLAMA_DEFAULT_KEEP_ALIVE`.
2. **Kein Whole-Request-Timeout mehr für `/api/chat`**: `fetch` läuft ohne internen Timer, Abort kommt von außen über `signal` (wird jetzt auch tatsächlich an `fetch` durchgereicht — vorher verschluckt). Nur explizites `options.timeoutMs` aktiviert `fetchWithTimeout`. Empfehlung für Aufrufer als Export: `OLLAMA_CHAT_TIMEOUT_MS = 600_000` (10min).
3. **`num_ctx: 8192`** als Default in `options`, pro Call überschreibbar via `numCtx`-Extra. Export: `OLLAMA_DEFAULT_NUM_CTX`.
4. **`listModels` auf 10s** (`LIST_TIMEOUT`); **`healthCheck` unverändert 3s** — beide weiter über `fetchWithTimeout`.
5. **Keine fremden Dateien angefasst**: `ChatOptions` (in `src/types/llm.ts`) wurde bewusst NICHT erweitert — Extras laufen über das lokale Interface `OllamaChatExtras` per Cast (`keepAlive?: string | number`, `numCtx?: number`). Keine KIPanel-/Provider-Dateien berührt.

## Tests (`src/services/llm/ollama.timeout.test.ts`, 6 neu)
| # | Test | Ergebnis |
|---|------|----------|
| 1 | `keep_alive="keep"` + `num_ctx=8192` Defaults im Payload (alte Felder unverändert) | ✅ |
| 2 | `keepAlive`/`numCtx`-Overrides pro Call | ✅ |
| 3 | `OLLAMA_CHAT_TIMEOUT_MS ≥ 600_000` | ✅ |
| 4 | Langsamer First-Token (1,5s Delay + tröpfelnde Chunks): vollständig, **kein** `fetchWithTimeout` für `/api/chat`, externes `signal` durchgereicht | ✅ |
| 5 | Explizites `timeoutMs` aktiviert `fetchWithTimeout` für chat | ✅ |
| 6 | `healthCheck`=3s, `listModels`=10s via `fetchWithTimeout` | ✅ |

## Verifikation
- `npx vitest run src/services/llm/ollama.timeout.test.ts src/services/llm/ollama.poolcache.test.ts` → **11/11 ✅** (6 neu + 5 bestehende, keine Regression)
- `npx tsc --noEmit` → **EXIT 0**, keine Typfehler

## Offen / Hinweise an Integration
- Aufrufer mit harter Obergrenze (z.B. `runKIAction`) sollten per `AbortController` nach `OLLAMA_CHAT_TIMEOUT_MS` abbrechen — `chat()` selbst tut das nicht mehr.
- Echter Last-Test gegen laufendes Ollama mit dem 14-GB-Modell steht noch aus (nur gemockt verifiziert); `keep_alive`-Wirkung per `GET /api/ps` prüfen.
