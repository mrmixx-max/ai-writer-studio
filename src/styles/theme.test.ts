import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const THEME = readFileSync(join(ROOT, "src/styles/theme.css"), "utf8");
const APP = readFileSync(join(ROOT, "src/App.tsx"), "utf8");

const REQUIRED_VARS: Record<string, string> = {
  "--bg": "#000",
  "--fg": "#e0e0e0",
  "--accent": "#ffa028",
  "--border": "#333",
  "--muted": "#888",
  "--success": "#4caf50",
  "--warn": "#ff9800",
  "--error": "#f44336",
};

describe("Sprint 18 Agent 1: Bloomberg App-Shell Theme", () => {
  it("definiert alle 8 Pflicht-CSS-Variablen mit exakten Werten", () => {
    for (const [name, value] of Object.entries(REQUIRED_VARS)) {
      expect(
        THEME,
        `Variable ${name} fehlt in src/styles/theme.css`,
      ).toContain(name);
      const re = new RegExp(
        `${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:\\s*${value.replace("#", "\\#")}`,
        "i",
      );
      expect(re.test(THEME), `${name} muss den Wert ${value} haben`).toBe(
        true,
      );
    }
  });

  it("App-Shell nutzt CSS-Variablen statt Hardcoded-Farben", () => {
    for (const sel of [".app-root", ".app-header", ".wordcount-bar"]) {
      expect(THEME).toContain(sel);
    }
    // Shell-Regeln dürfen keine Hex-Farben enthalten — nur var(...) + rgba-Overlay.
    const shellBlock = THEME.slice(THEME.indexOf(".app-root"));
    const hexes = shellBlock.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hexes, `Hardcoded-Farben in Shell-Regeln: ${hexes}`).toEqual([]);
    expect(shellBlock).toContain("var(--bg)");
    expect(shellBlock).toContain("var(--fg)");
    expect(shellBlock).toContain("var(--accent)");
  });

  it("setzt Monospace-Font und dichte Bloomberg-Panels", () => {
    expect(THEME).toMatch(/--font-mono\s*:/);
    expect(THEME).toMatch(/ui-monospace|Menlo|Consolas/);
    expect(THEME).toContain("font-family: var(--font-mono)");
    // Dicht: kompakte 11–12px Typo statt luftigem 14px+.
    expect(THEME).toMatch(/font-size:\s*1[12]px/);
  });

  it("App.tsx importiert das Theme und wendet Vars ohne Behavior-Change an", () => {
    expect(APP).toContain('@/styles/theme.css');
    expect(APP).toContain('data-testid="app-root"');
    expect(APP).toContain('var(--bg)');
    expect(APP).toContain('var(--fg)');
    // Keine Hardcoded-Farbe im App-Shell-Diff (style-Prop + Import-Umfeld).
    const idx = APP.indexOf('data-testid="app-root"');
    const window = APP.slice(Math.max(0, idx - 400), idx + 400);
    expect(window.match(/#[0-9a-fA-F]{3,8}/g) ?? []).toEqual([]);
  });

  it("keine Hardcoded-Shell-Farben in App.tsx ausserhalb von Kommentaren/Strings-Logik", () => {
    // App.tsx darf keine inline-Hex-Styles enthalten (Farben leben in CSS).
    const styleProps = APP.match(/style=\{\{[^}]*\}\}/g) ?? [];
    for (const s of styleProps) {
      expect(s.match(/#[0-9a-fA-F]{3,8}/g) ?? []).toEqual([]);
    }
    expect(styleProps.length).toBeGreaterThan(0);
  });
});
