// Tests: Rate-Limiting
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "@/utils/rateLimit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      maxTokensPerMinute: 1000,
      maxRequestsPerMinute: 5,
    });
  });

  it("erlaubt Requests innerhalb des Limits", () => {
    expect(limiter.tryAcquire(100)).toBe(true);
    expect(limiter.tryAcquire(100)).toBe(true);
    expect(limiter.tryAcquire(100)).toBe(true);
  });

  it("blockiert bei Überschreitung des Token-Limits", () => {
    expect(limiter.tryAcquire(900)).toBe(true);
    expect(limiter.tryAcquire(200)).toBe(false);
  });

  it("blockiert bei Überschreitung des Request-Limits", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire(10)).toBe(true);
    }
    expect(limiter.tryAcquire(10)).toBe(false);
  });

  it("resets after 60 seconds", () => {
    for (let i = 0; i < 5; i++) {
      limiter.tryAcquire(100);
    }
    expect(limiter.tryAcquire(100)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(limiter.tryAcquire(100)).toBe(true);
  });

  it("check() returns correct status", () => {
    limiter.tryAcquire(300);
    const status = limiter.check(400);
    expect(status.allowed).toBe(true);
    expect(status.tokensRemaining).toBe(700);
    expect(status.requestsRemaining).toBe(4);
  });

  it("check() returns not allowed when over limit", () => {
    limiter.tryAcquire(900);
    const status = limiter.check(200);
    expect(status.allowed).toBe(false);
    expect(status.tokensRemaining).toBe(100);
  });

  it("reset() clears all counters", () => {
    limiter.tryAcquire(500);
    limiter.reset();
    expect(limiter.tryAcquire(500)).toBe(true);
  });
});
