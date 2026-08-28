// vitest.config.ts — isolierte Unit-/Integrationstests ohne Tauri-Kontext.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    // Component-Tests (React Testing Library) laufen in jsdom, alle anderen in node.
    // jsdom wird pro Testdatei via `@vitest-environment jsdom` Docblock gewählt.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/services/**", "src/components/**", "src/i18n/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**", "src/components/**/*.css"],
      thresholds: {
        // Ratchet: Schwellen liegen knapp über dem aktuellen Ist-Stand
        // (gemessen 2026-08: services ~59/47/58/60, components ~2/1/1/2).
        // Jede Verbesserung wird zum neuen Minimum; kein Rückschritt.
        // Ziel-Roadmap: services ≥ 80 %, components ≥ 60 % (siehe README/Tests).
        // Services tragen die Geschäftslogik — höhere Anforderung.
        "src/services/**": {
          statements: 58,
          branches: 47,
          functions: 58,
          lines: 59,
        },
        // UI-Komponenten: struktureller Mindestschutz (Ausbaustufe).
        "src/components/**": {
          statements: 1,
          branches: 0,
          functions: 0,
          lines: 1,
        },
        // Kritische Kern-Komponenten (Editor, Sidebar, Export, KI, Wizard, Settings)
        // sind jetzt mit React Testing Library abgedeckt (gemessen 2026-08).
        // Die Kern-Dateien liegen deutlich höher (Editor.tsx 82 %, ExportBar.tsx 98 %,
        // KIPanel.tsx 81 %, WelcomeWizard.tsx 94 %, Sidebar.tsx 76 %, SettingsPanel 60 %
        // Zeilen) — die Verzeichnis-Werte werden durch noch ungetestete
        // Nebendateien (extensions/, AIWritingAssistant/, Step*) gezogen.
        "src/components/Editor/**": { statements: 35, branches: 23, functions: 26, lines: 35 },
        "src/components/Sidebar/**": { statements: 60, branches: 50, functions: 47, lines: 60 },
        "src/components/Export/**": { statements: 90, branches: 80, functions: 95, lines: 95 },
        "src/components/KIPanel/**": { statements: 33, branches: 33, functions: 26, lines: 35 },
        "src/components/Welcome/**": { statements: 60, branches: 50, functions: 55, lines: 60 },
        "src/components/Settings/**": { statements: 59, branches: 50, functions: 53, lines: 59 },
        // Durchschnitt über alles (services + components + i18n).
        statements: 39,
        branches: 30,
        functions: 31,
        lines: 40,
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      // `sql.js/dist/sql-wasm.wasm?url` ist ein Vite-Asset-Import, den Node
      // nicht auflösen kann. In Tests wird der Pfad ohnehin nicht benutzt:
      // sql.js lädt dort das mitgelieferte Fallback-WASM aus node_modules.
      {
        find: /^sql\.js\/dist\/sql-wasm\.wasm\?url$/,
        replacement: path.resolve(__dirname, "src/test/wasmUrlStub.ts"),
      },
    ],
  },
});
