// Tests: Ollama-Resilienz (Sprint 13, Agent 1). ASCII-only (shell-safe).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_HEALTH_TTL_MS,
  OFFLINE_MESSAGE,
  OllamaResilienceError,
  isOfflineError,
  isModelMissingError,
  toOfflineError,
  requestWithTimeout,
  SingleFlight,
  SerialQueue,
  resolveModelChain,
  runWithFallbackChain,
  OllamaHealthCache,
} from "./resilience";

const okResponse = () => new Response("ok", { status: 200 });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("requestWithTimeout: Timeout-Guard mit Abort", () => {
  it("erfolgreicher Fetch wird durchgereicht (ok=true)", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const res = await requestWithTimeout("http://x/api/tags", {}, 1000, fetchFn as typeof fetch);
    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("Timeout bricht ab und wirft kind=timeout", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted-by-timeout-guard")),
            { once: true },
          );
        }),
    );
    const p = requestWithTimeout("http://x/api/tags", {}, 50, fetchFn as typeof fetch);
    const assertion = expect(p).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });

  it("bereits abgebrochenes externes Signal wirft kind=aborted ohne Fetch", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fetchFn = vi.fn(async () => okResponse());
    await expect(
      requestWithTimeout("http://x", { signal: ctrl.signal }, 1000, fetchFn as typeof fetch),
    ).rejects.toMatchObject({ kind: "aborted" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("Netzwerkfehler (TypeError) wird zu kind=offline mit klarer Meldung", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const err = await requestWithTimeout("http://x", {}, 1000, fetchFn as typeof fetch).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(OllamaResilienceError);
    expect(err.kind).toBe("offline");
    expect(err.message).toBe(OFFLINE_MESSAGE);
  });
});

describe("SingleFlight: identische Requests teilen ein Promise", () => {
  it("N parallele run() mit gleichem Key = 1 Ausfuehrung", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const fn = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    };
    const results = await Promise.all([sf.run("k", fn), sf.run("k", fn), sf.run("k", fn)]);
    expect(results).toEqual([42, 42, 42]);
    expect(calls).toBe(1);
    expect(sf.size).toBe(0);
  });

  it("verschiedene Keys laufen unabhaengig", async () => {
    const sf = new SingleFlight<string>();
    let calls = 0;
    const fn = (v: string) => async () => {
      calls += 1;
      return v;
    };
    const [a, b] = await Promise.all([sf.run("a", fn("A")), sf.run("b", fn("B"))]);
    expect([a, b]).toEqual(["A", "B"]);
    expect(calls).toBe(2);
  });

  it("nach Settle wird neu ausgefuehrt (kein ewiges Caching)", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return calls;
    };
    expect(await sf.run("k", fn)).toBe(1);
    expect(await sf.run("k", fn)).toBe(2);
    expect(calls).toBe(2);
  });
});

describe("SerialQueue: FIFO, Concurrency 1", () => {
  it("Tasks starten strikt in Enqueue-Reihenfolge", async () => {
    const q = new SerialQueue();
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        q.enqueue(async () => {
          order.push(n);
          await new Promise((r) => setTimeout(r, 5));
          return n;
        }),
      ),
    );
    expect(order).toEqual([1, 2, 3]);
    expect(q.size).toBe(0);
  });

  it("abgelehnter Task bricht die Kette nicht", async () => {
    const q = new SerialQueue();
    const failing = q.enqueue(async () => {
      throw new Error("boom");
    });
    const after = q.enqueue(async () => "weiter");
    await expect(failing).rejects.toThrow("boom");
    await expect(after).resolves.toBe("weiter");
    expect(q.size).toBe(0);
  });
});

