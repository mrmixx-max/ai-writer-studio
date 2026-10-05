// Analytics-Panel: Fortschritt, Ziele, Sitzungs-Statistiken, Streaks.
import { useEffect, useState } from "react";
import { useAnalyticsStore } from "@/store/analyticsStore";
import {
  dailyGoalProgress,
  deadlineProgress,
  productivity,
  todayKey,
  daysAgoKey,
} from "@/services/analytics";

function fmtMs(ms: number): string {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  if (h > 0) return `${h} h ${min % 60} min`;
  return `${min} min`;
}

export function AnalyticsPanel() {
  const { days, goals, currentSession, streak, setDailyGoal, setDeadlineGoal, removeGoal, refresh } =
    useAnalyticsStore();
  const [dailyTarget, setDailyTarget] = useState("");
  const [deadlineTarget, setDeadlineTarget] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  const daily = dailyGoalProgress(days, goals);
  const dl = deadlineProgress(days, goals);
  const today = todayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const key = daysAgoKey(6 - i);
    return { key, entry: days[key] };
  });
  const maxW = Math.max(1, ...last7.map((d) => d.entry?.words ?? 0));

  const sessionProd = currentSession ? productivity(currentSession, 0) : null;

  return (
    <div className="analytics-panel">
      <h3>Writing-Analytics</h3>

      <section className="analytics-section">
        <h4>Streaks</h4>
        <div className="analytics-row">
          <span className="analytics-kpi">🔥 {streak.current}</span>
          <span className="analytics-sub">aktuelle Tage in Folge</span>
        </div>
        <div className="analytics-row">
          <span className="analytics-kpi">🏆 {streak.longest}</span>
          <span className="analytics-sub">längster Streak</span>
        </div>
      </section>

      <section className="analytics-section">
        <h4>Tagesziel</h4>
        {daily ? (
          <>
            <div className="analytics-progress">
              <div
                className="analytics-progress-bar"
                style={{ width: `${Math.min(100, daily.ratio * 100)}%` }}
              />
            </div>
            <div className="analytics-row">
              <span>
                {daily.words.toLocaleString("de-DE")} / {daily.target.toLocaleString("de-DE")} Wörter
              </span>
              <button
                className="analytics-btn"
                onClick={() => {
                  removeGoal(goals.find((g) => g.type === "dailyWords")!.id);
                }}
              >
                ✕
              </button>
            </div>
          </>
        ) : (
          <div className="analytics-row">
            <input
              className="analytics-input"
              type="number"
              min="1"
              placeholder="z. B. 500"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
            />
            <button
              className="analytics-btn"
              onClick={() => {
                const n = parseInt(dailyTarget, 10);
                if (n > 0) {
                  setDailyGoal(n);
                  setDailyTarget("");
                }
              }}
            >
              Ziel setzen
            </button>
          </div>
        )}
      </section>

      <section className="analytics-section">
        <h4>Deadline</h4>
        {dl ? (
          <>
            <div className="analytics-row">
              <span>
                Noch {dl.remaining.toLocaleString("de-DE")} Wörter in {dl.daysLeft} Tagen
              </span>
              <button
                className="analytics-btn"
                onClick={() => removeGoal(dl.goal.id)}
              >
                ✕
              </button>
            </div>
            <div className="analytics-sub">Täglich nötig: {Math.ceil(dl.perDay).toLocaleString("de-DE")} Wörter</div>
          </>
        ) : (
          <div className="analytics-col">
            <input
              className="analytics-input"
              type="number"
              min="1"
              placeholder="Gesamt-Wörter"
              value={deadlineTarget}
              onChange={(e) => setDeadlineTarget(e.target.value)}
            />
            <input
              className="analytics-input"
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
            />
            <button
              className="analytics-btn"
              onClick={() => {
                const n = parseInt(deadlineTarget, 10);
                if (n > 0 && deadlineDate) {
                  setDeadlineGoal(n, deadlineDate);
                  setDeadlineTarget("");
                  setDeadlineDate("");
                }
              }}
            >
              Deadline setzen
            </button>
          </div>
        )}
      </section>

      <section className="analytics-section">
        <h4>Letzte 7 Tage</h4>
        <div className="analytics-chart">
          {last7.map(({ key, entry }) => (
            <div key={key} className="analytics-bar-col" title={`${key}: ${entry?.words ?? 0} Wörter`}>
              <div
                className="analytics-bar"
                style={{ height: `${((entry?.words ?? 0) / maxW) * 100}%` }}
              />
              <span className="analytics-bar-label">{key.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="analytics-section">
        <h4>Heute</h4>
        <div className="analytics-row">
          <span>{(days[today]?.words ?? 0).toLocaleString("de-DE")} Wörter</span>
          <span>{days[today]?.sessions ?? 0} Sessions</span>
        </div>
        <div className="analytics-row">
          <span>Aktiv: {fmtMs(days[today]?.activeMs ?? 0)}</span>
          <span>Pause: {fmtMs(days[today]?.pauseMs ?? 0)}</span>
        </div>
        {sessionProd && (
          <div className="analytics-sub">
            Laufende Session: {fmtMs(sessionProd.activeMs)} · {Math.round(sessionProd.wordsPerHour).toLocaleString("de-DE")} Wörter/h
          </div>
        )}
      </section>
    </div>
  );
}
