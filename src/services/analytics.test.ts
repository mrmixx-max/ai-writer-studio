// Coverage-Nachtrag Sprint 3 (Agent 1 — Task 4): analytics.ts —
// Streaks, Ziele, Produktivität, Persistenz (jsdom-localStorage).
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  todayKey,
  daysAgoKey,
  emptyEntry,
  loadData,
  saveData,
  calcStreak,
  dailyGoalProgress,
  deadlineProgress,
  productivity,
  isPauseElapsed,
  PAUSE_THRESHOLD_MS_VALUE,
  type DayEntry,
  type AnalyticsData,
} from "@/services/analytics";

beforeEach(() => {
  localStorage.clear();
});

describe("Tasten-Helfer", () => {
  it("todayKey formatiert YYYY-MM-DD lokal", () => {
    const k = todayKey(new Date(2026, 8, 5, 14, 30));
    expect(k).toBe("2026-09-05");
  });

  it("daysAgoKey: n Tage zurück", () => {
    const today = todayKey();
    const yesterday = daysAgoKey(1);
    expect(yesterday).not.toBe(today);
    expect(yesterday.length).toBe(10);
  });

  it("emptyEntry: Null-Tag", () => {
    expect(emptyEntry("2026-09-05")).toEqual({
      date: "2026-09-05", words: 0, sessions: 0, activeMs: 0, pauseMs: 0,
    });
  });
});

describe("Persistenz (localStorage)", () => {
  it("ohne Daten → leerer Default", () => {
    expect(loadData()).toEqual({ days: {}, goals: [], currentSession: null });
  });

  it("saveData + loadData Rundtrip", () => {
    const data: AnalyticsData = {
      days: { "2026-09-05": { date: "2026-09-05", words: 500, sessions: 2, activeMs: 3600000, pauseMs: 600000 } },
      goals: [{ id: "g1", type: "dailyWords", target: 1000, createdAt: "2026-09-01" }],
      currentSession: { startedAt: 1, lastActivityAt: 2, words: 10 },
    };
    saveData(data);
    expect(loadData()).toEqual(data);
  });

  it("korrupte Daten → leerer Default statt Crash", () => {
    localStorage.setItem("ai-writer-studio.analytics.v1", "{kaputt");
    expect(loadData()).toEqual({ days: {}, goals: [], currentSession: null });
  });

  it("partielle Daten → Felder aufgefüllt (days/goals/currentSession-Defaults)", () => {
    localStorage.setItem("ai-writer-studio.analytics.v1", JSON.stringify({ days: {} }));
    const d = loadData();
    expect(d.goals).toEqual([]);
    expect(d.currentSession).toBeNull();
  });
});

describe("calcStreak", () => {
  it("keine Einträge → 0/0", () => {
    expect(calcStreak({})).toEqual({ current: 0, longest: 0 });
  });

  it("heute geschrieben → current 1", () => {
    const days: Record<string, DayEntry> = {};
    days[todayKey()] = { ...emptyEntry(todayKey()), words: 200 };
    expect(calcStreak(days).current).toBe(1);
  });

  it("heute leer, gestern geschrieben → Streak startet bei gestern", () => {
    const days: Record<string, DayEntry> = {};
    days[daysAgoKey(1)] = { ...emptyEntry(daysAgoKey(1)), words: 200 };
    expect(calcStreak(days).current).toBe(1);
  });

  it("3 aufeinanderfolgende Tage endend heute → current 3", () => {
    const days: Record<string, DayEntry> = {};
    for (const n of [0, 1, 2]) {
      const k = daysAgoKey(n);
      days[k] = { ...emptyEntry(k), words: 100 };
    }
    expect(calcStreak(days).current).toBe(3);
  });

  it("Lücke bricht den Streak (longest zählt vorherige Serie)", () => {
    const days: Record<string, DayEntry> = {};
    // Serie vor 5 Tagen: 5,4,3 — Lücke bei 2 — heute: 0
    for (const n of [5, 4, 3]) {
      const k = daysAgoKey(n);
      days[k] = { ...emptyEntry(k), words: 100 };
    }
    const k = daysAgoKey(0);
    days[k] = { ...emptyEntry(k), words: 100 };
    const s = calcStreak(days);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });

  it("Tage mit words=0 unterbrechen die Serie", () => {
    const days: Record<string, DayEntry> = {};
    for (const n of [0, 1, 2]) {
      const k = daysAgoKey(n);
      days[k] = { ...emptyEntry(k), words: n === 1 ? 0 : 100 };
    }
    expect(calcStreak(days).current).toBe(1);
  });
});

describe("Ziele", () => {
  it("dailyGoalProgress: null ohne Ziel", () => {
    expect(dailyGoalProgress({}, [])).toBeNull();
  });

  it("dailyGoalProgress: ratio korrekt", () => {
    const k = todayKey();
    const days: Record<string, DayEntry> = { [k]: { ...emptyEntry(k), words: 250 } };
    const r = dailyGoalProgress(days, [{ id: "g", type: "dailyWords", target: 1000, createdAt: "x" }]);
    expect(r).toEqual({ target: 1000, words: 250, ratio: 0.25 });
  });

  it("dailyGoalProgress: Ziel 0 → ratio 0 (kein NaN)", () => {
    const r = dailyGoalProgress({}, [{ id: "g", type: "dailyWords", target: 0, createdAt: "x" }]);
    expect(r!.ratio).toBe(0);
  });

  it("deadlineProgress: null ohne Deadline-Ziel", () => {
    expect(deadlineProgress({}, [])).toBeNull();
    expect(deadlineProgress({}, [{ id: "g", type: "dailyWords", target: 10, createdAt: "x" }])).toBeNull();
    expect(deadlineProgress({}, [{ id: "g", type: "deadline", target: 10, createdAt: "x" }])).toBeNull();
  });

  it("deadlineProgress: verbleibende Wörter aus Baseline", () => {
    const k = daysAgoKey(1);
    const days: Record<string, DayEntry> = { [k]: { ...emptyEntry(k), words: 4000 } };
    // Deadline weit in der Zukunft (Jahr 2099) — deterministisch daysLeft > 0.
    const r = deadlineProgress(days, [{ id: "g", type: "deadline", target: 10000, deadline: "2099-01-01", createdAt: "x" }]);
    expect(r).not.toBeNull();
    expect(r!.baseline).toBe(4000);
    expect(r!.remaining).toBe(6000);
    expect(r!.daysLeft).toBeGreaterThan(0);
    expect(r!.perDay).toBeGreaterThan(0);
  });
});

describe("Produktivität & Pause", () => {
  it("productivity: Wörter pro Stunde aus aktiver Zeit", () => {
    const r = productivity({ startedAt: 0, lastActivityAt: 3600000, words: 900 }, 600000);
    expect(r.totalMs).toBe(3600000);
    expect(r.activeMs).toBe(3000000);
    expect(r.wordsPerHour).toBeCloseTo(1080, 0);
  });

  it("productivity: keine aktive Zeit → 0 Wörter/Stunde (kein NaN)", () => {
    const r = productivity({ startedAt: 1000, lastActivityAt: 1000, words: 500 }, 0);
    expect(r.wordsPerHour).toBe(0);
  });

  it("isPauseElapsed: nur über Schwellwert", () => {
    expect(isPauseElapsed(0, PAUSE_THRESHOLD_MS_VALUE)).toBe(false);
    expect(isPauseElapsed(0, PAUSE_THRESHOLD_MS_VALUE + 1)).toBe(true);
  });
});
