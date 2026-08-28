// @vitest-environment jsdom
// Tests für das Plugin-System: Hooks, Events, Lifecycle, Manager.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { HookRegistry } from "./api/hooks";
import { EventBus } from "./api/events";
import { versionGt } from "./api/lifecycle";
import { PluginManager } from "./PluginManager";
import type { PluginDefinition } from "./types";

function makePlugin(id: string, version = "0.1.0", activate?: PluginDefinition["activate"]): PluginDefinition {
  return {
    manifest: { id, name: id, version },
    activate:
      activate ??
      (() => {
        /* passiv */
      }),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("HookRegistry", () => {
  it("führt Handler sequenziell als Kette aus", () => {
    const hooks = new HookRegistry();
    hooks.register("statusbar:wordcount", (v) => ((v as number) + 1));
    hooks.register("statusbar:wordcount", (v) => ((v as number) * 10));
    expect(hooks.run("statusbar:wordcount", 1)).toBe(20);
  });

  it("isoliert Fehler einzelner Handler", () => {
    const hooks = new HookRegistry();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    hooks.register("statusbar:wordcount", () => {
      throw new Error("boom");
    });
    hooks.register("statusbar:wordcount", (v) => ((v as number) + 5));
    expect(hooks.run("statusbar:wordcount", 1)).toBe(6);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("EventBus", () => {
  it("zustellen und abmelden", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on("wordcount:changed", handler);
    bus.emit("wordcount:changed", { paragraphs: 2 });
    off();
    bus.emit("wordcount:changed", { paragraphs: 3 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ paragraphs: 2 });
  });
});

describe("versionGt", () => {
  it("vergleicht semantische Versionen", () => {
    expect(versionGt("0.2.0", "0.1.9")).toBe(true);
    expect(versionGt("0.1.0", "0.1.0")).toBe(false);
    expect(versionGt("1.0.0", "0.9.9")).toBe(true);
  });
});

describe("PluginManager", () => {
  it("installiert und aktiviert ein Plugin", async () => {
    const mgr = new PluginManager();
    let active = false;
    await mgr.install(makePlugin("p1", "0.1.0", () => { active = true; }));
    expect(active).toBe(true);
    expect(mgr.list()[0].status).toBe("active");
    expect(mgr.isEnabled("p1")).toBe(true);
  });

  it("deaktiviert und aktiviert wieder", async () => {
    const mgr = new PluginManager();
    let active = false;
    await mgr.install(makePlugin("p1", "0.1.0", () => { active = true; }));
    mgr.disable("p1");
    expect(active).toBe(true); // activate lief, deactivate (keiner) tat nichts
    expect(mgr.list()[0].status).toBe("inactive");
    expect(mgr.isEnabled("p1")).toBe(false);
    await mgr.enable("p1");
    expect(mgr.list()[0].status).toBe("active");
  });

  it("setzt Plugin bei Aktivierungsfehler auf 'error' statt abzustürzen", async () => {
    const mgr = new PluginManager();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await mgr.install(
      makePlugin("bad", "0.1.0", () => {
        throw new Error("kaputt");
      }),
    );
    expect(mgr.list()[0].status).toBe("error");
    expect(mgr.list()[0].error).toContain("kaputt");
    err.mockRestore();
  });

  it("deinstalliert und räumt die Persistenz auf", async () => {
    const mgr = new PluginManager();
    await mgr.install(makePlugin("p1"));
    expect(mgr.list()).toHaveLength(1);
    mgr.uninstall("p1");
    expect(mgr.list()).toHaveLength(0);
    expect(mgr.isEnabled("p1")).toBe(false);
  });

  it("aktualisiert nur auf neuere Versionen", async () => {
    const mgr = new PluginManager();
    await mgr.install(makePlugin("p1", "0.1.0"));
    const changed = await mgr.update(makePlugin("p1", "0.1.1"));
    expect(changed).toBe(true);
    expect(mgr.list()[0].manifest.version).toBe("0.1.1");
    const changedAgain = await mgr.update(makePlugin("p1", "0.1.0"));
    expect(changedAgain).toBe(false);
  });

  it("registriert Badges über den Kontext und gibt sie zurück", async () => {
    const mgr = new PluginManager();
    await mgr.install(
      makePlugin("p1", "0.1.0", (ctx) => {
        ctx.registerBadge("b", () => <span>x</span>);
      }),
    );
    expect(mgr.getBadges()).toHaveLength(1);
    expect(mgr.getBadges()[0].id).toBe("p1:b");
    mgr.disable("p1");
    expect(mgr.getBadges()).toHaveLength(0);
  });

  it("deckt sich bei Reinstallation mit gleicher ID via update", async () => {
    const mgr = new PluginManager();
    await mgr.install(makePlugin("p1", "0.1.0"));
    await mgr.install(makePlugin("p1", "0.1.0"));
    expect(mgr.list()).toHaveLength(1);
  });
});