describe("Model-Fallback-Kette", () => {
  it("resolveModelChain trimmt, filtert leer, dedupt", () => {
    expect(resolveModelChain("  llama3 ", ["llama3", "", "mistral", "mistral"])).toEqual([
      "llama3",
      "mistral",
    ]);
  });

  it("preferred antwortet direkt, keine Fallbacks noetig", async () => {
    const r = await runWithFallbackChain({
      preferred: "llama3",
      fallbacks: ["mistral"],
      call: async (m) => `antwort-von-${m}`,
    });
    expect(r).toEqual({ value: "antwort-von-llama3", model: "llama3", tried: ["llama3"] });
  });

  it("model-missing faellt auf Fallback zurueck", async () => {
    const tried: string[] = [];
    const r = await runWithFallbackChain({
      preferred: "fehlt",
      fallbacks: ["auch-weg", "mistral"],
      call: async (m) => {
        tried.push(m);
        if (m !== "mistral") throw Object.assign(new Error("no such model"), { status: 404 });
        return "da";
      },
    });
    expect(r.model).toBe("mistral");
    expect(tried).toEqual(["fehlt", "auch-weg", "mistral"]);
  });

  it("Offline bricht die Kette sofort mit klarer Meldung ab", async () => {
    const tried: string[] = [];
    const err = await runWithFallbackChain({
      preferred: "llama3",
      fallbacks: ["mistral"],
      call: async (m) => {
        tried.push(m);
        throw new TypeError("fetch failed");
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(OllamaResilienceError);
    expect(err.kind).toBe("offline");
    expect(tried).toEqual(["llama3"]);
  });

  it("Kette erschoepft -> kind=model-missing mit tried-Liste", async () => {
    const err = await runWithFallbackChain({
      preferred: "a",
      fallbacks: ["b"],
      call: async () => {
        throw Object.assign(new Error("unknown model"), { status: 404 });
      },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(OllamaResilienceError);
    expect(err.kind).toBe("model-missing");
    expect(err.message).toContain("a, b");
  });
});

describe("OllamaHealthCache: Stale-Health-Cache", () => {
  it("zweiter Check im TTL kommt aus dem Cache (kein Probe)", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const cache = new OllamaHealthCache({ ttlMs: 15_000, fetchFn: fetchFn as typeof fetch });
    const first = await cache.check();
    const second = await cache.check();
    expect(first).toMatchObject({ healthy: true, fromCache: false });
    expect(second).toMatchObject({ healthy: true, fromCache: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("force=true probt erneut trotz frischem Cache", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const cache = new OllamaHealthCache({ ttlMs: 15_000, fetchFn: fetchFn as typeof fetch });
    await cache.check();
    const forced = await cache.check(true);
    expect(forced.fromCache).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("Probe-Fehler ergibt healthy=false und wirft nie", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const cache = new OllamaHealthCache({ ttlMs: 15_000, fetchFn: fetchFn as typeof fetch });
    const s = await cache.check();
    expect(s).toMatchObject({ healthy: false, fromCache: false });
  });

  it("invalidate() erzwingt neuen Probe; peek() probt nie", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const cache = new OllamaHealthCache({ ttlMs: 15_000, fetchFn: fetchFn as typeof fetch });
    expect(cache.peek()).toBeNull();
    await cache.check();
    expect(cache.peek()?.healthy).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    cache.invalidate();
    expect(cache.peek()).toBeNull();
    await cache.check();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("Fehler-Helfer", () => {
  it("isOfflineError erkennt TypeError + ECONNREFUSED-Text", () => {
    expect(isOfflineError(new TypeError("fetch failed"))).toBe(true);
    expect(isOfflineError("connect ECONNREFUSED 127.0.0.1:11434")).toBe(true);
    expect(isOfflineError(new Error("irgendwas anderes"))).toBe(false);
  });

  it("isModelMissingError erkennt 404 + Modell-Texte", () => {
    expect(isModelMissingError(Object.assign(new Error("x"), { status: 404 }))).toBe(true);
    expect(isModelMissingError(new Error("no such model 'llama3'"))).toBe(true);
    expect(isModelMissingError(new Error("ganz anderer Fehler"))).toBe(false);
  });

  it("toOfflineError behaelt Offline bei, wrappt Rest mit Ursache", () => {
    const off = new OllamaResilienceError("offline", OFFLINE_MESSAGE);
    expect(toOfflineError(off)).toBe(off);
    const wrapped = toOfflineError(new TypeError("fetch failed"));
    expect(wrapped.kind).toBe("offline");
    expect(wrapped.cause).toBeInstanceOf(TypeError);
  });

  it("Defaults entsprechen Router-Konvention", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_HEALTH_TTL_MS).toBe(15_000);
  });
});
