// Tests: GUI-Fortschritts-Helper für das BookWriter-Dashboard (Sprint 6).
// Reine Funktionen — kein DOM, keine DB.
import { describe, it, expect } from "vitest";
import {
  PROGRESS_POLL_INTERVAL_MS,
  deriveJobProgressState,
  JOB_STATE_LABELS,
  formatProgressPercent,
  formatRelativeTime,
  isJobRecoverable,
} from "./progress";

const NOW = 1_000_000_000;

function job(overrides: Partial<{ status: string; updatedAt: number; currentChapter: number }> = {}) {
  return {
    status: (overrides.status ?? "running") as never,
    updatedAt: overrides.updatedAt ?? NOW - 1000,
    currentChapter: overrides.currentChapter ?? 3,
  };
}

describe("PROGRESS_POLL_INTERVAL_MS", () => {
  it("pollt im Sekundenbereich (nicht zu schnell, nicht zu träge)", () => {
    expect(PROGRESS_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(PROGRESS_POLL_INTERVAL_MS).toBeLessThanOrEqual(5000);
  });
});

describe("deriveJobProgressState", () => {
  it("running mit frischem updatedAt → running", () => {
    expect(deriveJobProgressState(job(), NOW)).toBe("running");
  });

  it("running ohne Update seit staleMs → stalled (Stillstand erkannt)", () => {
    expect(deriveJobProgressState(job({ updatedAt: NOW - 300_000 }), NOW)).toBe("stalled");
  });

  it("interrupted → interrupted (auch wenn alt)", () => {
    expect(deriveJobProgressState(job({ status: "interrupted", updatedAt: NOW - 300_000 }), NOW)).toBe("interrupted");
  });

  it("completed → completed", () => {
    expect(deriveJobProgressState(job({ status: "completed" }), NOW)).toBe("completed");
  });

  it("aborted → interrupted (für die GUI dasselbe: nicht laufend)", () => {
    expect(deriveJobProgressState(job({ status: "aborted" }), NOW)).toBe("interrupted");
  });
});

describe("formatProgressPercent", () => {
  it("rechnet Kapitel-Fortschritt in Prozent", () => {
    expect(formatProgressPercent(2, 8)).toBe(25);
    expect(formatProgressPercent(4, 8)).toBe(50);
    expect(formatProgressPercent(8, 8)).toBe(100);
  });

  it("klemmt bei 0 und verteidigt sich gegen Division durch 0", () => {
    expect(formatProgressPercent(0, 8)).toBe(0);
    expect(formatProgressPercent(3, 0)).toBe(0);
  });
});

describe("formatRelativeTime", () => {
  it("'gerade eben' unter einer Minute", () => {
    expect(formatRelativeTime(NOW - 20_000, NOW)).toBe("gerade eben");
  });

  it("'vor X min' im Minutenbereich", () => {
    expect(formatRelativeTime(NOW - 3 * 60_000, NOW)).toBe("vor 3 min");
  });

  it("'vor X h' im Stundenbereich", () => {
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe("vor 2 h");
  });
});

describe("isJobRecoverable", () => {
  it("running/interrupted mit Fortschritt ist fortsetzbar", () => {
    expect(isJobRecoverable({ status: "running", currentChapter: 2 } as never)).toBe(true);
    expect(isJobRecoverable({ status: "interrupted", currentChapter: 5 } as never)).toBe(true);
  });

  it("ohne Fortschritt oder abgeschlossen nicht", () => {
    expect(isJobRecoverable({ status: "running", currentChapter: 0 } as never)).toBe(false);
    expect(isJobRecoverable({ status: "completed", currentChapter: 8 } as never)).toBe(false);
  });
});

describe("JOB_STATE_LABELS", () => {
  it("hat deutsche Labels für alle Zustände", () => {
    expect(JOB_STATE_LABELS.running).toBeTruthy();
    expect(JOB_STATE_LABELS.stalled).toBeTruthy();
    expect(JOB_STATE_LABELS.interrupted).toBeTruthy();
    expect(JOB_STATE_LABELS.completed).toBeTruthy();
  });
});
