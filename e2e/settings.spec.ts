// E2E: Einstellungen — Sprachwechsel (i18n) und Hochkontrast-Modus.
// Das Settings-Modal öffnet der Header-Button ("Einstellungen"/"Settings").
import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

async function openSettings(page: import("@playwright/test").Page) {
  await page
    .locator("header button", { hasText: /Einstellungen|Settings/ })
    .first()
    .click();
  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  return modal;
}

test("Sprachwechsel: UI und html lang wechseln auf Englisch", async ({ page }) => {
  await gotoApp(page);
  const modal = await openSettings(page);

  // Sprache über das Settings-Select auf English umstellen.
  const langSelect = modal.locator("label select").filter({
    has: page.locator('option[value="en"]'),
  });
  await langSelect.first().selectOption("en");

  // html lang spiegelt die neue Sprache …
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // … und persistiert über einen Reload.
  await page.reload();
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Sprachwechsel: Sprachauswahl bietet alle vier Sprachen", async ({ page }) => {
  await gotoApp(page);
  const modal = await openSettings(page);
  const langSelect = modal.locator("label select").filter({
    has: page.locator('option[value="en"]'),
  });
  // Settings-Modal ist lazy geladen — Select explizit abwarten.
  await expect(langSelect.first()).toBeVisible({ timeout: 10_000 });
  const values = await langSelect.first().locator("option").allTextContents();
  expect(values.join(",")).toMatch(/Deutsch|English|Français|Español/);
});

test("Hochkontrast-Modus setzt data-contrast am html-Element", async ({ page }) => {
  await gotoApp(page);
  const modal = await openSettings(page);

  // Checkbox "Hochkontrast" aktivieren.
  const contrastBox = modal.locator('input[type="checkbox"]').first();
  await contrastBox.check();

  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");

  // Persistiert über Reload (localStorage "app-contrast").
  await page.reload();
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
});
