// E2E Runde 2: Updater-Check mit gemocktem Offline-Backend.
// Im Browser gibt es kein Tauri-Backend (invoke scheitert) — genau der
// Offline-Fall: Die Update-Prüfung muss graceful auf Fehler-Status gehen,
// statt zu crashen. Provider-Netz wird zusätzlich abgebrochen.
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

async function goOffline(page: Page): Promise<void> {
  await page.route(
    (url) =>
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port !== "1420",
    (route) => route.abort("connectionrefused"),
  );
}

/**
 * Bekanntes Browser-Rauschen (kein App-Fehler): UpdateCheck abonniert beim
 * Mount Tauri-Events via @tauri-apps/api `listen()` — im reinen Browser (kein
 * Tauri-Backend) wirft das unbehandelt "transformCallback". Präzedenz:
 * smoke.spec.ts filtert analog ERR_CONNECTION_REFUSED. Entscheidend ist, dass
 * KEIN ErrorBoundary erscheint und die UI in den Fehler-Status geht.
 */
function realPageErrors(pageErrors: string[]): string[] {
  return pageErrors.filter((m) => !/transformCallback/i.test(m));
}

async function openUpdateSection(page: Page): Promise<void> {
  await page
    .locator(".header-actions button", { hasText: "Einstellungen" })
    .click();
  await expect(
    page.locator('.update-section[aria-label="App-Updates"]'),
  ).toBeVisible();
}

test("App-Updates-Sektion steht im Idle-Status", async ({ page }) => {
  await pinGerman(page);
  await goOffline(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await gotoApp(page);
  await openUpdateSection(page);

  const check = page.locator(".update-check");
  await expect(check).toBeVisible();
  await expect(check).toHaveAttribute("data-status", "idle");
  await expect(check.locator('[role="status"]')).toBeVisible();
  const real = realPageErrors(pageErrors);
  expect(real, real.join("\n")).toEqual([]);
});

test("Update-Check offline: Fehler-Status statt Crash, App bedienbar", async ({
  page,
}) => {
  await pinGerman(page);
  await goOffline(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await gotoApp(page);
  await openUpdateSection(page);

  const check = page.locator(".update-check");
  // "Nach Updates suchen" — Button im Actions-Bereich.
  await check.locator(".update-check-actions button").first().click();
  await expect(check).toHaveAttribute("data-status", /^(checking|error)$/, {
    timeout: 10_000,
  });
  // Offline-Backend: am Ende steht der Fehler-Status (kein Hängen).
  await expect(check).toHaveAttribute("data-status", "error", {
    timeout: 15_000,
  });
  await expect(check.locator('[role="status"]')).not.toBeEmpty();

  // Kein ErrorBoundary, App bleibt bedienbar.
  await expect(
    page.getByText(/Es liegt ein Fehler in der Anwendung/),
  ).toHaveCount(0);
  const real2 = realPageErrors(pageErrors);
  expect(real2, real2.join("\n")).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#app-sidebar")).toBeVisible();
});
