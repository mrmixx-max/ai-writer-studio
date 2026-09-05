// Tests: BookWriter-Mode in der Sidebar (Sprint 6).
// Struktur-Prüfung nach dem Vorbild von navigation.test.ts: Der Modus muss im
// Typ, im Switcher und in ModePanel verdrahtet sein — sonst ist er wieder
// "im Typ, aber unerreichbar" (der klassische Sidebar-Fehler).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SIDEBAR = readFileSync(
  join(process.cwd(), "src/components/Sidebar/Sidebar.tsx"),
  "utf-8",
);
const MODE_TYPES = readFileSync(
  join(process.cwd(), "src/types/mode.ts"),
  "utf-8",
);
const DASHBOARD = readFileSync(
  join(process.cwd(), "src/components/BookWriter/BookWriterDashboard.tsx"),
  "utf-8",
);

describe("BookWriter-Tab in der Sidebar", () => {
  it("bookwriter ist im EditorMode-Typ", () => {
    expect(MODE_TYPES).toContain('"bookwriter"');
  });

  it("bookwriter ist genau einmal in MODES verdrahtet", () => {
    const entries = SIDEBAR.match(/id:\s*"bookwriter"/g) ?? [];
    expect(entries.length).toBe(1);
  });

  it("ModePanel rendert das Dashboard im bookwriter-Modus (kein Projekt/Kapitel nötig)", () => {
    // Dashboard vor dem Kapitel-Guard: bookwriter braucht kein offenes Kapitel.
    const dashboardRender = SIDEBAR.indexOf('mode === "bookwriter"');
    const chapterGuard = SIDEBAR.indexOf("!projectId || !chapterId");
    expect(dashboardRender).toBeGreaterThan(-1);
    expect(chapterGuard).toBeGreaterThan(-1);
    expect(dashboardRender).toBeLessThan(chapterGuard);
  });

  it("ModePanel bindet BookWriterDashboardPanel ein", () => {
    expect(SIDEBAR).toMatch(/mode === "bookwriter"\) return <BookWriterDashboardPanel/);
  });

  it("Sidebar importiert BookWriterDashboardPanel lazy", () => {
    expect(SIDEBAR).toMatch(
      /BookWriterDashboardPanel = lazy\(\(\) =>\s*import\(".*BookWriterDashboard"\)/,
    );
  });
});

describe("BookWriter-Recovery beim App-Start", () => {
  it("App.tsx bindet BookWriterRecoveryDialog ein", () => {
    const APP = readFileSync(join(process.cwd(), "src/App.tsx"), "utf-8");
    expect(APP).toContain("BookWriterRecoveryDialog");
  });
});

describe("BookWriterDashboard — Recovery-Dialog im Panel", () => {
  it("Dashboard rendert den Recovery-Dialog (Panel-intern)", () => {
    expect(DASHBOARD).toContain("BookWriterRecoveryDialog");
  });
});
