// Schreib-Sprint-Timer: Presets, Wortziel, Live-Zähler, Streaks, Statistik.

export interface SprintPreset {
  label: string;
  minutes: number;
  wordGoal: number;
}

export const SPRINT_PRESETS: SprintPreset[] = [
  { label: "15 Min", minutes: 15, wordGoal: 300 },
  { label: "25 Min", minutes: 25, wordGoal: 500 },
  { label: "45 Min", minutes: 45, wordGoal: 1000 },
];

export interface SprintStats {
  totalSprints: number;
  totalWords: number;
  totalMinutes: number;
  currentStreak: number;
  bestStreak: number;
  lastSprintDate: number | null;
}

const STATS_KEY = "ai-writer-studio.sprint.v1";
/** Vorgaenger-Schluessel (ungeprefixt): wird nur noch gelesen/migriert. */
const LEGACY_STATS_KEY = "sprint_stats";

const DEFAULT_STATS: SprintStats = {
  totalSprints: 0,
  totalWords: 0,
  totalMinutes: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastSprintDate: null,
};

function isValidStats(v: unknown): v is SprintStats {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.totalSprints === "number" &&
    typeof s.totalWords === "number" &&
    typeof s.totalMinutes === "number" &&
    typeof s.currentStreak === "number" &&
    typeof s.bestStreak === "number" &&
    (s.lastSprintDate === null || typeof s.lastSprintDate === "number")
  );
}

/** Laedt gespeicherte Statistik (mit Legacy-Migration + Formvalidierung). */
export function loadSprintStats(): SprintStats {
  try {
    const raw =
      localStorage.getItem(STATS_KEY) ?? localStorage.getItem(LEGACY_STATS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidStats(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_STATS };
}

/** Speichert Statistik (best-effort; raeumt Legacy-Schluessel weg). */
export function saveSprintStats(stats: SprintStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    localStorage.removeItem(LEGACY_STATS_KEY);
  } catch {
    /* ignore (z. B. Private Mode / Quota) */
  }
}

/** Prüft ob heute schon ein Sprint gemacht wurde. */
function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Aktualisiert Statistik nach einem Sprint. */
export function recordSprint(words: number, minutes: number): SprintStats {
  const stats = loadSprintStats();
  const now = Date.now();

  stats.totalSprints++;
  stats.totalWords += words;
  stats.totalMinutes += minutes;

  // Streak-Logik
  if (stats.lastSprintDate && isSameDay(stats.lastSprintDate, now)) {
    // Heute schon — Streak beibehalten
  } else if (stats.lastSprintDate && isSameDay(stats.lastSprintDate, now - 86400000)) {
    // Gestern — Streak erhöhen
    stats.currentStreak++;
  } else {
    // Länger her — Streak neu starten
    stats.currentStreak = 1;
  }

  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
  stats.lastSprintDate = now;

  saveSprintStats(stats);
  return stats;
}

/** Tages-Statistik. */
export function getTodayStats(): { sprints: number; words: number; minutes: number } {
  const stats = loadSprintStats();
  if (!stats.lastSprintDate) return { sprints: 0, words: 0, minutes: 0 };

  const today = new Date();
  const last = new Date(stats.lastSprintDate);

  if (
    today.getFullYear() === last.getFullYear() &&
    today.getMonth() === last.getMonth() &&
    today.getDate() === last.getDate()
  ) {
    return {
      sprints: stats.totalSprints,
      words: stats.totalWords,
      minutes: stats.totalMinutes,
    };
  }

  return { sprints: 0, words: 0, minutes: 0 };
}
