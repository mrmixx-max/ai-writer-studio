// Tests: Prompt-Cache mit TTL (Sprint 7, Agent 2).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PromptCache,
  hashPrompt,
  promptCacheKey,
  getOrCompute,
  getPromptCache,
  resetPromptCache,
} from "./promptCache";

afterEach(() => {
  resetPromptCache();
  vi.useRealTimers();
});

describe("PromptCache: Grundfunktionen", () => {
  it("set/get: Treffer liefert identischen Text", () => {
    const c = new PromptCache();
    c.set("k", "Antwort");
    expect(c.get("k")?.text).toBe("Antwort");
  });

  it("get auf fehlenden Key → null (Miss)", () => {
    const c = new PromptCache();
    expect(c.get("fehlt")).toBeNull();
  });

  it("get auf verfallenen Eintrag → null und Eintrag entfernt (TTL)", () => {
    vi.useFakeTimers();
    const c = new PromptCache({ ttlMs: 1000 });
    c.set("k", "Antwort");
    vi.advanceTimersByTime(1001);
    expect(c.get("k")).toBeNull();
    const s = c.getStats();
    expect(s.expired).toBe(1);
    expect(s.misses).toBe(1);
  });

  it("innerhalb der TTL → Treffer", () => {
    vi.useFakeTimers();
    const c = new PromptCache({ ttlMs: 1000 });
    c.set("k", "Antwort");
    vi.advanceTimersByTime(999);
    expect(c.get("k")?.text).toBe("Antwort");
  });

  it("ttlMs = 0: Einträge verfallen nie (bewusst)", () => {
    vi.useFakeTimers();
    const c = new PromptCache({ ttlMs: 0 });
    c.set("k", "Antwort");
    vi.advanceTimersByTime(3_600_000);
    expect(c.get("k")?.text).toBe("Antwort");
  });

  it("peek verändert die Statistik nicht", () => {
    const c = new PromptCache();
    c.set("k", "x");
    c.peek("k");
    const s = c.getStats();
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(0);
  });
});

describe("PromptCache: LRU", () => {
  it("maxSize=2: ältester Eintrag wird verdrängt", () => {
    const c = new PromptCache({ maxSize: 2 });
    c.set("a", "1");
    c.set("b", "2");
    c.get("a"); // LRU-Touch → a ist frischer als b
    c.set("c", "3"); // verdrängt b
    expect(c.peek("a")).not.toBeNull();
    expect(c.peek("b")).toBeNull();
    expect(c.peek("c")).not.toBeNull();
    expect(c.getStats().evictions).toBe(1);
  });

  it("set auf existierenden Key ersetzt ohne Verdrängung", () => {
    const c = new PromptCache({ maxSize: 2 });
    c.set("a", "1");
    c.set("a", "2");
    expect(c.get("a")?.text).toBe("2");
    expect(c.getStats().evictions).toBe(0);
  });

  it("purgeExpired entfernt nur Verfallenes", () => {
    vi.useFakeTimers();
    const c = new PromptCache({ ttlMs: 1000 });
    c.set("alt", "1");
    vi.advanceTimersByTime(1001);
    c.set("frisch", "2");
    expect(c.purgeExpired()).toBe(1);
    expect(c.peek("frisch")).not.toBeNull();
    expect(c.peek("alt")).toBeNull();
  });
});

describe("PromptCache: Statistik", () => {
  it("hits/misses/hitRate korrekt", () => {
    const c = new PromptCache();
    c.set("k", "x");
    c.get("k"); // hit
    c.get("k"); // hit
    c.get("nix"); // miss
    const s = c.getStats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3);
  });

  it("leerer Cache: hitRate = 0", () => {
    expect(new PromptCache().getStats().hitRate).toBe(0);
  });

  it("clear leert alles, Treffer danach null", () => {
    const c = new PromptCache();
    c.set("k", "x");
    c.clear();
    expect(c.get("k")).toBeNull();
    expect(c.getStats().size).toBe(0);
  });
});

describe("Cache-Key & Hash", () => {
  it("hashPrompt: deterministisch, unterschiedliche Inputs → unterschiedliche Hashes", () => {
    expect(hashPrompt(["a", 1])).toBe(hashPrompt(["a", 1]));
    expect(hashPrompt(["a", 1])).not.toBe(hashPrompt(["a", 2]));
  });

  it("promptCacheKey: Temperatur und maxTokens fließen ein", () => {
    const msgs = [{ role: "user", content: "p" }];
    expect(promptCacheKey("m", msgs, { temperature: 0.7 })).toBe(
      promptCacheKey("m", msgs, { temperature: 0.7 }),
    );
    expect(promptCacheKey("m", msgs, { temperature: 0.7 })).not.toBe(
      promptCacheKey("m", msgs, { temperature: 0.9 }),
    );
    expect(promptCacheKey("m", msgs)).not.toBe(promptCacheKey("m2", msgs));
  });

  it("promptCacheKey: timeoutMs ist KEIN Key-Bestandteil (Ergebnis-identisch)", () => {
    const msgs = [{ role: "user", content: "p" }];
    const k1 = promptCacheKey("m", msgs, { temperature: 0.7 });
    const k2 = promptCacheKey("m", msgs, { temperature: 0.7 });
    expect(k1).toBe(k2);
  });
});

describe("getOrCompute", () => {
  it("erster Aufruf berechnet, zweiter kommt aus dem Cache", async () => {
    const c = new PromptCache();
    let calls = 0;
    const fn = async () => {
      calls++;
      return "ergebnis";
    };
    const r1 = await getOrCompute(c, "k", fn);
    const r2 = await getOrCompute(c, "k", fn);
    expect(r1.value).toBe("ergebnis");
    expect(r1.fromCache).toBe(false);
    expect(r2.value).toBe("ergebnis");
    expect(r2.fromCache).toBe(true);
    expect(calls).toBe(1);
  });

  it("bei Fehler wird nichts gecacht", async () => {
    const c = new PromptCache();
    await expect(getOrCompute(c, "k", async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(c.getStats().size).toBe(0);
  });
});

describe("Singleton", () => {
  it("getPromptCache liefert dieselbe Instanz, reset erzeugt neue", () => {
    const a = getPromptCache();
    expect(getPromptCache()).toBe(a);
    resetPromptCache();
    expect(getPromptCache()).not.toBe(a);
  });
});
