// Tests: Chaos engineering with mocked providers — no real network/disk.
// Covers: network down, Ollama crash mid-stream, disk full, slow provider.
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// --- Minimal local harness (mocked seams, no production deps) ---

type ErrorCode = "ECONNREFUSED" | "ENOSPC" | "PROVIDER_TIMEOUT" | "STREAM_CRASHED";

class ProviderError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

function connRefused(): Error {
  const e = new Error("connect ECONNREFUSED 127.0.0.1:11434") as Error & { code: string };
  e.code = "ECONNREFUSED";
  return e;
}

function noSpace(): Error {
  const e = new Error("write failed, no space left on device") as Error & { code: string };
  e.code = "ENOSPC";
  return e;
}

/** Fetch wrapper with a bounded retry budget; maps ECONNREFUSED to ProviderError. */
async function fetchWithRetry(
  fetcher: () => Promise<unknown>,
  opts: { retries: number; backoffMs?: number },
): Promise<{ attempts: number; data: unknown }> {
  let attempts = 0;
  for (;;) {
    attempts++;
    try {
      const data = await fetcher();
      return { attempts, data };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "ECONNREFUSED") {
        if (attempts > opts.retries + 1 - 1 && attempts >= opts.retries + 1) {
          throw new ProviderError("ECONNREFUSED", "provider unreachable (network down)");
        }
        if (opts.backoffMs) await new Promise((r) => setTimeout(r, opts.backoffMs));
        if (attempts >= opts.retries + 1) {
          throw new ProviderError("ECONNREFUSED", "provider unreachable (network down)");
        }
        continue;
      }
      throw err;
    }
  }
}

/** Drain an async token stream, preserving partial output when it throws. */
async function collectStream(gen: AsyncGenerator<string>): Promise<{ text: string; error?: Error }> {
  let text = "";
  try {
    for await (const chunk of gen) text += chunk;
    return { text };
  } catch (err) {
    return { text, error: err as Error };
  }
}

type JobStatus = "pending" | "done" | "failed";
interface Job {
  id: string;
  status: JobStatus;
  error?: string;
}

/** Persist a job via injected writer; ENOSPC marks the job failed (never silent). */
async function saveJob(job: Job, writer: (data: string) => Promise<void>): Promise<Job> {
  try {
    await writer(JSON.stringify(job));
    job.status = "done";
    return job;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ENOSPC") {
      job.status = "failed";
      job.error = "ENOSPC: disk full — job not persisted";
      return job;
    }
    throw err;
  }
}

/** Tiny slot pool with stats, for the slow-provider test. */
class SlotPool {
  private active = 0;
  maxActive = 0;
  constructor(readonly size: number) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.size) throw new Error("pool exhausted");
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      return await task();
    } finally {
      this.active--;
    }
  }
  stats(): { active: number; size: number; maxActive: number } {
    return { active: this.active, size: this.size, maxActive: this.maxActive };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new ProviderError("PROVIDER_TIMEOUT", `timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(id!));
}

// --- Chaos tests ---

describe("Chaos: network down", () => {
  it("fetch rejects ECONNREFUSED → typed error + retry budget respected", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      throw connRefused();
    };
    const retries = 2;
    await expect(fetchWithRetry(fetcher, { retries, backoffMs: 1 })).rejects.toMatchObject({
      name: "ProviderError",
      code: "ECONNREFUSED",
    });
    // Initial attempt + `retries` retries = 3 total fetcher calls.
    expect(calls).toBe(retries + 1);
  });
});

describe("Chaos: Ollama crash mid-stream", () => {
  async function* crashingStream(): AsyncGenerator<string> {
    yield "Hello ";
    yield "world";
    throw new Error("STREAM_CRASHED: ollama process died");
  }

  it("partial output preserved + error surfaced", async () => {
    const { text, error } = await collectStream(crashingStream());
    expect(text).toBe("Hello world");
    expect(error).toBeDefined();
    expect((error as Error).message).toContain("STREAM_CRASHED");
  });
});

describe("Chaos: disk full", () => {
  it("write fails ENOSPC → job marked failed, no silent loss", async () => {
    const job: Job = { id: "job-1", status: "pending" };
    const writer = async () => {
      throw noSpace();
    };
    const result = await saveJob(job, writer);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("ENOSPC");
    // Not silently swallowed: error detail is recorded on the job.
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

describe("Chaos: slow provider", () => {
  it("delayed response → timeout fires, pool slot released, stats consistent", async () => {
    const pool = new SlotPool(2);
    const slow = () => new Promise<string>((r) => setTimeout(() => r("late"), 5000));
    await expect(pool.run(() => withTimeout(slow(), 30))).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
    // Slot released even though the task timed out.
    expect(pool.stats().active).toBe(0);
    // Pool still usable and stats stay consistent.
    const ok = await pool.run(() => Promise.resolve("fast"));
    expect(ok).toBe("fast");
    expect(pool.stats()).toEqual({ active: 0, size: 2, maxActive: 1 });
  });
});
