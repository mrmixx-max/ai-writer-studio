// Tests für die Log-Rotation (Sprint 6, Agent 4).
// Vertrag:
//  - Monats-Logdatei: app-YYYY-MM.log (z. B. app-2026-09.log)
//  - Größen-Rotation: app-YYYY-MM.log → app-YYYY-MM.1.log, .2.log …
//  - Aufbewahrung: maxRetained Dateien pro Monat (neueste behalten)
//  - Rotation-Detonator: sollte eine Datei das Limit überschreiten,
//    wandern bestehende rotierte Dateien nach hinten (.2→.3 …) und die
//    aktive Datei wird zur .1.log; die aktive Datei startet leer.

import { describe, it, expect } from "vitest";
import {
  monthlyLogFileName,
  parseMonthlyLogFileName,
  rotatedName,
  planRotation,
  retentionList,
  formatLogLine,
  parseLogLine,
  DEFAULT_MAX_FILE_BYTES,
} from "./logRotation";

describe("monthlyLogFileName", () => {
  it("bildet app-YYYY-MM.log aus einem Datum", () => {
    expect(monthlyLogFileName(new Date("2026-09-05T14:30:00Z"))).toBe("app-2026-09.log");
    expect(monthlyLogFileName(new Date("2026-01-01T00:00:00Z"))).toBe("app-2026-01.log");
  });

  it("crasht nicht am Monats-/Jahreswechsel (lokale Zeit, nicht UTC-Verschiebung)", () => {
    // 2026-12-31 23:59 lokal (Zeitzone des Tests) → dieser Monat
    const d = new Date(2026, 11, 31, 23, 59, 0);
    expect(monthlyLogFileName(d)).toBe("app-2026-12.log");
    const d2 = new Date(2027, 0, 1, 0, 0, 0);
    expect(monthlyLogFileName(d2)).toBe("app-2027-01.log");
  });
});

describe("parseMonthlyLogFileName", () => {
  it("parst aktive und rotierte Namen", () => {
    expect(parseMonthlyLogFileName("app-2026-09.log")).toEqual({ year: 2026, month: 9, rotated: null });
    expect(parseMonthlyLogFileName("app-2026-09.3.log")).toEqual({ year: 2026, month: 9, rotated: 3 });
  });

  it("lehnt Fremdformate ab", () => {
    expect(parseMonthlyLogFileName("other-2026-09.log")).toBeNull();
    expect(parseMonthlyLogFileName("app-2026-9.log")).toBeNull();
    expect(parseMonthlyLogFileName("app-2026-13.log")).toBeNull();
    expect(parseMonthlyLogFileName("")).toBeNull();
  });
});

describe("rotatedName", () => {
  it("verschiebt aktive Datei auf .1.log und .n auf .n+1.log", () => {
    expect(rotatedName("app-2026-09.log")).toBe("app-2026-09.1.log");
    expect(rotatedName("app-2026-09.1.log")).toBe("app-2026-09.2.log");
  });
});

describe("planRotation", () => {
  it("rotiert nicht unterhalb des Limits", () => {
    expect(planRotation(10, DEFAULT_MAX_FILE_BYTES - 1)).toEqual({ rotate: false, renames: [] });
  });

  it("rotiert ab Limit-Schwellwert (>= maxBytes)", () => {
    const plan = planRotation(DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES);
    expect(plan.rotate).toBe(true);
    // Aktive Datei wird .1.log; .1 wird .2 … (hier noch keine rotierten Dateien vorhanden)
    expect(plan.renames).toEqual([
      { from: "app-2026-09.log", to: "app-2026-09.1.log", sequence: 0 },
    ]);
  });

  it("wandelt bestehende rotierte Dateien in umgekehrter Reihenfolge um", () => {
    const plan = planRotation(DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES, [
      "app-2026-09.1.log",
      "app-2026-09.2.log",
    ]);
    expect(plan.rotate).toBe(true);
    expect(plan.renames).toEqual([
      { from: "app-2026-09.2.log", to: "app-2026-09.3.log", sequence: 0 },
      { from: "app-2026-09.1.log", to: "app-2026-09.2.log", sequence: 1 },
      { from: "app-2026-09.log", to: "app-2026-09.1.log", sequence: 2 },
    ]);
  });

  it("respektiert ein konfigurierbares Limit", () => {
    const small = 1024;
    expect(planRotation(1024, small).rotate).toBe(true);
    expect(planRotation(1023, small).rotate).toBe(false);
  });
});

describe("retentionList", () => {
  it("behält die neuesten maxFiles Dateien (aktive Datei immer zuerst)", () => {
    const files = [
      "app-2026-09.log",
      "app-2026-09.1.log",
      "app-2026-09.2.log",
      "app-2026-09.3.log",
    ];
    const { keep, remove } = retentionList(files, 3);
    expect(keep).toContain("app-2026-09.log");
    expect(keep).toContain("app-2026-09.1.log");
    expect(keep).toContain("app-2026-09.2.log");
    expect(remove).toEqual(["app-2026-09.3.log"]);
  });

  it("maxFiles=0 löscht nichts (Schutz vor Konfigurationsfehler)", () => {
    const { remove } = retentionList(["app-2026-09.log"], 0);
    expect(remove).toEqual([]);
  });

  it("sortiert Fremd-/Korrupteinträge ans Ende der Löschkandidaten nicht ein", () => {
    const { remove } = retentionList(["app-2026-09.log", "junk.txt"], 5);
    expect(remove).toEqual([]);
  });

  it("entfernt abgelaufene Monate (aelter als maxAgeDays)", () => {
    const now = new Date(2026, 8, 5); // 2026-09-05 lokal
    const { remove } = retentionList(
      ["app-2026-09.log", "app-2026-08.log", "app-2026-02.log"],
      10,
      { now, maxAgeDays: 180 },
    );
    // 2026-02 ist > 180 Tage alt (Aug + Jul + Jun + Mai + Apr + Mär ≈ 184 Tage)
    expect(remove).toContain("app-2026-02.log");
    expect(remove).not.toContain("app-2026-09.log");
    expect(remove).not.toContain("app-2026-08.log");
  });
});

describe("formatLogLine / parseLogLine", () => {
  it("erzeugt eine parsebare Zeile mit Zeitstempel", () => {
    const ts = new Date("2026-09-05T12:00:00.000Z").getTime();
    const line = formatLogLine({ level: "info", message: "Start", context: "app", timestamp: ts });
    expect(line).toBe("2026-09-05T12:00:00.000Z INFO [app] Start");
    const parsed = parseLogLine(line);
    expect(parsed).toEqual({ level: "info", message: "Start", context: "app", timestamp: ts });
  });

  it("hängt Error-Detail als JSON an und liest es zurück", () => {
    const ts = new Date("2026-09-05T12:00:00.000Z").getTime();
    const line = formatLogLine({ level: "error", message: "crash", context: "export", timestamp: ts, error: "boom" });
    const parsed = parseLogLine(line);
    expect(parsed?.level).toBe("error");
    expect(parsed?.message).toContain("crash");
    expect(parsed?.error).toBe("boom");
  });

  it("parst keine Fremdzeilen", () => {
    expect(parseLogLine("irgendein text")).toBeNull();
    expect(parseLogLine("")).toBeNull();
  });
});