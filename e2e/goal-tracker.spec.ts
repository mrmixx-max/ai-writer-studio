// E2E Runde 2: Ziel-Tracker (Writing-Analytics) — Tagesziel setzen,
// Fortschrittsbalken rendert, Ziel entfernen (Roundtrip). Echte UI,
// Header-Button "Analytics".
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./helpers";

async function pinGerman(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("app-lang", "de"));
}

async function openAnalytics(page: Page): Promise<void> {
  await page.locator(".header-actions button", { hasText: "Analytics" }).click();
  await expect(page.locator(".analytics-panel")).toBeVisible();
}

test("Tagesziel setzen rendert Fortschritt mit Zielwert", async ({ page }) => {
  await pinGerman(page);
  await gotoApp(page);
  await openAnalytics(page);

  const panel = page.locator(".analytics-panel");
  await panel.locator(".analytics-input").first().fill("500");
  await panel.getByRole("button", { name: "Ziel setzen" }).first().click();

  // Balken rendert (bei 0 Wörtern 0 % Breite → per Count, nicht Visibility).
  await expect(panel.locator(".analytics-progress-bar")).toHaveCount(1);
  await expect(panel).toContainText(/500/);
  await expect(panel).toContainText(/Wörter/);
});

test("Ziel entfernen führt zurück zur Eingabe (Roundtrip)", async ({
  page,
}) => {
  await pinGerman(page);
  await gotoApp(page);
  await openAnalytics(page);

  const panel = page.locator(".analytics-panel");
  // Falls aus vorherigem Lauf ein Ziel persistiert ist, erst entfernen.
  const removeBtn = panel.locator(".analytics-row .analytics-btn", {
    hasText: "✕",
  });
  if (await removeBtn.count().then((c) => c > 0)) {
    await removeBtn.first().click();
  }
  await expect(panel.locator(".analytics-input").first()).toBeVisible();

  await panel.locator(".analytics-input").first().fill("250");
  await panel.getByRole("button", { name: "Ziel setzen" }).first().click();
  await expect(panel.locator(".analytics-progress-bar")).toHaveCount(1);

  await panel
    .locator(".analytics-row .analytics-btn", { hasText: "✕" })
    .first()
    .click();
  await expect(panel.locator(".analytics-input").first()).toBeVisible();
  await expect(panel.locator(".analytics-progress-bar")).toHaveCount(0);
});
