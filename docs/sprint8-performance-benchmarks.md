# Sprint 8 — Performance Benchmarks & Pool Tuning

> Scope: `src/services/ollama/connectionPool.ts`, `src/services/bulk/bulkRunner.ts`,
> `src/services/bulk/bulkOrchestrator.ts`, `src/services/bookwriter/jobs.ts`.
> Numbers marked **[measured]** come from code/tests. Numbers marked **[estimated]**
> are reasoned projections, not measurements. No wall-clock load tests were run
> (other workers own `tests/performance/*`); do not quote this doc as measured throughput.

## 1. Baseline (all [measured] from source)

| Component | Default | Behavior | Source |
|---|---|---|---|
| Pool `maxConcurrent` | **4** | Max simultaneous in-flight Ollama requests; extras wait in FIFO queue | `connectionPool.ts:58`, option doc `:25` |
| Pool `queueTimeoutMs` | **60 000 ms** | Queued request rejected with descriptive error after 60 s; `0` = wait forever | `connectionPool.ts:59,99-111` |
| `maxConcurrent` floor | **≥ 1** | `Math.max(1, floor(...))` — 0/negative coerced to 1 | `connectionPool.ts:72` |
| Pool scope | **1 pool per baseUrl** | Singleton via `getOllamaPool()` (trailing-slash normalized); `resetOllamaPools()` for tests | `connectionPool.ts:194-207` |
| Slot contract | **whole stream duration** | `acquire()`/`release()`; `run()` wraps in try/finally; double-release idempotent | `connectionPool.ts:92-130,147-183` |
| Bulk `cooldownMs` | **60 000 ms** | Sleep between books, skipped after last book; `0` disables | `bulkOrchestrator.ts:22,181-184` |
| Bulk queue | **strictly serial** | One book at a time; fatal error → `failed_jobs.json`, queue continues, cache cleared, no requeue | `bulkOrchestrator.ts:143-194` |
| Bulk chapter sizing | **1200 w/ch** | `chapterCount = clamp(3..40, round(targetWords/1200))`; `wordsPerChapter = round(target/chapters)`, min 200 | `bulkRunner.ts:43-49,62` |
| Job persistence | **per-chapter commit** | `persistNow()` after create / outline / every chapter / status change; resume at `current_chapter + 1` | `jobs.ts:53-116` |

### Verified pool semantics ([measured] via `connectionPool.test.ts`)

- `maxConcurrent=2`, 5 tasks → peak in-flight exactly 2, all 5 complete.
- `maxConcurrent=1` → strict FIFO order preserved.
- `run()` throwing still frees the slot (finally-contract).
- Double-release is a no-op (no counter leak).
- Queue-timeout rejects with `/Queue-Timeout/`; `rejected` counter increments; `queueTimeoutMs=0` waits indefinitely.
- Stats: `completed`, `rejected`, `totalWaitMs`, `maxWaitMs`, `avgWaitMs = round(total/completed)`.

### Ollama single-request bottleneck analysis

Ollama serves generation largely serially per loaded model (one KV-cache-heavy
runner; concurrent requests either queue server-side or force model swaps).
The client pool therefore exists to **cap memory/latency chaos**, not to create
parallelism Ollama can't deliver:

- Without the pool: N parallel chunk generations → N concurrent HTTP streams →
  server-side queueing with uncontrolled latency + N× KV-cache memory pressure.
- With the pool (`maxConcurrent=4`): at most 4 streams hold slots; the rest wait
  client-side with a **visible timeout** (60 s) instead of hanging the UI.
- The slot covers the **entire stream consumption**, not just headers — verified
  by the acquire/release contract (`connectionPool.ts:9-13,86-91`).
- One pool **per baseUrl** is correct: the bottleneck is per Ollama server
  instance, so separate servers get separate limits ([measured] `:186-202`).

### Bulk cooldown behavior ([measured])

- Cooldown fires **only between books** (`queue.length > 0 && cooldownMs > 0`),
  so `cooldownsTaken = books − 1` for N books (test asserts 2 for 3 books).
- `cooldownMs=0` is the supported remote-provider mode (no local-model rest needed).
- After **every** book (success or failure): `clearContextCache()` runs, then
  cooldown. Cache-clear never kills the queue (documented no-op + try/catch in
  `bulkRunner.ts:118-137`).

