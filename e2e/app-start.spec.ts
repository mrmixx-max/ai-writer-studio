// E2E: App-Start — Splash verschwindet, App-Gerüst steht, kein Fehler-Dialog.
import { expect, test } from "@playwright/test";

test("App startet und zeigt die Hauptoberfläche", async ({ page }) => {
  await page.goto("/");
  // Header mit App-Name ist sichtbar (t("app.name") im .logo-Element).
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  // Sidebar und Editor-Kontext vorhanden.
  await expect(page.locator("#app-sidebar")).toBeVisible();
  // Kein abgefangener Startfehler (ErrorBoundary-Fallback).
  await expect(page.getByText(/Es liegt ein Fehler in der Anwendung/)).toHaveCount(0);
});

test("I18n: html lang spiegelt eine unterstützte Sprache", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header .logo")).toBeVisible({ timeout: 30_000 });
  // Ohne gespeicherte Präferenz gilt die Browsersprache — in CI-Chromium oft
  // en-US. Entscheidend: der Wert ist immer eine der vier unterstützten.
  await expect(page.locator("html")).toHaveAttribute("lang", /^(de|en|fr|es)$/);
});
