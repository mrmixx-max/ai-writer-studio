// vitest.config.ts — isolierte Unit-/Integrationstests ohne Tauri-Kontext.
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
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
