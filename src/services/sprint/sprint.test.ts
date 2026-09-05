// Coverage-Nachtrag Sprint 3 (Agent 1 — Task 4): sprint/sprint.ts —
// Sprint-Timer-Statistik inkl. Streak-Logik (jsdom-localStorage).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  SPRINT_PRESETS,
  loadSprintStats,
  saveSprintStats,
  recordSprint,
  getTodayStats,
  type SprintStats,
} from "@/services/sprint/sprint";

beforeEach(() => {
  localStorage.clear();
});

describe("Presets & Persistenz", () => {
  it("drei Presets mit sinnvollen Werten", () => {
    expect(SPRINT_PRESETS).toHaveLength(3);
    for (const p of SPRINT_PRESETS) {
      expect(p.minutes).toBeGreaterThan(0);
      expect(p.wordGoal).toBeGreaterThan(0);
    }
  });

  it("ohne Daten → Null-Statistik", () => {
    expect(loadSprintStats()).toEqual({
      totalSprints: 0, totalWords: 0, totalMinutes: 0,
      currentStreak: 0, bestStreak: 0, lastSprintDate: null,
    });
  });

  it("saveSprintStats + loadSprintStats Rundtrip", () => {
    const stats: SprintStats = {
      totalSprints: 5, totalWords: 2500, totalMinutes: 125,
      currentStreak: 2, bestStreak: 3, lastSprintDate: Date.now(),
    };
    saveSprintStats(stats);
    expect(loadSprintStats()).toEqual(stats);
  });

  it("korrupte Daten → Null-Statistik statt Crash", () => {
    localStorage.setItem("sprint_stats", "{kaputt");
    expect(loadSprintStats().totalSprints).toBe(0);
  });
});

describe("recordSprint (Streak-Logik)", () => {
  it("erster Sprint: Zähler hoch, Streak 1", () => {
    const s = recordSprint(300, 15);
    expect(s.totalSprints).toBe(1);
    expect(s.totalWords).toBe(300);
    expect(s.totalMinutes).toBe(15);
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });

  it("zweiter Sprint am selben Tag: Streak bleibt", () => {
    recordSprint(300, 15);
    const s = recordSprint(500, 25);
    expect(s.totalSprints).toBe(2);
    expect(s.currentStreak).toBe(1);
    expect(s.totalWords).toBe(800);
  });

  it("Sprint an aufeinanderfolgenden Tagen (simuliert): Streak steigt", () => {
    // Gestern als lastSprintDate setzen, dann heute aufzeichnen.
    const yesterday = Date.now() - 86400000;
    saveSprintStats({
      totalSprints: 1, totalWords: 300, totalMinutes: 15,
      currentStreak: 1, bestStreak: 1, lastSprintDate: yesterday,
    });
    const s = recordSprint(400, 20);
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(2);
  });

  it("Sprint nach Lücke: Streak startet bei 1 neu", () => {
    const longAgo = Date.now() - 3 * 86400000;
    saveSprintStats({
      totalSprints: 4, totalWords: 2000, totalMinutes: 100,
      currentStreak: 3, bestStreak: 3, lastSprintDate: longAgo,
    });
    const s = recordSprint(300, 15);
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(3); // Best bleibt erhalten
  });
});

describe("getTodayStats", () => {
  it("ohne Sprints → 0", () => {
    expect(getTodayStats()).toEqual({ sprints: 0, words: 0, minutes: 0 });
  });

  it("Sprint heute → heutige Summen", () => {
    recordSprint(300, 15);
    recordSprint(200, 10);
    expect(getTodayStats()).toEqual({ sprints: 2, words: 500, minutes: 25 });
  });

  it("letzter Sprint gestern → 0 für heute", () => {
    saveSprintStats({
      totalSprints: 2, totalWords: 800, totalMinutes: 40,
      currentStreak: 1, bestStreak: 1, lastSprintDate: Date.now() - 86400000,
    });
    expect(getTodayStats()).toEqual({ sprints: 0, words: 0, minutes: 0 });
  });
});
