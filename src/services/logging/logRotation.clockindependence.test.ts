// Temporärer Beweis-Test: prüft, dass planRotation KEINE echte Uhr liest.
// Vor dem Fix schlug logRotation.test.ts bei jedem Monatswechsel fehl, weil
// planRotation() intern monthlyLogFileName() (= new Date()) aufrief.
import { describe, it, expect, vi, afterEach } from "vitest";
import { planRotation, DEFAULT_MAX_FILE_BYTES } from "./logRotation";

afterEach(() => {
  vi.useRealTimers();
});

describe("planRotation ist kalenderunabhängig", () => {
  it("liefert bei eingefrorenem Systemdatum (März 2031) dasselbe Ergebnis", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 2, 17, 9, 0, 0)); // 2031-03-17

    const plan = planRotation(DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES, [], "app-2026-09.log");

    expect(plan.rotate).toBe(true);
    // Explizit übergebene activeFile gewinnt — NICHT app-2031-03.log.
    expect(plan.renames).toEqual([
      { from: "app-2026-09.log", to: "app-2026-09.1.log", sequence: 0 },
    ]);
  });

  it("nutzt ohne activeFile-Angabe den aktuellen Monat der (gefake-ten) Uhr", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 2, 17, 9, 0, 0)); // 2031-03-17

    const plan = planRotation(DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES);

    expect(plan.rotate).toBe(true);
    expect(plan.renames).toEqual([
      { from: "app-2031-03.log", to: "app-2031-03.1.log", sequence: 0 },
    ]);
  });
});
