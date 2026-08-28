// Writing-Analytics: Persistenz (localStorage) + Berechnungen (Streaks, Produktivität).
// Tagesbasierte Wortzahl-Historie, Sitzungs-Events, Ziele.

export interface DayEntry {
  date: string; // YYYY-MM-DD (lokal)
  words: number; // netto geschriebene Wörter an diesem Tag
  sessions: number; // Anzahl Schreib-Sessions (Starts)
  activeMs: number; // aktive Schreibzeit in ms
  pauseMs: number; // Pausenzeit in ms
}

export interface WritingGoal {
  id: string;
  type: "dailyWords" | "deadline";
  // dailyWords: Ziel-Wortzahl pro Tag; deadline: Ziel-Wortzahl bis Datum
  target: number;
  deadline?: string; // YYYY-MM-DD bei type=deadline
  createdAt: string;
}

export interface SessionEvent {
  startedAt: number; // epoch ms
  lastActivityAt: number;
  words: number; // in dieser Session geschriebene Wörter (netto)
}

export interface AnalyticsData {
  days: Record<string, DayEntry>;
  goals: WritingGoal[];
  currentSession: SessionEvent | null;
}

const STORAGE_KEY = "ai-writer-studio.analytics.v1";
const PAUSE_THRESHOLD_MS = 5 * 60 * 1000; // > 5 min ohne Aktivität = Pause-Ende der Session

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

export function emptyEntry(date: string): DayEntry {
  return { date, words: 0, sessions: 0, activeMs: 0, pauseMs: 0 };
}

export function loadData(): AnalyticsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AnalyticsData;
      return {
        days: parsed.days ?? {},
        goals: parsed.goals ?? [],
        currentSession: parsed.currentSession ?? null,
      };
    }
  } catch {
    // korrupte Daten → neu starten
  }
  return { days: {}, goals: [], currentSession: null };
}

export function saveData(data: AnalyticsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Speichern ist best-effort
  }
}

/** Streak: aufeinanderfolgende Tage mit words > 0, endend heute oder gestern. */
export function calcStreak(days: Record<string, DayEntry>): { current: number; longest: number } {
  let current = 0;
  let offset = 0;
  // Wenn heute noch nichts geschrieben → Streak darf mit gestern beginnen.
  if (!days[todayKey()] || days[todayKey()].words <= 0) offset = 1;
  while ((days[daysAgoKey(offset + current)]?.words ?? 0) > 0) current++;
  // Longest: über alle bekannten Tage
  const sorted = Object.keys(days).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if ((days[key]?.words ?? 0) <= 0) {
      run = 0;
      prev = key;
      continue;
    }
    const contiguous = prev !== null && isNextDay(prev, key);
    run = contiguous && run > 0 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }
  return { current, longest: Math.max(longest, current) };
}

function isNextDay(prevKey: string, key: string): boolean {
  const [y, m, d] = prevKey.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return todayKey(next) === key;
}

/** Fortschritt des täglichen Wortziels (0..1+, null wenn kein Ziel). */
export function dailyGoalProgress(
  days: Record<string, DayEntry>,
  goals: WritingGoal[],
  date = todayKey(),
): { target: number; words: number; ratio: number } | null {
  const g = goals.find((x) => x.type === "dailyWords");
  if (!g) return null;
  const words = days[date]?.words ?? 0;
  return { target: g.target, words, ratio: g.target > 0 ? words / g.target : 0 };
}

/** Deadlines: verbleibende Wörter pro Tag bis zum Ziel. */
export function deadlineProgress(
  days: Record<string, DayEntry>,
  goals: WritingGoal[],
): { goal: WritingGoal; remaining: number; daysLeft: number; perDay: number; baseline: number } | null {
  const g = goals.find((x) => x.type === "deadline" && x.deadline);
  if (!g || !g.deadline) return null;
  const [y, m, d] = g.deadline.split("-").map(Number);
  const dl = new Date(y, m - 1, d);
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((dl.getTime() - today.getTime()) / 86400000));
  // Basis = Summe aller Wörter in der Historie (fortlaufendes Projekt-Wortkonto)
  const baseline = Object.values(days).reduce((acc, e) => acc + e.words, 0);
  const remaining = Math.max(0, g.target - baseline);
  const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  return { goal: g, remaining, daysLeft, perDay, baseline };
}

/** Produktivität einer Session: aktive Zeit vs. Pausen, Wörter pro Stunde. */
export function productivity(ev: SessionEvent, pauseMs: number): {
  activeMs: number;
  totalMs: number;
  wordsPerHour: number;
} {
  const totalMs = Math.max(0, ev.lastActivityAt - ev.startedAt);
  const activeMs = Math.max(0, totalMs - pauseMs);
  const hours = activeMs / 3600000;
  return { activeMs, totalMs, wordsPerHour: hours > 0 ? ev.words / hours : 0 };
}

export function isPauseElapsed(lastActivityAt: number, now: number): boolean {
  return now - lastActivityAt > PAUSE_THRESHOLD_MS;
}

export const PAUSE_THRESHOLD_MS_VALUE = PAUSE_THRESHOLD_MS;
