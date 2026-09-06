// @vitest-environment jsdom
// Tests für das Writing-Goal-Tracker-Plugin (5. Plugin).
// TDD: Zuerst die Tests, dann die Implementierung in ./writing-goal-tracker.tsx.
// Persistenz wird über injizierbaren Fake-Storage getestet (kein localStorage nötig),
// nur der Registrierungs-Test nutzt den echten PluginManager (jsdom liefert localStorage).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginManager } from "../PluginManager";
import {
  DEFAULT_DAILY_TARGET,
  GOAL_STORAGE_KEY,
  defaultGoalState,
  goalProgress,
  isGoalMet,
  loadGoalState,
  recordWords,
  saveGoalState,
  setDailyTarget,
  todayKey,
  writingGoalTrackerPlugin,
  type GoalStorage,
} from "./writing-goal-tracker";

function makeFakeStorage(initial: Record<string, string> = {}): GoalStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function throwingStorage(): GoalStorage {
  return {
    getItem: () => {
      throw new Error("kein Zugriff");
    },
    setItem: () => {
      throw new Error("kein Zugriff");
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("writing-goal-tracker: Manifest & Registrierung", () => {
  it("hat ein vollständiges Manifest im etablierten Schema (id, name, version, apiVersion)", () => {
    expect(writingGoalTrackerPlugin.manifest.id).toBe("writing-goal-tracker");
    expect(writingGoalTrackerPlugin.manifest.name).toBeTruthy();
    expect(writingGoalTrackerPlugin.manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(writingGoalTrackerPlugin.manifest.apiVersion).toBe("0.1.0");
  });

  it("installiert und aktiviert sich fehlerfrei über den PluginManager", async () => {
    const mgr = new PluginManager();
    await mgr.install(writingGoalTrackerPlugin);
    const entry = mgr.list().find((e) => e.id === "writing-goal-tracker");
    expect(entry?.status).toBe("active");
    expect(mgr.isEnabled("writing-goal-tracker")).toBe(true);
  });

  it("registriert ein Badge 'writing-goal-tracker:daily-goal' und räumt es bei disable wieder ab", async () => {
    const mgr = new PluginManager();
    await mgr.install(writingGoalTrackerPlugin);
    expect(mgr.getBadges().map((b) => b.id)).toContain("writing-goal-tracker:daily-goal");
    mgr.disable("writing-goal-tracker");
    expect(mgr.getBadges()).toHaveLength(0);
  });

  it("reicht den editor:content-change-Hook unverändert durch (Ketten-Verträglichkeit)", async () => {
    const mgr = new PluginManager();
    await mgr.install(writingGoalTrackerPlugin);
    const doc = JSON.stringify({ content: [{ text: "hallo welt" }] });
    expect(mgr.runHook("editor:content-change", doc)).toBe(doc);
  });
});

describe("writing-goal-tracker: Ziellogik (rein, ohne Storage)", () => {
  it("goalProgress rechnet Anteil aus (250/500 = 0,5)", () => {
    expect(goalProgress(250, 500)).toBe(0.5);
  });

  it("goalProgress klemmt Übererfüllung auf 1 und Negative auf 0; Ziel <= 0 ergibt 0", () => {
    expect(goalProgress(900, 500)).toBe(1);
    expect(goalProgress(-5, 500)).toBe(0);
    expect(goalProgress(10, 0)).toBe(0);
    expect(goalProgress(10, -3)).toBe(0);
  });

  it("isGoalMet erkennt die Zielgrenze exakt (500/500 wahr, 499/500 falsch)", () => {
    expect(isGoalMet(500, 500)).toBe(true);
    expect(isGoalMet(499, 500)).toBe(false);
    expect(isGoalMet(10, 0)).toBe(false);
  });

  it("setDailyTarget übernimmt gültige Ziele (gerundet) und ignoriert ungültige", () => {
    const s = defaultGoalState();
    expect(setDailyTarget(s, 1000).dailyTarget).toBe(1000);
    expect(setDailyTarget(s, 750.9).dailyTarget).toBe(750);
    expect(setDailyTarget(s, 0).dailyTarget).toBe(DEFAULT_DAILY_TARGET);
    expect(setDailyTarget(s, -50).dailyTarget).toBe(DEFAULT_DAILY_TARGET);
    expect(setDailyTarget(s, Number.NaN).dailyTarget).toBe(DEFAULT_DAILY_TARGET);
  });

  it("recordWords baut Streak auf: erster Zieltag = 1, Folgetag = 2", () => {
    let s = setDailyTarget(defaultGoalState(), 100);
    s = recordWords(s, 120, "2026-09-04");
    expect(s.streak).toBe(1);
    s = recordWords(s, 150, "2026-09-05");
    expect(s.streak).toBe(2);
    expect(s.wordsByDay["2026-09-05"]).toBe(150);
  });

  it("recordWords setzt den Streak nach einer Lücke auf 1 zurück", () => {
    let s = setDailyTarget(defaultGoalState(), 100);
    s = recordWords(s, 120, "2026-09-01");
    s = recordWords(s, 130, "2026-09-05"); // 3 Tage Lücke
    expect(s.streak).toBe(1);
  });

  it("recordWords ohne Zielerreichung erhöht den Streak nicht", () => {
    let s = setDailyTarget(defaultGoalState(), 100);
    s = recordWords(s, 120, "2026-09-04");
    s = recordWords(s, 20, "2026-09-05");
    expect(s.streak).toBe(1);
    expect(s.wordsByDay["2026-09-05"]).toBe(20);
  });

  it("todayKey liefert das lokale Datum als YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 8, 6, 12, 0, 0))).toBe("2026-09-06");
  });
});

describe("writing-goal-tracker: Persistenz (Fake-Storage, Muster wie PluginManager)", () => {
  it("speichert unter dem Namensraum-Schlüssel und lädt verlustfrei zurück", () => {
    const storage = makeFakeStorage();
    let s = setDailyTarget(defaultGoalState(), 800);
    s = recordWords(s, 810, "2026-09-06");
    saveGoalState(s, storage);
    expect(Object.keys(storage.data)).toContain(GOAL_STORAGE_KEY);
    const loaded = loadGoalState(storage);
    expect(loaded.dailyTarget).toBe(800);
    expect(loaded.streak).toBe(1);
    expect(loaded.wordsByDay["2026-09-06"]).toBe(810);
  });

  it("leerer Storage ergibt Defaults (Ziel 500, Streak 0)", () => {
    const loaded = loadGoalState(makeFakeStorage());
    expect(loaded.dailyTarget).toBe(DEFAULT_DAILY_TARGET);
    expect(loaded.streak).toBe(0);
    expect(loaded.wordsByDay).toEqual({});
  });

  it("kaputtes JSON oder falsche Form fällt auf Defaults zurück, statt zu werfen", () => {
    expect(loadGoalState(makeFakeStorage({ [GOAL_STORAGE_KEY]: "kein-json{{{" })).dailyTarget).toBe(
      DEFAULT_DAILY_TARGET,
    );
    expect(
      loadGoalState(makeFakeStorage({ [GOAL_STORAGE_KEY]: JSON.stringify({ dailyTarget: "viel" }) }))
        .dailyTarget,
    ).toBe(DEFAULT_DAILY_TARGET);
  });

  it("werfender Storage wird best-effort geschluckt (wie PluginManager.writeEnabledIds)", () => {
    const storage = throwingStorage();
    expect(() => saveGoalState(defaultGoalState(), storage)).not.toThrow();
    expect(() => loadGoalState(storage)).not.toThrow();
  });

  it("deactivate existiert und wirft nicht (Lifecycle-Vertrag)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => writingGoalTrackerPlugin.deactivate?.()).not.toThrow();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("ist in LOCAL_REGISTRY eingetragen (findInRegistry findet die Definition)", async () => {
    const { findInRegistry, LOCAL_REGISTRY } = await import("../registry");
    expect(LOCAL_REGISTRY.map((p) => p.manifest.id)).toContain("writing-goal-tracker");
    expect(findInRegistry("writing-goal-tracker")?.manifest.version).toBe(
      writingGoalTrackerPlugin.manifest.version,
    );
  });
});
