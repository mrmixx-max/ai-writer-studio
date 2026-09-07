// Unit-Tests: errorReport (rein, keine DOM-Abhängigkeit).
import { describe, it, expect } from "vitest";
import {
  buildErrorReport,
  formatErrorReport,
  sanitizeErrorText,
  detectPlatform,
  MAX_LOG_TAIL,
} from "./errorReport";

describe("sanitizeErrorText", () => {
  it("redigiert Windows-Absolutpfade inkl. Benutzername", () => {
    const out = sanitizeErrorText("Fehler in C:\\Users\\webma\\Projects\\app.ts:12");
    expect(out).not.toContain("webma");
    expect(out).not.toContain("C:\\Users\\webma");
    expect(out).toContain("[path]");
  });

  it("redigiert /home/<user>-Pfade", () => {
    const out = sanitizeErrorText("at /home/jdoe/src/index.js:5:3");
    expect(out).not.toContain("jdoe");
    expect(out).toContain("/home/<redacted>");
  });

  it("redigiert /Users/<user>-Pfade (macOS)", () => {
    const out = sanitizeErrorText("at /Users/jane.doe/work/a.ts:1:1");
    expect(out).not.toContain("jane.doe");
  });

  it("lässt harmlose Meldungen unverändert", () => {
    expect(sanitizeErrorText("Netzwerkfehler: Timeout")).toBe("Netzwerkfehler: Timeout");
  });
});

describe("buildErrorReport", () => {
  it("sammelt message, stack, Version, Plattform und Log-Tail", () => {
    const report = buildErrorReport({
      message: "boom",
      stack: "Error: boom\n    at f",
      appVersion: "1.2.3",
      platform: "test-os",
      recentLogs: ["[info] start", "[error] kaputt"],
    });
    expect(report.message).toBe("boom");
    expect(report.stack).toContain("at f");
    expect(report.appVersion).toBe("1.2.3");
    expect(report.platform).toBe("test-os");
    expect(report.recentLogs).toEqual(["[info] start", "[error] kaputt"]);
    expect(typeof report.ts).toBe("number");
  });

  it("kappt den Log-Tail auf MAX_LOG_TAIL Einträge (neueste behalten)", () => {
    const logs = Array.from({ length: MAX_LOG_TAIL + 20 }, (_, i) => `log-${i}`);
    const report = buildErrorReport({ message: "x", recentLogs: logs });
    expect(report.recentLogs).toHaveLength(MAX_LOG_TAIL);
    expect(report.recentLogs[0]).toBe(`log-20`);
  });

  it("sanitisiert auch componentStack und Log-Tail (keine PII)", () => {
    const report = buildErrorReport({
      message: "Fehler bei C:\\Users\\webma\\a.ts",
      componentStack: "in Panel (at C:\\Users\\webma\\Panel.tsx:3)",
      recentLogs: ["[info] geladen von /home/webma/data.db"],
    });
    const blob = JSON.stringify(report);
    expect(blob).not.toContain("webma");
    expect(blob).not.toContain("C:\\Users\\webma");
    expect(blob).not.toContain("/home/webma");
  });

  it("detectPlatform liefert einen nicht-leeren String", () => {
    expect(detectPlatform().length).toBeGreaterThan(0);
  });
});

describe("formatErrorReport", () => {
  it("enthält Nachricht, Version und Plattform und bleibt PII-frei", () => {
    const report = buildErrorReport({
      message: "Absturz in C:\\Users\\webma\\x.ts",
      appVersion: "9.9.9",
      platform: "win32",
      recentLogs: ["[warn] Hinweis"],
    });
    const text = formatErrorReport(report);
    expect(text).toContain("9.9.9");
    expect(text).toContain("win32");
    expect(text).not.toContain("webma");
  });
});
