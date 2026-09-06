// Writing-Goal-Tracker-Plugin: Tagesziel, Fortschritt, Streak.
//
// Folgt exakt dem Muster von ./word-count-badge.tsx:
// Manifest + activate(ctx) + optionales deactivate(), dazu
// registerBadge + onHook("editor:content-change") + onEvent("wordcount:changed").
//
// Persistenz: namespaced localStorage-Schlüssel mit JSON und best-effort
// try/catch — dasselbe Muster wie PluginManager.readEnabledIds/writeEnabledIds
// (STORAGE_KEY "plugins.enabled"). Der Storage ist als Parameter injizierbar,
// damit die Logik ohne DOM testbar bleibt.

import type { PluginContext, PluginDefinition } from "../types";

/** Namespaced Schlüssel — Kollisionen mit anderen Plugins ausgeschlossen. */
export const GOAL_STORAGE_KEY = "plugins.writing-goal-tracker";

/** Standard-Tagesziel in Wörtern (gilt, bis der Nutzer ein eigenes setzt). */
export const DEFAULT_DAILY_TARGET = 500;

/** Persistierter Zustand des Plugins (ein JSON-Objekt unter GOAL_STORAGE_KEY). */
export interface GoalState {
  dailyTarget: number;
  /** Wörter pro Kalendertag, Schlüssel "YYYY-MM-DD" (Ortszeit). */
  wordsByDay: Record<string, number>;
  /** Aufeinanderfolgende Ziel-Tage (steht bei Lücken wieder auf 1 bzw. 0). */
  streak: number;
  /** Letzter Tag, an dem das Ziel erreicht wurde ("YYYY-MM-DD" oder null). */
  lastGoalDate: string | null;
}

/** Minimaler Storage-Vertrag — localStorage erfüllt ihn, Tests injizieren Fakes. */
export interface GoalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function globalStorage(): GoalStorage | undefined {
  try {
    const ls = globalThis.localStorage;
    if (ls && typeof ls.getItem === "function" && typeof ls.setItem === "function") return ls;
  } catch {
    /* kein DOM-Kontext (z. B. Node-Tests ohne jsdom) */
  }
  return undefined;
}

/** Lokales Datum als "YYYY-MM-DD" (Ortszeit, nicht UTC — Mitternacht zählt). */
export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Kalendertag direkt vor dem gegebenen "YYYY-MM-DD" (mittags verankert, DST-sicher). */
function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const at = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  at.setDate(at.getDate() - 1);
  return todayKey(at);
}

/** Anteil des Tagesziels in [0, 1]; Ziel <= 0 ergibt 0 (nie durch Null teilen). */
export function goalProgress(words: number, target: number): number {
  if (!Number.isFinite(words) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, words / target));
}

/** Exakte Zielgrenze: erst words >= target bei positivem Ziel zählt. */
export function isGoalMet(words: number, target: number): boolean {
  return Number.isFinite(words) && Number.isFinite(target) && target > 0 && words >= target;
}

export function defaultGoalState(): GoalState {
  return { dailyTarget: DEFAULT_DAILY_TARGET, wordsByDay: {}, streak: 0, lastGoalDate: null };
}

function isValidState(value: unknown): value is GoalState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.dailyTarget === "number" &&
    Number.isFinite(v.dailyTarget) &&
    (v.dailyTarget as number) > 0 &&
    typeof v.wordsByDay === "object" &&
    v.wordsByDay !== null &&
    typeof v.streak === "number" &&
    Number.isFinite(v.streak) &&
    (v.lastGoalDate === null || typeof v.lastGoalDate === "string")
  );
}

/** Zustand laden; bei fehlendem/kaputtem Inhalt Defaults (wirft nie). */
export function loadGoalState(storage: GoalStorage | undefined = globalStorage()): GoalState {
  try {
    const raw = storage?.getItem(GOAL_STORAGE_KEY);
    if (!raw) return defaultGoalState();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return defaultGoalState();
    return {
      dailyTarget: Math.floor(parsed.dailyTarget),
      wordsByDay: parsed.wordsByDay as Record<string, number>,
      streak: Math.max(0, Math.floor(parsed.streak)),
      lastGoalDate: parsed.lastGoalDate,
    };
  } catch {
    return defaultGoalState();
  }
}

