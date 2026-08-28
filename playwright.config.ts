// Playwright-E2E-Konfiguration für AI Writer Studio.
//
// Die Tests laufen gegen den Vite-Dev-Server (`npm run dev:vite`, Port 1420),
// NICHT gegen die Tauri-EXE. Im reinen Browser fällt die App bewusst auf eine
// In-Memory-Datenbank zurück (siehe src/services/db/index.ts) — genau dieser
// Fallback macht die UI im Browser testbar, ohne das Rust-Backend zu brauchen.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries: lokal 1, in CI 2 — fängt Welcome-Overlay-/Init-Racing ab.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Video bei Fehlversuchen aufheben — wichtig für Overlay-Timing-Flakiness.
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:vite",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
