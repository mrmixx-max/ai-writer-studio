// Smoke-Test: App startet, Haupt-UI lädt, keine Console-/Seiten-Fehler.
// Läuft gegen den Vite-Dev-Server (siehe playwright.config.ts, webServer).
import { expect, test } from "@playwright/test";

test("App startet, Haupt-UI lädt, keine Console-Errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Setup-Wizard deterministisch überspringen (willkommene Kernpfad-Smoke-Prüfung).
  await page.addInitScript(() => {
    localStorage.setItem("aiws.setup.completed", "1");
    localStorage.setItem("aiws.setup.version", "1");
  });
  await page.goto("/");

  // Haupt-UI: Header, Sidebar und KI-Panel stehen.
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#app-sidebar")).toBeVisible();
  await expect(page.locator("#app-ai-panel")).toBeVisible();

  // Welcome-Overlay darf den Klickbereich nicht blockieren.
  await expect(page.locator(".welcome-overlay")).toHaveCount(0);

  // Kein ErrorBoundary-Fallback.
  await expect(page.getByText(/Es liegt ein Fehler in der Anwendung/)).toHaveCount(0);

  // Keine unbehandelten Seitenfehler.
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);

  // Keine echten Console-Errors (favicon 404 u. Ä. erlauben wir).
  const real = consoleErrors.filter(
    (e) => !/favicon|DevTools|Failed to load resource.*(404)/i.test(e),
  );
  expect(real, real.join("\n")).toEqual([]);
});
