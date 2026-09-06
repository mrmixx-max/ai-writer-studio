// vitest.config.ts — isolierte Unit-/Integrationstests ohne Tauri-Kontext.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    // Component-Tests (React Testing Library) laufen in jsdom, alle anderen in node.
    // jsdom wird pro Testdatei via `@vitest-environment jsdom` Docblock gewählt.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
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
        // Kritische Kern-Komponenten — Thresholds knapp unter Ist-Stand (Ratchet).
        // Tests: 1763/1763 grün. Gates anti-Regression, nicht Release-Blocker.
        "src/components/Editor/**": { statements: 35, branches: 23, functions: 26, lines: 35 },
        "src/components/Sidebar/**": { statements: 57, branches: 49, functions: 39, lines: 57 },
        "src/components/Export/**": { statements: 90, branches: 80, functions: 95, lines: 95 },
        "src/components/KIPanel/**": { statements: 33, branches: 31, functions: 24, lines: 33 },
        "src/components/Welcome/**": { statements: 52, branches: 47, functions: 44, lines: 53 },
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
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
      // `sql.js/dist/sql-wasm.wasm?url` ist ein Vite-Asset-Import, den Node
      // nicht auflösen kann. In Tests wird der Pfad ohnehin nicht benutzt:
      // sql.js lädt dort das mitgelieferte Fallback-WASM aus node_modules.
      {
        find: /^sql\.js\/dist\/sql-wasm\.wasm\?url$/,
        replacement: path.resolve(import.meta.dirname, "src/test/wasmUrlStub.ts"),
      },
    ],
  },
});
