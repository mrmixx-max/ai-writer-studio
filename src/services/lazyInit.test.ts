import { describe, it, expect, beforeEach } from "vitest";
import {
  lazyModule,
  resetLazyModules,
  preloadCritical,
  deferHeavy,
  HEAVY_MODULES,
} from "@/services/lazyInit";

beforeEach(() => {
  resetLazyModules();
});

describe("lazyModule", () => {
  it("loader called once under parallel access", async () => {
    let calls = 0;
    const mod = lazyModule(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { value: 42 };
    });
    const [a, b, c] = await Promise.all([mod.load(), mod.load(), mod.load()]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mod.isLoaded()).toBe(true);
    expect(mod.get()).toEqual({ value: 42 });
  });

  it("prefetch warms cache", async () => {
    let calls = 0;
    const mod = lazyModule(async () => {
      calls++;
      return "warmed";
    });
    expect(mod.isLoaded()).toBe(false);
    mod.prefetch();
    await mod.load();
    await mod.load();
    expect(calls).toBe(1);
    expect(mod.isLoaded()).toBe(true);
    expect(mod.get()).toBe("warmed");
  });

  it("reset clears cache so loader runs again", async () => {
    let calls = 0;
    const mod = lazyModule(async () => {
      calls++;
      return calls;
    });
    expect(await mod.load()).toBe(1);
    mod.reset();
    expect(mod.isLoaded()).toBe(false);
    expect(mod.get()).toBeUndefined();
    expect(await mod.load()).toBe(2);
    expect(calls).toBe(2);
  });

  it("loader error propagates and retries on next call", async () => {
    let calls = 0;
    const mod = lazyModule<string>(async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return "recovered";
    });
    await expect(mod.load()).rejects.toThrow("boom");
    expect(mod.isLoaded()).toBe(false);
    // Retry: second call must invoke the loader again and succeed.
    await expect(mod.load()).resolves.toBe("recovered");
    expect(calls).toBe(2);
    expect(mod.isLoaded()).toBe(true);
  });

  it("resetLazyModules clears all registered modules", async () => {
    let aCalls = 0;
    let bCalls = 0;
    const a = lazyModule(async () => ++aCalls);
    const b = lazyModule(async () => ++bCalls);
    await a.load();
    await b.load();
    expect(a.isLoaded() && b.isLoaded()).toBe(true);
    resetLazyModules();
    expect(a.isLoaded()).toBe(false);
    expect(b.isLoaded()).toBe(false);
    await a.load();
    await b.load();
    expect(aCalls).toBe(2);
    expect(bCalls).toBe(2);
  });
});

describe("helpers", () => {
  it("HEAVY_MODULES lists chapter-gen, bulkRunner, export/kdp docs", () => {
    const names = HEAVY_MODULES.map((m) => m.name);
    expect(names).toContain("chapter-gen");
    expect(names).toContain("bulkRunner");
    expect(names.some((n) => n.includes("export"))).toBe(true);
    expect(names.some((n) => n.includes("kdp"))).toBe(true);
    for (const m of HEAVY_MODULES) {
      expect(m.importPath.length).toBeGreaterThan(0);
      expect(m.reason.length).toBeGreaterThan(0);
      expect(typeof m.load).toBe("function");
    }
  });

  it("preloadCritical resolves all modules", async () => {
    const a = lazyModule(async () => "a");
    const b = lazyModule(async () => "b");
    await expect(preloadCritical([a, b])).resolves.toEqual(["a", "b"]);
  });

  it("deferHeavy runs fn asynchronously", async () => {
    let ran = false;
    deferHeavy(() => {
      ran = true;
    });
    expect(ran).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(true);
  });
});
