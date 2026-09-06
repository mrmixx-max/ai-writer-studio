// E2E: App-Start ohne Ollama (offline) — graceful degradation statt Crash.
// Läuft gegen den Vite-Dev-Server (siehe playwright.config.ts, webServer).
// Ollama/LM-Studio-Calls werden per route.abort() simuliert (0 echte Calls,
// kein echter Ollama nötig) — genau der CI-Fall.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp, setupTestProject, switchToClassicTab } from "./helpers";

/**
 * Pinned die UI-Sprache auf Deutsch: detectLanguage() (src/i18n) liest zuerst
 * localStorage("app-lang"), erst dann die Browsersprache. Ohne Pin hängt die
 * UI-Sprache vom Test-Browser ab (Chromium-Default en-US) und alle
 * deutschsprachigen Selektoren werden flaky — in CI genauso wie lokal.
 */
async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

/**
 * Bricht alle Provider-Netzwerkcalls ab (Ollama/LM Studio/Gateways auf
 * localhost/127.0.0.1, jeder Port) — aber NIEMALS den Vite-Dev-Server selbst
 * (Port 1420). Pfad-Globs wie `**\/api/**` sind verboten: Sie treffen auch
 * eigene Module (`/src/plugins/api/*.ts`) und lassen den Boot ins Leere laufen.
 */
async function goOffline(page: import("@playwright/test").Page): Promise<void> {
  await page.route(
    (url) =>
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port !== "1420",
    (route) => route.abort("connectionrefused"),
  );
}

test("Bootet mit unerreichbarem Ollama: Haupt-UI steht, kein ErrorBoundary", async ({
  page,
}) => {
  await pinGerman(page);
  await goOffline(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await gotoApp(page);

  // Haupt-UI steht trotz totem Provider.
  await expect(page.locator("#app-sidebar")).toBeVisible();
  await expect(page.locator("#app-ai-panel")).toBeVisible();
  // Kein ErrorBoundary-Fallback.
  await expect(page.getByText(/Es liegt ein Fehler in der Anwendung/)).toHaveCount(0);
  // Keine unbehandelten Seitenfehler.
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

test("Buchgenerierung ohne Ollama zeigt Fehler-UI, App bleibt bedienbar", async ({
  page,
}) => {
  // Nur der Generierungs-Call scheitert (Offline-Fall am BookWriter).
  // Host-basiert gematcht: Pfad-Globs wie `**/api/chat` sind hier zwar eng
  // genug, aber das Prädikat schließt zusätzlich den Dev-Server (Port 1420)
  // und eigene Module (`/src/plugins/api/*`) garantiert aus.
  await pinGerman(page);
  await page.route(
    (url) =>
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port !== "1420" &&
      url.pathname.endsWith("/api/chat"),
    (route) => route.abort("connectionrefused"),
  );
  await setupTestProject(page, "Offline-Buchprojekt");
  await switchToClassicTab(page);

  await page
    .locator('.bookwriter-panel label:has-text("Thema") input')
    .fill("Der weiße Fleck");
  await page
    .locator(".bookwriter-panel button.bw-start", { hasText: "Buch generieren" })
    .click();

  // Graceful degradation: lesbare Fehler-UI statt Crash …
  await expect(page.locator(".bookwriter-panel .bw-error")).toContainText(/Fehler:/, {
    timeout: 120_000,
  });
  // … App bleibt bedienbar.
  await expect(page.getByText(/Es liegt ein Fehler in der Anwendung/)).toHaveCount(0);
  await expect(page.locator("#app-sidebar")).toBeVisible();
  await expect(page.locator("#app-ai-panel")).toBeVisible();
});
