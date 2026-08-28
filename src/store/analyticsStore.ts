// Analytics-Store: Fortschritt, Ziele, Sitzungen, Streaks. Persistiert via services/analytics.
import { create } from "zustand";
import {
  loadData,
  saveData,
  todayKey,
  calcStreak,
  productivity,
  isPauseElapsed,
  type DayEntry,
  type AnalyticsData,
  type SessionEvent,
} from "@/services/analytics";

interface AnalyticsState extends AnalyticsData {
  // abgeleitet (on-demand berechnet)
  streak: { current: number; longest: number };
  todayWords: number;
  // Aktionen
  recordWords: (delta: number) => void; // +/− Wörter beim Tippen/Löschen
  touchActivity: () => void; // Schreibaktivität (Session-Timer)
  tick: () => void; // periodisch: Pausen zählen
  endSession: () => void; // Session abschließen
  setDailyGoal: (target: number) => void;
  setDeadlineGoal: (target: number, deadline: string) => void;
  removeGoal: (id: string) => void;
  refresh: () => void; // Streak etc. neu berechnen
}

function entryFor(days: Record<string, DayEntry>, date: string): DayEntry {
  return days[date] ?? { date, words: 0, sessions: 0, activeMs: 0, pauseMs: 0 };
}

function persist(s: AnalyticsState): void {
  const data: AnalyticsData = { days: s.days, goals: s.goals, currentSession: s.currentSession };
  saveData(data);
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  ...loadData(),
  streak: { current: 0, longest: 0 },
  todayWords: get()?.days ? (get().days[todayKey()]?.words ?? 0) : 0,

  recordWords: (delta) => {
    if (!delta) return;
    const date = todayKey();
    set((s) => {
      const e = entryFor(s.days, date);
      const nextDays: Record<string, DayEntry> = {
        ...s.days,
        [date]: { ...e, words: Math.max(0, e.words + delta) },
      };
      // Wörter auch der laufenden Session gutschreiben
      const cs: SessionEvent | null = s.currentSession
        ? { ...s.currentSession, words: Math.max(0, s.currentSession.words + delta), lastActivityAt: Date.now() }
        : { startedAt: Date.now(), lastActivityAt: Date.now(), words: Math.max(0, delta) };
      const next = { ...s, days: nextDays, currentSession: cs, todayWords: nextDays[date].words };
      persist(next);
      return next;
    });
  },

  touchActivity: () => {
    const now = Date.now();
    set((s) => {
      // Neue Session, wenn keine existiert oder Pause-Schwelle überschritten
      let cs = s.currentSession;
      let days = s.days;
      const date = todayKey();
      if (!cs || isPauseElapsed(cs.lastActivityAt, now)) {
        if (cs) {
          // alte Session abschließen (inkl. Pause bis jetzt)
          const oldDate = todayKey(new Date(cs.lastActivityAt));
          const oldE = entryFor(days, oldDate);
          const prod = productivity(cs, Math.max(0, now - cs.lastActivityAt) + oldE.pauseMs);
          days = {
            ...days,
            [oldDate]: {
              ...oldE,
              activeMs: oldE.activeMs + prod.activeMs,
              pauseMs: oldE.pauseMs + Math.max(0, now - cs.lastActivityAt),
            },
          };
        }
        cs = { startedAt: now, lastActivityAt: now, words: 0 };
        const e = entryFor(days, date);
        days = { ...days, [date]: { ...e, sessions: e.sessions + 1 } };
      } else {
        cs = { ...cs, lastActivityAt: now };
      }
      const next = { ...s, days, currentSession: cs };
      persist(next);
      return next;
    });
  },

  tick: () => {
    const s = get();
    const cs = s.currentSession;
    if (!cs) return;
    const now = Date.now();
    if (!isPauseElapsed(cs.lastActivityAt, now)) return; // noch aktiv, nichts zu tun
    // Pause akkumulieren (einfach: volle Zeit seit letzter Aktivität als Pause buchen)
    const date = todayKey(new Date(cs.lastActivityAt));
    const e = entryFor(s.days, date);
    const pauseDelta = now - cs.lastActivityAt;
    const next = {
      ...s,
      days: { ...s.days, [date]: { ...e, pauseMs: e.pauseMs + pauseDelta } },
    };
    persist(next);
  },

  endSession: () => {
    const s = get();
    const cs = s.currentSession;
    if (!cs) return;
    const date = todayKey(new Date(cs.startedAt));
    const e = entryFor(s.days, date);
    const prod = productivity(cs, 0);
    const next: AnalyticsState = {
      ...s,
      days: {
        ...s.days,
        [date]: { ...e, activeMs: e.activeMs + prod.activeMs, pauseMs: e.pauseMs },
      },
      currentSession: null,
    };
    persist(next);
    set(next);
  },

  setDailyGoal: (target) => {
    set((s) => {
      const goals = s.goals.filter((g) => g.type !== "dailyWords");
      if (target > 0) {
        goals.push({ id: `daily-${Date.now()}`, type: "dailyWords", target, createdAt: new Date().toISOString() });
      }
      const next = { ...s, goals };
      persist(next);
      return next;
    });
  },

  setDeadlineGoal: (target, deadline) => {
    set((s) => {
      const goals = s.goals.filter((g) => g.type !== "deadline");
      if (target > 0 && deadline) {
        goals.push({ id: `deadline-${Date.now()}`, type: "deadline", target, deadline, createdAt: new Date().toISOString() });
      }
      const next = { ...s, goals };
      persist(next);
      return next;
    });
  },

  removeGoal: (id) => {
    set((s) => {
      const next = { ...s, goals: s.goals.filter((g) => g.id !== id) };
      persist(next);
      return next;
    });
  },

  refresh: () => {
    const s = get();
    set({
      streak: calcStreak(s.days),
      todayWords: s.days[todayKey()]?.words ?? 0,
    });
  },
}));
