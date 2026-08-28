// E2E: Export — Export-Menü öffnen, Formate + Bereich wählen, PDF-Export
// erzeugt einen Download. Der Datei-Speichern-Dialog läuft in der Desktop-EXE
// über das Tauri-Dialog-Plugin; im Browser greift der Download-Fallback
// (a[download]) — genau den prüfen wir hier.
import { expect, test } from "@playwright/test";
import { createProjectWithChapter, gotoApp } from "./helpers";

test("Export-Menü öffnet sich und bietet Formate", async ({ page }) => {
  await gotoApp(page);

  const toggle = page.locator("button", { hasText: "Export" }).first();
  await toggle.click();
  await expect(page.locator(".export-menu")).toBeVisible();

  // Formate im Select vorhanden.
  const select = page.locator(".export-menu select").first();
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  expect(options.join(",")).toMatch(/DOCX|docx/i);

  // Bereichsauswahl: Kapitel vs. ganzes Projekt.
  const scope = page.locator(".export-menu select").nth(1);
  await scope.selectOption("chapter");
  await expect(scope).toHaveValue("chapter");
});

test("Export als PDF erzeugt einen Download", async ({ page }) => {
  await gotoApp(page);
  await createProjectWithChapter(page);

  const toggle = page.locator("button", { hasText: "Export" }).first();
  await toggle.click();
  await expect(page.locator(".export-menu")).toBeVisible();

  const format = page.locator(".export-menu select").first();
  await format.selectOption("pdf");
  await expect(format).toHaveValue("pdf");

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  // PDF/DOCX/EPUB zeigen zuerst den Preflight — erst der zweite Klick exportiert.
  await page.locator(".export-menu .export-go").first().click();
  const goAgain = page.locator(".export-menu .export-go").first();
  if (await goAgain.isVisible().catch(() => false)) {
    await goAgain.click();
  }
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
});
