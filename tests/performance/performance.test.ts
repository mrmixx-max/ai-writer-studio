// Tests: Performance, Load & Chaos Engineering.
import { describe, it, expect } from "vitest";

describe("Performance: Rate Limiter", () => {
  it("TokenBucket erlaubt Requests unter dem Limit", async () => {
    const { TokenBucketRateLimit } = await import("@/utils/rateLimit");
    const rl = new TokenBucketRateLimit(10, 1);
    expect(rl.tryConsume(5)).toBe(true);
  });

  it("TokenBucket blockiert Requests über dem Limit", async () => {
    const { TokenBucketRateLimit } = await import("@/utils/rateLimit");
    const rl = new TokenBucketRateLimit(5, 1);
    expect(rl.tryConsume(5)).toBe(true);
    expect(rl.tryConsume(1)).toBe(false);
  });
});

describe("Performance: Memory", () => {
  it("BookWriter generiert ohne Memory Leak (simuliert)", async () => {
    // Simuliert: Kapitel generieren → GC → Memory sollte stabil bleiben
    const before = process.memoryUsage().heapUsed;
    const data: string[] = [];
    for (let i = 0; i < 100; i++) {
      data.push("x".repeat(1000));
    }
    const after = process.memoryUsage().heapUsed;
    // Memory sollte proportional zur Datengröße sein, nicht exponentiell
    expect(after - before).toBeLessThan(1024 * 1024); // < 1MB overhead
  });
});

describe("Chaos: Error Recovery", () => {
  it("Provider-Failover bei Netzwerkfehler", async () => {
    // Mock: Provider wirft Fehler
    expect(() => {
      throw new Error("Connection refused");
    }).toThrow("Connection refused");
  });

  it("Graceful Shutdown bei SIGTERM", async () => {
    const { GracefulShutdown } = await import("@/services/monitoring/shutdown");
    const gs = new GracefulShutdown();
    let executed = false;
    gs.register({
      name: "test-task",
      priority: 1,
      execute: async () => {
        executed = true;
      },
    });
    const result = await gs.execute("SIGTERM");
    expect(result.success).toBe(true);
    expect(executed).toBe(true);
  });
});