/** Zustand speichern; best-effort wie PluginManager.writeEnabledIds (wirft nie). */
export function saveGoalState(state: GoalState, storage: GoalStorage | undefined = globalStorage()): void {
  try {
    storage?.setItem(GOAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Speichern ist best-effort */
  }
}

/** Tagesziel setzen (abgerundet); ungültige Werte lassen den Zustand unverändert. */
export function setDailyTarget(state: GoalState, target: number): GoalState {
  if (!Number.isFinite(target) || target < 1) return { ...state };
  return { ...state, dailyTarget: Math.floor(target) };
}

/**
 * Wortstand eines Tages verbuchen und Streak fortschreiben:
 * Ziel an einem neuen Tag erreicht → Folgetag von lastGoalDate = streak+1,
 * sonst (Lücke) = 1. Ohne Zielerreichung bleibt der Streak unverändert.
 */
export function recordWords(state: GoalState, words: number, dateStr: string): GoalState {
  const safeWords = Number.isFinite(words) ? Math.max(0, Math.floor(words)) : 0;
  const next: GoalState = {
    ...state,
    wordsByDay: { ...state.wordsByDay, [dateStr]: safeWords },
  };
  if (!isGoalMet(safeWords, next.dailyTarget)) return next;
  if (next.lastGoalDate === dateStr) return next; // derselbe Tag: Streak nicht doppeln
  next.streak = next.lastGoalDate !== null && dayBefore(dateStr) === next.lastGoalDate ? next.streak + 1 : 1;
  next.lastGoalDate = dateStr;
  return next;
}

/** Badge: Fortschrittsbalken + Zähler + Streak; rendert aus wordCount-Prop und Storage. */
function GoalBadge({ wordCount }: { wordCount: number; charCount: number }) {
  const state = loadGoalState();
  const progress = goalProgress(wordCount, state.dailyTarget);
  const pct = Math.round(progress * 100);
  return (
    <span
      className="plugin-badge"
      title={`Tagesziel: ${wordCount} von ${state.dailyTarget} Wörtern — Streak: ${state.streak} Tage`}
    >
      <span
        style={{
          display: "inline-block",
          width: 48,
          height: 6,
          borderRadius: 3,
          background: "var(--border, #ddd)",
          verticalAlign: "middle",
          marginRight: 6,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <span
          style={{
            display: "block",
            width: `${pct}%`,
            height: "100%",
            background: "currentColor",
          }}
        />
      </span>
      {wordCount}/{state.dailyTarget} · {pct} % · 🔥 {state.streak}
    </span>
  );
}

export const writingGoalTrackerPlugin: PluginDefinition = {
  manifest: {
    id: "writing-goal-tracker",
    name: "Writing-Goal-Tracker",
    version: "0.1.0",
    description: "Tages-Wortziel mit Fortschrittsbalken und Streak-Zähler in der Statusleiste.",
    author: "AI Writer Studio",
    apiVersion: "0.1.0",
  },
  activate(ctx: PluginContext) {
    ctx.log.info("Writing-Goal-Tracker aktiv");

    ctx.registerBadge("daily-goal", GoalBadge);

    // Editor-Hook: Wert immer unverändert durchreichen (Ketten-Vertrag wie
    // im Word-Count-Badge); numerische Wortstände zusätzlich als Tagesstand
    // verbuchen und ein Event absetzen.
    ctx.onHook("editor:content-change", (value) => {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        const state = recordWords(loadGoalState(), value, todayKey());
        saveGoalState(state);
        ctx.emitEvent("wordcount:changed", { words: Math.floor(value), day: todayKey() });
      }
      return value;
    });

    ctx.onEvent("wordcount:changed", (payload) => {
      ctx.log.info(`Wortstand: ${(payload as { words?: number })?.words ?? 0}`);
    });
  },
  deactivate() {
    // Badges/Hooks/Events räumt der Manager über die Disposer ab (wie beim
    // Word-Count-Badge); hier gibt es keine eigenen Timer/Subscriptions.
    console.info("[writing-goal-tracker] deaktiviert");
  },
};
