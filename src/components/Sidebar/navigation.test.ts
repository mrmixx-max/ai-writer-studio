// Tests: Sidebar-Navigation (refactored).
//
// Nach dem Refactoring (Sprint 18) ist die Sidebar in eigenständige
// Komponenten aufgeteilt. Diese Tests prüfen die neue Struktur.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SIDEBAR = readFileSync(
  join(process.cwd(), "src/components/Sidebar/Sidebar.tsx"),
  "utf-8",
);

const MODE_REGISTRY = readFileSync(
  join(process.cwd(), "src/components/Sidebar/modeRegistry.ts"),
  "utf-8",
);

describe("Modus-Switcher ist erreichbar", () => {
  it("wird als ModeSwitcher-Komponente importiert und gerendert", () => {
    // ModeSwitcher wird importiert
    expect(SIDEBAR).toContain("import { ModeSwitcher }");
    // Und im Spezial-Modus-Zweig gerendert
    expect(SIDEBAR).toContain("<ModeSwitcher");
  });

  it("erscheint im Spezial-Modus-Zweig (inSpecialMode)", () => {
    // Der ModeSwitcher wird im Spezial-Modus-Zweig gerendert
    const specialModeIndex = SIDEBAR.indexOf("inSpecialMode");
    const switcherIndex = SIDEBAR.indexOf("<ModeSwitcher");
    expect(specialModeIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(specialModeIndex);
  });
});

describe("Alle Modi sind in der Registry definiert", () => {
  it("hat 65+ Modi in MODES Array", () => {
    const modeMatches = MODE_REGISTRY.match(/id:\s*"[^"]+"/g) ?? [];
    expect(modeMatches.length).toBeGreaterThanOrEqual(65);
  });

  it("enthält knowledge Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "knowledge"');
  });

  it("enthält diagnostics Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "diagnostics"');
  });

  it("enthält preflight Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "preflight"');
  });

  it("enthält snapshots Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "snapshots"');
  });

  it("enthält kdp Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "kdp"');
  });

  it("enthält bookwriter Modus", () => {
    expect(MODE_REGISTRY).toContain('id: "bookwriter"');
  });

  it("enthält standalone-Modi (publishing, amazon, etc.)", () => {
    expect(MODE_REGISTRY).toContain('id: "publishing"');
    expect(MODE_REGISTRY).toContain('id: "amazon"');
    expect(MODE_REGISTRY).toContain('id: "shortprose"');
    expect(MODE_REGISTRY).toContain('id: "voice"');
  });
});

describe("Sidebar-Breite über modeRegistry", () => {
  it("nutzt isWideMode aus modeRegistry", () => {
    expect(SIDEBAR).toContain("import { isWideMode");
    expect(SIDEBAR).toContain("isWideMode(mode)");
  });

  it("hat wide-Klasse im Stylesheet", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/Sidebar/sidebar.css"),
      "utf-8",
    );
    expect(css).toContain(".sidebar.wide");
    expect(css).toMatch(/\.sidebar\.wide\s*\{[^}]*width:\s*4\d\dpx/);
  });
});

describe("ModePanel wird für alle Spezial-Modi gerendert", () => {
  it("rendert ModePanel im Spezial-Modus-Zweig", () => {
    expect(SIDEBAR).toContain("<ModePanel");
    const panelIndex = SIDEBAR.indexOf("<ModePanel");
    const specialModeIndex = SIDEBAR.indexOf("inSpecialMode");
    expect(panelIndex).toBeGreaterThan(specialModeIndex);
  });

  it("übergeben projectId und chapterId an ModePanel", () => {
    expect(SIDEBAR).toContain("projectId={activeProjectId}");
    expect(SIDEBAR).toContain("chapterId={activeChapterId}");
  });
});

describe("Mode-Validierung", () => {
  it("nutzt useModeValidation Hook", () => {
    expect(SIDEBAR).toContain("import { useSidebarState, useModeValidation }");
    expect(SIDEBAR).toContain("useModeValidation(");
  });

  it("hat Fallback-Logik für ungültige Modi", () => {
    expect(SIDEBAR).toContain("modeValid");
    expect(SIDEBAR).toContain("fallback");
    expect(SIDEBAR).toContain("setMode(fallback)");
  });
});
