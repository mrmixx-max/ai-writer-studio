// Shutdown-Regressionstests (Agent a3-sec): Task-Timeout statt Hänger.
import { describe, it, expect } from "vitest";
import { GracefulShutdown } from "./shutdown";

describe("GracefulShutdown Timeout (a3-sec)", () => {
  it("hängender Task wird nach timeoutMs als fehlgeschlagen verbucht", async () => {
    const sd = new GracefulShutdown();
    sd.register({
      name: "haenger",
      priority: 10,
      timeoutMs: 50,
      execute: () => new Promise<void>(() => {}),
    });
    const res = await sd.execute("SIGTERM");
    expect(res.success).toBe(false);
    expect(res.completedTasks).toEqual([]);
    expect(res.failedTasks).toHaveLength(1);
    expect(res.failedTasks[0].name).toBe("haenger");
    expect(res.failedTasks[0].error).toContain("Zeitlimit");
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("schneller Task läuft normal durch, andere Tasks trotzdem", async () => {
    const sd = new GracefulShutdown();
    const order: string[] = [];
    sd.register({
      name: "schnell",
      priority: 10,
      timeoutMs: 5000,
      execute: async () => {
        order.push("schnell");
      },
    });
    sd.register({
      name: "fehler",
      priority: 5,
      execute: async () => {
        throw new Error("boom");
      },
    });
    const res = await sd.execute();
    expect(res.completedTasks).toEqual(["schnell"]);
    expect(res.failedTasks).toHaveLength(1);
    expect(order).toEqual(["schnell"]);
  });

  it("timeoutMs 0 = kein Timeout", async () => {
    const sd = new GracefulShutdown();
    sd.register({
      name: "langsam-ok",
      priority: 10,
      timeoutMs: 0,
      execute: async () => {
        await new Promise((r) => setTimeout(r, 120));
      },
    });
    const res = await sd.execute();
    expect(res.success).toBe(true);
    expect(res.completedTasks).toEqual(["langsam-ok"]);
  });
});