## 2. Tuning recommendation

**Recommendation: keep `maxConcurrent = 4`. Do not raise it.**

| Decision | Justification |
|---|---|
| Keep 4 | Aligned with Ollama's `OLLAMA_NUM_PARALLEL` default (stated in code, `:25`). Raising client concurrency beyond what the server parallelizes only adds KV-cache pressure and tail latency. |
| Keep `queueTimeoutMs = 60 s` | Matches bulk cooldown scale; generation stalls longer than 60 s are already failures worth surfacing. `0` (infinite) only for explicitly supervised batch runs. |
| Keep bulk `cooldownMs = 60 s` for local models | Gives a hot local model one minute to cool/GC between books; matches pool timeout scale so a full queue drains within one cooldown+timeout window. |
| Set bulk `cooldownMs = 0` for remote/cloud providers | No thermal/memory reason to wait; supported and tested mode. |
| One pool per baseUrl (keep) | Correct bottleneck granularity; do not share one pool across servers. |

### Per-book slot budgeting math ([estimated] arithmetic on [measured] defaults)

A single book run is internally **serial per chapter** (job store advances
`current_chapter` one at a time), but chunk/embedding/router calls within a
chapter can overlap. Budget conservatively:

- Steady-state demand per active book: **1 slot** (generation is the long pole;
  embeddings/router are short and interleave).
- Burst demand per active book: **up to 2 slots** (generation + one auxiliary call).
- Safe capacity rule: `parallelBooks × burstFactor ≤ maxConcurrent`.

| Parallel books | Burst demand (×2) | vs 4 slots | Verdict |
|---|---|---|---|
| 1 | 2 | fits | safe |
| 2 | 4 | exactly full | safe, zero headroom |
| 3+ | 6+ | over capacity | queueing guaranteed |

**Guidance:** the app runs books **serially** through `BulkOrchestrator` today,
so the pool never sees multi-book pressure — 1 book × burst 2 ≤ 4 holds with
2 slots headroom. If a future parallel-books mode is added, cap it at
**2 parallel books** without pool changes, or raise the pool only together with
`OLLAMA_NUM_PARALLEL` on a server proven to have the VRAM for it.

### Queue sizing guidance for 5+ parallel books ([estimated])

If parallel-books lands: with 5 books × burst 2 = 10 slot-claims vs 4 slots,
6 claims queue. Queued claims older than 60 s reject — with chapter
generations lasting tens of seconds each, deep queues will hit timeouts.
Mitigations in order of preference:

1. Cap parallel books at 2 (no pool change needed).
2. Serialize the long-pole (generation) per book so burst → 1 slot/book.
3. Only then consider `maxConcurrent` 6–8 **and** raise `OLLAMA_NUM_PARALLEL`
   to match on a VRAM-adequate host — measure tail latency before/after.

## 3. Load-test scenarios (for `tests/performance/*` owners)

Queue depth and waits below are **[estimated]** from the FIFO + 60 s-timeout
design, assuming each book holds ~1 slot long-term with 2-slot bursts and each
chapter generation takes **G** seconds (G is deployment-dependent, not measured here).

| Scenario | Active books | Expected queue depth **[est.]** | Expected wait **[est.]** | Timeout risk **[est.]** |
|---|---|---|---|---|
| 1 book (current design) | 1 | 0–1 | ~0 ms (headroom of 2–3 slots) | none |
| 5 parallel books | 5 | 1–6 fluctuating | bursts wait ~1×G; sustained overload possible | moderate — bursts past 60 s reject |
| 10 parallel books | 10 | 6–16 sustained | multiple ×G; queue mostly full | high — expect `rejected > 0`, surfaced via `getStats()` |

Suggested assertions for the load tests (design targets, not measured results):

- 1 book: `maxWaitMs` small, `rejected === 0`, `completed === submitted`.
- 5 books: `peak active ≤ 4` always; `rejected` may be 0 if G < ~15 s.
- 10 books: `peak active ≤ 4` always; `rejected ≥ 0` tolerated but must be
  surfaced (error message names label + active/queued counts — [measured] `:107`).

## 4. Startup optimization notes (`lazyInit`)

