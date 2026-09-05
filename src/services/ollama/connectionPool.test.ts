// Tests: Ollama-Connection-Pool (Sprint 7, Agent 2).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  OllamaConnectionPool,
  getOllamaPool,
  resetOllamaPools,
} from "./connectionPool";

afterEach(() => {
  resetOllamaPools();
});

describe("OllamaConnectionPool: Begrenzung", () => {
  it("maxConcurrent = 2: nur 2 Slots parallel, Dritte wartet", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 2 });
    let inFlight = 0;
    let peak = 0;

    const task = async (n: number) =>
      pool.run(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 20 + n * 5));
        inFlight--;
        return n;
      });

    const results = await Promise.all([task(0), task(1), task(2), task(3), task(4)]);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(pool.getStats().completed).toBe(5);
  });

  it("maxConcurrent = 1: strikt seriell (FIFO-Reihenfolge)", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 1 });
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        pool.run(async () => {
          order.push(n);
          await new Promise((r) => setTimeout(r, 10));
          return n;
        }),
      ),
    );
    expect(order).toEqual([1, 2, 3]);
    expect(pool.activeCount).toBe(0);
  });

  it("Release ohne run(): Slot wird freigegeben, nächster Wartender rückt nach", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 1 });
    const release = await pool.acquire("a");
    expect(pool.activeCount).toBe(1);

    const second = pool.acquire("b");
    let resolved = false;
    void second.then((r) => {
      resolved = true;
      r();
    });
    // Queue voll — noch kein Slot.
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(true);
    expect(pool.getStats().active).toBe(0);
  });

  it("Fehler in run() gibt den Slot trotzdem frei (finally-Vertrag)", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 1 });
    await expect(pool.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    // Slot frei → nächster Call startet sofort.
    const result = await pool.run(async () => "ok");
    expect(result).toBe("ok");
    expect(pool.getStats().completed).toBe(2);
    expect(pool.getStats().active).toBe(0);
  });

  it("Doppelt-release ist idempotent (kein Slot-Leak/Überzähler)", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 2 });
    const release = await pool.acquire("x");
    release();
    expect(() => release()).not.toThrow();
    const s = pool.getStats();
    expect(s.active).toBe(0);
    expect(s.completed).toBe(1);
  });
});

describe("OllamaConnectionPool: Queue-Timeout", () => {
  it("Wartender Request fliegt nach queueTimeoutMs mit sprechendem Fehler raus", async () => {
    vi.useFakeTimers();
    try {
      const pool = new OllamaConnectionPool({ maxConcurrent: 1, queueTimeoutMs: 100 });
      const blocker = await pool.acquire("blocker");

      const victim = pool.acquire("victim");
      const expectation = expect(victim).rejects.toThrow(/Queue-Timeout/);

      await vi.advanceTimersByTimeAsync(150);
      await expectation;

      blocker();
    } finally {
      vi.useRealTimers();
    }
    expect(true).toBe(true); // Statistik-Reset via afterEach-Pools nicht nötig (eigener Pool)
  });

  it("Abgewiesene Requests zählen in den Statistiken (rejected)", async () => {
    vi.useFakeTimers();
    try {
      const pool = new OllamaConnectionPool({ maxConcurrent: 1, queueTimeoutMs: 50 });
      const blocker = await pool.acquire("b");
      const victim = pool.acquire("v").catch(() => "rejected");
      await vi.advanceTimersByTimeAsync(100);
      await victim;
      blocker();
      expect(pool.getStats().rejected).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("queueTimeoutMs = 0: keine Queue-Timeouts (unbegrenztes Warten)", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 1, queueTimeoutMs: 0 });
    const blocker = await pool.acquire("b");
    const p = pool.acquire("waiter").then((r) => { r(); return "ok"; });
    await new Promise((r) => setTimeout(r, 30));
    blocker();
    await expect(p).resolves.toBe("ok");
  });
});

describe("OllamaConnectionPool: Statistik", () => {
  it("avgWaitMs/maxWaitMs spiegeln die Wartezeit in der Queue", async () => {
    const pool = new OllamaConnectionPool({ maxConcurrent: 1 });
    const first = await pool.acquire("first");
    const p2 = pool.acquire("second").then((r) => { r(); return "s"; });
    await new Promise((r) => setTimeout(r, 25));
    first();
    await p2;
    const s = pool.getStats();
    expect(s.completed).toBe(2);
    expect(s.maxWaitMs).toBeGreaterThanOrEqual(20);
    expect(s.avgWaitMs).toBeGreaterThan(0);
  });
});

describe("Singleton pro baseUrl", () => {
  it("getOllamaPool liefert pro baseUrl dieselbe Instanz, andere baseUrl einen neuen Pool", () => {
    const a = getOllamaPool("http://127.0.0.1:11434");
    const a2 = getOllamaPool("http://127.0.0.1:11434/");
    const b = getOllamaPool("http://127.0.0.1:11435");
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });

  it("resetOllamaPools leert das Singleton-Verzeichnis", () => {
    const a = getOllamaPool();
    resetOllamaPools();
    expect(getOllamaPool()).not.toBe(a);
  });
});