> `src/services/lazyInit.ts` is owned by another worker and did not exist at
> time of writing — the notes below describe **what should be deferred** based
> on [measured] import structure (`main.tsx`, `App.tsx`). Wins are qualitative
> **[estimated]**; no timings were taken.

Eager-at-boot today ([measured]): global error handlers, fetch-retry shim,
log persistence (`main.tsx:3-19`), DB init (`App.tsx:64`), service worker
registration. Heavy but **not** on the first-paint path:

| Candidate to defer behind `lazyInit` | Why ([measured] basis) | Expected win **[estimated]** |
|---|---|---|
| DB open + migrations (`initDb`) | Only needed when a project/book loads, not for first paint | Faster time-to-interactive; DB failure no longer blocks boot |
| Bulk/bookwriter workflow imports (`workflow`, `bulkRunner`, `jobs`) | Imported per-route/panel today; pulling them into the boot chunk grows parse cost | Smaller initial bundle, panels load on demand |
| Ollama pool creation | `getOllamaPool` is lazy-singleton already — keep as-is, just don't pre-warm at boot | Avoids a pointless health-check round-trip on startup |
| Log-file rotation (`installLogPersistence`) | Already fire-and-forget; keep, but never `await` at boot | No boot stall on slow disks |
| Tauri FS/path dynamic imports (`bulkOrchestrator defaultWriteFailedJobs`) | Already dynamically imported — reference pattern for further splits | Template for deferring other Tauri APIs |

Non-goal: deferring error-handler/fetch-shim installation — they must stay
eager (they observe boot itself).

## 5. Chaos matrix (fault → expected behavior)

All "expected" entries are **[measured]** from code contracts unless marked otherwise.

| # | Fault | Expected behavior | Source |
|---|---|---|---|
| 1 | Slot holder throws mid-`run()` | Slot freed via finally; next waiter proceeds; `completed` increments | `connectionPool.ts:123-130`, test `:71-79` |
| 2 | Queue wait exceeds 60 s | Request rejects with `[OllamaConnectionPool] Queue-Timeout …` naming label + active/queued; `rejected += 1`; waiter removed from queue | `connectionPool.ts:100-111`, tests `:93-125` |
| 3 | Double `release()` | Idempotent no-op; counters unchanged | `connectionPool.ts:151-159`, test `:81-89` |
| 4 | Caller forgets `release()` | Slot leaks until process end (no watchdog) — **known limitation**; prefer `run()` over manual `acquire()` | Code inspection (no auto-reclaim path exists) |
| 5 | Ollama server down / conn refused | Pool passes the error through; slot freed; no retry in pool (retry lives in fetch shim) | `run()` finally-contract; `main.tsx:19` shim |
| 6 | Bulk book crashes fatally | Job → `failed_jobs.json` immediately; cache cleared; queue continues with next book; no requeue (no infinite loop) | `bulkOrchestrator.ts:156-178` |
| 7 | Crash between books (process kill) | Completed chapters committed per-chapter; resume at `current_chapter + 1` via `getResumableBookJob`; failed-set re-derivable from `failed_jobs.json` | `jobs.ts:89-139`, `bulkOrchestrator.ts:167-171` |
| 8 | `clearContextCache()` throws | Swallowed (documented no-op); queue never killed by cache hygiene | `bulkRunner.ts:127-136` |
| 9 | `failed_jobs.json` unwritable (no Tauri ctx) | Silently ignored; in-memory `failed[]` still returned in `BulkRunResult` | `bulkOrchestrator.ts:96-106` |
| 10 | Queue-timeout storm (10 books) **[est.]** | Mass `rejected` with descriptive errors; `getStats()` shows `rejected`, `maxWaitMs ≈ 60 000`; active stays ≤ 4 — degraded but bounded, never wedged | Design inference from FIFO + timeout |
| 11 | Cooldown sleep interrupted (kill during 60 s) | Books done so far are committed; remaining queue re-derivable from CSV; `cooldownsTaken` reflects only taken cooldowns | `bulkOrchestrator.ts:181-193` |

**Known limitation to fix (not this sprint):** no release-watchdog — a leaked
slot (forgotten `release()`) permanently reduces capacity by 1 until
`resetOllamaPools()`. Recommend lint rule / wrapper (`run()`-only in app code).
